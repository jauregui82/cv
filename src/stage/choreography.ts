/**
 * Pose table (brief 4.2) + target-pose resolution: which section's pose is
 * "held" for the current scroll position, the `p` progress value inside a
 * held range, and the `easeInOutCubic` blend between one section's pose and
 * the next across the gap between ranges. Ported field-for-field from
 * `docs/design/mockup.html`'s `pose()`/`targetPose()` — that mockup is the
 * working reference for this system; where this file differs from it, the
 * difference is called out in a comment (see the Hero-mobile override
 * below).
 */

/** Matches the `<760px` breakpoint used across `src/sections/*.css`. */
export const MOBILE_BREAKPOINT = 760

/** DOM order == pose-table order == `[data-sec]` order in the mockup. */
export const SECTION_IDS = ['hero', 'about', 'specs', 'work', 'contact'] as const
export type SectionIndex = 0 | 1 | 2 | 3 | 4

export const SPECS_SECTION_INDEX: SectionIndex = 2
export const WORK_SECTION_INDEX: SectionIndex = 3

export interface Pose {
  x: number
  y: number
  h: number
  ry: number
  rx: number
  rz: number
  /** Cursor-follow amount, 0-1 (brief 4.2/4.3). */
  look: number
  /** Contact "yes"-nodding gate, 0-1 (1 in Contact, 0 elsewhere). */
  wave: number
  /** Stack callout-lines visibility, 0-1 — tracked but unused until Phase 4. */
  specs: number
  /** 1 in the hero (head sits on the "o" of "Crespo"), 0 elsewhere (brief v2 §3). */
  slot: number
}

export const POSE_KEYS = ['x', 'y', 'h', 'ry', 'rx', 'rz', 'look', 'wave', 'specs', 'slot'] as const

/** mockup.html's `cur` initial value (the Hero desktop pose) — what the
 * avatar renders as before the first `useScrollPose` measurement resolves. */
export const INITIAL_DISPLAY_POSE: Pose = {
  x: 0,
  y: -0.08,
  h: 0.7,
  ry: 0,
  rx: 0,
  rz: 0,
  look: 1,
  wave: 0,
  specs: 0,
  slot: 1,
}

export interface PoseContext {
  mobile: boolean
  /** 0-1 progress within the current held section range (Specs' `ry`). */
  p: number
  /** Normalized (-1..1) target Y for the Work section's active job, or
   * `null` before the first job has been measured. */
  workY: number | null
  /** Hero's live pose, derived every frame from the `.o-slot` letter's
   * screen position (brief v2 §3) — `null` before the first measurement. */
  heroSlot: { x: number; y: number; h: number } | null
  reducedMotion: boolean
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Brief v2 §4, one section at a time. `p` drives the Specs section's
 * `ry = sin(p*2π)*0.9` (suppressed under reduced motion — brief section 6's
 * "sin ... giros atados al scroll"). The Work section's `y` is not a table
 * constant; it comes from `ctx.workY`, fed by the active-job tracking in
 * `src/sections/Work.tsx` via `store.ts`.
 */
export function basePose(section: SectionIndex, ctx: PoseContext): Pose {
  const { mobile, p, workY, heroSlot, reducedMotion } = ctx

  switch (section) {
    // Hero: the head sits on the last "o" of "Crespo" (brief v2 §3), same
    // pose on desktop and mobile — no static table row anymore. Falls back
    // to the pre-v2 desktop values (INITIAL_DISPLAY_POSE) for the first
    // frame or two before `.o-slot` has been measured.
    case 0:
      return heroSlot
        ? { x: heroSlot.x, y: heroSlot.y, h: heroSlot.h, ry: 0, rx: 0, rz: 0, look: 1, wave: 0, specs: 0, slot: 1 }
        : { ...INITIAL_DISPLAY_POSE, slot: 1 }

    case 1: // About — curious head tilt; rx dips as you read (rx = -0.1 + p*0.42)
      return mobile
        ? { x: 1.0, y: -0.45, h: 0.24, ry: -0.85, rx: 0.05, rz: 0.22, look: 0.4, wave: 0, specs: 0, slot: 0 }
        : { x: -0.58, y: 0, h: 0.5, ry: 0.55, rx: -0.1 + p * 0.42, rz: -0.14, look: 0.35, wave: 0, specs: 0, slot: 0 }

    case 2: // Specs / Stack
      return {
        x: 0,
        y: mobile ? 0.1 : -0.04,
        h: mobile ? 0.22 : 0.5,
        ry: reducedMotion ? 0 : Math.sin(p * Math.PI * 2) * 0.9,
        rx: 0.04,
        rz: 0,
        look: 0,
        wave: 0,
        specs: 1,
        slot: 0,
      }

    case 3: { // Work / Trayectoria — y tracks the active job (see workY above)
      const y = clamp(workY ?? 0, -0.6, 0.55)
      return mobile
        ? { x: 1.0, y: clamp(y, -0.6, 0.4), h: 0.2, ry: -0.85, rx: 0.05, rz: 0.2, look: 0.3, wave: 0, specs: 0, slot: 0 }
        : { x: -0.64, y: y - 0.04, h: 0.26, ry: 0.75, rx: 0.08, rz: -0.06, look: 0.3, wave: 0, specs: 0, slot: 0 }
    }

    case 4: // Contact
      return { x: 0, y: 0.5, h: mobile ? 0.22 : 0.3, ry: 0, rx: 0, rz: 0, look: 0.6, wave: 1, specs: 0, slot: 0 }
  }
}

export function mixPose(a: Pose, b: Pose, t: number): Pose {
  const out = {} as Pose
  for (const key of POSE_KEYS) out[key] = a[key] + (b[key] - a[key]) * t
  return out
}

/** Brief 4.2's inter-section blend easing (mockup.html's `ease`). */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}
