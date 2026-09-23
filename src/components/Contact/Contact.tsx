import { motion } from 'motion/react'
import { useLanguage } from '../../hooks/useLanguage'
import { Reveal } from '../Reveal'
import './Contact.css'

const tapTransition = { type: 'spring', bounce: 0, duration: 0.3 } as const

export function Contact() {
  const { content } = useLanguage()
  const { contact } = content

  return (
    <section id="contact" className="contact">
      <div className="container">
        <Reveal>
          <h2>{contact.title}</h2>
          <ul className="contact__list">
            <li>
              <span className="contact__label">{contact.emailLabel}</span>
              <motion.a
                href={`mailto:${contact.email}`}
                whileTap={{ scale: 0.97 }}
                transition={tapTransition}
              >
                {contact.email}
              </motion.a>
            </li>
            <li>
              <span className="contact__label">{contact.whatsappLabel}</span>
              <motion.a
                href={contact.whatsappLink}
                target="_blank"
                rel="noreferrer"
                whileTap={{ scale: 0.97 }}
                transition={tapTransition}
              >
                {contact.whatsappDisplay}
              </motion.a>
            </li>
            <li>
              <span className="contact__location">
                {contact.locationLabel}
              </span>
            </li>
          </ul>
        </Reveal>
      </div>
    </section>
  )
}
