import { useLanguage } from '../hooks/useLanguage'
import { Reveal } from '../components/Reveal'
import './About.css'

export function About() {
  const { content } = useLanguage()
  const { about } = content

  return (
    <section id="about" className="about wrap">
      <div className="aboutcopy">
        <Reveal>
          <span className="mono kicker">{about.kicker}</span>
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
