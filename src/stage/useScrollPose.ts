import { useCallback, useEffect, useRef } from 'react'
import {
  MOBILE_BREAKPOINT,
  SECTION_IDS,
  basePose,
  clamp,
  easeInOutCubic,
  mixPose,
} from './choreography'
import type { Pose, PoseContext, SectionIndex } from './choreography'
import { heroSlotStore, mobileSlotStore, workTrackingStore } from './store'
import type { MobileSlotSnapshot } from './store'

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
  mobile: boolean
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

  // Mobile brief §2: the Hero->About blend must not start until Hero's own
  // foot (lede/cue) has actually scrolled clear of the header — the fixed
  // `0.75vh` offset above doesn't know the "o" slot already started docking
  // by then, and content-driven beats guessing a scroll distance (works for
  // any copy length or viewport size).
  if (mobile) {
    const foot = document.querySelector('.hero .foot')
    const headerEl = document.querySelector('.site-header')
    if (foot && headerEl) {
      const footBottomDoc = foot.getBoundingClientRect().bottom + window.scrollY
      const headerHeight = headerEl.getBoundingClientRect().height
      ranges[0][1] = Math.max(ranges[0][1], footBottomDoc - headerHeight)
    }
  }

  return { ranges, mobile, viewportHeight }
}

const FALLBACK_POSE_CONTEXT: PoseContext = {
  mobile: false,
  p: 0,
  workY: null,
  heroSlot: null,
  reducedMotion: false,
  mobilePose: null,
}

/** Mobile brief §2.1: the slot's head-height parameter for the dock pose —
 * a fixed value, not the dock `<span>`'s own CSS size (38×38). */
const DOCK_HEAD_HEIGHT_PX = 36
/** Mobile brief §2.1: `t = clamp((96 - cy) / 90, 0, 1)`. */
const DOCK_TRANSITION_START_PX = 96
const DOCK_TRANSITION_RANGE_PX = 90

const NEUTRAL_POSE_EXTRA: Omit<Pose, 'x' | 'y' | 'h'> = {
  ry: 0,
  rx: 0,
  rz: 0,
  look: 0,
  wave: 0,
  specs: 0,
  slot: 0,
}

function toNormalizedPose(
  centerX: number,
  cy: number,
  hp: number,
  viewportWidth: number,
  viewportHeight: number,
  extra: Partial<Pose>,
): Pose {
  return {
    x: (centerX / viewportWidth) * 2 - 1,
    y: 1 - (2 * cy) / viewportHeight,
    h: hp / viewportHeight,
    ...NEUTRAL_POSE_EXTRA,
    ...extra,
  }
}

/**
 * Mobile brief §2.1 "slots + dock": resolves a section's live pose from its
 * DOM slot, mixed toward the header dock's pose once the slot's center
 * scrolls within `DOCK_TRANSITION_RANGE_PX` of the header. Falls back to the
 * dock pose alone when the slot itself isn't active/measured yet (brief's
 * "si no hay trabajo activo visible, va al dock", generalized to every
 * slot), and to `null` only when neither has been measured yet.
 */
function resolveSlotPose(
  slot: MobileSlotSnapshot,
  dock: MobileSlotSnapshot,
  viewportWidth: number,
  viewportHeight: number,
  extra: Partial<Pose>,
): Pose | null {
  const dockPose =
    dock.centerX != null && dock.cy != null
      ? toNormalizedPose(dock.centerX, dock.cy, DOCK_HEAD_HEIGHT_PX, viewportWidth, viewportHeight, {
          ry: -0.35,
          rx: 0.22,
        })
      : null

  if (slot.centerX == null || slot.cy == null || slot.hp == null) {
    return dockPose
  }

  const slotPose = toNormalizedPose(slot.centerX, slot.cy, slot.hp, viewportWidth, viewportHeight, extra)
  if (!dockPose) return slotPose

  const t = clamp((DOCK_TRANSITION_START_PX - slot.cy) / DOCK_TRANSITION_RANGE_PX, 0, 1)
  if (t <= 0) return slotPose

  return mixPose(slotPose, dockPose, easeInOutCubic(t))
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
      return { pose: basePose(0, FALLBACK_POSE_CONTEXT), dominant: 0, p: 0, mobile: false }
    }

    const { ranges, mobile, viewportHeight } = measurements
    const viewportWidth = window.innerWidth
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
            x: (slotSnapshot.centerX / viewportWidth) * 2 - 1,
            y: 1 - (2 * slotSnapshot.cy) / viewportHeight,
            h: slotSnapshot.hp / viewportHeight,
          }
        : null

    // Mobile brief §2: each section's slot-or-dock pose, resolved once per
    // call (cheap — plain object math) rather than per `basePose` case, so
    // every consumer of `ctx.mobilePose` sees the same frame's measurement.
    const mobilePose = mobile
      ? {
          hero: resolveSlotPose(slotSnapshot, mobileSlotStore.getSnapshot('dock'), viewportWidth, viewportHeight, {
            look: 1,
            slot: 1,
          }),
          about: resolveSlotPose(
            mobileSlotStore.getSnapshot('about'),
            mobileSlotStore.getSnapshot('dock'),
            viewportWidth,
            viewportHeight,
            { ry: 0.35, rx: 0.28, rz: -0.1, look: 0.4 },
          ),
          work: resolveSlotPose(
            mobileSlotStore.getSnapshot('work'),
            mobileSlotStore.getSnapshot('dock'),
            viewportWidth,
            viewportHeight,
            { ry: -0.55, rx: 0.12, look: 0.3 },
          ),
          contact: resolveSlotPose(
            mobileSlotStore.getSnapshot('contact'),
            mobileSlotStore.getSnapshot('dock'),
            viewportWidth,
            viewportHeight,
            { wave: 1, look: 0.6 },
          ),
        }
      : null

    const contextFor = (p: number): PoseContext => ({ mobile, p, workY, heroSlot, reducedMotion, mobilePose })
    const scrollY = window.scrollY

    for (let i = 0; i < ranges.length; i++) {
      const [a, b] = ranges[i]
      if (scrollY >= a && scrollY <= b) {
        const p = b > a ? (scrollY - a) / (b - a) : 0
        return { pose: basePose(i as SectionIndex, contextFor(p)), dominant: i as SectionIndex, p, mobile }
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
        return { pose, dominant, p: t < 0.5 ? 1 : 0, mobile }
      }
    }

    const last = (ranges.length - 1) as SectionIndex
    return { pose: basePose(last, contextFor(1)), dominant: last, p: 1, mobile }
  }, [])

  return { getTargetPose }
}
