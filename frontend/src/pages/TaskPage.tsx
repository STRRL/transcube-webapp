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
import BilingualSubtitle, { SubtitleEntry } from '@/components/BilingualSubtitle'
import VideoPlayer from '@/components/VideoPlayer'
import { GetAllTasks } from '../../wailsjs/go/main/App'
import { types } from '../../wailsjs/go/models'

// Empty subtitle data - will be populated from backend
const mockSubtitles: SubtitleEntry[] = [
  // Subtitles will be loaded from backend
]

// Empty summary data
const mockSummary = {
  overview: "",
  keyPoints: [],
  technicalDetails: []
}

export default function TaskPage() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const [video, setVideo] = useState<types.Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [videoSrc, setVideoSrc] = useState<string | null>(null)
  const [subtitles, setSubtitles] = useState<any[]>([])

  useEffect(() => {
    loadTask()
  }, [taskId])

  const loadTask = async () => {
    if (!taskId) return
    
    try {
      const tasks = await GetAllTasks()
      const task = tasks.find(t => t.id === taskId)
      if (task) {
        setVideo(task)
        
        // Load video file if task is completed
        if (task.status === 'done') {
          try {
            // Use the media server endpoint
            setVideoSrc(`/media/${task.id}/video.mp4`)
            
            // Load subtitles via media server
            const subtitleFiles = [
              { file: 'captions.vtt', label: 'English', lang: 'en' },
              { file: 'subs_en.srt', label: 'English', lang: 'en' },
              { file: 'translated_zh.srt', label: 'Chinese', lang: 'zh' },
            ]
            
            const loadedSubs = subtitleFiles.map(sub => ({
              src: `/media/${task.id}/${sub.file}`,
              label: sub.label,
              language: sub.lang,
              default: sub.lang === 'en'
            }))
            setSubtitles(loadedSubs)
          } catch (err) {
            console.error('Failed to load video:', err)
          }
        }
      }
    } catch (err) {
      console.error('Failed to load task:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

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

  const handleCopyLink = () => {
    if (video.videoId) {
      navigator.clipboard.writeText(`https://youtube.com/watch?v=${video.videoId}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Video Player Area */}
      <div className="bg-black relative h-[60vh] flex-shrink-0">
        {video.status === 'done' && videoSrc ? (
          <VideoPlayer 
            src={videoSrc}
            poster={video.thumbnail}
            subtitles={subtitles}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="relative max-w-full max-h-full">
              <img 
                src={video.thumbnail || 'https://via.placeholder.com/1280x720'} 
                alt={video.title || 'Video'}
                className="max-w-full max-h-[60vh] object-contain"
              />
              {video.videoId && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Button 
                    size="icon" 
                    className="w-16 h-16 rounded-full"
                    onClick={() => window.open(`https://youtube.com/watch?v=${video.videoId}`, '_blank')}
                  >
                    <Play className="h-8 w-8" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Controls Bar */}
      <div className="border-b p-4 flex items-center justify-between">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate('/')}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back to Library
        </Button>
        <div className="flex gap-2">
          {video.videoId && (
            <>
              <Button 
                variant="secondary" 
                size="sm"
                onClick={() => window.open(`https://youtube.com/watch?v=${video.videoId}`, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in YouTube
              </Button>
              <Button 
                variant="secondary" 
                size="sm"
                onClick={handleCopyLink}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Link
                  </>
                )}
              </Button>
            </>
          )}
          <Button size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Logs
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
                <h1 className="text-2xl font-semibold mb-2">{video.title || 'Untitled'}</h1>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {video.channel && <Badge variant="secondary">{video.channel}</Badge>}
                  {video.duration && (
                    <span className="flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      {video.duration}
                    </span>
                  )}
                  <Badge variant="outline">
                    Language: {video.sourceLang || 'Unknown'}
                  </Badge>
                  <Badge variant={video.status === 'done' ? 'default' : 'secondary'}>
                    {video.status}
                  </Badge>
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
              <TabsTrigger value="details">Details</TabsTrigger>
            </TabsList>

            <TabsContent value="about" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Video Information</h3>
                  <div className="space-y-2 text-sm">
                    <p>
                      <span className="text-muted-foreground">Video ID:</span> {video.videoId || 'N/A'}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Source Language:</span> {video.sourceLang || 'Not specified'}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Status:</span> {video.status}
                    </p>
                    {video.createdAt && (
                      <p>
                        <span className="text-muted-foreground">Started:</span> {new Date(video.createdAt).toLocaleString()}
                      </p>
                    )}
                    {video.completedAt && (
                      <p>
                        <span className="text-muted-foreground">Completed:</span> {new Date(video.completedAt).toLocaleString()}
                      </p>
                    )}
                    {video.workDir && (
                      <p>
                        <span className="text-muted-foreground">Work Directory:</span> {video.workDir}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="summary" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Overview</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {mockSummary.overview || 'Summary not available yet. AI summarization will be added in future updates.'}
                  </p>
                </div>
                
                {mockSummary.keyPoints.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Key Points</h3>
                    <ul className="list-disc list-inside space-y-1">
                      {mockSummary.keyPoints.map((point, index) => (
                        <li key={index} className="text-sm">{point}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="transcript" className="space-y-4">
              {mockSubtitles.length > 0 ? (
                <BilingualSubtitle 
                  subtitles={mockSubtitles}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Transcript not available yet</p>
                  <p className="text-sm mt-2">
                    {video.status === 'done' 
                      ? 'Check the work directory for subtitle files'
                      : 'Transcript will be available after processing completes'}
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="details" className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Processing Details</h3>
                <pre className="bg-muted p-4 rounded-lg text-xs overflow-auto">
                  {JSON.stringify(video, null, 2)}
                </pre>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}