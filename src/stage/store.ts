/**
 * Shared state between the DOM (`src/sections/Work.tsx`) and the canvas
 * (`src/stage/layers.ts`) for the Work section's active-job tracking (brief
 * section 8: "estado compartido ... trabajo activo ... en un `ref`
 * mutable, sin provocar re-renders en cada fotograma").
 *
 * `Work.tsx` writes here on every scroll/resize (continuous data — the
 * active job's on-screen position changes on every scroll pixel, not just
 * when the active index changes). `layers.ts` reads `getSnapshot()` once
 * per animation frame; nothing here is React state, so none of this causes
 * a render.
 *
 * `jumpVersion` is the discrete "active job changed" signal (brief 4.3
 * "Salto"): it only increments on a genuine transition between two known
 * jobs, mirroring mockup.html's `activeJob !== -1 && best !== -1` guard —
 * so the initial detection on mount, and losing track when scrolled away
 * from the Work section, don't fire a spurious jump. `layers.ts` polls this
 * counter each frame and diffs it against the value it last saw.
 */
import type { SectionIndex } from './choreography'

export interface WorkTrackingSnapshot {
  /** Index into `work.jobs`, or -1 if no job is currently in view. */
  activeIndex: number
  /** Viewport-space Y (px) of the active job's "aim" point, or null. */
  activeScreenTop: number | null
  jumpVersion: number
}

const snapshot: WorkTrackingSnapshot = {
  activeIndex: -1,
  activeScreenTop: null,
  jumpVersion: 0,
}

export const workTrackingStore = {
  getSnapshot(): Readonly<WorkTrackingSnapshot> {
    return snapshot
  },

  update(index: number, screenTop: number | null) {
    const prevIndex = snapshot.activeIndex
    snapshot.activeIndex = index
    snapshot.activeScreenTop = screenTop
    if (prevIndex !== -1 && index !== -1 && index !== prevIndex) {
      snapshot.jumpVersion += 1
    }
  },
}

/**
 * Shared state between the canvas (`src/stage/layers.ts`) and the DOM
 * (`src/stage/SpecLines.tsx`) for the Stack section's leader lines (brief
 * 5.4 + 4.5). `layers.ts` writes this every animation frame from inside the
 * R3F tree, where the avatar's `matrixWorld` and the camera are available —
 * it projects the 5 model-space anchor points (brain/glasses/torso/hand/
 * feet) through the avatar's current world transform and the camera into
 * screen-space pixels. `SpecLines.tsx` reads `getSnapshot()` from its own
 * `requestAnimationFrame` loop outside the canvas and imperatively updates
 * SVG element attributes with it — nothing here is React state, so none of
 * this causes a render (same rationale as `workTrackingStore` above).
 */
export interface SpecLinesSnapshot {
  /** Screen-space [x, y] px for each of the 5 anchor points, in
   * `content.specs.groups` order (Cerebro/Visión/Núcleo/Manos/Base). `null`
   * entries are only possible before the avatar's first frame. */
  anchors: ([number, number] | null)[]
  /** Raw (undamped) dominant section index from this frame's scroll-pose
   * read — `ScrollPoseResult.dominant`. */
  dominant: SectionIndex
  /** Raw progress-within-range for the dominant section this frame —
   * `ScrollPoseResult.p`. */
  p: number
  /** Damped 0-1 visibility for the whole leader-lines group — `Pose.specs`
   * after the same exponential smoothing as the rest of the displayed pose
   * (brief 4.2's `k`); 0 outside Specs' held+blend range. */
  opacity: number
}

const specLinesSnapshot: SpecLinesSnapshot = {
  anchors: [null, null, null, null, null],
  dominant: 0,
  p: 0,
  opacity: 0,
}

export const specLinesStore = {
  getSnapshot(): Readonly<SpecLinesSnapshot> {
    return specLinesSnapshot
  },

  update(anchors: ([number, number] | null)[], dominant: SectionIndex, p: number, opacity: number) {
    specLinesSnapshot.anchors = anchors
    specLinesSnapshot.dominant = dominant
    specLinesSnapshot.p = p
    specLinesSnapshot.opacity = opacity
  },
}

