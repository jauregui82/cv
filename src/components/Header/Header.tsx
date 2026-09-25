import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'motion/react'
import { useLanguage } from '../../hooks/useLanguage'
import { useVariant } from '../../hooks/useVariant'
import { avatarActionStore, mobileSlotStore } from '../../stage/store'
import type { Language } from '../../content'
import './Header.css'

/** Brief v2 §5 "Idioma": the flip itself (triggered below) runs 1.1s total,
 * a full Y turn, on the `spin` group (`layers.ts`); the actual `setLanguage`
 * call is delayed to this midpoint so the text visibly swaps mid-turn
 * instead of at click time. */
const LANGUAGE_FLIP_MIDPOINT_MS = 550

export function Header() {
  const { content, language, setLanguage } = useLanguage()
  const { variant, setVariant } = useVariant()
  const reducedMotion = useReducedMotion()
  const { nav, header } = content
  const dockRef = useRef<HTMLSpanElement>(null)

  // Mobile brief §2.1: the dock's screen position for `useScrollPose.ts`'s
  // slot-or-dock mix. The header is `position: fixed`, so unlike the other
  // slots this one doesn't move on scroll — only resize/fonts affect it.
  useEffect(() => {
    function measure() {
      const dock = dockRef.current
      if (!dock) return
      const rect = dock.getBoundingClientRect()
      mobileSlotStore.update('dock', rect.left + rect.width / 2, rect.top + rect.height / 2, rect.height)
    }

    measure()
    window.addEventListener('resize', measure)
    const fontsReady = (document as Document & { fonts?: FontFaceSet }).fonts?.ready
    fontsReady?.then(measure)

    return () => window.removeEventListener('resize', measure)
  }, [])

  // Brief 4.3: under prefers-reduced-motion the language must still change
  // — it's core functionality, not decoration — just without the physical
  // spin (brief section 6), so it swaps immediately instead of at a delayed
  // midpoint. Mirrors mockup.html's own `if (l===lang) return` no-op guard
  // for re-clicking the already-active language (including while a flip to
  // a *different* target is still pending, since `language` here is React
  // state and hasn't updated yet at that point) — this also means clicking
  // ES/EN again shortly after a flip just restarts that flip cleanly, it
  // never gets stuck.
  function requestLanguage(next: Language) {
    if (next === language) return
    if (reducedMotion) {
      setLanguage(next)
      return
    }
    avatarActionStore.triggerFlip()
    setTimeout(() => setLanguage(next), LANGUAGE_FLIP_MIDPOINT_MS)
  }

  return (
    <header className="site-header">
      <div className="wrap bar">
        <a className="brand" href="#hero">
          jau<b>.</b>
        </a>

        <span className="dock" ref={dockRef} aria-hidden="true" />

        <nav className="links" aria-label={header.navGroupLabel}>
          <a href="#about">{nav.about}</a>
          <a href="#specs">{nav.specs}</a>
          <a href="#work">{nav.work}</a>
          <a href="#contact">{nav.contact}</a>
        </nav>

        <div className="controls">
          <div className="seg" role="group" aria-label={header.langGroupLabel}>
            <button
              type="button"
              aria-pressed={language === 'es'}
              onClick={() => requestLanguage('es')}
            >
              ES
            </button>
            <button
              type="button"
              aria-pressed={language === 'en'}
              onClick={() => requestLanguage('en')}
            >
              EN
            </button>
          </div>
          <div
            className="seg"
            role="group"
            aria-label={header.variantGroupLabel}
          >
            <button
              type="button"
              aria-pressed={variant === 'noche'}
              onClick={() => setVariant('noche')}
            >
              {header.variantNoche}
            </button>
            <button
              type="button"
              aria-pressed={variant === 'dia'}
              onClick={() => setVariant('dia')}
            >
              {header.variantDia}
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
