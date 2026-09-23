import { useReducedMotion } from 'motion/react'
import type { RefObject } from 'react'
import { useSmoothScrollProgress } from '../../hooks/useSmoothScrollProgress'
import { useAvatarDock } from '../../hooks/useAvatarDock'
import { AvatarScene } from './AvatarScene'
import './AvatarDock.css'

interface AvatarDockProps {
  heroSlotRef: RefObject<HTMLDivElement | null>
}

/**
 * Always-mounted wrapper around `<AvatarScene>`, rendered once at the App
 * level so the R3F canvas/WebGL context never unmounts while scrolling.
 * Docks onto Hero's `.hero__avatar-slot` placeholder while it's in view,
 * then slides into a fixed corner badge for the rest of the page.
 */
export function AvatarDock({ heroSlotRef }: AvatarDockProps) {
  const progress = useSmoothScrollProgress()
  const reducedMotion = useReducedMotion() ?? false
  const { wrapperRef } = useAvatarDock(heroSlotRef, reducedMotion)

  return (
    <div ref={wrapperRef} className="avatar-dock">
      <AvatarScene progress={progress} reducedMotion={reducedMotion} />
    </div>
  )
}
