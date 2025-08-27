import type { TaskStatus, Subtitle, Summary, DependencyStatus, Settings, VideoMetadata, StructuredSummary, QASummary } from '@/types'

export class MockService {
  private currentTask: TaskStatus | null = null
  private taskInterval: ReturnType<typeof setInterval> | null = null

  async checkDependencies(): Promise<DependencyStatus> {
    await this.delay(500)
    return {
      ytdlp: true,
      ffmpeg: true,
      yap: Math.random() > 0.2
    }
  }

  async getSettings(): Promise<Settings> {
    await this.delay(200)
    return {
      workspace: '~/Downloads/TransCube',
      sourceLang: 'en',
      apiProvider: 'gemini',
      apiKey: 'sk-xxxxxxxxxxxxxxxxxxxxxx',
      summaryLength: 'medium',
      temperature: 0.3,
      maxTokens: 4096
    }
  }

  async updateSettings(settings: Partial<Settings>): Promise<Settings> {
    await this.delay(300)
    const current = await this.getSettings()
    return { ...current, ...settings }
  }

  async parseVideoUrl(url: string): Promise<VideoMetadata> {
    await this.delay(800)
    
    const videoId = this.extractVideoId(url) || 'dQw4w9WgXcQ'
    
    return {
      id: videoId,
      title: 'Building a Modern Web Application with React and TypeScript',
      channel: 'Tech Education Channel',
      duration: 3600,
      publishedAt: '2024-01-15T10:00:00Z',
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
    }
  }

