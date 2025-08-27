export interface VideoItem {
  id: string
  title: string
  channel: string
  duration: string
  thumbnail: string
  publishedAt: string
  views: string
  category: string
  description: string
}

export interface RecentTask {
  id: string
  videoId: string
  title: string
  channel: string
  thumbnail: string
  status: 'completed' | 'processing' | 'failed'
  progress: number
  completedAt?: string
  duration: string
}

export const featuredVideos: VideoItem[] = [
  {
    id: 'dQw4w9WgXcQ',
    title: 'WWDC25 Platforms State of the Union Recap',
    channel: 'Apple Developer',
    duration: '3min',
    thumbnail: 'https://i.ytimg.com/vi/FLNfZqjVGKc/maxresdefault.jpg',
    publishedAt: '2025-06-10',
    views: '1.2M views',
    category: 'WWDC25',
    description: 'Get an overview of the latest tools, technologies, and advances across Apple platforms.'
  },
  {
    id: 'abc123',
    title: 'Automate your development process with the App Store Connect API',
    channel: 'Apple Developer',
    duration: '17min',
    thumbnail: 'https://i.ytimg.com/vi/vBLD5N5z7Dg/maxresdefault.jpg',
    publishedAt: '2025-06-08',
    views: '856K views',
    category: 'WWDC25',
    description: 'Learn how to leverage the App Store Connect API to streamline your app submission and management workflow.'
  },
  {
    id: 'xyz789',
    title: 'Better together: SwiftUI and RealityKit',
    channel: 'Apple Developer',
    duration: '30min',
    thumbnail: 'https://i.ytimg.com/vi/va8f7YXG6Qo/maxresdefault.jpg',
    publishedAt: '2025-06-07',
    views: '723K views',
    category: 'WWDC25',
    description: 'Discover how SwiftUI and RealityKit work together to create immersive spatial experiences.'
  }
]

export const popularVideos: VideoItem[] = [
  {
    id: 'speech123',
    title: 'Bring advanced speech-to-text to your app with SpeechAnalyzer',
    channel: 'Apple Developer',
    duration: '19min',
    thumbnail: 'https://i.ytimg.com/vi/TgQdgIvBOCo/maxresdefault.jpg',
    publishedAt: '2025-06-05',
    views: '543K views',
    category: 'WWDC25',
    description: 'Learn about the Swift API and its capabilities for speech to text transcription.'
  },
  {
    id: 'swift456',
    title: 'Bring Swift Charts to the third dimension',
    channel: 'Apple Developer',
    duration: '11min',
    thumbnail: 'https://i.ytimg.com/vi/vM5OIj3OXZM/maxresdefault.jpg',
    publishedAt: '2025-06-04',
    views: '412K views',
    category: 'WWDC25',
    description: 'Add depth and dimension to your data visualizations with Swift Charts 3D capabilities.'
  },
  {
    id: 'scene789',
    title: 'Bring your SceneKit project to RealityKit',
    channel: 'Apple Developer',
    duration: '28min',
    thumbnail: 'https://i.ytimg.com/vi/3G6ELlQCVe0/maxresdefault.jpg',
    publishedAt: '2025-06-03',
    views: '387K views',
    category: 'WWDC25',
    description: 'Transition your existing SceneKit projects to leverage the power of RealityKit.'
  }
]

export const recentVideos: VideoItem[] = [
  {
    id: 'swiftui123',
    title: 'Build a SwiftUI app with the new design system',
    channel: 'Apple Developer',
    duration: '22min',
    thumbnail: 'https://i.ytimg.com/vi/pjsFvjJW7mU/maxresdefault.jpg',
    publishedAt: '2025-06-02',
    views: '298K views',
    category: 'WWDC25',
    description: 'Create beautiful, consistent apps using the latest SwiftUI design system.'
  },
  {
    id: 'uikit456',
    title: 'Build a UIKit app with the new design system',
    channel: 'Apple Developer',
    duration: '23min',
    thumbnail: 'https://i.ytimg.com/vi/R9K0WlrUBqg/maxresdefault.jpg',
    publishedAt: '2025-06-01',
    views: '267K views',
    category: 'WWDC25',
    description: 'Modernize your UIKit apps with the new design system features.'
  },
  {
    id: 'appkit789',
    title: 'Build an AppKit app with the new design system',
    channel: 'Apple Developer',
    duration: '18min',
    thumbnail: 'https://i.ytimg.com/vi/tCfKfRMkC5I/maxresdefault.jpg',
    publishedAt: '2025-05-31',
    views: '198K views',
    category: 'WWDC25',
    description: 'Enhance your Mac apps with the latest AppKit design improvements.'
  },
  {
    id: 'camera123',
    title: 'Capture cinematic video in your app',
    channel: 'Apple Developer',
    duration: '12min',
    thumbnail: 'https://i.ytimg.com/vi/ajYQVDaKz-A/maxresdefault.jpg',
    publishedAt: '2025-05-30',
    views: '456K views',
    category: 'WWDC25',
    description: 'Implement professional video capture features using the latest camera APIs.'
  },
  {
    id: 'ai456',
    title: 'Code-along: Bring on-device AI to your app using the Foundation framework',
    channel: 'Apple Developer',
    duration: '31min',
    thumbnail: 'https://i.ytimg.com/vi/1Zv8NRN-YNI/maxresdefault.jpg',
    publishedAt: '2025-05-29',
    views: '567K views',
    category: 'WWDC25',
    description: 'Add powerful on-device machine learning capabilities to your applications.'
  },
  {
    id: 'text789',
    title: 'Code-along: Cook up a rich text experience in SwiftUI with TextKit',
    channel: 'Apple Developer',
    duration: '35min',
    thumbnail: 'https://i.ytimg.com/vi/JG92eLPpRR8/maxresdefault.jpg',
    publishedAt: '2025-05-28',
    views: '234K views',
    category: 'WWDC25',
    description: 'Create advanced text editing experiences combining SwiftUI and TextKit.'
  }
]

export const recentTasks: RecentTask[] = [
  {
    id: 'task1',
    videoId: 'speech123',
    title: 'Bring advanced speech-to-text to your app',
    channel: 'Apple Developer',
    thumbnail: 'https://i.ytimg.com/vi/TgQdgIvBOCo/maxresdefault.jpg',
    status: 'completed',
    progress: 100,
    completedAt: '2025-08-26T05:30:00Z',
    duration: '19min'
  },
  {
    id: 'task2',
    videoId: 'swift456',
    title: 'Bring Swift Charts to the third dimension',
    channel: 'Apple Developer',
    thumbnail: 'https://i.ytimg.com/vi/vM5OIj3OXZM/maxresdefault.jpg',
    status: 'processing',
    progress: 65,
    duration: '11min'
  },
  {
    id: 'task3',
    videoId: 'swiftui123',
    title: 'Build a SwiftUI app with the new design',
    channel: 'Apple Developer', 
    thumbnail: 'https://i.ytimg.com/vi/pjsFvjJW7mU/maxresdefault.jpg',
    status: 'completed',
    progress: 100,
    completedAt: '2025-08-26T04:15:00Z',
    duration: '22min'
  }
]

export const categories = [
  { id: 'all', name: 'All Videos', count: 245 },
  { id: 'wwdc25', name: 'WWDC25', count: 156 },
  { id: 'swiftui', name: 'SwiftUI & UI', count: 42 },
  { id: 'ml', name: 'Machine Learning & AI', count: 28 },
  { id: 'spatial', name: 'Spatial Computing', count: 19 }
]