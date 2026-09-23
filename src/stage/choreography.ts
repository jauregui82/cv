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
  /** Greeting-wiggle amount, 0-1 — tracked but unused until Phase 5. */
  wave: number
  /** Stack callout-lines visibility, 0-1 — tracked but unused until Phase 4. */
  specs: number
}

export const POSE_KEYS = ['x', 'y', 'h', 'ry', 'rx', 'rz', 'look', 'wave', 'specs'] as const

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
}

export interface PoseContext {
  mobile: boolean
  /** 0-1 progress within the current held section range (Specs' `ry`). */
  p: number
  /** Normalized (-1..1) target Y for the Work section's active job, or
   * `null` before the first job has been measured. */
  workY: number | null
  reducedMotion: boolean
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Brief table 4.2, one section at a time. `p` drives the Specs section's
 * `ry = sin(p*2π)*0.7` (suppressed under reduced motion — brief section 6's
 * "sin ... giros atados al scroll"). The Work section's `y` is not a table
 * constant; it comes from `ctx.workY`, fed by the active-job tracking in
 * `src/sections/Work.tsx` via `store.ts`.
 */
export function basePose(section: SectionIndex, ctx: PoseContext): Pose {
  const { mobile, p, workY, reducedMotion } = ctx

  switch (section) {
    case 0: // Hero
      return mobile
        ? // Brief table literally says `y:-0.3, h:0.3` here, but at that
          // size/position the avatar overlaps `.hero .lede` (the intro
          // paragraph) on mobile — forbidden by brief section 6 ("en las
          // poses fijas no debe tapar párrafos"). Fixed to `y:0.13, h:0.21`
          // in commit fbcd339 (Phase 2 verification) — that verification
          // only checked the static scrollY=0 render, since Phase 2 had no
          // scroll-driven poses yet.
          //
          // Phase 3 scrutiny found the *same* overlap resurfaces at
          // `y:0.13, h:0.21` once scroll-tied poses are real: Hero's held
          // range runs from scrollY 0 to ~211px (`bottom - 0.75*vh`) on a
          // 390x844 viewport, and `.lede` — an ordinary in-flow paragraph —
          // scrolls up 1:1 with the page while the avatar's screen position
          // stays fixed. At `y:0.13, h:0.21` the avatar's on-screen band is
          // ~[278px, 456px]; `.lede` sweeps from ~[473px, 550px] (scrollY 0)
          // up to ~[262px, 339px] (scrollY 211) — those two bands overlap
          // for most of the range, reproducible by scrolling to roughly the
          // middle of Hero's own held range (not just its start).
          //
          // Retuned again to `y:0.56, h:0.15`: smaller and anchored higher,
          // so its band (~[122px, 249px]) sits fully above `.lede`'s entire
          // swept range (up to ~262px) with a safety margin, while still
          // clearing the mono eyebrow label above it. It now overlaps the
          // giant name instead — explicitly allowed by brief section 6
          // ("los títulos gigantes sí se pueden tapar").
          { x: 0, y: 0.56, h: 0.15, ry: 0, rx: 0, rz: 0, look: 1, wave: 0, specs: 0 }
        : { x: 0, y: -0.08, h: 0.7, ry: 0, rx: 0, rz: 0, look: 1, wave: 0, specs: 0 }

    case 1: // About
      return mobile
        ? { x: 1.02, y: -0.5, h: 0.26, ry: -0.9, rx: 0.1, rz: 0.18, look: 0.4, wave: 0, specs: 0 }
        : { x: -0.6, y: -0.06, h: 0.58, ry: 0.7, rx: 0.14, rz: -0.08, look: 0.4, wave: 0, specs: 0 }

    case 2: // Specs / Stack
      return {
        x: 0,
        y: mobile ? 0.1 : -0.02,
        h: mobile ? 0.22 : 0.56,
        ry: reducedMotion ? 0 : Math.sin(p * Math.PI * 2) * 0.7,
        rx: 0.04,
        rz: 0,
        look: 0,
        wave: 0,
        specs: 1,
      }

    case 3: { // Work / Trayectoria — y tracks the active job (see workY above)
      const fallbackY = mobile ? -0.1 : 0
      const y = workY ?? fallbackY
      return mobile
        ? {
            x: 1.02,
            y: clamp(y, -0.6, 0.4),
            h: 0.22,
            ry: -0.9,
            rx: 0,
            rz: 0.18,
            look: 0.3,
            wave: 0,
            specs: 0,
          }
        : {
            x: -0.66,
            y: clamp(y, -0.6, 0.55) - 0.08,
            h: 0.3,
            ry: 0.9,
            rx: 0,
            rz: 0,
            look: 0.3,
            wave: 0,
            specs: 0,
          }
    }

    case 4: // Contact
      return mobile
        ? { x: 0, y: 0.52, h: 0.26, ry: 0, rx: 0, rz: 0, look: 0.6, wave: 1, specs: 0 }
        : { x: 0, y: 0.3, h: 0.46, ry: 0, rx: 0, rz: 0, look: 0.6, wave: 1, specs: 0 }
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
