import { useEffect, useRef } from 'react'
import { useLanguage } from '../hooks/useLanguage'
import { avatarActionStore, avatarHeadStore } from './store'
import './SpeechBubble.css'

/** Brief 4.4: the bubble "dura 2.4s" once shown. */
const VISIBLE_SECONDS = 2.4

/** Keeps the bubble's tail clear of the fixed header (Header.css) — mirrors
 * mockup.html's own hardcoded `Math.max(70, hy - 6)`. */
const TOP_CLEARANCE_PX = 70

/**
 * HTML overlay bubble that follows the avatar's head and shows a line of
 * dialogue (brief 4.4): the current section's line when the dominant
 * section changes (`avatarHeadStore.sectionChangeVersion`), or a random
 * "poke" phrase when the avatar is tapped (`avatarActionStore.pokeVersion`,
 * brief 4.3 "Toque"). Lives outside the R3F `<Canvas>` (sibling of
 * `SpecLines.tsx` in `App.tsx`), reading both stores from its own
 * `requestAnimationFrame` loop and imperatively updating the DOM — same "no
 * React state per frame" pattern `SpecLines.tsx` uses for the leader lines.
 */
export function SpeechBubble() {
  const { content } = useLanguage()
  // The rAF loop below is set up once (empty deps) but needs the *current*
  // language's copy whenever a trigger fires — kept in a ref rather than a
  // loop dependency, refreshed after every commit (never read/write refs
  // during render itself).
  const contentRef = useRef(content)
  useEffect(() => {
    contentRef.current = content
  }, [content])

  const bubbleRef = useRef<HTMLDivElement | null>(null)
  const remainingSecondsRef = useRef(0)
  const lastSectionVersionRef = useRef(avatarHeadStore.getSnapshot().sectionChangeVersion)
  const lastPokeVersionRef = useRef(avatarActionStore.getSnapshot().pokeVersion)
  const lastFrameTimeRef = useRef<number | null>(null)

  useEffect(() => {
    let frameId = requestAnimationFrame(loop)

    function say(text: string) {
      const bubble = bubbleRef.current
      if (!bubble) return
      bubble.textContent = text
      bubble.classList.add('on')
      remainingSecondsRef.current = VISIBLE_SECONDS
    }

    function loop(now: number) {
      frameId = requestAnimationFrame(loop)

      const last = lastFrameTimeRef.current
      const dt = last === null ? 0 : Math.min(0.05, (now - last) / 1000)
      lastFrameTimeRef.current = now

      const head = avatarHeadStore.getSnapshot()
      const action = avatarActionStore.getSnapshot()

      if (head.sectionChangeVersion !== lastSectionVersionRef.current) {
        lastSectionVersionRef.current = head.sectionChangeVersion
        say(contentRef.current.speech.lines[head.dominant])
      }
      if (action.pokeVersion !== lastPokeVersionRef.current) {
        lastPokeVersionRef.current = action.pokeVersion
        const pokes = contentRef.current.speech.pokes
        say(pokes[Math.floor(Math.random() * pokes.length)])
      }

      const bubble = bubbleRef.current
      if (!bubble || remainingSecondsRef.current <= 0) return

      remainingSecondsRef.current -= dt
      if (remainingSecondsRef.current <= 0) {
        bubble.classList.remove('on')
        return
      }

      // Clamp to the viewport edges (brief 4.4: "limitado a los bordes de
      // la pantalla") — ported from mockup.html's own clamp, which accounts
      // for the bubble's `translate(-10%, -100%)` CSS transform: its visual
      // left/right edges sit 10%/90% of its own width away from the raw
      // `left` value.
      if (!head.headAnchor) return
      const [hx, hy] = head.headAnchor
      const width = bubble.offsetWidth
      const minLeft = 8 + width * 0.1
      const maxLeft = window.innerWidth - width * 0.9 - 12
      bubble.style.left = `${Math.min(maxLeft, Math.max(minLeft, hx))}px`
      bubble.style.top = `${Math.max(TOP_CLEARANCE_PX, hy - 6)}px`
    }

    return () => cancelAnimationFrame(frameId)
  }, [])

  return <div ref={bubbleRef} className="speech-bubble" role="status" aria-live="polite" />
}
