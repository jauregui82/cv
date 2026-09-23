import { useLanguage } from '../../hooks/useLanguage'
import { Reveal } from '../Reveal'
import './Experience.css'

export function Experience() {
  const { content } = useLanguage()
  const { experience } = content

  return (
    <section id="work" className="experience">
      <div className="container">
        <Reveal>
          <h2>{experience.title}</h2>
        </Reveal>

        <Reveal>
          <h3 className="experience__subtitle">
            {experience.educationTitle}
          </h3>
          <ul className="experience__list">
            {experience.education.map((item) => (
              <li key={item.label}>
                <b>{item.label}</b>
                <span>{item.value}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal>
          <h3 className="experience__subtitle">{experience.workTitle}</h3>
          <ul className="experience__jobs">
            {experience.jobs.map((job) => (
              <li key={job.company}>
                <b>{job.company}&nbsp;</b>
                <span>{job.meta}</span>
                <small>{job.description}</small>
              </li>
            ))}
            <li>
              <b>{experience.previousExperience.label}</b>
              <span>{experience.previousExperience.value}</span>
            </li>
          </ul>
        </Reveal>

        <Reveal>
          <h3 className="experience__subtitle">{experience.skillsTitle}</h3>
          <ul className="experience__list">
            {experience.skills.map((skill) => (
              <li key={skill.label}>
                <b>{skill.label}</b> <span>{skill.value}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  )
}
