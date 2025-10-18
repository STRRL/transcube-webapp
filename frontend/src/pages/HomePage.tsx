import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Clock, Plus, Trash2, RefreshCcw, Loader2 } from 'lucide-react'
import { GetAllTasks, DeleteTask, ListActiveTasks } from '../../wailsjs/go/main/App'
import { EventsOn } from '../../wailsjs/runtime/runtime'

export default function HomePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchQuery, setSearchQuery] = useState('')
  const [processedVideos, setProcessedVideos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [videoToDelete, setVideoToDelete] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null)
  const [activeTasks, setActiveTasks] = useState<any[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [pollMs, setPollMs] = useState(1500)
  const idleRoundsRef = useRef(0)

  const isActiveStatus = useCallback(
    (status: string | undefined) =>
      status === 'pending' ||
      status === 'downloading' ||
      status === 'transcribing' ||
      status === 'translating' ||
      status === 'summarizing',
    []
  )

  const loadTasks = useCallback(async () => {
    try {
      const tasks = await GetAllTasks()
      console.log('All tasks loaded:', tasks)
      // Filter tasks that already reached a terminal state
      const completed = (tasks || []).filter(
        (task) => task.status === 'done' || task.status === 'failed'
      )
      // Sort by createdAt in descending order (newest first)
      completed.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime()
        const dateB = new Date(b.createdAt).getTime()
        return dateB - dateA
      })
      console.log('Completed tasks:', completed)
      setProcessedVideos(completed)
    } catch (err) {
      console.error('Failed to load tasks:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const adjustPollingCadence = useCallback((activeCount: number) => {
    if (activeCount > 0) {
      idleRoundsRef.current = 0
      setPollMs(1500)
      return
    }

    idleRoundsRef.current = Math.min(idleRoundsRef.current + 1, 3)
    const schedule = [10000, 30000, 60000]
    const idx = Math.min(idleRoundsRef.current - 1, schedule.length - 1)
    setPollMs(schedule[idx])
  }, [])

  const loadActiveTasks = useCallback(async () => {
    try {
      const tasks = await ListActiveTasks()
      const running = (tasks || []).filter((task) => isActiveStatus(task.status))
      setActiveTasks(running)
      adjustPollingCadence(running.length)
    } catch (err) {
      console.error('Failed to refresh active tasks:', err)
    }
  }, [adjustPollingCadence, isActiveStatus])

  useEffect(() => {
    loadTasks()
    loadActiveTasks()

    // Listen for reload-videos event from backend
    const offReload = EventsOn('reload-videos', () => {
      console.log('Received reload-videos event from backend')
      loadTasks()
      loadActiveTasks()
    })

    // Cleanup on unmount
    return () => {
      offReload()
    }
  }, [loadTasks, loadActiveTasks])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const channel = params.get('channel')
    setSelectedChannel(channel)
  }, [location])

  useEffect(() => {
    const id = setInterval(() => {
      loadActiveTasks()
    }, pollMs)

    return () => clearInterval(id)
  }, [pollMs, loadActiveTasks])

  const handleManualRefresh = useCallback(async () => {
    setRefreshing(true)
    setLoading(true)
    idleRoundsRef.current = 0
    setPollMs(1500)
    try {
      await Promise.all([loadTasks(), loadActiveTasks()])
    } catch (err) {
      console.error('Manual refresh failed:', err)
    } finally {
      setRefreshing(false)
    }
  }, [loadActiveTasks, loadTasks])

  const confirmDelete = async () => {
    if (!videoToDelete) return
    
    setDeleting(true)
    try {
      console.log('Deleting video:', videoToDelete.id)
      await DeleteTask(videoToDelete.id)
      console.log('Delete successful')
      
      // Close dialog immediately
      setDeleteDialogOpen(false)
      setVideoToDelete(null)
      
      // The reload will be triggered by the backend event
      // No need to manually reload here
    } catch (err) {
      console.error('Delete failed:', err)
      alert(`Failed to delete video: ${err}`)
    } finally {
      setDeleting(false)
    }
  }

  const combinedTasks = useMemo(() => {
    const tasks = [...activeTasks, ...processedVideos]
    return tasks.sort((a, b) => {
      const aActive = isActiveStatus(a.status)
      const bActive = isActiveStatus(b.status)
      if (aActive !== bActive) {
        return aActive ? -1 : 1
      }
      const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime()
      const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime()
      return dateB - dateA
    })
  }, [activeTasks, processedVideos, isActiveStatus])

  const filteredTasks = combinedTasks.filter(task => {
    if (selectedChannel && task.channel !== selectedChannel) {
      return false
    }

    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    const title = (task.title || task.url || '').toLowerCase()
    const channel = (task.channel || '').toLowerCase()
    return title.includes(query) || channel.includes(query)
  })

  const statusLabels: Record<string, string> = {
    pending: 'Pending',
    downloading: 'Downloading',
    transcribing: 'Transcribing',
    translating: 'Translating',
    summarizing: 'Summarizing',
    failed: 'Failed',
    done: 'Completed'
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold mb-1">
            {selectedChannel ? `Channel: ${selectedChannel}` : 'TransCube Library'}
          </h1>
          <p className="text-muted-foreground">
            {selectedChannel
              ? `${filteredTasks.length} tasks in this channel`
              : `Active ${activeTasks.length} · Completed ${processedVideos.length} · Showing ${filteredTasks.length}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
          <Button onClick={() => navigate('/new')}>
            <Plus className="h-4 w-4 mr-2" />
            New Transcription
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <Input
          placeholder="Search videos, channels, or tags..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Task Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 relative">
        {/* Loading overlay */}
        {loading && combinedTasks.length > 0 && (
          <div className="absolute inset-0 bg-background/80 z-50 flex items-center justify-center rounded">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-sm text-muted-foreground">Refreshing...</p>
            </div>
          </div>
        )}
        {filteredTasks.map(task => {
          const isCompleted = task.status === 'done'

          if (!isCompleted) {
            const clampedProgress = Math.min(Math.max(Math.round(task.progress || 0), 0), 100)
            const updated = task.updatedAt || task.createdAt
            const updatedLabel = updated
              ? new Date(updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
              : 'Just now'
            const hasPreview = Boolean(task.thumbnail && task.title)
            const statusVariant = task.status === 'failed' ? 'destructive' : 'secondary'

            return (
              <Card
                key={task.id}
                className={`
                  overflow-hidden flex flex-col transition-shadow
                  ${task.status === 'failed' ? 'border-destructive/40 shadow-sm shadow-destructive/10' : 'border-border'}
                `}
              >
                <div className="relative aspect-video overflow-hidden bg-muted">
                  {hasPreview ? (
                    <>
                      <img
                        src={task.thumbnail}
                        alt={task.title}
                        className="object-cover w-full h-full"
                        onError={(e) => {
                          e.currentTarget.src = `https://via.placeholder.com/640x360/09090b/ffffff?text=${encodeURIComponent(task.title?.substring(0, 20) || 'Video')}`
                        }}
                      />
                      <div className="absolute inset-0 bg-black/55 text-white p-4 flex flex-col justify-between">
                        <div className="flex items-start justify-between gap-2">
                          <Badge
                            variant={statusVariant}
                            className={`backdrop-blur-sm text-white ${
                              statusVariant === 'destructive'
                                ? ''
                                : 'bg-white/20 hover:bg-white/30 border-white/20'
                            }`}
                          >
                            {statusLabels[task.status] || task.status}
                          </Badge>
                          <span className="text-xs font-medium">{clampedProgress}%</span>
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-base font-semibold line-clamp-2">
                            {task.title}
                          </h3>
                          {task.channel && (
                            <p className="text-xs text-white/80 line-clamp-1">{task.channel}</p>
                          )}
                        </div>
                        <div className="text-[11px] text-white/80">
                          {statusLabels[task.status] || task.status} · Updated {updatedLabel}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 flex flex-col justify-between">
                      <Badge variant={statusVariant} className="w-fit">
                        {statusLabels[task.status] || task.status}
                      </Badge>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Task</p>
                        <h3 className="text-base font-semibold line-clamp-3 text-foreground">
                          {task.title || task.url || 'Processing task'}
                        </h3>
                      </div>
                    </div>
                  )}
                </div>
                <CardContent className="p-4 space-y-3 flex-1">
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-2">
                      <span>Progress</span>
                      <span>{clampedProgress}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${task.status === 'failed' ? 'bg-destructive' : 'bg-primary'}`}
                        style={{ width: `${clampedProgress}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Updated {updatedLabel}
                    </p>
                  </div>

                  {task.status === 'failed' && task.error && (
                    <p className="text-xs text-destructive leading-relaxed">
                      Error: {task.error}
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          }

          return (
            <Card
              key={task.id}
              className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow group"
              onClick={(e) => {
                const target = e.target as HTMLElement
                if (target.closest('button')) {
                  return
                }
                navigate(`/task/${task.id}`)
              }}
            >
              <div className="aspect-video relative bg-muted">
                {task.thumbnail && (
                  <img
                    src={task.thumbnail}
                    alt={task.title || 'Video'}
                    className="object-cover w-full h-full"
                    onError={(e) => {
                      e.currentTarget.src = `https://via.placeholder.com/640x360/09090b/ffffff?text=${encodeURIComponent(task.title?.substring(0, 20) || 'Video')}`
                    }}
                  />
                )}
                <button
                  className="absolute top-2 right-2 p-1.5 rounded-md bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setVideoToDelete(task)
                    setDeleteDialogOpen(true)
                  }}
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <CardContent className="p-4">
                <h3 className="font-medium line-clamp-2 text-sm mb-2">
                  {task.title || 'Untitled Video'}
                </h3>

                <p className="text-xs text-muted-foreground mb-3">
                  {task.completedAt
                    ? `Processed ${formatDate(task.completedAt)}`
                    : task.createdAt
                      ? `Started ${formatDate(task.createdAt)}`
                      : 'Processing...'}
                </p>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {task.channel && (
                    <span className="flex items-center gap-1">
                      {task.channel}
                    </span>
                  )}
                  {task.channel && task.duration && (
                    <span>•</span>
                  )}
                  {task.duration && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {task.duration}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {filteredTasks.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No tasks found. Click "New Transcription" to start processing.</p>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{videoToDelete?.title || 'this video'}" and all its associated files. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete} 
              className="bg-red-500 hover:bg-red-600"
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
