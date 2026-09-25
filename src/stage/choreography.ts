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

/**
 * Mobile brief §3.1: the 5 head turns that show each Stack part to the
 * camera, one at a time, over the sticky scroll budget. Same order as
 * `content.specs.groups` / `SPEC_ANCHORS` (`layers.ts`) — Cerebro, Visión,
 * Oído, Olfato, Barba. Rotations only (not anchor positions — those are
 * `SPEC_ANCHORS`, separately calibrated against the actual model).
 */
export const SPEC_MOBILE_PART_POSE: readonly { ry: number; rx: number }[] = [
  { ry: 0, rx: 0.62 },
  { ry: 0.12, rx: 0 },
  { ry: 1.25, rx: 0 },
  { ry: -1.1, rx: 0 },
  { ry: 0, rx: -0.42 },
]

/** Mobile brief §3.1's `Math.floor(p * PARTS.length)`, clamped to a valid index. */
export function specPartIndex(p: number): number {
  return Math.min(SPEC_MOBILE_PART_POSE.length - 1, Math.floor(clamp(p, 0, 0.9999) * SPEC_MOBILE_PART_POSE.length))
}

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
  /** Mobile brief §2 "slots + dock": each section's live pose resolved from
   * its DOM slot (mixed toward the header dock once it scrolls close under
   * it), or `null` before first measurement / on desktop. */
  mobilePose: {
    hero: Pose | null
    about: Pose | null
    work: Pose | null
    contact: Pose | null
    /** Stack's sticky-pinned slot position (x/y/h only — never mixed toward
     * the dock, since the head stays pinned for the whole section). */
    specs: { x: number; y: number; h: number } | null
  } | null
}

export function clamp(value: number, min: number, max: number): number {
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
  const { mobile, p, workY, heroSlot, reducedMotion, mobilePose } = ctx

  switch (section) {
    // Hero: the head sits on the last "o" of "Crespo" (brief v2 §3). On
    // mobile it also docks into the header once the "o" scrolls close under
    // it (mobile brief §2) — `mobilePose.hero` already carries that mix.
    case 0:
      if (mobile && mobilePose?.hero) return mobilePose.hero
      return heroSlot
        ? { x: heroSlot.x, y: heroSlot.y, h: heroSlot.h, ry: 0, rx: 0, rz: 0, look: 1, wave: 0, specs: 0, slot: 1 }
        : { ...INITIAL_DISPLAY_POSE, slot: 1 }

    case 1: // About — curious head tilt; rx dips as you read (rx = -0.1 + p*0.42)
      if (mobile) {
        return (
          mobilePose?.about ?? {
            x: 1.0,
            y: -0.45,
            h: 0.24,
            ry: -0.85,
            rx: 0.05,
            rz: 0.22,
            look: 0.4,
            wave: 0,
            specs: 0,
            slot: 0,
          }
        )
      }
      return { x: -0.58, y: 0, h: 0.5, ry: 0.55, rx: -0.1 + p * 0.42, rz: -0.14, look: 0.35, wave: 0, specs: 0, slot: 0 }

    case 2: { // Specs / Stack
      if (mobile) {
        const part = SPEC_MOBILE_PART_POSE[specPartIndex(p)]
        const slot = mobilePose?.specs
        return {
          x: slot?.x ?? 0,
          y: slot?.y ?? 0.1,
          h: slot?.h ?? 0.22,
          ry: part.ry,
          rx: part.rx,
          rz: 0,
          look: 0,
          wave: 0,
          specs: 1,
          slot: 0,
        }
      }
      return {
        x: 0,
        y: -0.04,
        h: 0.5,
        ry: reducedMotion ? 0 : Math.sin(p * Math.PI * 2) * 0.9,
        rx: 0.04,
        rz: 0,
        look: 0,
        wave: 0,
        specs: 1,
        slot: 0,
      }
    }

    case 3: { // Work / Trayectoria — y tracks the active job (see workY above)
      if (mobile) {
        const y = clamp(workY ?? 0, -0.6, 0.4)
        return (
          mobilePose?.work ?? {
            x: 1.0,
            y,
            h: 0.2,
            ry: -0.85,
            rx: 0.05,
            rz: 0.2,
            look: 0.3,
            wave: 0,
            specs: 0,
            slot: 0,
          }
        )
      }
      const y = clamp(workY ?? 0, -0.6, 0.55)
      return { x: -0.64, y: y - 0.04, h: 0.26, ry: 0.75, rx: 0.08, rz: -0.06, look: 0.3, wave: 0, specs: 0, slot: 0 }
    }

    case 4: // Contact
      if (mobile) {
        return mobilePose?.contact ?? { x: 0, y: 0.5, h: 0.22, ry: 0, rx: 0, rz: 0, look: 0.6, wave: 1, specs: 0, slot: 0 }
      }
      return { x: 0, y: 0.5, h: 0.3, ry: 0, rx: 0, rz: 0, look: 0.6, wave: 1, specs: 0, slot: 0 }
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
