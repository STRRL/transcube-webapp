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

export const processedVideos: ProcessedVideo[] = [
  {
    id: 'task-001',
    videoId: 'TgQdgIvBOCo',
    title: 'Bring advanced speech-to-text to your app with SpeechAnalyzer',
    channel: 'WWDC25',
    description: 'Discover the new SpeechAnalyzer API for speech to text. We\'ll learn about the Swift API and its capabilities, which power features in Notes, Voice Memos, Journal, and more. We\'ll dive into details about how speech to text works and how SpeechAnalyzer and SpeechTranscriber can enable you to create exciting, performant features. And you\'ll learn how to incorporate SpeechAnalyzer and live transcription into your app with a code-along.',
    duration: '19min',
    thumbnail: 'https://i.ytimg.com/vi/TgQdgIvBOCo/maxresdefault.jpg',
    processedAt: '2025-08-25T10:30:00Z',
    fileSize: '145 MB',
    sourceLang: 'en',
    hasTranscript: true,
    hasTranslation: true,
    hasSummary: true,
    chapters: [
      { timestamp: '00:00', title: 'Introduction' },
      { timestamp: '02:41', title: 'SpeechAnalyzer API' },
      { timestamp: '07:03', title: 'SpeechTranscriber model' },
      { timestamp: '09:06', title: 'Build a speech-to-text feature' }
    ],
    tags: ['Speech Recognition', 'API', 'Swift', 'WWDC25']
  },
  {
    id: 'task-002',
    videoId: 'FLNfZqjVGKc',
    title: 'WWDC25 Platforms State of the Union',
    channel: 'WWDC25',
    description: 'Discover the newest advancements on Apple platforms. Get an overview of the latest tools, technologies, and frameworks revealed at WWDC25.',
    duration: '1h 45min',
    thumbnail: 'https://i.ytimg.com/vi/FLNfZqjVGKc/maxresdefault.jpg',
    processedAt: '2025-08-24T14:20:00Z',
    fileSize: '892 MB',
    sourceLang: 'en',
    hasTranscript: true,
    hasTranslation: true,
    hasSummary: true,
    chapters: [
      { timestamp: '00:00', title: 'Opening' },
      { timestamp: '05:12', title: 'iOS 19 Features' },
      { timestamp: '15:30', title: 'macOS Updates' },
      { timestamp: '28:45', title: 'Swift 6' },
      { timestamp: '42:00', title: 'Xcode 16' },
      { timestamp: '58:30', title: 'Machine Learning' },
      { timestamp: '1:15:00', title: 'Privacy & Security' },
      { timestamp: '1:30:00', title: 'Developer Tools' }
    ],
    tags: ['WWDC', 'Platforms', 'iOS', 'macOS', 'Swift']
  },
  {
    id: 'task-003',
    videoId: 'vM5OIj3OXZM',
    title: 'Bring Swift Charts to the third dimension',
    channel: 'WWDC25',
    description: 'Learn how to render 3D charts with Swift Charts and make your data visualizations stand out.',
    duration: '11min',
    thumbnail: 'https://i.ytimg.com/vi/vM5OIj3OXZM/maxresdefault.jpg',
    processedAt: '2025-08-24T09:15:00Z',
    fileSize: '98 MB',
    sourceLang: 'en',
    hasTranscript: true,
    hasTranslation: true,
    hasSummary: true,
    tags: ['Swift Charts', 'Data Visualization', '3D Graphics']
  },
  {
    id: 'task-004',
    videoId: 'va8f7YXG6Qo',
    title: 'Better together: SwiftUI and RealityKit',
    channel: 'WWDC25',
    description: 'Discover how SwiftUI and RealityKit work together to help you build immersive spatial experiences.',
    duration: '30min',
    thumbnail: 'https://i.ytimg.com/vi/va8f7YXG6Qo/maxresdefault.jpg',
    processedAt: '2025-08-23T16:45:00Z',
    fileSize: '267 MB',
    sourceLang: 'en',
    hasTranscript: true,
    hasTranslation: false,
    hasSummary: true,
    tags: ['SwiftUI', 'RealityKit', 'Spatial Computing', 'AR/VR']
  },
  {
    id: 'task-005',
    videoId: 'pjsFvjJW7mU',
    title: 'Build a SwiftUI app with the new design system',
    channel: 'WWDC25',
    description: 'Learn to create beautiful, consistent apps using the latest SwiftUI design system enhancements.',
    duration: '22min',
    thumbnail: 'https://i.ytimg.com/vi/pjsFvjJW7mU/maxresdefault.jpg',
    processedAt: '2025-08-23T11:30:00Z',
    fileSize: '189 MB',
    sourceLang: 'en',
    hasTranscript: true,
    hasTranslation: true,
    hasSummary: true,
    tags: ['SwiftUI', 'Design System', 'UI/UX']
  },
  {
    id: 'task-006',
    videoId: '1Zv8NRN-YNI',
    title: 'Code-along: Bring on-device AI to your app',
    channel: 'WWDC25',
    description: 'Add powerful on-device machine learning capabilities to your applications using the Foundation framework.',
    duration: '31min',
    thumbnail: 'https://i.ytimg.com/vi/1Zv8NRN-YNI/maxresdefault.jpg',
    processedAt: '2025-08-22T13:00:00Z',
    fileSize: '278 MB',
    sourceLang: 'en',
    hasTranscript: true,
    hasTranslation: true,
    hasSummary: true,
    tags: ['Machine Learning', 'AI', 'Foundation Framework', 'Code-along']
  }
]

export function getProcessedVideo(id: string): ProcessedVideo | undefined {
  return processedVideos.find(v => v.id === id)
}