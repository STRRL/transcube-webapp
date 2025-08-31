package services

import (
    "bytes"
    "context"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "os"
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
    Model    string        `json:"model"`
    Messages []chatMessage `json:"messages"`
    MaxTokens int          `json:"max_tokens,omitempty"`
    Temperature float64    `json:"temperature,omitempty"`
    ResponseFormat *responseFormat `json:"response_format,omitempty"`
}

type responseFormat struct {
    Type       string        `json:"type"`
    JSONSchema *jsonSchema   `json:"json_schema,omitempty"`
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
                        "type": "array",
                        "items": map[string]interface{}{"type": "string"},
                    },
                    "mainTopic": map[string]interface{}{"type": "string"},
                    "conclusion": map[string]interface{}{"type": "string"},
                    "tags": map[string]interface{}{
                        "type": "array",
                        "items": map[string]interface{}{"type": "string"},
                    },
                },
                "required": []string{"keyPoints", "mainTopic", "conclusion", "tags"},
                "additionalProperties": false,
            },
        },
        "required": []string{"type", "content"},
        "additionalProperties": false,
    }

    reqBody := chatReq{
        Model: "google/gemini-2.5-flash",
        Messages: []chatMessage{
            {Role: "system", Content: system},
            {Role: "user", Content: user + "\n\nTranscript:\n" + transcript},
        },
        MaxTokens: maxTokens,
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
    req.Header.Set("HTTP-Referer", "https://transcube.local")
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
        Choices []struct{
            Message struct{ Content string `json:"content"` } `json:"message"`
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
