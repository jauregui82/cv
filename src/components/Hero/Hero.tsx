import { motion, useReducedMotion } from 'motion/react'
import type { RefObject } from 'react'
import { useLanguage } from '../../hooks/useLanguage'
import './Hero.css'

interface HeroProps {
  avatarSlotRef: RefObject<HTMLDivElement | null>
}

export function Hero({ avatarSlotRef }: HeroProps) {
  const { content } = useLanguage()
  const reduceMotion = useReducedMotion() ?? false

  return (
    <section id="hero" className="hero">
      <div className="hero__inner container">
        <motion.div
          className="hero__copy"
          initial={reduceMotion ? undefined : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
        >
          <p className="eyebrow">{content.hero.role}</p>
          <h1 className="hero__name">{content.hero.name}</h1>
          <p className="hero__tagline">{content.hero.tagline}</p>
        </motion.div>

        <div className="hero__avatar">
          {/* Invisible spacer: reserves the layout rect the always-mounted
              AvatarDock (see App.tsx) docks onto while Hero is in view. */}
          <div className="hero__avatar-slot" ref={avatarSlotRef} />
        </div>
      </div>
    </section>
  )
}
