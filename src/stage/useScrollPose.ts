import { useCallback, useEffect, useRef } from 'react'
import {
  MOBILE_BREAKPOINT,
  SECTION_IDS,
  basePose,
  easeInOutCubic,
  mixPose,
} from './choreography'
import type { Pose, PoseContext, SectionIndex } from './choreography'
import { heroSlotStore, workTrackingStore } from './store'

interface Measurements {
  /** `[rangeStart, rangeEnd]` per section, document-relative scrollY. */
  ranges: [number, number][]
  mobile: boolean
  viewportHeight: number
}

export interface ScrollPoseResult {
  pose: Pose
  dominant: SectionIndex
  p: number
}

export interface ScrollPoseApi {
  getTargetPose: (reducedMotion: boolean) => ScrollPoseResult
}

/**
 * Brief 4.2's per-section scroll ranges: a pose is "held" between
 * `top - 0.45*vh` and `bottom - 0.75*vh` (document-relative). Mirrors
 * mockup.html's `measure()`.
 */
function measure(): Measurements {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const mobile = viewportWidth < MOBILE_BREAKPOINT

  const ranges = SECTION_IDS.map((id, index): [number, number] => {
    const el = document.getElementById(id)
    if (!el) return [index === 0 ? -Infinity : 0, 0]

    const rect = el.getBoundingClientRect()
    const top = rect.top + window.scrollY
    const bottom = top + rect.height

    const a = index === 0 ? -Infinity : top - viewportHeight * 0.45
    const b = bottom - viewportHeight * 0.75
    return [a, Math.max(a, b)]
  })

  return { ranges, mobile, viewportHeight }
}

const FALLBACK_POSE_CONTEXT: PoseContext = {
  mobile: false,
  p: 0,
  workY: null,
  heroSlot: null,
  reducedMotion: false,
}

/**
 * Scroll-driven target pose (brief 4.2 + mockup.html's `targetPose()`): the
 * held pose for whichever section range the current scroll position falls
 * in, or an `easeInOutCubic` blend across the gap between two sections.
 * Re-measures section ranges on resize/load/fonts-ready, but reads
 * `window.scrollY` fresh on every call — cheap enough to call directly from
 * the avatar's `useFrame` loop (see `layers.ts`), same as the mockup reads
 * `scrollY` directly in its own rAF loop with no scroll listener.
 */
export function useScrollPose(): ScrollPoseApi {
  const measurementsRef = useRef<Measurements | null>(null)

  useEffect(() => {
    function remeasure() {
      measurementsRef.current = measure()
    }
    remeasure()

    window.addEventListener('resize', remeasure)
    window.addEventListener('load', remeasure)
    const fontsReady = (document as Document & { fonts?: FontFaceSet }).fonts?.ready
    fontsReady?.then(remeasure)

    return () => {
      window.removeEventListener('resize', remeasure)
      window.removeEventListener('load', remeasure)
    }
  }, [])

  const getTargetPose = useCallback((reducedMotion: boolean): ScrollPoseResult => {
    const measurements = measurementsRef.current
    if (!measurements || measurements.ranges.length === 0) {
      return { pose: basePose(0, FALLBACK_POSE_CONTEXT), dominant: 0, p: 0 }
    }

    const { ranges, mobile, viewportHeight } = measurements
    const workSnapshot = workTrackingStore.getSnapshot()
    const workY =
      workSnapshot.activeScreenTop != null
        ? 1 - 2 * (workSnapshot.activeScreenTop / viewportHeight)
        : null

    // Same -1..1/fraction-of-screen-height conversion as `workY` above,
    // applied to the `.o-slot` measurement `Hero.tsx` writes on scroll/
    // resize (brief v2 §3).
    const slotSnapshot = heroSlotStore.getSnapshot()
    const heroSlot =
      slotSnapshot.centerX != null && slotSnapshot.cy != null && slotSnapshot.hp != null
        ? {
            x: (slotSnapshot.centerX / window.innerWidth) * 2 - 1,
            y: 1 - (2 * slotSnapshot.cy) / viewportHeight,
            h: slotSnapshot.hp / viewportHeight,
          }
        : null

    const contextFor = (p: number): PoseContext => ({ mobile, p, workY, heroSlot, reducedMotion })
    const scrollY = window.scrollY

    for (let i = 0; i < ranges.length; i++) {
      const [a, b] = ranges[i]
      if (scrollY >= a && scrollY <= b) {
        const p = b > a ? (scrollY - a) / (b - a) : 0
        return { pose: basePose(i as SectionIndex, contextFor(p)), dominant: i as SectionIndex, p }
      }

      const next = ranges[i + 1]
      if (next && scrollY > b && scrollY < next[0]) {
        const t = easeInOutCubic((scrollY - b) / (next[0] - b))
        const dominant = (t < 0.5 ? i : i + 1) as SectionIndex
        const pose = mixPose(
          basePose(i as SectionIndex, contextFor(1)),
          basePose((i + 1) as SectionIndex, contextFor(0)),
          t,
        )
        return { pose, dominant, p: t < 0.5 ? 1 : 0 }
      }
    }

    const last = (ranges.length - 1) as SectionIndex
    return { pose: basePose(last, contextFor(1)), dominant: last, p: 1 }
  }, [])

  return { getTargetPose }
}
