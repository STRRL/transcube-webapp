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

export interface VideoMetadata {
  id: string
  title: string
  channel: string
  channelId: string
  duration: string
  publishedAt: string
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

// Mock function to simulate URL parsing - will be replaced with actual API
async function parseYouTubeUrl(url: string): Promise<VideoMetadata | null> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  // Extract video ID from various YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([^&\n?#]+)$/ // Just the video ID
  ]
  
  let videoId = null
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) {
      videoId = match[1]
      break
    }
  }

  if (!videoId) {
    return null
  }

  // Mock metadata - in real implementation, this would call yt-dlp
  return {
    id: videoId,
    title: 'Building Modern Web Applications with React and TypeScript',
    channel: 'Tech Education',
    channelId: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
    duration: '45:32',
    publishedAt: '2024-01-15',
    thumbnail: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
    views: '125,432',
    likes: '5,234',
    description: 'In this comprehensive tutorial, we explore modern web development using React 18 and TypeScript. Learn best practices, performance optimization, and scalable architecture patterns.',
    isValid: true,
    hasSubtitles: true,
    availableLanguages: ['en', 'en-auto', 'es', 'fr', 'de']
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
                  {new Date(metadata.publishedAt).toLocaleDateString()}
                </div>
              </div>

              {showDetails && (
                <div className="flex items-center space-x-3 text-xs text-muted-foreground">
                  <div className="flex items-center">
                    <Eye className="h-3 w-3 mr-1" />
                    {metadata.views} views
                  </div>
                  <div className="flex items-center">
                    <ThumbsUp className="h-3 w-3 mr-1" />
                    {metadata.likes}
                  </div>
                </div>
              )}

              {/* Status Badges */}
              <div className="flex items-center space-x-2 mt-2">
                <Badge variant="outline" className="text-xs">
                  <Hash className="h-3 w-3 mr-1" />
                  {metadata.id}
                </Badge>
                
                {metadata.hasSubtitles ? (
                  <Badge variant="outline" className="text-xs text-green-600">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Subtitles Available
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-orange-600">
                    <XCircle className="h-3 w-3 mr-1" />
                    No Subtitles
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