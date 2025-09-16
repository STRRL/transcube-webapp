export interface TaskStatus {
  id: string
  url: string
  title: string
  channel: string
  videoId: string
  sourceLang: string
  status: 'pending' | 'downloading' | 'transcribing' | 'translating' | 'summarizing' | 'done' | 'failed'
  progress: number
  error?: string
  createdAt: string
  updatedAt: string
}

export interface Subtitle {
  index: number
  start: string
  end: string
  text: string
}

export interface Summary {
  type: 'structured' | 'qa'
  content: StructuredSummary | QASummary
}

export interface StructuredSummary {
  keyPoints: string[]
  mainTopic: string
  conclusion: string
  tags: string[]
}

export interface QASummary {
  questions: Array<{
    question: string
    answer: string
  }>
}

export interface DependencyStatus {
  ytdlp: boolean
  ffmpeg: boolean
  yap: boolean
}

export interface Settings {
  workspace: string
  sourceLang: string
  apiProvider: 'gemini' | 'openai'
  apiKey: string
  summaryLength: 'short' | 'medium' | 'long'
  temperature: number
  maxTokens: number
}

export interface VideoMetadata {
  id: string
  title: string
  channel: string
  channelId?: string
  duration: number
  publishedAt?: string
  thumbnail: string
  viewCount?: number
  likeCount?: number
  description?: string
}
