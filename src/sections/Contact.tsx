import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../hooks/useLanguage'
import { Reveal } from '../components/Reveal'
import './Contact.css'

export function Contact() {
  const { content } = useLanguage()
  const { contact } = content
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(timeoutRef.current), [])

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
      <Reveal>
        <h2 className="display">
          {contact.titleLine1}
          <br />
          {contact.titleLine2}
        </h2>
      </Reveal>
      <Reveal delay={0.1}>
        <div className="rows">
          <div>
            <span className="mono">{contact.emailLabel}</span>
            <span className="val">{contact.email}</span>
            <button type="button" className="copy" onClick={handleCopy}>
              {copied ? contact.copiedLabel : contact.copyLabel}
            </button>
          </div>
          <div>
            <span className="mono">{contact.whatsappLabel}</span>
            <a
              className="val"
              href={contact.whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              {contact.whatsappDisplay}
            </a>
          </div>
          <div>
            <span className="mono">{contact.locationLabel}</span>
            <span className="val">{contact.locationValue}</span>
          </div>
        </div>
      </Reveal>
    </section>
  )
}
