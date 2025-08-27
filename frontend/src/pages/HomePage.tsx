import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Clock, 
  FileText, 
  Languages, 
  Brain,
  Download,
  Plus
} from 'lucide-react'
import { processedVideos } from '@/services/processedVideos'

export default function HomePage() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')

  const filteredVideos = processedVideos.filter(video =>
    video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    video.channel.toLowerCase().includes(searchQuery.toLowerCase()) ||
    video.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  )

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
          <h1 className="text-2xl font-semibold mb-1">TransCube Library</h1>
          <p className="text-muted-foreground">
            {processedVideos.length} videos processed
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredVideos.map(video => (
          <Card 
            key={video.id} 
            className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate(`/task/${video.id}`)}
          >
            <div className="aspect-video relative bg-muted">
              <img 
                src={video.thumbnail} 
                alt={video.title}
                className="object-cover w-full h-full"
                onError={(e) => {
                  e.currentTarget.src = `https://via.placeholder.com/640x360/09090b/ffffff?text=${encodeURIComponent(video.title.substring(0, 20))}`
                }}
              />
              <Badge className="absolute top-2 left-2" variant="secondary">
                {video.channel}
              </Badge>
              <Badge className="absolute top-2 right-2" variant="secondary">
                <Clock className="h-3 w-3 mr-1" />
                {video.duration}
              </Badge>
              
              {/* Status Badges */}
              <div className="absolute bottom-2 left-2 flex gap-1">
                {video.hasTranscript && (
                  <div className="bg-background/90 rounded p-1">
                    <FileText className="h-3 w-3" />
                  </div>
                )}
                {video.hasTranslation && (
                  <div className="bg-background/90 rounded p-1">
                    <Languages className="h-3 w-3" />
                  </div>
                )}
                {video.hasSummary && (
                  <div className="bg-background/90 rounded p-1">
                    <Brain className="h-3 w-3" />
                  </div>
                )}
              </div>
              
            </div>
            
            <CardContent className="p-4">
              <h3 className="font-medium line-clamp-2 text-sm mb-1">{video.title}</h3>
              <p className="text-xs text-muted-foreground mb-2">
                Processed {formatDate(video.processedAt)} • {video.fileSize}
              </p>
              
              {/* Tags */}
              {video.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {video.tags.slice(0, 3).map(tag => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredVideos.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No videos found matching your search.</p>
        </div>
      )}
    </div>
  )
}