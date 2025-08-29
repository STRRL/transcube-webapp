import { useEffect, useRef } from 'react'

interface VideoPlayerProps {
  src: string
  poster?: string
  subtitles?: Array<{
    src: string
    label: string
    language: string
    default?: boolean
  }>
}

export default function VideoPlayer({ src, poster, subtitles = [] }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Apply custom styles to video subtitles
    if (videoRef.current) {
      // Force subtitle track to be shown if it's the default
      const tracks = videoRef.current.textTracks
      if (tracks.length > 0) {
        // Enable the first/default subtitle track
        for (let i = 0; i < tracks.length; i++) {
          const track = tracks[i]
          if (track.kind === 'subtitles' || track.kind === 'captions') {
            // Set the first subtitle track as showing if it's default
            const trackElement = videoRef.current.querySelector(`track[srclang="${track.language}"]`)
            if (trackElement?.hasAttribute('default')) {
              track.mode = 'showing'
            }
          }
        }
      }
    }
  }, [subtitles])

  return (
    <div className="relative w-full h-full bg-black" ref={containerRef}>
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        controls
        poster={poster}
        crossOrigin="anonymous"
        playsInline
      >
        <source src={src} type="video/mp4" />
        {subtitles.map((sub, index) => (
          <track
            key={index}
            src={sub.src}
            kind="subtitles"
            label={sub.label}
            srcLang={sub.language}
            default={sub.default}
          />
        ))}
      </video>
    </div>
  )
}