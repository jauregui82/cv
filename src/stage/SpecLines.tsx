import { useEffect, useRef } from 'react'
import { MOBILE_BREAKPOINT, SPECS_SECTION_INDEX } from './choreography'
import { specLinesStore } from './store'
import './SpecLines.css'

/** Brief 5.4: each tag reveals once `p >= i*0.14`. The `-0.02` slack mirrors
 * mockup.html's `tp.prog >= i*.14 - .02` — without it a tag can flicker
 * on/off for a frame right at its exact threshold instead of catching it in
 * the affirmative on that frame's slightly-less-than-exact `p`. */
const REVEAL_STEP = 0.14
const REVEAL_SLACK = 0.02
const TAG_COUNT = 5

interface CalloutRef {
  el: HTMLElement
  /** Left-side tag (brief 5.4's "alternadas a izquierda y derecha") —
   * mirrors mockup.html's `c.classList.contains('l')` check. */
  left: boolean
}

/**
 * SVG overlay (brief section 8's suggested `SpecLines.tsx`) drawing the 5
 * leader lines from each Stack tag to its projected 3D anchor point on the
 * avatar (brief 5.4 + 4.5). Lives outside the R3F `<Canvas>` — it reads the
 * per-frame anchor projections `layers.ts` writes into `specLinesStore` and
 * imperatively updates plain SVG attributes from its own
 * `requestAnimationFrame` loop, the same "no React state per frame" pattern
 * `store.ts` documents for `workTrackingStore`. It also owns toggling each
 * `.specs__callout` element's `on` class (the fade/slide reveal), since that
 * reveal state is exactly the same per-tag condition the lines need anyway
 * — mirrors mockup.html's `frame()`, which does both in one pass over the
 * same `callouts` array.
 */
export function SpecLines() {
  const pathRefs = useRef<(SVGPathElement | null)[]>([])
  const circleRefs = useRef<(SVGCircleElement | null)[]>([])
  const calloutsRef = useRef<CalloutRef[]>([])
  const mobileRef = useRef(window.innerWidth < MOBILE_BREAKPOINT)

  // Re-finds the `.specs__callout` DOM nodes on resize/fonts-ready, mirroring
  // useScrollPose.ts's own `measure()` precedent of querying the DOM
  // directly rather than threading refs across the Stage/Specs component
  // boundary (SpecLines and Specs.tsx aren't parent/child — both are
  // siblings of `<main>` in App.tsx).
  useEffect(() => {
    function remeasure() {
      mobileRef.current = window.innerWidth < MOBILE_BREAKPOINT
      calloutsRef.current = Array.from(
        document.querySelectorAll<HTMLElement>('.specs__callout'),
      ).map((el) => ({ el, left: el.classList.contains('l') }))
    }
    remeasure()

    window.addEventListener('resize', remeasure)
    const fontsReady = (document as Document & { fonts?: FontFaceSet }).fonts?.ready
    fontsReady?.then(remeasure)

    return () => window.removeEventListener('resize', remeasure)
  }, [])

  useEffect(() => {
    let frameId = requestAnimationFrame(loop)

    // Hides both the leader line AND its endpoint circle. The circle was
    // previously left untouched here - it kept whatever cx/cy/opacity it
    // last had from inside the Stack section, so it rendered as a stray dot
    // frozen over later sections (e.g. Contact) once scrolled away. Only
    // the path was ever cleared, since a circle's `opacity="0"` and a
    // path's `d=""` both fully hide the element, but a circle has no `d`.
    function clearMark(index: number) {
      pathRefs.current[index]?.setAttribute('d', '')
      circleRefs.current[index]?.setAttribute('opacity', '0')
    }

    function loop() {
      frameId = requestAnimationFrame(loop)

      const snapshot = specLinesStore.getSnapshot()
      const callouts = calloutsRef.current
      const mobile = mobileRef.current

      if (snapshot.opacity <= 0) {
        for (let i = 0; i < callouts.length; i++) {
          callouts[i].el.classList.remove('on')
          clearMark(i)
        }
        return
      }

      for (let i = 0; i < callouts.length; i++) {
        const callout = callouts[i]
        const on =
          snapshot.dominant === SPECS_SECTION_INDEX && snapshot.p >= i * REVEAL_STEP - REVEAL_SLACK
        callout.el.classList.toggle('on', on)

        const path = pathRefs.current[i]
        const circle = circleRefs.current[i]
        const anchor = snapshot.anchors[i]
        if (!on || !path || !circle || !anchor) {
          clearMark(i)
          continue
        }

        const [ax, ay] = anchor
        const rect = callout.el.getBoundingClientRect()

        // Elbow geometry ported from mockup.html's `frame()` — a straight
        // 28px "codo" out from the tag, then a diagonal down to the anchor
        // (desktop); on mobile a short 10px stub up from the tag's top-left
        // instead (brief 5.4: "líneas que salen desde arriba").
        let lx: number
        let ly: number
        let ex: number
        let ey: number
        if (mobile) {
          lx = rect.left + 4
          ex = lx
          ly = rect.top - 4
          ey = ly - 10
        } else {
          lx = callout.left ? rect.right + 12 : rect.left - 12
          ly = rect.top + 10
          ex = callout.left ? lx + 28 : lx - 28
          ey = ly
        }

        path.setAttribute('d', `M${lx},${ly} L${ex},${ey} L${ax},${ay}`)
        path.setAttribute('opacity', snapshot.opacity.toFixed(2))
        circle.setAttribute('cx', String(ax))
        circle.setAttribute('cy', String(ay))
        circle.setAttribute('opacity', snapshot.opacity.toFixed(2))
      }
    }

    return () => cancelAnimationFrame(frameId)
  }, [])

  return (
    <svg className="spec-lines" aria-hidden="true">
      {Array.from({ length: TAG_COUNT }).map((_, i) => (
        <g key={i}>
          <path
            ref={(el) => {
              pathRefs.current[i] = el
            }}
          />
          <circle
            ref={(el) => {
              circleRefs.current[i] = el
            }}
            r={4.5}
          />
        </g>
      ))}
    </svg>
  )
}
