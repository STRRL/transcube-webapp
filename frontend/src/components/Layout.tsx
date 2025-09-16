import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { 
  Search,
  List,
  Settings,
  Plus,
  Tv,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { GetAllTasks } from '../../wailsjs/go/main/App'
import { EventsOn } from '../../wailsjs/runtime/runtime'
import { types } from '../../wailsjs/go/models'

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [channels, setChannels] = useState<Record<string, number>>({})
  const [showChannels, setShowChannels] = useState(true)
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null)

  const isActive = (path: string) => {
    return location.pathname === path
  }

  useEffect(() => {
    loadChannels()

    const offReload = EventsOn('reload-videos', () => {
      loadChannels()
    })

    return () => {
      offReload()
    }
  }, [])

  const loadChannels = async () => {
    try {
      const tasks = await GetAllTasks()
      const channelCount = {} as Record<string, number>
      
      (tasks || []).forEach((task: types.Task) => {
        if (task.status === 'done' && task.channel) {
          channelCount[task.channel] = (channelCount[task.channel] || 0) + 1
        }
      })
      
      setChannels(channelCount)
    } catch (err) {
      console.error('Failed to load channels:', err)
    }
  }

  const handleChannelClick = (channel: string) => {
    setSelectedChannel(channel)
    navigate(`/?channel=${encodeURIComponent(channel)}`)
  }

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const channel = params.get('channel')
    setSelectedChannel(channel)
  }, [location])

  return (
    <div className="flex h-full w-full bg-background">
      {/* Sidebar */}
      <div className="w-64 border-r bg-muted/10">
        <div className="p-4 border-b">
          <h1 className="font-semibold text-lg">TransCube</h1>
        </div>

        <div className="p-4">
          <Button 
            className="w-full justify-start" 
            variant={location.pathname === '/new' ? 'secondary' : 'ghost'}
            asChild
          >
            <Link to="/new">
              <Plus className="mr-2 h-4 w-4" />
              New Transcription
            </Link>
          </Button>
        </div>

        <div className="px-4 pb-4">
          <Link
            to="/"
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground",
              isActive('/') && !selectedChannel && "bg-accent text-accent-foreground"
            )}
          >
            <List className="h-4 w-4" />
            All Tasks
          </Link>
          
          {Object.keys(channels).length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setShowChannels(!showChannels)}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground rounded-md"
              >
                {showChannels ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <Tv className="h-4 w-4" />
                By Channels
              </button>
              
              {showChannels && (
                <div className="mt-1 ml-4 space-y-1">
                  {Object.entries(channels)
                    .sort((a, b) => b[1] - a[1])
                    .map(([channel, count]) => (
                      <button
                        key={channel}
                        onClick={() => handleChannelClick(channel)}
                        className={cn(
                          "flex items-center justify-between w-full px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground rounded-md",
                          selectedChannel === channel && "bg-accent text-accent-foreground"
                        )}
                      >
                        <span className="truncate mr-2">{channel}</span>
                        <span className="text-xs text-muted-foreground">{count}</span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="absolute bottom-0 w-64 p-4 border-t">
          <Link
            to="/settings"
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground",
              isActive('/settings') && "bg-accent text-accent-foreground"
            )}
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  )
}