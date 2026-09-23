import { motion } from 'motion/react'
import { useLanguage } from '../../hooks/useLanguage'
import './Header.css'

const tapTransition = { type: 'spring', bounce: 0, duration: 0.3 } as const

export function Header() {
  const { content, language, setLanguage } = useLanguage()

  return (
    <header className="site-header">
      <div className="site-header__inner container">
        <a className="site-header__brand" href="#hero">
          {content.hero.name}
        </a>

        <nav className="site-header__nav" aria-label="Primary">
          <a href="#about">{content.nav.about}</a>
          <a href="#work">{content.nav.work}</a>
          <a href="#contact">{content.nav.contact}</a>
        </nav>

        <div className="lang-toggle" role="group" aria-label="Language">
          <motion.button
            type="button"
            className={language === 'es' ? 'active' : ''}
            onClick={() => setLanguage('es')}
            whileTap={{ scale: 0.9 }}
            transition={tapTransition}
            aria-pressed={language === 'es'}
          >
            ES
          </motion.button>
          <motion.button
            type="button"
            className={language === 'en' ? 'active' : ''}
            onClick={() => setLanguage('en')}
            whileTap={{ scale: 0.9 }}
            transition={tapTransition}
            aria-pressed={language === 'en'}
          >
            EN
          </motion.button>
        </div>
      </div>
    </header>
  )
}
