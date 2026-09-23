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
