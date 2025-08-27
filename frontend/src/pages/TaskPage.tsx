import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { 
  Play, 
  Download,
  ChevronLeft,
  Clock,
  FileText,
  Languages,
  Brain,
  Copy,
  Check,
  ExternalLink
} from 'lucide-react'
import { getProcessedVideo } from '@/services/processedVideos'
import type { ProcessedVideo } from '@/services/processedVideos'
import BilingualSubtitle, { SubtitleEntry } from '@/components/BilingualSubtitle'

// Mock bilingual subtitle data
const mockSubtitles: SubtitleEntry[] = [
  {
    index: 1,
    timestamp: '00:00:00',
    startTime: '00:00:00,000',
    endTime: '00:00:05,000',
    english: 'Welcome to this comprehensive session on bringing advanced speech-to-text capabilities to your application.',
    chinese: '欢迎来到这个关于为您的应用程序带来高级语音转文本功能的综合课程。'
  },
  {
    index: 2,
    timestamp: '00:00:05',
    startTime: '00:00:05,000',
    endTime: '00:00:10,000',
    english: 'The SpeechAnalyzer API provides powerful speech recognition capabilities.',
    chinese: 'SpeechAnalyzer API 提供强大的语音识别功能。'
  },
  {
    index: 3,
    timestamp: '00:00:10',
    startTime: '00:00:10,000',
    endTime: '00:00:15,000',
    english: 'It works entirely on-device, ensuring user privacy while delivering exceptional performance.',
    chinese: '它完全在设备上运行，确保用户隐私的同时提供卓越的性能。'
  },
  {
    index: 4,
    timestamp: '00:00:15',
    startTime: '00:00:15,000',
    endTime: '00:00:20,000',
    english: 'Our new SpeechTranscriber model leverages advanced machine learning techniques.',
    chinese: '我们的新 SpeechTranscriber 模型利用先进的机器学习技术。'
  },
  {
    index: 5,
    timestamp: '00:00:20',
    startTime: '00:00:20,000',
    endTime: '00:00:25,000',
    english: 'It provides accurate transcription across multiple languages and accents.',
    chinese: '它提供跨多种语言和口音的准确转写。'
  },
  {
    index: 6,
    timestamp: '00:00:25',
    startTime: '00:00:25,000',
    endTime: '00:00:30,000',
    english: 'Let\'s dive into the implementation details.',
    chinese: '让我们深入了解实现细节。'
  },
  {
    index: 7,
    timestamp: '00:00:30',
    startTime: '00:00:30,000',
    endTime: '00:00:35,000',
    english: 'First, import the Speech framework and create an instance of SpeechAnalyzer.',
    chinese: '首先，导入 Speech 框架并创建 SpeechAnalyzer 的实例。'
  },
  {
    index: 8,
    timestamp: '00:00:35',
    startTime: '00:00:35,000',
    endTime: '00:00:40,000',
    english: 'Configure the analyzer with your desired language and recognition options.',
    chinese: '使用您所需的语言和识别选项配置分析器。'
  }
]

const mockSummary = {
  overview: "This session introduces the new SpeechAnalyzer API for implementing advanced speech-to-text capabilities in iOS applications. The API provides on-device processing for privacy, supports multiple languages, and offers real-time transcription features.",
  keyPoints: [
    "SpeechAnalyzer API enables on-device speech recognition for enhanced privacy",
    "Supports real-time transcription with low latency",
    "Includes advanced features like punctuation detection and speaker diarization",
    "Compatible with multiple languages and regional accents",
    "Integrates seamlessly with existing iOS frameworks"
  ],
  technicalDetails: [
    "Requires iOS 19.0 or later",
    "Uses Core ML for on-device processing",
    "Supports audio formats: AAC, MP3, WAV",
    "Maximum continuous transcription duration: 1 hour"
  ]
}

