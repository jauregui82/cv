import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useLanguage } from '../hooks/useLanguage'
import { Reveal } from '../components/Reveal'
import { mobileSlotStore } from '../stage/store'
import './Contact.css'

const CV_FILES = {
  es: { href: `${import.meta.env.BASE_URL}cv/cv-es.pdf`, filename: 'Jauregui-Crespo-CV-ES.pdf' },
  en: { href: `${import.meta.env.BASE_URL}cv/cv-en.pdf`, filename: 'Jauregui-Crespo-CV-EN.pdf' },
}

// Mobile brief §3: the head measures 148px in the Contact slot — a fixed
// head-height, not the 150×150 CSS box's own rendered size.
const CONTACT_SLOT_HEAD_HEIGHT_PX = 148

export function Contact() {
  const { content } = useLanguage()
  const { contact } = content
  const reduceMotion = useReducedMotion()
  const [copied, setCopied] = useState(false)
  const [cvOpen, setCvOpen] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const cvRef = useRef<HTMLDivElement>(null)
  const slotRef = useRef<HTMLSpanElement>(null)

  useEffect(() => () => clearTimeout(timeoutRef.current), [])

  // Mobile brief §2.1: live screen position of `.cslot` for
  // `useScrollPose.ts`'s slot-or-dock mix — same rAF-scheduled scroll/resize
  // pattern as `Hero.tsx`'s `.o-slot` measurement.
  useEffect(() => {
    let pendingFrame = 0

    function measure() {
      pendingFrame = 0
      const slot = slotRef.current
      if (!slot) return
      const rect = slot.getBoundingClientRect()
      mobileSlotStore.update('contact', rect.left + rect.width / 2, rect.top + rect.height / 2, CONTACT_SLOT_HEAD_HEIGHT_PX)
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

  useEffect(() => {
    if (!cvOpen) return
    function onPointerDown(event: PointerEvent) {
      if (!cvRef.current?.contains(event.target as Node)) setCvOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setCvOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [cvOpen])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(contact.email)
    } catch {
      // Clipboard API unavailable — the email is still visible as text.
    }
    setCopied(true)
    clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setCopied(false), 1600)
  }

  return (
    <section id="contact" className="contact wrap">
      <span className="cslot" ref={slotRef} aria-hidden="true" />
      <Reveal>
        <h2 className="display">
          {contact.titleLine1}
          <br />
          {contact.titleLine2}
        </h2>
      </Reveal>
      <Reveal delay={0.1}>
        <div className="rows">
          <div className="row-email">
            <span className="mono">{contact.emailLabel}</span>
            <span className="val email-visible">{contact.email}</span>
            <button type="button" className="copy" title={contact.email} onClick={handleCopy}>
              {copied ? contact.copiedLabel : contact.copyLabel}
            </button>
          </div>
          <div className="row-location">
            <span className="mono">{contact.locationLabel}</span>
            <span className="val">{contact.locationValue}</span>
          </div>
          <div className="cv" ref={cvRef}>
            <span className="mono">{contact.cvLabel}</span>
            <div className="cv-desktop">
              <button
                type="button"
                className="copy"
                aria-haspopup="true"
                aria-expanded={cvOpen}
                onClick={() => setCvOpen((open) => !open)}
              >
                {contact.cvButtonLabel}
              </button>
              <AnimatePresence>
                {cvOpen && (
                  <motion.div
                    className="seg cv-picker"
                    role="group"
                    aria-label={contact.cvGroupLabel}
                    initial={reduceMotion ? undefined : { opacity: 0, y: -6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={reduceMotion ? undefined : { opacity: 0, y: -6, scale: 0.96 }}
                    transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
                  >
                    <a href={CV_FILES.es.href} download={CV_FILES.es.filename} onClick={() => setCvOpen(false)}>
                      {contact.cvOptionEs}
                    </a>
                    <a href={CV_FILES.en.href} download={CV_FILES.en.filename} onClick={() => setCvOpen(false)}>
                      {contact.cvOptionEn}
                    </a>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="cv-mobile">
              <a className="btn primary" href={CV_FILES.es.href} download={CV_FILES.es.filename}>
                {contact.cvOptionEsShort}
              </a>
              <a className="btn" href={CV_FILES.en.href} download={CV_FILES.en.filename}>
                {contact.cvOptionEnShort}
              </a>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  )
}
