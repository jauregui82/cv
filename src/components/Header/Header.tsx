import { useLanguage } from '../../hooks/useLanguage'
import { useVariant } from '../../hooks/useVariant'
import './Header.css'

export function Header() {
  const { content, language, setLanguage } = useLanguage()
  const { variant, setVariant } = useVariant()
  const { nav, header } = content

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
              onClick={() => setLanguage('es')}
            >
              ES
            </button>
            <button
              type="button"
              aria-pressed={language === 'en'}
              onClick={() => setLanguage('en')}
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
