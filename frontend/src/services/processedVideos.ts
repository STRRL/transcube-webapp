export interface ProcessedVideo {
  id: string
  videoId: string
  title: string
  channel: string
  description: string
  duration: string
  thumbnail: string
  processedAt: string
  fileSize: string
  sourceLang: string
  hasTranscript: boolean
  hasTranslation: boolean
  hasSummary: boolean
  chapters?: Chapter[]
  tags: string[]
}

export interface Chapter {
  timestamp: string
  title: string
}

export const processedVideos: ProcessedVideo[] = []

export function getProcessedVideo(id: string): ProcessedVideo | undefined {
  return processedVideos.find(v => v.id === id)
}