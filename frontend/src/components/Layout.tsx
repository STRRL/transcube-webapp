import { Outlet, Link, useLocation } from 'react-router-dom'
import { 
  Search,
  List,
  Settings,
  Plus
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function Layout() {
  const location = useLocation()

  const isActive = (path: string) => {
    return location.pathname === path
  }

  return (
    <div className="flex h-screen bg-background">
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
              isActive('/') && "bg-accent text-accent-foreground"
            )}
          >
            <List className="h-4 w-4" />
            All Tasks
          </Link>
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