import { useLanguage } from '../hooks/useLanguage'
import './Hero.css'

export function Hero() {
  const { content } = useLanguage()
  const { hero } = content
  const [l1, ...rest] = hero.name.split(' ')
  const l2 = rest.join(' ')

  return (
    <section id="hero" className="hero wrap">
      <div className="name">
        <div className="mono eyebrow">{hero.eyebrow}</div>
        <h1 className="display">
          <span className="l1">{l1}</span>
          <br />
          <span className="l2">{l2}</span>
        </h1>
      </div>
      <div className="foot">
        <p className="lede">
          {hero.ledeBefore}
          <em>{hero.ledeEmphasis}</em>
          {hero.ledeAfter}
        </p>
        <div className="cue mono">
          <i />
          <span>{hero.indicator}</span>
        </div>
      </div>
    </section>
  )
}