export default function TaskPage() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const [video, setVideo] = useState<ProcessedVideo | null>(null)

  useEffect(() => {
    if (taskId) {
      const processedVideo = getProcessedVideo(taskId)
      if (processedVideo) {
        setVideo(processedVideo)
      }
    }
  }, [taskId])

  if (!video) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Video not found</p>
          <Button onClick={() => navigate('/')}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Library
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Video Player Area */}
      <div className="bg-black relative aspect-video max-h-[60vh]">
        <img 
          src={video.thumbnail} 
          alt={video.title}
          className="w-full h-full object-contain"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <Button size="lg" className="rounded-full h-16 w-16">
            <Play className="h-8 w-8 ml-1" fill="currentColor" />
          </Button>
        </div>
        
        {/* Video Controls Overlay */}
        <div className="absolute top-4 left-4">
          <Button variant="secondary" size="sm" onClick={() => navigate('/')}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </div>
        
        <div className="absolute top-4 right-4 flex gap-2">
          <Button 
            variant="secondary" 
            size="sm"
            onClick={() => window.open(`https://youtube.com/watch?v=${video.videoId}`, '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Open in YouTube
          </Button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Video Info */}
          <div className="mb-6">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h1 className="text-2xl font-semibold mb-2">{video.title}</h1>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <Badge variant="secondary">{video.channel}</Badge>
                  <span className="flex items-center">
                    <Clock className="h-3 w-3 mr-1" />
                    {video.duration}
                  </span>
                  <span>{video.fileSize}</span>
                  <div className="flex items-center gap-2">
                    {video.hasTranscript && (
                      <Badge variant="outline" className="text-xs">
                        <FileText className="h-3 w-3 mr-1" />
                        Transcript
                      </Badge>
                    )}
                    {video.hasTranslation && (
                      <Badge variant="outline" className="text-xs">
                        <Languages className="h-3 w-3 mr-1" />
                        Translation
                      </Badge>
                    )}
                    {video.hasSummary && (
                      <Badge variant="outline" className="text-xs">
                        <Brain className="h-3 w-3 mr-1" />
                        Summary
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Content Tabs */}
          <Tabs defaultValue="about" className="space-y-4">
            <TabsList>
              <TabsTrigger value="about">About</TabsTrigger>
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="transcript">Transcript</TabsTrigger>
              <TabsTrigger value="code">Code</TabsTrigger>
            </TabsList>

            <TabsContent value="about" className="space-y-6">
              <div>
                <p className="text-sm leading-relaxed">{video.description}</p>
              </div>
              
              {video.chapters && video.chapters.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">Chapters</h3>
                  <div className="space-y-2">
                    {video.chapters.map((chapter, index) => (
                      <button
                        key={index}
                        className="flex items-center gap-3 text-sm hover:bg-accent rounded p-2 -mx-2 w-full text-left"
                      >
                        <span className="text-blue-600 font-mono">{chapter.timestamp}</span>
                        <span>{chapter.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {video.tags.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {video.tags.map(tag => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="summary" className="space-y-6">
              <div>
                <h3 className="font-semibold mb-3">Overview</h3>
                <p className="text-sm leading-relaxed">{mockSummary.overview}</p>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Key Points</h3>
                <ul className="space-y-2">
                  {mockSummary.keyPoints.map((point, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-primary mr-2">•</span>
                      <span className="text-sm">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Technical Details</h3>
                <ul className="space-y-2">
                  {mockSummary.technicalDetails.map((detail, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-primary mr-2">•</span>
                      <span className="text-sm">{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </TabsContent>

            <TabsContent value="transcript" className="space-y-4">
              <BilingualSubtitle
                subtitles={mockSubtitles}
                onTimeClick={(time) => console.log('Jump to:', time)}
                showTimestamps={true}
              />
            </TabsContent>

            <TabsContent value="code" className="space-y-4">
              <div className="bg-muted rounded-lg p-4">
                <p className="text-sm text-muted-foreground">
                  Code samples and implementation details would appear here.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}