  async startTranscription(url: string, sourceLang: string): Promise<TaskStatus> {
    const metadata = await this.parseVideoUrl(url)
    
    this.currentTask = {
      id: Date.now().toString(),
      url,
      title: metadata.title,
      channel: metadata.channel,
      videoId: metadata.id,
      sourceLang,
      status: 'pending',
      progress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    this.simulateTaskProgress()
    
    return this.currentTask
  }

  async getCurrentTask(): Promise<TaskStatus | null> {
    return this.currentTask
  }

  async retryTask(taskId: string): Promise<TaskStatus> {
    if (this.currentTask && this.currentTask.id === taskId) {
      this.currentTask.status = 'pending'
      this.currentTask.progress = 0
      this.currentTask.error = undefined
      this.simulateTaskProgress()
      return this.currentTask
    }
    throw new Error('Task not found')
  }

  async getSubtitles(taskId: string, lang: 'en' | 'zh' | 'bilingual'): Promise<Subtitle[]> {
    await this.delay(500)
    
    const mockSubtitles: Record<string, Subtitle[]> = {
      en: [
        { index: 1, start: '00:00:00,000', end: '00:00:05,000', text: 'Welcome to this comprehensive tutorial on building modern web applications.' },
        { index: 2, start: '00:00:05,000', end: '00:00:10,000', text: 'Today we will explore React, TypeScript, and best practices for scalable architecture.' },
        { index: 3, start: '00:00:10,000', end: '00:00:15,000', text: 'First, let us understand the core concepts and why they matter for your projects.' },
        { index: 4, start: '00:00:15,000', end: '00:00:20,000', text: 'React provides a component-based architecture that makes UI development more maintainable.' },
        { index: 5, start: '00:00:20,000', end: '00:00:25,000', text: 'TypeScript adds static typing to JavaScript, catching errors during development.' }
      ],
      zh: [
        { index: 1, start: '00:00:00,000', end: '00:00:05,000', text: '欢迎来到这个关于构建现代网络应用的综合教程。' },
        { index: 2, start: '00:00:05,000', end: '00:00:10,000', text: '今天我们将探索React、TypeScript和可扩展架构的最佳实践。' },
        { index: 3, start: '00:00:10,000', end: '00:00:15,000', text: '首先，让我们了解核心概念以及它们对您的项目的重要性。' },
        { index: 4, start: '00:00:15,000', end: '00:00:20,000', text: 'React提供了基于组件的架构，使UI开发更易维护。' },
        { index: 5, start: '00:00:20,000', end: '00:00:25,000', text: 'TypeScript为JavaScript添加了静态类型，在开发期间捕获错误。' }
      ],
      bilingual: [
        { index: 1, start: '00:00:00,000', end: '00:00:05,000', text: 'Welcome to this comprehensive tutorial on building modern web applications.\n欢迎来到这个关于构建现代网络应用的综合教程。' },
        { index: 2, start: '00:00:05,000', end: '00:00:10,000', text: 'Today we will explore React, TypeScript, and best practices for scalable architecture.\n今天我们将探索React、TypeScript和可扩展架构的最佳实践。' },
        { index: 3, start: '00:00:10,000', end: '00:00:15,000', text: 'First, let us understand the core concepts and why they matter for your projects.\n首先，让我们了解核心概念以及它们对您的项目的重要性。' },
        { index: 4, start: '00:00:15,000', end: '00:00:20,000', text: 'React provides a component-based architecture that makes UI development more maintainable.\nReact提供了基于组件的架构，使UI开发更易维护。' },
        { index: 5, start: '00:00:20,000', end: '00:00:25,000', text: 'TypeScript adds static typing to JavaScript, catching errors during development.\nTypeScript为JavaScript添加了静态类型，在开发期间捕获错误。' }
      ]
    }
    
    return mockSubtitles[lang] || mockSubtitles.en
  }

  async getSummary(taskId: string, type: 'structured' | 'qa'): Promise<Summary> {
    await this.delay(500)
    
    if (type === 'structured') {
      const structured: StructuredSummary = {
        keyPoints: [
          'React provides component-based architecture for building user interfaces',
          'TypeScript adds static typing to catch errors during development',
          'Modern tooling like Vite improves development experience',
          'Best practices include code splitting and lazy loading',
          'Testing is crucial for maintaining code quality'
        ],
        mainTopic: 'Building scalable web applications with React and TypeScript',
        conclusion: 'The combination of React and TypeScript provides a robust foundation for building maintainable and scalable web applications.',
        tags: ['React', 'TypeScript', 'Web Development', 'Frontend', 'JavaScript']
      }
      return { type: 'structured', content: structured }
    } else {
      const qa: QASummary = {
        questions: [
          {
            question: 'What is the main topic of this video?',
            answer: 'The video covers building modern web applications using React and TypeScript, focusing on best practices and scalable architecture.'
          },
          {
            question: 'What are the key benefits of using TypeScript?',
            answer: 'TypeScript adds static typing to JavaScript, helping catch errors during development and providing better IDE support with autocomplete and refactoring tools.'
          },
          {
            question: 'Why is React popular for UI development?',
            answer: 'React offers a component-based architecture that makes UI development more maintainable, along with a virtual DOM for efficient updates and a large ecosystem.'
          },
          {
            question: 'What are the recommended best practices?',
            answer: 'The video recommends code splitting, lazy loading, proper testing strategies, and following established patterns for state management and component structure.'
          }
        ]
      }
      return { type: 'qa', content: qa }
    }
  }

  async exportLogs(taskId: string): Promise<Blob> {
    await this.delay(1000)
    const logContent = `TransCube Task Logs
Task ID: ${taskId}
Date: ${new Date().toISOString()}

[2024-01-15 10:00:00] Starting download...
[2024-01-15 10:00:05] Audio downloaded successfully
[2024-01-15 10:00:10] Checking for official subtitles...
[2024-01-15 10:00:12] No official subtitles found, using yap for transcription
[2024-01-15 10:00:15] Starting transcription...
[2024-01-15 10:01:00] Transcription completed
[2024-01-15 10:01:05] Starting translation...
[2024-01-15 10:01:30] Translation completed
[2024-01-15 10:01:35] Generating summary...
[2024-01-15 10:01:45] Summary generated
[2024-01-15 10:01:50] Task completed successfully`
    
    return new Blob([logContent], { type: 'text/plain' })
  }

  private simulateTaskProgress() {
    if (this.taskInterval) {
      clearInterval(this.taskInterval)
    }

    const stages: TaskStatus['status'][] = ['downloading', 'transcribing', 'translating', 'summarizing', 'done']
    let stageIndex = 0
    let progress = 0

    this.taskInterval = setInterval(() => {
      if (!this.currentTask || this.currentTask.status === 'done' || this.currentTask.status === 'failed') {
        if (this.taskInterval) clearInterval(this.taskInterval)
        return
      }

      progress += Math.random() * 15
      
      if (progress >= 100) {
        stageIndex++
        progress = stageIndex * 20
        
        if (stageIndex >= stages.length) {
          this.currentTask.status = 'done'
          this.currentTask.progress = 100
          if (this.taskInterval) clearInterval(this.taskInterval)
        } else {
          this.currentTask.status = stages[stageIndex]
        }
      }

      if (Math.random() > 0.95 && stageIndex > 0) {
        this.currentTask.status = 'failed'
        this.currentTask.error = 'Network timeout during processing'
        if (this.taskInterval) clearInterval(this.taskInterval)
      }

      this.currentTask.progress = Math.min(progress, 100)
      this.currentTask.updatedAt = new Date().toISOString()
    }, 1000)
  }

  private extractVideoId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /^([^&\n?#]+)$/
    ]
    
    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) return match[1]
    }
    
    return null
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}