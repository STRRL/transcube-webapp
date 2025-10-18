import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { 
  Play, 
  ChevronLeft,
  Clock,
  FileText,
  Copy,
  Check,
  RefreshCcw,
  Loader2
} from 'lucide-react'
import BilingualSubtitle from '@/components/BilingualSubtitle'
import VideoPlayer, { VideoPlayerHandle } from '@/components/VideoPlayer'
import { 
  GetAllTasks, 
  GetTaskSubtitles, 
  UpdateTaskSourceLanguage,
  DownloadTask,
  TranscribeTask,
  SummarizeTask
} from '../../wailsjs/go/main/App'
import { types, main } from '../../wailsjs/go/models'

type StructuredSummary = {
  type: 'structured'
  content: {
    keyPoints: string[]
    mainTopic: string
    conclusion: string
    tags: string[]
  }
}

export default function TaskPage() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const [video, setVideo] = useState<types.Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [videoSrc, setVideoSrc] = useState<string | null>(null)
  const [subtitles, setSubtitles] = useState<any[]>([])
  const [transcriptSubtitles, setTranscriptSubtitles] = useState<main.SubtitleEntry[]>([])
  const [summary, setSummary] = useState<StructuredSummary | null>(null)
  const [selectedLang, setSelectedLang] = useState<string>('en')
  const [isUpdatingLanguage, setIsUpdatingLanguage] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const videoPlayerRef = useRef<VideoPlayerHandle | null>(null)

  const isBusy = isUpdatingLanguage || isDownloading || isTranscribing || isSummarizing

  const languageOptions = [
    { value: 'en', label: 'English' },
    { value: 'zh', label: 'Chinese' },
    { value: 'es', label: 'Spanish' },
    { value: 'fr', label: 'French' },
    { value: 'de', label: 'German' },
    { value: 'ja', label: 'Japanese' },
    { value: 'ko', label: 'Korean' },
    { value: 'ru', label: 'Russian' },
    { value: 'pt', label: 'Portuguese' },
    { value: 'it', label: 'Italian' }
  ]

  useEffect(() => {
    loadTask()
  }, [taskId])

  useEffect(() => {
    if (video?.sourceLang) {
      setSelectedLang(video.sourceLang)
    }
  }, [video?.sourceLang])

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
            // Detect available video container (mp4 preferred, fallback to webm)
            const mp4 = `/media/${task.id}/video.mp4`
            const webm = `/media/${task.id}/video.webm`
            let chosen: string | null = null

            try {
              const headMp4 = await fetch(mp4, { method: 'HEAD' })
              if (headMp4.ok) {
                chosen = mp4
              }
            } catch {}

            if (!chosen) {
              try {
                const headWebm = await fetch(webm, { method: 'HEAD' })
                if (headWebm.ok) {
                  chosen = webm
                }
              } catch {}
            }

            if (chosen) {
              setVideoSrc(chosen)
            } else {
              // As a last resort, try mp4 to let the video element surface an error
              setVideoSrc(mp4)
            }

            // Load subtitles via media server based on source language
            const subtitleFiles = []
            
            // Add the transcribed subtitle based on source language
            if (task.sourceLang) {
              const langLabels: Record<string, string> = {
                'en': 'English',
                'zh': 'Chinese',
                'es': 'Spanish',
                'fr': 'French',
                'de': 'German',
                'ja': 'Japanese',
                'ko': 'Korean',
                'ru': 'Russian',
                'pt': 'Portuguese',
                'it': 'Italian'
              }
              
              subtitleFiles.push({
                file: `subs_${task.sourceLang}.vtt`,
                label: langLabels[task.sourceLang] || task.sourceLang,
                lang: task.sourceLang
              })
            }
            
            const loadedSubs = subtitleFiles.map((sub, index) => ({
              src: `/media/${task.id}/${sub.file}`,
              label: sub.label,
              language: sub.lang,
              default: index === 0  // 第一个字幕轨道设为默认
            }))
            setSubtitles(loadedSubs)
          } catch (err) {
            console.error('Failed to load video:', err)
          }
          
          // Load transcript subtitles for display
          try {
            const subs = await GetTaskSubtitles(task.id)
            setTranscriptSubtitles(subs)
          } catch (err) {
            console.error('Failed to load transcript:', err)
          }

          // Load summary JSON from media server if available
          try {
            const res = await fetch(`/media/${task.id}/summary_structured.json`)
            if (res.ok) {
              const json = await res.json()
              setSummary(json)
            }
          } catch (err) {
            console.error('Failed to load summary:', err)
          }
        }
      }
    } catch (err) {
      console.error('Failed to load task:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleLanguageChange = async (lang: string) => {
    if (!taskId) return
    const previousLang = selectedLang

    setSelectedLang(lang)
    setActionError(null)
    setActionMessage(null)
    setIsUpdatingLanguage(true)

    try {
      await UpdateTaskSourceLanguage(taskId, lang)
      await loadTask()
      setActionMessage('Source language updated. Regenerate transcript to apply the change.')
    } catch (err) {
      console.error('Failed to update source language:', err)
      setSelectedLang(previousLang)
      const message = err instanceof Error ? err.message : 'Failed to update source language'
      setActionError(message)
    } finally {
      setIsUpdatingLanguage(false)
    }
  }

  const handleRedownload = async () => {
    if (!taskId) return

    setActionError(null)
    setActionMessage(null)
    setIsDownloading(true)

    try {
      await DownloadTask(taskId)
      await loadTask()
      setActionMessage('Media files refreshed successfully.')
    } catch (err) {
      console.error('Failed to redownload media:', err)
      const message = err instanceof Error ? err.message : 'Failed to redownload media'
      setActionError(message)
    } finally {
      setIsDownloading(false)
    }
  }

  const handleRetranscribe = async () => {
    if (!taskId) return

    setActionError(null)
    setActionMessage(null)
    setIsTranscribing(true)

    try {
      await TranscribeTask(taskId)
      await loadTask()
      setSummary(null)
      setActionMessage('Transcript regenerated. Run summary again to refresh insights.')
    } catch (err) {
      console.error('Failed to retranscribe:', err)
      const message = err instanceof Error ? err.message : 'Failed to regenerate transcript'
      setActionError(message)
    } finally {
      setIsTranscribing(false)
    }
  }

  const handleResummarize = async () => {
    if (!taskId) return

    setActionError(null)
    setActionMessage(null)
    setIsSummarizing(true)

    try {
      await SummarizeTask(taskId)
      await loadTask()
      setActionMessage('Summary regenerated successfully.')
    } catch (err) {
      console.error('Failed to regenerate summary:', err)
      const message = err instanceof Error ? err.message : 'Failed to regenerate summary'
      setActionError(message)
    } finally {
      setIsSummarizing(false)
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

  const handleTimeClick = (timeString: string) => {
    // Parse time string like "00:00:02,520" to seconds
    const parts = timeString.split(':')
    if (parts.length >= 3) {
      const hours = parseInt(parts[0], 10)
      const minutes = parseInt(parts[1], 10)
      const secondsParts = parts[2].split(',')
      const seconds = parseInt(secondsParts[0], 10)
      const milliseconds = secondsParts[1] ? parseInt(secondsParts[1], 10) / 1000 : 0
      
      const totalSeconds = hours * 3600 + minutes * 60 + seconds + milliseconds
      
      // Seek video to this time
      if (videoPlayerRef.current) {
        videoPlayerRef.current.seekTo(totalSeconds)
      }
    }
  }

  

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b bg-background">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/')}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Library
          </Button>
          {video.videoId && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleCopyLink}
            >
              {copied ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Link
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-8">
          <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="relative aspect-video w-full bg-black">
              {video.status === 'done' && videoSrc ? (
                <VideoPlayer 
                  ref={videoPlayerRef}
                  src={videoSrc}
                  poster={video.thumbnail}
                  subtitles={subtitles}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-black">
                  <div className="relative h-full w-full">
                    <img 
                      src={video.thumbnail || 'https://via.placeholder.com/1280x720'} 
                      alt={video.title || 'Video'}
                      className="h-full w-full object-contain"
                    />
                    {video.videoId && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Button 
                          size="icon" 
                          className="h-16 w-16 rounded-full"
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
          </section>

          <section className="rounded-2xl bg-card p-6 shadow-sm">
            <div className="mb-6">
              <h1 className="mb-2 text-2xl font-semibold">{video.title || 'Untitled'}</h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {video.channel && <Badge variant="secondary">{video.channel}</Badge>}
                {video.duration && (
                  <span className="flex items-center">
                    <Clock className="mr-1 h-3 w-3" />
                    {video.duration}
                  </span>
                )}
              </div>
            </div>

            <Tabs defaultValue="about" className="space-y-4">
              <TabsList>
                <TabsTrigger value="about">About</TabsTrigger>
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="transcript">Transcript</TabsTrigger>
              </TabsList>

              <TabsContent value="about" className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <h3 className="mb-2 text-lg font-semibold">Video Information</h3>
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
                  <div>
                    <h3 className="mb-2 text-lg font-semibold">Manual Controls</h3>
                    <div className="space-y-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                        <span className="text-sm font-medium">Source Language</span>
                        <Select
                          value={selectedLang}
                          onValueChange={handleLanguageChange}
                          disabled={isBusy}
                        >
                          <SelectTrigger className="w-full sm:w-56">
                            <SelectValue placeholder="Select language" />
                          </SelectTrigger>
                          <SelectContent>
                            {languageOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          onClick={handleRedownload}
                          disabled={isBusy}
                        >
                          {isDownloading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCcw className="mr-2 h-4 w-4" />
                          )}
                          Refresh Download
                        </Button>
                        <Button
                          variant="outline"
                          onClick={handleRetranscribe}
                          disabled={isBusy}
                        >
                          {isTranscribing ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCcw className="mr-2 h-4 w-4" />
                          )}
                          Regenerate Transcript
                        </Button>
                        <Button
                          variant="outline"
                          onClick={handleResummarize}
                          disabled={isBusy}
                        >
                          {isSummarizing ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCcw className="mr-2 h-4 w-4" />
                          )}
                          Regenerate Summary
                        </Button>
                      </div>
                      {actionMessage && (
                        <p className="text-sm text-green-600">{actionMessage}</p>
                      )}
                      {actionError && (
                        <p className="text-sm text-destructive">{actionError}</p>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="summary" className="space-y-4">
                <div className="space-y-4">
                  {video.status === 'done' ? (
                    summary ? (
                      <>
                        <div>
                          <h3 className="mb-1 text-lg font-semibold">Main Topic</h3>
                          <p className="text-sm text-muted-foreground">{summary.content.mainTopic}</p>
                        </div>
                        {summary.content.keyPoints && summary.content.keyPoints.length > 0 && (
                          <div>
                            <h3 className="mb-2 text-lg font-semibold">Key Points</h3>
                            <ul className="list-inside list-disc space-y-1">
                              {summary.content.keyPoints.map((pt, i) => (
                                <li key={i} className="text-sm">{pt}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {summary.content.conclusion && (
                          <div>
                            <h3 className="mb-1 text-lg font-semibold">Conclusion</h3>
                            <p className="text-sm text-muted-foreground">{summary.content.conclusion}</p>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-sm text-muted-foreground">Loading summary...</div>
                    )
                  ) : (
                    <div className="text-sm text-muted-foreground">Summary will be available after processing completes.</div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="transcript" className="space-y-4">
                {transcriptSubtitles.length > 0 ? (
                  <BilingualSubtitle 
                    subtitles={transcriptSubtitles}
                    onTimeClick={handleTimeClick}
                  />
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    <FileText className="mx-auto mb-4 h-12 w-12 opacity-50" />
                    <p>
                      {video.status === 'done' 
                        ? 'No transcript available (no speech detected or subtitles empty)'
                        : 'Transcript will be available after processing completes'}
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </section>
        </div>
      </div>
    </div>
  )
}
