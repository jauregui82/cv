import { Fragment, useEffect, useRef, useState } from 'react'
import { useLanguage } from '../hooks/useLanguage'
import { Reveal } from '../components/Reveal'
import { SPECS_SECTION_INDEX, specPartIndex } from '../stage/choreography'
import { mobileSlotStore, specLinesStore } from '../stage/store'
import './Specs.css'

/** Brief 5.4's per-tag vertical position within `.specs__callouts` — ported
 * verbatim from mockup.html's `style="top:X%"` inline attributes. */
const CALLOUT_TOP_PERCENT = [4, 22, 44, 60, 80]

/** Mobile brief §3: the card's 180ms fade when the active part changes —
 * mirrors mockup.html's `card.classList.add('swap')` timing. */
const CARD_SWAP_MS = 180

/**
 * Phase 4 ("Stack sticky", brief 5.4): a 320vh scroll budget with a
 * `position: sticky` inner pin holding the visible content. `SpecLines.tsx`
 * (an overlay sibling in App.tsx, not nested here) owns revealing each
 * `.specs__callout` by scroll tramo and drawing the leader lines to the
 * avatar — it toggles the `on` class this file's CSS keys the reveal
 * animation off, and reads each callout's `getBoundingClientRect()`
 * directly, so no scroll-position state needs to live in this component.
 */
export function Specs() {
  const { content } = useLanguage()
  const { specs } = content
  const sslotRef = useRef<HTMLSpanElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [specIndex, setSpecIndex] = useState(0)
  const [swapping, setSwapping] = useState(false)

  // Mobile brief §3: the Stack slot's live screen position (92% of the
  // square box, matching the desktop callouts' own "sits in the model, not
  // filling it" proportions). Needs a scroll listener too, not just mount/
  // resize — before the pin is actually stuck (e.g. at mount, or right after
  // a resize while scrolled elsewhere), `.sslot` still sits at its normal-
  // flow position, nowhere near where it'll be once sticky engages, so a
  // one-time measurement can be stale for the entire session.
  useEffect(() => {
    let pendingFrame = 0

    function measure() {
      pendingFrame = 0
      const slot = sslotRef.current
      if (!slot) return
      const rect = slot.getBoundingClientRect()
      mobileSlotStore.update('specs', rect.left + rect.width / 2, rect.top + rect.height / 2, rect.height * 0.92)
    }

    function scheduleMeasure() {
      if (pendingFrame) return
      pendingFrame = requestAnimationFrame(measure)
    }

    measure()
    window.addEventListener('scroll', scheduleMeasure, { passive: true })
    window.addEventListener('resize', scheduleMeasure)
    const fontsReady = (document as Document & { fonts?: FontFaceSet }).fonts?.ready
    fontsReady?.then(measure)

    return () => {
      if (pendingFrame) cancelAnimationFrame(pendingFrame)
      window.removeEventListener('scroll', scheduleMeasure)
      window.removeEventListener('resize', scheduleMeasure)
    }
  }, [])

  // Mobile brief §3: which of the 5 parts is current, derived from the same
  // `p` (progress within the Stack's held scroll range) the 3D pose already
  // uses (`specLinesStore`, written by `layers.ts`) — polled from a rAF loop
  // rather than React state per scroll pixel, same pattern as `Work.tsx`'s
  // active-job tracking. Only commits a state update (and the 180ms fade)
  // when the index actually changes.
  useEffect(() => {
    let frameId = requestAnimationFrame(loop)
    let swapTimeout: ReturnType<typeof setTimeout> | undefined

    function loop() {
      frameId = requestAnimationFrame(loop)
      const snapshot = specLinesStore.getSnapshot()
      if (snapshot.dominant !== SPECS_SECTION_INDEX) return

      const idx = specPartIndex(snapshot.p)
      setSpecIndex((current) => {
        if (idx === current) return current
        setSwapping(true)
        clearTimeout(swapTimeout)
        swapTimeout = setTimeout(() => setSwapping(false), CARD_SWAP_MS)
        return idx
      })
    }

    return () => {
      cancelAnimationFrame(frameId)
      clearTimeout(swapTimeout)
    }
  }, [])

  const activeGroup = specs.groups[specIndex]

  return (
    <Fragment>
      <section id="specs" className="specs">
        <div className="specs__pin wrap">
          <div className="specs__head">
            <div className="specs__heading">
              <Reveal>
                <span className="mono kicker">{specs.kicker}</span>
              </Reveal>
              <Reveal delay={0.05}>
                <h2 className="display">
                  {specs.titleLine1}
                  <br />
                  {specs.titleLine2}
                </h2>
              </Reveal>
            </div>
            <div className="mono specs__model">
              {specs.modelLine1}
              <br />
              {specs.modelLine2}
            </div>
          </div>

          <div className="specs__callouts">
            {specs.groups.map((group, index) => (
              <div
                // Stable, position-based key - not `group.label`. The 5 tags
                // are a fixed, never-reordered list (brief 5.4); their label
                // is just translated *text*, not their identity. Keying on
                // the translated label made every tag's DOM node get
                // unmounted and replaced on each ES/EN toggle (a new key ->
                // React treats it as a different element), which left
                // SpecLines.tsx holding refs to now-detached nodes -
                // getBoundingClientRect() on those returns all zeros, which
                // is why the leader lines visibly snapped to the top-left
                // corner right after a language switch.
                key={index}
                className={`specs__callout ${index % 2 === 0 ? 'l' : 'r'}`}
                style={{ top: `${CALLOUT_TOP_PERCENT[index]}%` }}
              >
                <span className="mono">{group.label}</span>
                <p>{group.text}</p>
              </div>
            ))}
          </div>

          <span className="sslot" ref={sslotRef} aria-hidden="true" />

          <div className="specs__mobile-card" ref={cardRef}>
            <div className="specs__mobile-top">
              <span className={`mono specs__mobile-label${swapping ? ' swap' : ''}`}>{activeGroup.label}</span>
              <span className="mono specs__mobile-count">
                {String(specIndex + 1).padStart(2, '0')} / {String(specs.groups.length).padStart(2, '0')}
              </span>
            </div>
            <p className={`specs__mobile-text${swapping ? ' swap' : ''}`}>{activeGroup.text}</p>
            <div className="specs__mobile-bars">
              {specs.groups.map((_, index) => (
                <i key={index} className={index <= specIndex ? 'on' : ''} />
              ))}
            </div>
          </div>

          <Reveal>
            <p className="specs__tail specs__tail--inside">{specs.tail}</p>
          </Reveal>
        </div>
      </section>

      <Reveal>
        <p className="specs__tail specs__tail--outside wrap">{specs.tail}</p>
      </Reveal>
    </Fragment>
  )
}
