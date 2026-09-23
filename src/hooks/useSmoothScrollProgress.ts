import { useScroll, useSpring } from 'motion/react'
import type { MotionValue } from 'motion/react'

/**
 * Tracks whole-page scroll progress (0 -> 1) and smooths it through a
 * critically-damped-ish spring so downstream consumers never react to raw,
 * jittery `scrollY` deltas (trackpad scroll in particular is noisy).
 */
export function useSmoothScrollProgress(): MotionValue<number> {
  const { scrollYProgress } = useScroll()

  return useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 26,
    mass: 0.6,
    restDelta: 0.0005,
  })
}
