import { useLanguage } from '../hooks/useLanguage'
import { Reveal } from '../components/Reveal'
import './Specs.css'

/** Brief 5.4's per-tag vertical position within `.specs__callouts` — ported
 * verbatim from mockup.html's `style="top:X%"` inline attributes. */
const CALLOUT_TOP_PERCENT = [4, 22, 44, 60, 80]

/**
 * Phase 4 ("Stack sticky", brief 5.4): a 320vh scroll budget with a
 * `position: sticky` inner pin holding the visible content. `SpecLines.tsx`
 * (an overlay sibling in App.tsx, not nested here) owns revealing each
 * `.specs__callout` by scroll tramo and drawing the leader lines to the
 * avatar — it toggles the `on` class this file's CSS keys the reveal
 * animation off, and reads each callout's `getBoundingClientRect()`
 * directly, so no scroll-position state needs to live in this component.
 */
export function Specs() {
  const { content } = useLanguage()
  const { specs } = content

  return (
    <section id="specs" className="specs">
      <div className="specs__pin wrap">
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
            <div
              // Stable, position-based key - not `group.label`. The 5 tags
              // are a fixed, never-reordered list (brief 5.4); their label
              // is just translated *text*, not their identity. Keying on
              // the translated label made every tag's DOM node get
              // unmounted and replaced on each ES/EN toggle (a new key ->
              // React treats it as a different element), which left
              // SpecLines.tsx holding refs to now-detached nodes -
              // getBoundingClientRect() on those returns all zeros, which
              // is why the leader lines visibly snapped to the top-left
              // corner right after a language switch.
              key={index}
              className={`specs__callout ${index % 2 === 0 ? 'l' : 'r'}`}
              style={{ top: `${CALLOUT_TOP_PERCENT[index]}%` }}
            >
              <span className="mono">{group.label}</span>
              <p>{group.text}</p>
            </div>
          ))}
        </div>

        <Reveal>
          <p className="specs__tail">{specs.tail}</p>
        </Reveal>
      </div>
    </section>
  )
}
