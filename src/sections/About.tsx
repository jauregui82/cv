import { useEffect, useRef } from 'react'
import { useLanguage } from '../hooks/useLanguage'
import { Reveal } from '../components/Reveal'
import { mobileSlotStore } from '../stage/store'
import './About.css'

// Mobile brief §3: the head measures 118px in the About slot — a fixed
// head-height, not the 120×120 CSS box's own rendered size.
const ABOUT_SLOT_HEAD_HEIGHT_PX = 118

export function About() {
  const { content } = useLanguage()
  const { about } = content
  const slotRef = useRef<HTMLSpanElement>(null)

  // Mobile brief §2.1: live screen position of `.hslot` for
  // `useScrollPose.ts`'s slot-or-dock mix — same rAF-scheduled scroll/resize
  // pattern as `Hero.tsx`'s `.o-slot` measurement.
  useEffect(() => {
    let pendingFrame = 0

    function measure() {
      pendingFrame = 0
      const slot = slotRef.current
      if (!slot) return
      const rect = slot.getBoundingClientRect()
      mobileSlotStore.update('about', rect.left + rect.width / 2, rect.top + rect.height / 2, ABOUT_SLOT_HEAD_HEIGHT_PX)
    }

    function scheduleMeasure() {
      if (pendingFrame) return
      pendingFrame = requestAnimationFrame(measure)
    }

    measure()
    window.addEventListener('scroll', scheduleMeasure, { passive: true })
    window.addEventListener('resize', scheduleMeasure)

    return () => {
      if (pendingFrame) cancelAnimationFrame(pendingFrame)
      window.removeEventListener('scroll', scheduleMeasure)
      window.removeEventListener('resize', scheduleMeasure)
    }
  }, [])

  return (
    <section id="about" className="about wrap">
      <div className="aboutcopy">
        <Reveal>
          <div className="intro">
            <span className="hslot" ref={slotRef} aria-hidden="true" />
            <span className="mono kicker">{about.kicker}</span>
          </div>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="display">{about.title}</h2>
        </Reveal>
        {about.paragraphs.map((paragraph, index) => (
          <Reveal key={paragraph.slice(0, 24)} delay={0.1 + index * 0.05}>
            <p>{paragraph}</p>
          </Reveal>
        ))}
        <Reveal delay={0.2}>
          <div className="stats">
            {about.stats.map((stat) => (
              <div key={stat.label}>
                <b>{stat.value}</b>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
