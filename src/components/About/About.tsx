import { useLanguage } from '../../hooks/useLanguage'
import { Reveal } from '../Reveal'
import './About.css'

export function About() {
  const { content } = useLanguage()

  return (
    <section id="about" className="about">
      <div className="container">
        <Reveal>
          <h2>{content.about.title}</h2>
        </Reveal>
        <div className="about__paragraphs">
          {content.about.paragraphs.map((paragraph, index) => (
            <Reveal key={paragraph.slice(0, 24)} delay={index * 0.05}>
              <p>{paragraph}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
