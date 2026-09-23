import { Fragment } from 'react'
import { useLanguage } from '../hooks/useLanguage'
import { Reveal } from '../components/Reveal'
import './Work.css'

export function Work() {
  const { content } = useLanguage()
  const { work } = content

  return (
    <section id="work" className="work wrap">
      <div className="col">
        <Reveal>
          <span className="mono kicker">{work.kicker}</span>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="display">{work.title}</h2>
        </Reveal>

        <Reveal delay={0.1}>
          <ol className="jobs">
            {work.jobs.map((job) => (
              <li className="job" key={job.company}>
                <span className="mono yr">{job.years}</span>
                <div>
                  <h3>{job.company}</h3>
                  <div className="role">{job.role}</div>
                  <p>{job.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </Reveal>

        <Reveal delay={0.15}>
          <div className="edu">
            <span className="mono kicker">{work.educationKicker}</span>
            <dl>
              {work.education.map((entry) => (
                <Fragment key={entry.term}>
                  <dt className="mono">{entry.term}</dt>
                  <dd>{entry.description}</dd>
                </Fragment>
              ))}
            </dl>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