/**
 * DOM -> canvas one-shot triggers for the two "spin"-group animations
 * (brief 4.3 "Toque"/"Voltereta"): `AvatarTapListener` (`Avatar.tsx`) bumps
 * `pokeVersion` on a hit-confirmed click, and the Header's ES/EN toggle
 * bumps `flipVersion` before delaying the actual language swap by 450ms.
 * `layers.ts` polls `getSnapshot()` once per frame and diffs each version
 * against the value it last saw — same "fire once per transition" pattern
 * as `workTrackingStore.jumpVersion` above. Poke and flip are independent
 * counters (not a single "busy" flag): the mockup's own `poke`/`flip`
 * progress vars drive different `spin` rotation axes (Y vs X) and are never
 * checked against each other, so both can be in flight at once, and
 * re-triggering either one just restarts that one's progress from 0 —
 * mirrored exactly here, see `layers.ts`.
 */
export interface AvatarActionSnapshot {
  pokeVersion: number
  flipVersion: number
}

const avatarActionSnapshot: AvatarActionSnapshot = {
  pokeVersion: 0,
  flipVersion: 0,
}

export const avatarActionStore = {
  getSnapshot(): Readonly<AvatarActionSnapshot> {
    return avatarActionSnapshot
  },

  triggerPoke() {
    avatarActionSnapshot.pokeVersion += 1
  },

  triggerFlip() {
    avatarActionSnapshot.flipVersion += 1
  },
}

/**
 * DOM -> canvas bridge for the hero's `.o-slot` measurement (brief v2 §3).
 * `Hero.tsx` writes the letter's live screen position on scroll/resize;
 * `useScrollPose.ts` reads it each frame to compute the Hero pose. `cy` and
 * `hp` are already the baseline-relative center Y and head-height in CSS
 * px — `Hero.tsx` does that arithmetic itself, mirroring how `Work.tsx`
 * bakes its own `AIM_OFFSET_PX` into `workTrackingStore` before writing.
 */
export interface HeroSlotSnapshot {
  centerX: number | null
  cy: number | null
  hp: number | null
}

const heroSlotSnapshot: HeroSlotSnapshot = { centerX: null, cy: null, hp: null }

export const heroSlotStore = {
  getSnapshot(): Readonly<HeroSlotSnapshot> {
    return heroSlotSnapshot
  },

  update(centerX: number, cy: number, hp: number) {
    heroSlotSnapshot.centerX = centerX
    heroSlotSnapshot.cy = cy
    heroSlotSnapshot.hp = hp
  },
}

/**
 * Canvas -> DOM bridge for the real "o" glyph's opacity (brief v2 §3:
 * `1 - min(1, slot*1.25)`, driven by the damped `slot` pose value).
 * `layers.ts` writes it every frame; `Hero.tsx` reads it from its own rAF
 * loop, same shape as `SpecLines.tsx`'s read of `specLinesStore`.
 */
const heroOSnapshot = { opacity: 1 }

export const heroOStore = {
  getSnapshot(): Readonly<typeof heroOSnapshot> {
    return heroOSnapshot
  },

  update(opacity: number) {
    heroOSnapshot.opacity = opacity
  },
}

/**
 * Canvas -> DOM bridge for the speech bubble (`SpeechBubble.tsx`, brief
 * 4.4). `layers.ts` writes `headAnchor` every frame — the model-space head
 * point `(0.1, 0.98, 0)` (distinct from `SPEC_ANCHORS`'s Cerebro point)
 * projected through the avatar's live world transform + camera, same
 * technique as `specLinesStore`'s anchors above. `sectionChangeVersion`
 * increments whenever `dominant` changes, the "entered a new section"
 * signal the bubble auto-triggers on — same fire-once-per-transition shape
 * as `jumpVersion`, except (unlike `jumpVersion`) the very first value counts
 * as a transition too, so Hero's own line greets on initial mount, matching
 * mockup.html's load-time greet.
 */
export interface AvatarHeadSnapshot {
  headAnchor: [number, number] | null
  dominant: SectionIndex
  sectionChangeVersion: number
}

const avatarHeadSnapshot: AvatarHeadSnapshot = {
  headAnchor: null,
  dominant: 0,
  sectionChangeVersion: 0,
}

let lastKnownDominant: SectionIndex | null = null

export const avatarHeadStore = {
  getSnapshot(): Readonly<AvatarHeadSnapshot> {
    return avatarHeadSnapshot
  },

  update(headAnchor: [number, number] | null, dominant: SectionIndex) {
    if (lastKnownDominant === null || dominant !== lastKnownDominant) {
      avatarHeadSnapshot.sectionChangeVersion += 1
    }
    lastKnownDominant = dominant
    avatarHeadSnapshot.dominant = dominant
    avatarHeadSnapshot.headAnchor = headAnchor
  },
}
