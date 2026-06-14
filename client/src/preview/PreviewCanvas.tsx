import { useEffect, useRef } from 'react'
import { FootageEngine, type AudioSource, type FootageState } from '@engine/footage/FootageEngine'
import { bundledArchive } from './sampleArchive'

// React host for the FOUND / FOOTAGE engine. React owns two stacked <canvas>
// elements (WebGL field + 2D typography overlay); the engine runs its own loop
// outside React. The default sample archive is loaded on mount so the idle
// "archive view" shows the real point cloud.

export function PreviewCanvas({
  audioSource,
  onReady,
  onState,
}: {
  audioSource?: AudioSource
  onReady?: (engine: FootageEngine) => void
  onState?: (state: FootageState) => void
}) {
  const glRef = useRef<HTMLCanvasElement | null>(null)
  const overlayRef = useRef<HTMLCanvasElement | null>(null)
  const engineRef = useRef<FootageEngine | null>(null)
  const onStateRef = useRef(onState)
  onStateRef.current = onState

  useEffect(() => {
    const gl = glRef.current
    const overlay = overlayRef.current
    if (!gl || !overlay) return
    const engine = new FootageEngine({ audioSource, onState: (s) => onStateRef.current?.(s) })
    engine.boot(gl, overlay)
    void engine.setManifest(bundledArchive())
    engineRef.current = engine
    onReady?.(engine)
    return () => {
      engine.dispose()
      engineRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <canvas ref={glRef} className="preview__canvas" />
      <canvas ref={overlayRef} className="preview__overlay" />
    </>
  )
}
