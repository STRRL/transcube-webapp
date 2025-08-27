import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Copy, 
  Check, 
  Download,
  Play,
  Languages,
  FileText
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SubtitleEntry {
  index: number
  timestamp: string
  startTime: string
  endTime: string
  english: string
  chinese?: string
}

interface BilingualSubtitleProps {
  subtitles: SubtitleEntry[]
  onTimeClick?: (time: string) => void
  showTimestamps?: boolean
  className?: string
}

export default function BilingualSubtitle({
  subtitles,
  onTimeClick,
  showTimestamps = true,
  className
}: BilingualSubtitleProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'bilingual' | 'english' | 'chinese'>('bilingual')

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  const copyAllSubtitles = () => {
    const text = subtitles.map(sub => {
      if (viewMode === 'english') return `${sub.timestamp}\n${sub.english}`
      if (viewMode === 'chinese') return `${sub.timestamp}\n${sub.chinese || ''}`
      return `${sub.timestamp}\n${sub.english}\n${sub.chinese || ''}`
    }).join('\n\n')
    
    navigator.clipboard.writeText(text)
    setCopiedIndex(-1)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  const exportSRT = () => {
    const srtContent = subtitles.map(sub => {
      const content = viewMode === 'english' ? sub.english :
                     viewMode === 'chinese' ? sub.chinese || '' :
                     `${sub.english}\n${sub.chinese || ''}`
      return `${sub.index}\n${sub.startTime} --> ${sub.endTime}\n${content}`
    }).join('\n\n')

    const blob = new Blob([srtContent], { type: 'text/srt' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `subtitle_${viewMode}.srt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Badge variant="outline">
            <FileText className="h-3 w-3 mr-1" />
            {subtitles.length} entries
          </Badge>
          
          {/* View Mode Selector */}
          <div className="flex rounded-md border">
            <Button
              variant={viewMode === 'bilingual' ? 'secondary' : 'ghost'}
              size="sm"
              className="rounded-r-none"
              onClick={() => setViewMode('bilingual')}
            >
              <Languages className="h-4 w-4 mr-1" />
              Bilingual
            </Button>
            <Button
              variant={viewMode === 'english' ? 'secondary' : 'ghost'}
              size="sm"
              className="rounded-none border-x"
              onClick={() => setViewMode('english')}
            >
              English
            </Button>
            <Button
              variant={viewMode === 'chinese' ? 'secondary' : 'ghost'}
              size="sm"
              className="rounded-l-none"
              onClick={() => setViewMode('chinese')}
            >
              中文
            </Button>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={copyAllSubtitles}
          >
            {copiedIndex === -1 ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Copy All
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportSRT}
          >
            <Download className="h-4 w-4 mr-2" />
            Export SRT
          </Button>
        </div>
      </div>

      {/* Subtitle Entries */}
      <div className="space-y-2">
        {subtitles.map((subtitle) => (
          <Card 
            key={subtitle.index}
            className="p-4 hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-start space-x-4">
              {/* Timestamp */}
              {showTimestamps && (
                <button
                  onClick={() => onTimeClick?.(subtitle.startTime)}
                  className="flex items-center space-x-1 text-xs font-mono text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  <Play className="h-3 w-3" />
                  <span>{subtitle.timestamp}</span>
                </button>
              )}

              {/* Content */}
              <div className="flex-1 space-y-1">
                {(viewMode === 'english' || viewMode === 'bilingual') && (
                  <p className="text-sm leading-relaxed">
                    {subtitle.english}
                  </p>
                )}
                {(viewMode === 'chinese' || viewMode === 'bilingual') && subtitle.chinese && (
                  <p className={cn(
                    "text-sm leading-relaxed",
                    viewMode === 'bilingual' && "text-muted-foreground"
                  )}>
                    {subtitle.chinese}
                  </p>
                )}
              </div>

              {/* Copy Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const text = viewMode === 'english' ? subtitle.english :
                              viewMode === 'chinese' ? subtitle.chinese || '' :
                              `${subtitle.english}\n${subtitle.chinese || ''}`
                  copyToClipboard(text, subtitle.index)
                }}
              >
                {copiedIndex === subtitle.index ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </Card>
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