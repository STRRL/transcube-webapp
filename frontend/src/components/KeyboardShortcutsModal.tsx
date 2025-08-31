import { X } from 'lucide-react'

interface KeyboardShortcutsModalProps {
  isOpen: boolean
  onClose: () => void
}

interface ShortcutItem {
  key: string
  description: string
}

interface ShortcutSection {
  title: string
  shortcuts: ShortcutItem[]
}

const shortcuts: ShortcutSection[] = [
  {
    title: 'PLAYBACK',
    shortcuts: [
      { key: 'k', description: 'Toggle play/pause' },
      { key: 'j', description: 'Rewind 10 seconds' },
      { key: 'l', description: 'Fast forward 10 seconds' },
      { key: '←', description: 'Rewind 5 seconds' },
      { key: '→', description: 'Fast forward 5 seconds' },
      { key: ',', description: 'Previous frame (while paused)' },
      { key: '.', description: 'Next frame (while paused)' },
      { key: '<', description: 'Decrease playback rate' },
      { key: '>', description: 'Increase playback rate' },
      { key: '0...9', description: 'Seek to specific point in the video (7 advances to 70% of duration)' },
    ]
  },
  {
    title: 'GENERAL',
    shortcuts: [
      { key: 'f', description: 'Toggle full screen' },
      { key: 'm', description: 'Toggle mute' },
      { key: 'c', description: 'Toggle captions ON/OFF' },
      { key: '↑', description: 'Increase volume 5%' },
      { key: '↓', description: 'Decrease volume 5%' },
      { key: 'SPACE', description: 'Toggle play/pause' },
      { key: 'ESCAPE', description: 'Exit full screen' },
      { key: '?', description: 'Show keyboard shortcuts' },
    ]
  }
]

export default function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div 
        className="bg-[#0f0f0f] text-white rounded-lg shadow-2xl max-w-3xl w-full mx-4 max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-xl font-semibold">Keyboard shortcuts</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto max-h-[calc(80vh-80px)]">
          <div className="grid md:grid-cols-2 gap-8">
            {shortcuts.map((section) => (
              <div key={section.title}>
                <h3 className="text-sm font-semibold text-gray-400 mb-4">{section.title}</h3>
                <div className="space-y-3">
                  {section.shortcuts.map((shortcut) => (
                    <div key={shortcut.key} className="flex items-start gap-4">
                      <span className="text-sm text-gray-300 min-w-[80px] font-mono">
                        {shortcut.key}
                      </span>
                      <span className="text-sm text-gray-400">
                        {shortcut.description}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-8 pt-6 border-t border-gray-800">
            <p className="text-xs text-gray-500 text-center">
              Press ESC or click outside to close
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}