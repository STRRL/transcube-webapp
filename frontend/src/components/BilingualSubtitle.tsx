import { Badge } from '@/components/ui/badge'
import { FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { main } from '../../wailsjs/go/models'

interface BilingualSubtitleProps {
  subtitles: main.SubtitleEntry[]
  onTimeClick?: (time: string) => void
  className?: string
}

export default function BilingualSubtitle({
  subtitles,
  onTimeClick,
  className
}: BilingualSubtitleProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {/* Header */}
      <div className="flex items-center">
        <Badge variant="outline">
          <FileText className="h-3 w-3 mr-1" />
          {subtitles.length} entries
        </Badge>
      </div>

      {/* Subtitle Entries - Simple list */}
      <div className="space-y-3">
        {subtitles.map((subtitle) => (
          <div 
            key={subtitle.index}
            className="flex items-start gap-4 text-sm cursor-pointer hover:bg-accent/50 p-2 -mx-2 rounded transition-colors"
            onClick={() => onTimeClick?.(subtitle.startTime)}
          >
            {/* Timestamp */}
            <span className="font-mono text-muted-foreground min-w-[80px]">
              {subtitle.timestamp}
            </span>

            {/* Content */}
            <div className="flex-1 space-y-1">
              {subtitle.english && subtitle.english.trim() !== '' && (
                <p className="leading-relaxed">
                  {subtitle.english}
                </p>
              )}
              {subtitle.chinese && subtitle.chinese.trim() !== '' && (
                <p className="leading-relaxed text-muted-foreground">
                  {subtitle.chinese}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {subtitles.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No subtitles available
        </div>
      )}
    </div>
  )
}