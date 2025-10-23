package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

type OpenRouterClient struct {
	httpClient *http.Client
}

func NewOpenRouterClient() *OpenRouterClient {
	return &OpenRouterClient{
		httpClient: &http.Client{Timeout: 60 * time.Second},
	}
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatReq struct {
	Model          string          `json:"model"`
	Messages       []chatMessage   `json:"messages"`
	MaxTokens      int             `json:"max_tokens,omitempty"`
	Temperature    float64         `json:"temperature,omitempty"`
	ResponseFormat *responseFormat `json:"response_format,omitempty"`
}

type responseFormat struct {
	Type       string      `json:"type"`
	JSONSchema *jsonSchema `json:"json_schema,omitempty"`
}

type jsonSchema struct {
	Name   string                 `json:"name"`
	Schema map[string]interface{} `json:"schema"`
	Strict bool                   `json:"strict"`
}

// SummarizeStructured calls OpenRouter with Gemini 2.5 Flash to produce a structured JSON summary
func (c *OpenRouterClient) SummarizeStructured(ctx context.Context, apiKey string, transcript string, length string, language string, temperature float64, maxTokens int) ([]byte, error) {
	if apiKey == "" {
		apiKey = os.Getenv("OPENROUTER_API_KEY")
	}
	if apiKey == "" {
		return nil, fmt.Errorf("missing OpenRouter API key")
	}

	// Clamp/Defaults
	if temperature <= 0 {
		temperature = 0.3
	}
	if maxTokens <= 0 {
		maxTokens = 2048
	}
	if length == "" {
		length = "medium"
	}
	if language == "" {
		language = "en"
	}

	// Map language codes to full names
	languageMap := map[string]string{
		"en": "English",
		"zh": "Chinese",
		"ja": "Japanese",
		"ko": "Korean",
		"es": "Spanish",
		"fr": "French",
		"de": "German",
		"ru": "Russian",
		"pt": "Portuguese",
		"it": "Italian",
	}

	langName := languageMap[language]
	if langName == "" {
		langName = "English"
	}

	// Build system / user prompts (content requirements still help quality)
	system := "You are a precise assistant that summarizes transcripts."
	user := fmt.Sprintf("Summarize the transcript. Length: %s. Use %s for all text in the summary. Return the object requested by the schema.", length, langName)

	// Define a strict JSON schema to enforce structured output
	schema := map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"type": map[string]interface{}{
				"type": "string",
				"enum": []string{"structured"},
			},
			"content": map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"keyPoints": map[string]interface{}{
						"type":  "array",
						"items": map[string]interface{}{"type": "string"},
					},
					"mainTopic":  map[string]interface{}{"type": "string"},
					"conclusion": map[string]interface{}{"type": "string"},
					"tags": map[string]interface{}{
						"type":  "array",
						"items": map[string]interface{}{"type": "string"},
					},
				},
				"required":             []string{"keyPoints", "mainTopic", "conclusion", "tags"},
				"additionalProperties": false,
			},
		},
		"required":             []string{"type", "content"},
		"additionalProperties": false,
	}

	reqBody := chatReq{
		Model: "google/gemini-2.5-flash",
		Messages: []chatMessage{
			{Role: "system", Content: system},
			{Role: "user", Content: user + "\n\nTranscript:\n" + transcript},
		},
		MaxTokens:   maxTokens,
		Temperature: temperature,
		ResponseFormat: &responseFormat{
			Type: "json_schema",
			JSONSchema: &jsonSchema{
				Name:   "StructuredSummary",
				Schema: schema,
				Strict: true,
			},
		},
	}

	data, _ := json.Marshal(reqBody)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://openrouter.ai/api/v1/chat/completions", bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)
	// OpenRouter recommends identifying apps
	req.Header.Set("HTTP-Referer", "https://github.com/strrl/transcube-webapp")
	req.Header.Set("X-Title", "TransCube")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("openrouter error: %s: %s", resp.Status, string(b))
	}

	// Minimal parse of the OpenAI-compatible response
	var parsed struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	b, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(b, &parsed); err != nil {
		return nil, fmt.Errorf("failed to parse OpenRouter response: %v", err)
	}
	if len(parsed.Choices) == 0 || parsed.Choices[0].Message.Content == "" {
		return nil, fmt.Errorf("empty summary response")
	}
	// The model is instructed to return a valid JSON object that matches the schema
	return []byte(parsed.Choices[0].Message.Content), nil
}

