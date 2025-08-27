import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, ChevronLeft, Download, CheckCircle2, XCircle } from 'lucide-react'
import VideoPreview, { VideoMetadata } from '@/components/VideoPreview'
import TaskProgress, { TaskStage } from '@/components/TaskProgress'
import { MockService } from '@/services/mock'

const mockService = new MockService()

export default function NewTranscriptionPage() {
  const navigate = useNavigate()
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [sourceLang, setSourceLang] = useState('en')
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null)
  
  // Task processing state
  const [isProcessing, setIsProcessing] = useState(false)
  const [taskStage, setTaskStage] = useState<TaskStage>('pending')
  const [taskProgress, setTaskProgress] = useState(0)
  const [taskDetail, setTaskDetail] = useState('')
  const [estimatedTime, setEstimatedTime] = useState('')
  
  const [dependencies, setDependencies] = useState({
    ytdlp: true,
    ffmpeg: true,
    yap: true
  })

  // Simulate task processing
  const simulateProcessing = () => {
    setIsProcessing(true)
    setTaskStage('downloading')
    setTaskProgress(0)
    
    // Simulate downloading
    let progress = 0
    const downloadInterval = setInterval(() => {
      progress += Math.random() * 20
      setTaskProgress(Math.min(progress, 100))
      setTaskDetail(`Downloading audio... ${Math.round(progress)}%`)
      setEstimatedTime('~2 minutes')
      
      if (progress >= 100) {
        clearInterval(downloadInterval)
        setTaskStage('transcribing')
        simulateTranscribing()
      }
    }, 500)
  }

  const simulateTranscribing = () => {
    setTaskProgress(0)
    let progress = 0
    
    const transcribeInterval = setInterval(() => {
      progress += Math.random() * 15
      setTaskProgress(Math.min(progress, 100))
      setTaskDetail(`Processing audio segments...`)
      setEstimatedTime('~3 minutes')
      
      if (progress >= 100) {
        clearInterval(transcribeInterval)
        setTaskStage('translating')
        simulateTranslating()
      }
    }, 600)
  }

  const simulateTranslating = () => {
    setTaskProgress(0)
    let progress = 0
    
    const translateInterval = setInterval(() => {
      progress += Math.random() * 25
      setTaskProgress(Math.min(progress, 100))
      setTaskDetail(`Translating to Chinese...`)
      setEstimatedTime('~1 minute')
      
      if (progress >= 100) {
        clearInterval(translateInterval)
        setTaskStage('summarizing')
        simulateSummarizing()
      }
    }, 400)
  }

  const simulateSummarizing = () => {
    setTaskProgress(0)
    let progress = 0
    
    const summarizeInterval = setInterval(() => {
      progress += Math.random() * 30
      setTaskProgress(Math.min(progress, 100))
      setTaskDetail(`Generating AI summary...`)
      setEstimatedTime('~30 seconds')
      
      if (progress >= 100) {
        clearInterval(summarizeInterval)
        setTaskStage('done')
        setTimeout(() => {
          navigate('/')
        }, 2000)
      }
    }, 300)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!url.trim()) {
      setError('Please enter a YouTube URL')
      return
    }

    if (!videoMetadata || !videoMetadata.isValid) {
      setError('Please enter a valid YouTube URL')
      return
    }

    setError('')
    simulateProcessing()
  }

  const handleCancel = () => {
    setIsProcessing(false)
    setTaskStage('pending')
    navigate('/')
  }

  const handleRetry = () => {
    setTaskStage('pending')
    simulateProcessing()
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="mb-4">
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back to Library
        </Button>
        
        <h1 className="text-2xl font-semibold mb-2">New Transcription</h1>
        <p className="text-muted-foreground">
          Download and process a YouTube video with AI-powered transcription and translation
        </p>
      </div>

      {/* Main Form */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Video Details</CardTitle>
          <CardDescription>
            Enter the YouTube URL and select processing options
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">YouTube URL</label>
              <Input
                placeholder="https://youtube.com/watch?v=... or video ID"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isProcessing}
              />
            </div>
            
            {/* Video Preview */}
            {url && (
              <VideoPreview 
                url={url}
                onMetadataLoaded={setVideoMetadata}
                showDetails={true}
              />
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Source Language</label>
              <select
                value={sourceLang}
                onChange={(e) => setSourceLang(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                disabled={isProcessing}
              >
                <option value="en">English</option>
                <option value="zh">Chinese</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="ja">Japanese</option>
                <option value="ko">Korean</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Processing Options</label>
              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input type="checkbox" defaultChecked disabled={isProcessing} />
                  <span className="text-sm">Generate transcript</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" defaultChecked disabled={isProcessing} />
                  <span className="text-sm">Translate to Chinese (if source is English)</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" defaultChecked disabled={isProcessing} />
                  <span className="text-sm">Generate AI summary</span>
                </label>
              </div>
            </div>
            
            {error && (
              <div className="flex items-center space-x-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}
            
            {!isProcessing && (
              <div className="flex justify-between items-center pt-4">
                <Button type="button" variant="outline" onClick={() => navigate('/')}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!videoMetadata?.isValid}>
                  <Download className="mr-2 h-4 w-4" />
                  Start Processing
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Task Progress */}
      {isProcessing && (
        <TaskProgress
          stage={taskStage}
          progress={taskProgress}
          currentDetail={taskDetail}
          estimatedTime={estimatedTime}
          onCancel={handleCancel}
          onRetry={taskStage === 'failed' ? handleRetry : undefined}
        />
      )}

      {/* System Status */}
      {!isProcessing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">System Dependencies</CardTitle>
            <CardDescription>
              Required tools for processing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">yt-dlp (Video downloader)</span>
                <div className="flex items-center space-x-1">
                  {dependencies.ytdlp ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-xs text-muted-foreground">
                    {dependencies.ytdlp ? 'Installed' : 'Missing'}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">ffmpeg (Media converter)</span>
                <div className="flex items-center space-x-1">
                  {dependencies.ffmpeg ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-xs text-muted-foreground">
                    {dependencies.ffmpeg ? 'Installed' : 'Missing'}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">yap (Speech recognition)</span>
                <div className="flex items-center space-x-1">
                  {dependencies.yap ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-xs text-muted-foreground">
                    {dependencies.yap ? 'Installed' : 'Missing'}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}