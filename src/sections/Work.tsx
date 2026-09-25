import { Fragment, useEffect, useRef, useState } from 'react'
import { useLanguage } from '../hooks/useLanguage'
import { Reveal } from '../components/Reveal'
import { mobileSlotStore, workTrackingStore } from '../stage/store'
import './Work.css'

// Vertical offset (px) from a job row's top edge to the point the avatar
// aims for — mirrors mockup.html's `r.top + 42` (roughly the company
// name's baseline rather than the row's raw top edge).
const AIM_OFFSET_PX = 42

// Mobile brief §3: the head measures 58px in the active job's slot — a
// fixed head-height, not the 60×60 CSS box's own rendered size.
const WORK_SLOT_HEAD_HEIGHT_PX = 58

/**
 * Active-job tracking (brief 5.5 / 4.3): the job nearest the viewport
 * center is "active" — full opacity, accent-colored company name — the
 * rest sit at .38 opacity (`Work.css`). Continuous position data (the
 * active job's on-screen Y, needed every scroll pixel) goes straight into
 * `workTrackingStore`'s mutable ref, not React state, so the canvas can
 * track it without this component re-rendering on every scroll event
 * (brief section 8). The discrete "which index is active" value is small
 * and infrequent enough to be ordinary React state here — it only changes
 * a few times per scroll through the section.
 */
export function Work() {
  const { content } = useLanguage()
  const { work } = content
  const jobRefs = useRef<(HTMLLIElement | null)[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)

  useEffect(() => {
    let pendingFrame = 0

    function measure() {
      pendingFrame = 0
      const viewportCenter = window.innerHeight / 2
      let bestIndex = -1
      let bestDistance = Infinity
      let bestScreenTop: number | null = null

      jobRefs.current.forEach((el, index) => {
        if (!el) return
        const rect = el.getBoundingClientRect()
        if (rect.bottom <= 0 || rect.top >= window.innerHeight) return
        const distance = Math.abs(rect.top + rect.height / 2 - viewportCenter)
        if (distance < bestDistance) {
          bestDistance = distance
          bestIndex = index
          bestScreenTop = rect.top + AIM_OFFSET_PX
        }
      })

      workTrackingStore.update(bestIndex, bestScreenTop)
      setActiveIndex(bestIndex)

      // Mobile brief §2.1/§3: the active job's `.jslot` screen position, or
      // cleared back to null when no job is active — `resolveSlotPose`
      // (`useScrollPose.ts`) falls back to the dock pose alone in that case
      // (brief's "si no hay trabajo activo visible, va al dock").
      const activeSlot = bestIndex >= 0 ? jobRefs.current[bestIndex]?.querySelector('.jslot') : null
      if (activeSlot) {
        const slotRect = activeSlot.getBoundingClientRect()
        mobileSlotStore.update(
          'work',
          slotRect.left + slotRect.width / 2,
          slotRect.top + slotRect.height / 2,
          WORK_SLOT_HEAD_HEIGHT_PX,
        )
      } else {
        mobileSlotStore.update('work', null, null, null)
      }
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
      workTrackingStore.update(-1, null)
      mobileSlotStore.update('work', null, null, null)
    }
  }, [])

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
            {work.jobs.map((job, index) => (
              <li
                className={`job${index === activeIndex ? ' active' : ''}`}
                key={job.company}
                ref={(el) => {
                  jobRefs.current[index] = el
                }}
              >
                <span className="mono yr">{job.years}</span>
                <div>
                  <div className="jrow">
                    <h3>{job.company}</h3>
                    <span className="jslot" aria-hidden="true" />
                  </div>
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
