import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, ChevronLeft, Download } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import VideoPreview, { VideoMetadata } from '@/components/VideoPreview'
import TaskProgress, { TaskStage } from '@/components/TaskProgress'
import { CheckDependencies, StartTranscription, GetCurrentTask } from '../../wailsjs/go/main/App'

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
    ytdlp: false,
    ffmpeg: false,
    yap: false
  })
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)

  useEffect(() => {
    // Check dependencies on mount
    checkDependencies()
    // Poll for task status if processing
    if (isProcessing && currentTaskId) {
      const interval = setInterval(pollTaskStatus, 1000)
      return () => clearInterval(interval)
    }
  }, [isProcessing, currentTaskId])

  const checkDependencies = async () => {
    try {
      const status = await CheckDependencies()
      setDependencies(status)
    } catch (err) {
      console.error('Failed to check dependencies:', err)
    }
  }

  const pollTaskStatus = async () => {
    try {
      const task = await GetCurrentTask()
      if (task) {
        // Map backend status to frontend TaskStage
        const stageMap: Record<string, TaskStage> = {
          'pending': 'pending',
          'downloading': 'downloading',
          'transcribing': 'transcribing',
          'translating': 'translating',
          'summarizing': 'summarizing',
          'done': 'done',
          'failed': 'failed'
        }
        setTaskStage(stageMap[task.status] || 'pending')
        setTaskProgress(task.progress)
        
        if (task.status === 'done') {
          setIsProcessing(false)
          setTimeout(() => navigate('/'), 2000)
        } else if (task.status === 'failed') {
          setIsProcessing(false)
          setError(task.error || 'Task failed')
        }
      }
    } catch (err) {
      console.error('Failed to get task status:', err)
    }
  }

  const startProcessing = async () => {
    try {
      setIsProcessing(true)
      setTaskStage('pending')
      setError('')
      
      const task = await StartTranscription(url, sourceLang)
      setCurrentTaskId(task.id)
      setTaskStage('downloading')
    } catch (err: any) {
      setIsProcessing(false)
      setError(err.message || 'Failed to start processing')
    }
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
    startProcessing()
  }

  const handleCancel = () => {
    setIsProcessing(false)
    setTaskStage('pending')
    navigate('/')
  }

  const handleRetry = () => {
    setTaskStage('pending')
    startProcessing()
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
            Enter the YouTube URL to start processing
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
              <Select value={sourceLang} onValueChange={setSourceLang} disabled={isProcessing}>
                <SelectTrigger>
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="zh">Chinese</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                  <SelectItem value="de">German</SelectItem>
                  <SelectItem value="ja">Japanese</SelectItem>
                  <SelectItem value="ko">Korean</SelectItem>
                </SelectContent>
              </Select>
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

      
    </div>
  )
}
