import { useState, useEffect } from 'react'
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
import { 
  Clock, 
  FileText, 
  Languages, 
  Brain,
  Download,
  Plus,
  Trash2
} from 'lucide-react'
import { GetAllTasks, DeleteTask } from '../../wailsjs/go/main/App'
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

  useEffect(() => {
    loadTasks()
    
    // Listen for reload-videos event from backend
    const offReload = EventsOn('reload-videos', () => {
      console.log('Received reload-videos event from backend')
      loadTasks()
    })

    // Cleanup on unmount
    return () => {
      offReload()
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const channel = params.get('channel')
    setSelectedChannel(channel)
  }, [location])

  const loadTasks = async () => {
    try {
      const tasks = await GetAllTasks()
      console.log('All tasks loaded:', tasks)
      // Filter only completed tasks - handle null case
      const completed = (tasks || []).filter(task => task.status === 'done')
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
  }

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

  const filteredVideos = processedVideos.filter(video => {
    // First filter by selected channel if any
    if (selectedChannel && video.channel !== selectedChannel) {
      return false
    }
    
    // Then apply search filter
    if (!searchQuery) return true
    const title = video.title || ''
    const channel = video.channel || ''
    return title.toLowerCase().includes(searchQuery.toLowerCase()) ||
           channel.toLowerCase().includes(searchQuery.toLowerCase())
  })

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
            {filteredVideos.length} {selectedChannel ? 'videos in this channel' : 'videos processed'}
          </p>
        </div>
        <Button onClick={() => navigate('/new')}>
          <Plus className="h-4 w-4 mr-2" />
          New Transcription
        </Button>
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

      {/* Video Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 relative">
        {/* Loading overlay */}
        {loading && processedVideos.length > 0 && (
          <div className="absolute inset-0 bg-background/80 z-50 flex items-center justify-center rounded">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-sm text-muted-foreground">Refreshing...</p>
            </div>
          </div>
        )}
        {filteredVideos.map(video => (
          <Card 
            key={video.id} 
            className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow group"
            onClick={(e) => {
              // Check if the click target is the delete button or its child
              const target = e.target as HTMLElement
              if (target.closest('button')) {
                return // Don't navigate if clicking on button
              }
              navigate(`/task/${video.id}`)
            }}
          >
            <div className="aspect-video relative bg-muted">
              {video.thumbnail && (
                <img 
                  src={video.thumbnail} 
                  alt={video.title || 'Video'}
                  className="object-cover w-full h-full"
                  onError={(e) => {
                    e.currentTarget.src = `https://via.placeholder.com/640x360/09090b/ffffff?text=${encodeURIComponent(video.title?.substring(0, 20) || 'Video')}`
                  }}
                />
              )}
              {/* Delete button - only visible on hover */}
              <button
                className="absolute top-2 right-2 p-1.5 rounded-md bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setVideoToDelete(video)
                  setDeleteDialogOpen(true)
                }}
                type="button"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            
            <CardContent className="p-4">
              <h3 className="font-medium line-clamp-2 text-sm mb-2">
                {video.title || 'Untitled Video'}
              </h3>
              
              <p className="text-xs text-muted-foreground mb-3">
                {video.completedAt ? `Processed ${formatDate(video.completedAt)}` : 
                 video.createdAt ? `Started ${formatDate(video.createdAt)}` : 'Processing...'}
              </p>
              
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {video.channel && (
                  <span className="flex items-center gap-1">
                    {video.channel}
                  </span>
                )}
                {video.channel && video.duration && (
                  <span>•</span>
                )}
                {video.duration && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {video.duration}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredVideos.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No videos processed yet. Click "New Transcription" to get started.</p>
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