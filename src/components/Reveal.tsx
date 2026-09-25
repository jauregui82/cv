import { forwardRef } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

interface RevealProps {
  children: ReactNode
  className?: string
  delay?: number
  /** Tag to render as — `li` for items inside an `<ol>`/`<ul>` (a `motion.div`
   * there would break list semantics), `div` otherwise. */
  as?: 'div' | 'li'
}

/**
 * Fades/slides content in once it scrolls into view, using a critically
 * damped spring. Falls back to a plain, static block under
 * prefers-reduced-motion. Forwards its ref to the rendered element — Work's
 * per-job active-tracking needs the real `<li>` node to measure.
 */
export const Reveal = forwardRef<HTMLElement, RevealProps>(function Reveal(
  { children, className, delay = 0, as = 'div' },
  ref,
) {
  const reduceMotion = useReducedMotion()

  if (reduceMotion) {
    const Static = as
    return (
      <Static className={className} ref={ref as never}>
        {children}
      </Static>
    )
  }

  const Motion = as === 'li' ? motion.li : motion.div

  return (
    <Motion
      className={className}
      ref={ref as never}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ type: 'spring', bounce: 0, duration: 0.5, delay }}
    >
      {children}
    </Motion>
  )
})
