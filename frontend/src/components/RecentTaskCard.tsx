import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Loader2, AlertCircle, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
interface RecentTask {
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

interface RecentTaskCardProps {
  task: RecentTask
}

export default function RecentTaskCard({ task }: RecentTaskCardProps) {
  const navigate = useNavigate()
  
  const getStatusIcon = () => {
    switch (task.status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />
      case 'processing':
        return <Loader2 className="w-4 h-4 text-primary animate-spin" />
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />
    }
  }

  const getStatusBadge = () => {
    const variants = {
      completed: 'success' as const,
      processing: 'secondary' as const,
      failed: 'destructive' as const
    }
    return (
      <Badge variant={variants[task.status as keyof typeof variants]} className="text-xs">
        {task.status}
      </Badge>
    )
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    
    if (hours < 1) {
      const mins = Math.floor(diff / (1000 * 60))
      return `${mins} min ago`
    } else if (hours < 24) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`
    } else {
      const days = Math.floor(hours / 24)
      return `${days} day${days > 1 ? 's' : ''} ago`
    }
  }

  return (
    <div 
      className={cn(
        "flex items-center space-x-3 p-3 rounded-lg hover:bg-secondary/50 cursor-pointer transition-colors",
        task.status === 'processing' && "bg-secondary/50"
      )}
      onClick={() => navigate(`/task/${task.id}`)}
    >
      <div className="relative w-20 h-12 bg-gray-900 rounded overflow-hidden flex-shrink-0">
        <img 
          src={task.thumbnail} 
          alt={task.title}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.src = `https://via.placeholder.com/160x90/1a1a2e/ffffff?text=Video`
          }}
        />
        {task.status === 'processing' && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white text-xs font-medium">{task.progress}%</span>
          </div>
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0 mr-2">
            <h4 className="text-sm font-medium truncate">{task.title}</h4>
            <p className="text-xs text-muted-foreground truncate">{task.channel}</p>
            <div className="flex items-center space-x-2 mt-1">
              <Clock className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{task.duration}</span>
              {task.completedAt && (
                <>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground">
                    {formatTime(task.completedAt)}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            {getStatusBadge()}
          </div>
        </div>
        {task.status === 'processing' && (
          <div className="mt-2">
            <div className="w-full bg-secondary rounded-full h-1.5">
              <div 
                className="bg-primary h-1.5 rounded-full transition-all"
                style={{ width: `${task.progress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
