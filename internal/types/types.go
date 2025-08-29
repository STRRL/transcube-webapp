package types

import "time"

// TaskStatus represents the current state of a transcription task
type TaskStatus string

const (
	TaskStatusPending      TaskStatus = "pending"
	TaskStatusDownloading  TaskStatus = "downloading"
	TaskStatusTranscribing TaskStatus = "transcribing"
	TaskStatusTranslating  TaskStatus = "translating"
	TaskStatusSummarizing  TaskStatus = "summarizing"
	TaskStatusDone         TaskStatus = "done"
	TaskStatusFailed       TaskStatus = "failed"
)

// Task represents a video processing task
type Task struct {
	ID          string     `json:"id"`
	URL         string     `json:"url"`
	VideoID     string     `json:"videoId"`
	Title       string     `json:"title"`
	Channel     string     `json:"channel"`
	Duration    string     `json:"duration"`
	Thumbnail   string     `json:"thumbnail"`
	SourceLang  string     `json:"sourceLang"`
	Status      TaskStatus `json:"status"`
	Progress    int        `json:"progress"`
	Error       string     `json:"error,omitempty"`
	WorkDir     string     `json:"workDir"`
	CreatedAt   time.Time  `json:"createdAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`
	CompletedAt *time.Time `json:"completedAt,omitempty"`
}

// VideoMetadata contains information about a YouTube video
type VideoMetadata struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Channel     string    `json:"channel"`
	Duration    int       `json:"duration"` // in seconds
	PublishedAt time.Time `json:"publishedAt"`
	Thumbnail   string    `json:"thumbnail"`
}

// Subtitle represents a subtitle entry
type Subtitle struct {
	Index int    `json:"index"`
	Start string `json:"start"`
	End   string `json:"end"`
	Text  string `json:"text"`
}

// Summary represents video summary data
type Summary struct {
	Type    string      `json:"type"` // "structured" or "qa"
	Content interface{} `json:"content"`
}

// StructuredSummary contains key points and conclusions
type StructuredSummary struct {
	KeyPoints  []string `json:"keyPoints"`
	MainTopic  string   `json:"mainTopic"`
	Conclusion string   `json:"conclusion"`
	Tags       []string `json:"tags"`
}

// QASummary contains question-answer pairs
type QASummary struct {
	Questions []QAPair `json:"questions"`
}

type QAPair struct {
	Question string `json:"question"`
	Answer   string `json:"answer"`
}

// DependencyStatus shows which dependencies are installed
type DependencyStatus struct {
	YtDlp  bool `json:"ytdlp"`
	FFmpeg bool `json:"ffmpeg"`
	Yap    bool `json:"yap"`
}

// Settings represents user configuration
type Settings struct {
	Workspace      string `json:"workspace"`
	SourceLang     string `json:"sourceLang"`
	APIProvider    string `json:"apiProvider"` // "gemini" or "openai"
	APIKey         string `json:"apiKey"`
	SummaryLength  string `json:"summaryLength"` // "short", "medium", "long"
	Temperature    float64 `json:"temperature"`
	MaxTokens      int    `json:"maxTokens"`
}