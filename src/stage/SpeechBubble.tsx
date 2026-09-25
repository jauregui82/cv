import { useEffect, useRef } from 'react'
import { useLanguage } from '../hooks/useLanguage'
import { MOBILE_BREAKPOINT } from './choreography'
import { avatarActionStore, avatarHeadStore } from './store'
import './SpeechBubble.css'

/** Brief 4.4: the bubble "dura 2.4s" once shown. */
const VISIBLE_SECONDS = 2.4

/** Keeps the bubble's tail clear of the fixed header (Header.css) — mirrors
 * mockup.html's own hardcoded `Math.max(70, hy - 6)`. */
const TOP_CLEARANCE_PX = 70

/** Mobile brief §5 "Globos": right side if the head's center sits in the
 * left 58% of the screen, left otherwise. */
const MOBILE_SIDE_SPLIT = 0.58
/** Mobile brief §5: `top = max(64px, yCabeza - 60% del alto del globo)`. */
const MOBILE_TOP_CLEARANCE_PX = 64
const MOBILE_TOP_HEIGHT_FACTOR = 0.6
/** Horizontal gap (px) between the head and the bubble's near edge — mirrors
 * mockup.html's `rad*.7` offset, `rad = Math.max(18, hFraction*innerHeight*.42)`. */
const MOBILE_OFFSET_MIN_PX = 18
const MOBILE_OFFSET_HEIGHT_FACTOR = 0.42
const MOBILE_OFFSET_FACTOR = 0.7
const MOBILE_EDGE_MARGIN_PX = 10

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

      if (!head.headAnchor) return
      const [hx, hy] = head.headAnchor

      // Mobile brief §5 "Globos": beside the head, not on top of it — the
      // side is whichever has room, and the bubble may wrap instead of
      // forcing a single `nowrap` line (SpeechBubble.css).
      if (window.innerWidth < MOBILE_BREAKPOINT) {
        const right = hx < window.innerWidth * MOBILE_SIDE_SPLIT
        bubble.classList.toggle('r', right)
        bubble.classList.toggle('l', !right)
        const offset =
          Math.max(MOBILE_OFFSET_MIN_PX, head.hFraction * window.innerHeight * MOBILE_OFFSET_HEIGHT_FACTOR) *
          MOBILE_OFFSET_FACTOR
        const width = bubble.offsetWidth
        bubble.style.left = right
          ? `${Math.min(window.innerWidth - width - MOBILE_EDGE_MARGIN_PX, hx + offset)}px`
          : `${Math.max(MOBILE_EDGE_MARGIN_PX, hx - offset - width)}px`
        bubble.style.top = `${Math.max(MOBILE_TOP_CLEARANCE_PX, hy - bubble.offsetHeight * MOBILE_TOP_HEIGHT_FACTOR)}px`
        return
      }

      bubble.classList.remove('r', 'l')

      // Clamp to the viewport edges (brief 4.4: "limitado a los bordes de
      // la pantalla") — ported from mockup.html's own clamp, which accounts
      // for the bubble's `translate(-10%, -100%)` CSS transform: its visual
      // left/right edges sit 10%/90% of its own width away from the raw
      // `left` value.
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
