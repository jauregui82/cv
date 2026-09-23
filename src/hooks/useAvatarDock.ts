import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { useAnimationFrame, useScroll, useSpring } from 'motion/react'

// Same damping/stiffness as useSmoothScrollProgress, for a consistent feel
// across every scroll-linked motion value in the app.
const SPRING_CONFIG = {
  stiffness: 120,
  damping: 26,
  mass: 0.6,
  restDelta: 0.0005,
} as const

// Once dockProgress is this close to 1 the hero slot is off-screen and no
// longer affects the result, so we stop reading its layout rect.
const FULLY_DOCKED_THRESHOLD = 0.999

const MOBILE_BREAKPOINT = '(max-width: 860px)'

interface CornerMetrics {
  size: number
  margin: number
  mobile: boolean
  headerHeight: number
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function readCornerMetrics(): CornerMetrics {
  const styles = getComputedStyle(document.documentElement)
  const size = parseFloat(styles.getPropertyValue('--avatar-dock-size')) || 96
  const margin =
    parseFloat(styles.getPropertyValue('--avatar-dock-margin')) || 24
  const mobile = window.matchMedia(MOBILE_BREAKPOINT).matches
  // Measured live (not hardcoded) so this stays correct if Header's height
  // ever changes - the mobile corner sits below it, not underneath it.
  const headerHeight =
    document.querySelector('header')?.getBoundingClientRect().height ?? 0

  return { size, margin, mobile, headerHeight }
}

/**
 * Docks the always-mounted avatar wrapper onto the hero slot while it's in
 * view, then slides/scales it down into a fixed corner badge as the hero
 * section scrolls out of view - keeping it visible across the whole page
 * instead of scrolling away with the Hero section.
 *
 * `heroSlotRef` points at Hero's invisible `.hero__avatar-slot` placeholder,
 * which reserves the layout space the avatar used to occupy directly.
 */
export function useAvatarDock(
  heroSlotRef: RefObject<HTMLDivElement | null>,
  reducedMotion: boolean,
) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const cornerRef = useRef<CornerMetrics>({
    size: 96,
    margin: 24,
    mobile: false,
    headerHeight: 0,
  })

  const { scrollYProgress: dockProgress } = useScroll({
    target: heroSlotRef,
    offset: ['end end', 'end start'],
  })
  const smoothDockProgress = useSpring(dockProgress, SPRING_CONFIG)

  // Corner badge metrics live as CSS custom properties (AvatarDock.css) so
  // the mobile breakpoint stays defined in one place, matching Hero.css.
  useEffect(() => {
    const readAndCache = () => {
      cornerRef.current = readCornerMetrics()
    }
    readAndCache()
    window.addEventListener('resize', readAndCache)
    return () => window.removeEventListener('resize', readAndCache)
  }, [])

  // Reduced motion: no fixed follow, no interpolation. Place the avatar once
  // at the hero slot's document position (not viewport-fixed) so it scrolls
  // away naturally with the page, same as before this feature existed.
  useEffect(() => {
    if (!reducedMotion) return
    const el = wrapperRef.current
    const slot = heroSlotRef.current
    if (!el || !slot) return

    const place = () => {
      const rect = slot.getBoundingClientRect()
      el.style.position = 'absolute'
      el.style.top = `${rect.top + window.scrollY}px`
      el.style.left = `${rect.left + window.scrollX}px`
      el.style.width = `${rect.width}px`
      el.style.height = `${rect.height}px`
      el.style.transform = 'none'
    }

    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [reducedMotion, heroSlotRef])

  useAnimationFrame(() => {
    if (reducedMotion) return
    const el = wrapperRef.current
    const slot = heroSlotRef.current
    if (!el || !slot) return

    const progress = smoothDockProgress.get()
    const { size, margin, mobile, headerHeight } = cornerRef.current
    const cornerLeft = window.innerWidth - margin - size
    // Mobile docks top-right, below the fixed header - not under it.
    const cornerTop = mobile
      ? headerHeight + margin
      : window.innerHeight - margin - size

    let left: number
    let top: number
    let width: number
    let height: number

    if (progress >= FULLY_DOCKED_THRESHOLD) {
      left = cornerLeft
      top = cornerTop
      width = size
      height = size
    } else {
      const slotRect = slot.getBoundingClientRect()
      left = lerp(slotRect.left, cornerLeft, progress)
      top = lerp(slotRect.top, cornerTop, progress)
      width = lerp(slotRect.width, size, progress)
      height = lerp(slotRect.height, size, progress)
    }

    // Animate the real box (top/left/width/height) rather than
    // transform: translate/scale. @react-three/fiber's <Canvas> resizes
    // itself via react-use-measure, which reads getBoundingClientRect() -
    // a value CSS transforms distort. A transform-scaled ancestor makes
    // R3F measure the inflated, post-transform size and resize its
    // drawing buffer to match while the real CSS box stays put, producing
    // a badly mismatched (effectively invisible) render. Real box
    // dimensions keep that measurement correct.
    el.style.position = 'fixed'
    el.style.top = `${top}px`
    el.style.left = `${left}px`
    el.style.width = `${width}px`
    el.style.height = `${height}px`
  })

  return { wrapperRef }
}
