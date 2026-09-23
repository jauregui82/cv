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
