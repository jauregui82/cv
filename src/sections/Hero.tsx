import { useEffect, useRef } from 'react'
import { useLanguage } from '../hooks/useLanguage'
import { heroOStore, heroSlotStore } from '../stage/store'
import './Hero.css'

export function Hero() {
  const { content } = useLanguage()
  const { hero } = content
  const [l1, ...rest] = hero.name.split(' ')
  const l2 = rest.join(' ')
  // The last character of l2 ("o" in "Crespo") is the slot the head sits
  // in (brief v2 §3) — sliced off generically rather than hardcoded.
  const l2Head = l2.slice(0, -1)
  const l2Last = l2.slice(-1)

  const oSlotRef = useRef<HTMLSpanElement>(null)
  const baseRef = useRef<HTMLElement>(null)

  // Writes the live `.o-slot` measurement for `useScrollPose.ts` to convert
  // into the Hero pose (brief v2 §3: "recalculada en cada fotograma...
  // porque se mueve con el scroll y con la carga de fuentes"). Scroll needs
  // its own listener (unlike `useScrollPose.ts`'s static section ranges) —
  // the slot's screen position changes on every scroll pixel, not just on
  // resize.
  useEffect(() => {
    let pendingFrame = 0

    function measure() {
      pendingFrame = 0
      const slot = oSlotRef.current
      const base = baseRef.current
      if (!slot || !base) return

      const slotRect = slot.getBoundingClientRect()
      const fontSize = parseFloat(getComputedStyle(slot).fontSize)
      const cy = base.getBoundingClientRect().top - fontSize * 0.32
      const hp = fontSize * 0.7
      heroSlotStore.update(slotRect.left + slotRect.width / 2, cy, hp)
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

  // Drives the real "o"'s opacity from the damped `slot` pose value without
  // a React re-render per frame — same rAF-loop-reads-a-store shape as
  // `SpecLines.tsx`. Default CSS opacity stays 1, so with no WebGL/JS this
  // loop never runs and the letter just reads normally (brief v2 §3).
  useEffect(() => {
    let frameId = requestAnimationFrame(loop)

    function loop() {
      frameId = requestAnimationFrame(loop)
      const slot = oSlotRef.current
      if (slot) slot.style.opacity = heroOStore.getSnapshot().opacity.toFixed(3)
    }

    return () => cancelAnimationFrame(frameId)
  }, [])

  return (
    <section id="hero" className="hero wrap">
      <div className="name">
        <div className="mono eyebrow">{hero.eyebrow}</div>
        <h1 className="display">
          <span className="l1">{l1}</span>
          <br />
          <span className="l2">
            {l2Head}
            <span className="o-slot" ref={oSlotRef}>
              {l2Last}
              <i className="base" ref={baseRef} />
            </span>
          </span>
        </h1>
      </div>
      <div className="foot">
        <p className="lede">
          {hero.ledeBefore}
          <em>{hero.ledeEmphasis}</em>
          {hero.ledeAfter}
        </p>
        <div className="cue mono">
          <i />
          <span>{hero.indicator}</span>
        </div>
      </div>
    </section>
  )
}
