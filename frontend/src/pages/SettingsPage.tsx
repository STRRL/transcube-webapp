import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  Save, 
  FolderOpen, 
  Key, 
  AlertCircle,
  CheckCircle2
} from 'lucide-react'
import { GetSettings, UpdateSettings } from '../../wailsjs/go/main/App'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { types } from '../../wailsjs/go/models'

export default function SettingsPage() {
  const [settings, setSettings] = useState<types.Settings | null>({
    workspace: '~/Downloads/TransCube',
    sourceLang: 'en',
    apiProvider: 'gemini',
    apiKey: '',
    summaryLength: 'medium',
    temperature: 0.3,
    maxTokens: 4096
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const data = await GetSettings()
      setSettings(data)
    } catch (err) {
      setError('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!settings) return
    
    setSaving(true)
    setError('')
    
    try {
      await UpdateSettings(settings)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleWorkspaceSelect = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.webkitdirectory = true
    input.onchange = (e: any) => {
      const path = e.target.files[0]?.path || '~/Downloads/TransCube'
      setSettings((prev: types.Settings | null) => prev ? { ...prev, workspace: path } : null)
    }
    input.click()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Failed to load settings</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Settings</h2>
        <div className="flex items-center space-x-2">
          {saved && (
            <Badge variant="success" className="animate-in fade-in">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Saved
            </Badge>
          )}
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center space-x-2 p-3 bg-destructive/10 text-destructive rounded-md">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
          <CardDescription>
            Configure where TransCube stores downloaded videos and transcriptions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Workspace Directory</label>
            <div className="flex space-x-2">
              <Input
                value={settings.workspace}
                onChange={(e) => setSettings({ ...settings, workspace: e.target.value })}
                placeholder="~/Downloads/TransCube"
              />
              <Button variant="outline" onClick={handleWorkspaceSelect}>
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              All video files, subtitles, and summaries will be stored in this directory
            </p>
          </div>
          
        </CardContent>
      </Card>

      

      <Card>
        <CardHeader>
          <CardTitle>AI Model</CardTitle>
          <CardDescription>
            Configure AI model for translation and summarization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Model Provider</label>
            <Select
              value={settings.apiProvider}
              onValueChange={(v) => setSettings({ ...settings, apiProvider: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini">Google Gemini 2.5 Flash</SelectItem>
                <SelectItem value="openrouter">OpenRouter (Gemini 2.5 Flash)</SelectItem>
                <SelectItem value="openai">OpenAI GPT-4</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">API Key</label>
            <div className="flex space-x-2">
              <Input
                type="password"
                value={settings.apiKey}
                onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                placeholder={
                  settings.apiProvider === 'openrouter' 
                    ? 'sk-or-v1-... (OpenRouter key)'
                    : 'sk-...'
                }
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Your API key is stored securely and never transmitted except to the AI provider
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Temperature</label>
              <Input
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={settings.temperature}
                onChange={(e) => setSettings({ ...settings, temperature: parseFloat(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">
                Lower values for more consistent output
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Max Tokens</label>
              <Input
                type="number"
                min="1000"
                max="8000"
                step="100"
                value={settings.maxTokens}
                onChange={(e) => setSettings({ ...settings, maxTokens: parseInt(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">
                Maximum output length for summaries
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      
    </div>
  )
}