// GeneratePostArticle creates a long-form Chinese article using the supplied creative brief and transcript
func (c *OpenRouterClient) GeneratePostArticle(ctx context.Context, apiKey string, transcript string, videoTitle string, creatorName string, videoURL string, temperature float64, maxTokens int) ([]byte, error) {
	if apiKey == "" {
		apiKey = os.Getenv("OPENROUTER_API_KEY")
	}
	if apiKey == "" {
		return nil, fmt.Errorf("missing OpenRouter API key")
	}

	if temperature <= 0 {
		temperature = 0.7
	}
	if maxTokens <= 0 {
		maxTokens = 6144
	}

	title := strings.TrimSpace(videoTitle)
	if title == "" {
		title = "Untitled Video"
	}
	creator := strings.TrimSpace(creatorName)
	if creator == "" {
		creator = "Unknown Creator"
	}
	link := strings.TrimSpace(videoURL)
	if link == "" {
		link = "https://youtube.com"
	}

	normalizedTranscript := strings.ReplaceAll(transcript, "\r\n", "\n")

	systemPrompt := `You are a top-tier long-form content creator and thought interpreter. Your craft turns any complex source into an architecturally sound, elegantly written, intellectually provocative Chinese essay. You do not list information—you illuminate ideas. Your prose must invite contemplation beyond simple comprehension.

Fully internalise every detail I provide, then craft an entirely original article in your own narrative voice. The output must be written in fluent Chinese, yet the creative brief you follow is written here in English.

Core creative principles:
1. Rebuild the ideas, never transcribe the wording. Absorb the source, rediscover its essence, and present it with fresh, insightful structure.
2. Treat titles as the soul of the essay. Craft an arresting master headline (optionally with a subtitle) and unique, compelling titles for every logical section. Avoid template labels such as “引言”, “正文”, or “总结”.
3. Let narrative drive everything. Even when explaining frameworks or sequences, rely on flowing paragraphs, graceful transitions, and cause-and-effect reasoning instead of bullet lists.

Production flow and delivery requirements:
Step 1 — Foundation and master title
- After understanding the full transcript, conceive a headline that captures the core thesis instantly.
- Include the following metadata at either the beginning or the end of the article using the exact labels provided later in this brief.

Step 2 — Opening movement
- Title: ignite curiosity or highlight the core tension.
- Content: open with a vivid scene, paradox, or problem that leads naturally into the big question the article tackles. Signal the unique value of reading on.

Step 3 — Core exploration (2–4 sections)
- Title: for each section, supply a concise, insightful micro-headline.
- Content: expand each theme with rich analysis, analogies, and probing questions. Integrate any step-by-step logic into narrative paragraphs that explain both the “what” and the “why”. Ensure seamless transitions between sections.

Step 4 — Elevation
- Title: name the distilled framework, mental model, or foundational logic you derive.
- Content: abstract the most universal insight from the story. Explain its components, mechanics, and philosophy, then describe how readers can apply it.

Step 5 — Resonant finale
- Title: deliver a philosophically charged or forward-looking closing.
- Content: rekindle the core thesis with a concise revelation, extend the insight to a broader arena, or leave the reader with a worthy open question.

Stylistic constraints:
- Write entirely in Chinese prose. Paragraphs only; avoid bullet points unless absolutely unavoidable for clarity.
- Speak with confident authority as an independent thinker. Do not reference any video, transcript, or instructions.
- Preserve proper nouns; on first mention provide the Chinese translation in parentheses if applicable.
- Deliver nothing but the finished article.
- Reproduce the metadata block using the exact label wording shared below.`

	metaDirective := fmt.Sprintf("Source of Inspiration: %s\nOriginal Video: %s", creator, link)
	userPrompt := fmt.Sprintf("Video Title: %s\nCreator Name: %s\nOriginal Video Link: %s\n\nInternalise all of the above, then write a long-form Chinese article that satisfies every element of the creative brief supplied in the system message. At the end of the article, append the metadata block exactly as shown here:\n%s\n\nFull transcript follows:\n%s", title, creator, link, metaDirective, normalizedTranscript)

	reqBody := chatReq{
		Model:       "google/gemini-2.5-flash",
		Messages:    []chatMessage{{Role: "system", Content: systemPrompt}, {Role: "user", Content: userPrompt}},
		MaxTokens:   maxTokens,
		Temperature: temperature,
	}

	data, _ := json.Marshal(reqBody)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://openrouter.ai/api/v1/chat/completions", bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("HTTP-Referer", "https://github.com/strrl/transcube-webapp")
	req.Header.Set("X-Title", "TransCube")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("openrouter error: %s: %s", resp.Status, string(b))
	}

	var parsed struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	b, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(b, &parsed); err != nil {
		return nil, fmt.Errorf("failed to parse OpenRouter response: %v", err)
	}
	if len(parsed.Choices) == 0 || strings.TrimSpace(parsed.Choices[0].Message.Content) == "" {
		return nil, fmt.Errorf("empty post response")
	}

	return []byte(parsed.Choices[0].Message.Content), nil
}
