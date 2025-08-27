import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Loader2, 
  Download, 
  FileText, 
  Languages, 
  Brain,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type TaskStage = 
  | 'pending'
  | 'downloading' 
  | 'transcribing'
  | 'translating'
  | 'summarizing'
  | 'done'
  | 'failed'

interface TaskProgressProps {
  stage: TaskStage
  progress: number
  currentDetail?: string
  estimatedTime?: string
  error?: string
  onCancel?: () => void
  onRetry?: () => void
}

const stageConfig: Record<TaskStage, {
  label: string
  icon: React.ElementType
  color: string
}> = {
  pending: {
    label: 'Pending',
    icon: Clock,
    color: 'text-gray-500'
  },
  downloading: {
    label: 'Downloading',
    icon: Download,
    color: 'text-blue-500'
  },
  transcribing: {
    label: 'Transcribing',
    icon: FileText,
    color: 'text-purple-500'
  },
  translating: {
    label: 'Translating',
    icon: Languages,
    color: 'text-indigo-500'
  },
  summarizing: {
    label: 'Summarizing',
    icon: Brain,
    color: 'text-teal-500'
  },
  done: {
    label: 'Completed',
    icon: CheckCircle2,
    color: 'text-green-500'
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    color: 'text-red-500'
  }
}

const stages: TaskStage[] = ['downloading', 'transcribing', 'translating', 'summarizing', 'done']

export default function TaskProgress({
  stage,
  progress,
  currentDetail,
  estimatedTime,
  error,
  onCancel,
  onRetry
}: TaskProgressProps) {
  const config = stageConfig[stage]
  const Icon = config.icon
  const currentStageIndex = stages.indexOf(stage)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Processing Status</CardTitle>
          <Badge variant={stage === 'failed' ? 'destructive' : stage === 'done' ? 'default' : 'secondary'}>
            {config.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stage Progress Indicators */}
        <div className="flex items-center justify-between">
          {stages.map((s, index) => {
            const StageIcon = stageConfig[s].icon
            const isActive = s === stage
            const isCompleted = index < currentStageIndex
            const isFailed = stage === 'failed' && index === currentStageIndex

            return (
              <div key={s} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                    isCompleted ? "bg-green-500 text-white" :
                    isActive && !isFailed ? "bg-primary text-primary-foreground" :
                    isFailed ? "bg-red-500 text-white" :
                    "bg-muted text-muted-foreground"
                  )}>
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : isFailed ? (
                      <XCircle className="h-5 w-5" />
                    ) : (
                      <StageIcon className="h-5 w-5" />
                    )}
                  </div>
                  <span className="text-xs mt-1">{stageConfig[s].label}</span>
                </div>
                {index < stages.length - 1 && (
                  <div className={cn(
                    "w-full h-1 mx-2",
                    index < currentStageIndex ? "bg-green-500" : "bg-muted"
                  )} />
                )}
              </div>
            )
          })}
        </div>

        {/* Current Stage Details */}
        {stage !== 'done' && stage !== 'failed' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-2">
                <Icon className={cn("h-4 w-4 animate-pulse", config.color)} />
                <span className="font-medium">{config.label}...</span>
              </div>
              {estimatedTime && (
                <span className="text-muted-foreground">{estimatedTime}</span>
              )}
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-secondary rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{currentDetail || `Processing ${config.label.toLowerCase()}...`}</span>
              <span>{Math.round(progress)}%</span>
            </div>
          </div>
        )}

        {/* Error State */}
        {stage === 'failed' && error && (
          <div className="p-3 bg-destructive/10 text-destructive rounded-md">
            <div className="flex items-start space-x-2">
              <AlertCircle className="h-4 w-4 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium">Error occurred</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Success State */}
        {stage === 'done' && (
          <div className="p-3 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 rounded-md">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm font-medium">Processing completed successfully!</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-2">
          {stage === 'failed' && onRetry && (
            <Button onClick={onRetry} variant="outline" size="sm">
              Retry
            </Button>
          )}
          {stage !== 'done' && stage !== 'failed' && onCancel && (
            <Button onClick={onCancel} variant="outline" size="sm">
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}