import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  AlertCircle, 
  Clock, 
  Calendar,
  User,
  Eye,
  ThumbsUp,
  Hash,
  CheckCircle2,
  XCircle,
  Globe
} from 'lucide-react'
import { ParseVideoUrl } from '../../wailsjs/go/main/App'

export interface VideoMetadata {
  id: string
  title: string
  channel: string
  channelId: string
  duration: string
  publishedAt?: string
  thumbnail: string
  views: string
  likes: string
  description: string
  isValid: boolean
  error?: string
  hasSubtitles?: boolean
  availableLanguages?: string[]
}

interface VideoPreviewProps {
  url: string
  onMetadataLoaded?: (metadata: VideoMetadata) => void
  showDetails?: boolean
}

async function parseYouTubeUrl(url: string): Promise<VideoMetadata | null> {
  try {
    const metadata = await ParseVideoUrl(url)
    if (!metadata) return null

    // Convert duration from seconds to readable format
    const duration = typeof metadata.duration === 'number' ? metadata.duration : 0
    const hours = Math.floor(duration / 3600)
    const minutes = Math.floor((duration % 3600) / 60)
    const seconds = duration % 60

    let durationStr = ''
    if (hours > 0) {
      durationStr = `${hours}h ${minutes}m`
    } else {
      durationStr = `${minutes}:${seconds.toString().padStart(2, '0')}`
    }

    const formatCount = (value: unknown) => {
      if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
        return 'N/A'
      }
      return value.toLocaleString()
    }

    const publishedAt =
      typeof metadata.publishedAt === 'string' && metadata.publishedAt.trim() !== ''
        ? metadata.publishedAt
        : undefined

    return {
      id: metadata.id,
      title: metadata.title,
      channel: metadata.channel,
      channelId: metadata.channelId || '',
      duration: durationStr,
      publishedAt,
      thumbnail: metadata.thumbnail,
      views: formatCount(metadata.viewCount),
      likes: formatCount(metadata.likeCount),
      description: metadata.description || '',
      isValid: Boolean(metadata.id),
      hasSubtitles: false,
      availableLanguages: []
    }
  } catch (err: any) {
    return {
      id: '',
      title: '',
      channel: '',
      channelId: '',
      duration: '',
      publishedAt: undefined,
      thumbnail: '',
      views: '',
      likes: '',
      description: '',
      isValid: false,
      error: err.message || 'Failed to parse URL'
    }
  }
}

export default function VideoPreview({
  url,
  onMetadataLoaded,
  showDetails = true
}: VideoPreviewProps) {
  const [loading, setLoading] = useState(false)
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    if (!url || url.trim() === '') {
      setMetadata(null)
      setError('')
      return
    }

    const loadMetadata = async () => {
      setLoading(true)
      setError('')
      
      try {
        const meta = await parseYouTubeUrl(url)
        if (meta) {
          setMetadata(meta)
          onMetadataLoaded?.(meta)
        } else {
          setError('Invalid YouTube URL')
          setMetadata(null)
        }
      } catch (err) {
        setError('Failed to fetch video information')
        setMetadata(null)
      } finally {
        setLoading(false)
      }
    }

    // Debounce URL parsing
    const timer = setTimeout(loadMetadata, 500)
    return () => clearTimeout(timer)
  }, [url, onMetadataLoaded])

  if (!url || url.trim() === '') {
    return null
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex space-x-4">
            <Skeleton className="h-24 w-40 rounded" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="p-4">
          <div className="flex items-center space-x-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!metadata) {
    return null
  }

  const publishedDateLabel = (() => {
    if (!metadata.publishedAt) {
      return 'Unknown date'
    }
    const parsed = new Date(metadata.publishedAt)
    return Number.isNaN(parsed.getTime())
      ? 'Unknown date'
      : parsed.toLocaleDateString()
  })()

  const viewsLabel =
    metadata.views && metadata.views !== 'N/A'
      ? `${metadata.views} views`
      : 'Views unavailable'

  const likesLabel =
    metadata.likes && metadata.likes !== 'N/A'
      ? `${metadata.likes} likes`
      : 'Likes unavailable'

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex space-x-4">
          {/* Thumbnail */}
          <div className="relative w-40 h-24 bg-muted rounded overflow-hidden flex-shrink-0">
            <img 
              src={metadata.thumbnail} 
              alt={metadata.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.src = `https://via.placeholder.com/160x90/09090b/ffffff?text=Video`
              }}
            />
            {metadata.duration && (
              <Badge className="absolute bottom-1 right-1 text-xs">
                {metadata.duration}
              </Badge>
            )}
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="space-y-1">
              <h3 className="font-medium text-sm line-clamp-2">{metadata.title}</h3>
              
              <div className="flex items-center space-x-3 text-xs text-muted-foreground">
                <div className="flex items-center">
                  <User className="h-3 w-3 mr-1" />
                  {metadata.channel}
                </div>
                <div className="flex items-center">
                  <Calendar className="h-3 w-3 mr-1" />
                  {publishedDateLabel}
                </div>
              </div>

              {showDetails && (
                <div className="flex items-center space-x-3 text-xs text-muted-foreground">
                  <div className="flex items-center">
                    <Eye className="h-3 w-3 mr-1" />
                    {viewsLabel}
                  </div>
                  <div className="flex items-center">
                    <ThumbsUp className="h-3 w-3 mr-1" />
                    {likesLabel}
                  </div>
                </div>
              )}

              {/* Status Badges */}
              <div className="flex items-center space-x-2 mt-2">
                {metadata.hasSubtitles && (
                  <Badge variant="outline" className="text-xs text-green-600">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Subtitles Available
                  </Badge>
                )}

                {metadata.availableLanguages && metadata.availableLanguages.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    <Globe className="h-3 w-3 mr-1" />
                    {metadata.availableLanguages.length} languages
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        {showDetails && metadata.description && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-muted-foreground line-clamp-2">
              {metadata.description}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}