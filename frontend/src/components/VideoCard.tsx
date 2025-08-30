import { Play, Clock, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VideoCardProps {
  title: string
  channel: string
  thumbnail: string
  duration: string
  category?: string
  views?: string
  size?: 'small' | 'medium' | 'large'
  onClick?: () => void
}

export default function VideoCard({ 
  title, 
  channel, 
  thumbnail, 
  duration, 
  category,
  views,
  size = 'medium',
  onClick 
}: VideoCardProps) {
  const sizeClasses = {
    small: 'w-64',
    medium: 'w-80',
    large: 'w-96'
  }

  return (
    <div 
      className={cn(
        "group cursor-pointer transition-all hover:scale-[1.02]",
        sizeClasses[size]
      )}
      onClick={onClick}
    >
      <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
        <img 
          src={thumbnail} 
          alt={title}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.src = `https://via.placeholder.com/640x360/1a1a2e/ffffff?text=${encodeURIComponent(title.substring(0, 20))}`
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center">
              <Play className="w-5 h-5 text-gray-900 ml-0.5" fill="currentColor" />
            </div>
          </div>
        </div>
        <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
          <Clock className="w-3 h-3 inline mr-1" />
          {duration}
        </div>
        {category && (
          <div className="absolute top-2 left-2 bg-primary/90 text-primary-foreground text-xs px-2 py-1 rounded">
            {category}
          </div>
        )}
      </div>
      <div className="mt-3">
        <h3 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
          {title}
        </h3>
        <p className="text-xs text-muted-foreground mt-1">{channel}</p>
        {views && (
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center">
            <Eye className="w-3 h-3 mr-1" />
            {views}
          </p>
        )}
      </div>
    </div>
  )
}
