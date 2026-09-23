import { useLanguage } from '../hooks/useLanguage'
import { Reveal } from '../components/Reveal'
import './Specs.css'

export function Specs() {
  const { content } = useLanguage()
  const { specs } = content

  return (
    <section id="specs" className="specs wrap">
      <div className="specs__head">
        <div className="specs__heading">
          <Reveal>
            <span className="mono kicker">{specs.kicker}</span>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="display">
              {specs.titleLine1}
              <br />
              {specs.titleLine2}
            </h2>
          </Reveal>
        </div>
        <div className="mono specs__model">
          {specs.modelLine1}
          <br />
          {specs.modelLine2}
        </div>
      </div>

      <div className="specs__callouts">
        {specs.groups.map((group, index) => (
          <Reveal key={group.label} delay={index * 0.06}>
            <div className={`specs__callout ${index % 2 === 0 ? 'l' : 'r'}`}>
              <span className="mono">{group.label}</span>
              <p>{group.text}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal>
        <p className="specs__tail">{specs.tail}</p>
      </Reveal>
    </section>
  )
}
