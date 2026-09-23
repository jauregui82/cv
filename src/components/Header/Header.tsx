import { useReducedMotion } from 'motion/react'
import { useLanguage } from '../../hooks/useLanguage'
import { useVariant } from '../../hooks/useVariant'
import { avatarActionStore } from '../../stage/store'
import type { Language } from '../../content'
import './Header.css'

/** Brief 4.3 "Voltereta": "el idioma cambia a mitad del giro (450ms)" — the
 * flip itself (triggered below) runs 1s total on the `spin` group
 * (`layers.ts`); the actual `setLanguage` call is delayed to this midpoint
 * so the text visibly swaps mid-turn instead of at click time. */
const LANGUAGE_FLIP_MIDPOINT_MS = 450

export function Header() {
  const { content, language, setLanguage } = useLanguage()
  const { variant, setVariant } = useVariant()
  const reducedMotion = useReducedMotion()
  const { nav, header } = content

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
