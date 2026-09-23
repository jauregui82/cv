import { lazy, Suspense, useEffect } from 'react'
import { Header } from './components/Header/Header'
import { Hero } from './sections/Hero'
import { About } from './sections/About'
import { Specs } from './sections/Specs'
import { Work } from './sections/Work'
import { Contact } from './sections/Contact'
import { SpecLines } from './stage/SpecLines'
import { SpeechBubble } from './stage/SpeechBubble'
import { useLanguage } from './hooks/useLanguage'
import './App.css'

// Phase 6 (brief 6, Lighthouse mobile performance): `Stage` pulls in
// three.js/@react-three/fiber/drei — by far the heaviest part of the bundle
// (three.js alone is several hundred KB) — but the brief itself says the
// canvas "es una mejora, no un requisito" (section 6) and the avatar is
// allowed to "mount slightly after initial content is visible". A static
// import bundled all of that into the same chunk as React/the sections/the
// copy, so evaluating it blocked first paint of the actual page content.
// `lazy` + `Suspense` moves it into its own chunk, fetched/evaluated after
// the initial render commits, without changing anything about how Stage
// itself behaves once mounted (it's still the single fixed full-screen
// Canvas from brief 4.1) — `SpecLines`/`SpeechBubble` don't import
// three/r3f at all, so they stay eagerly loaded; their own rAF loops just
// read `null`/zeroed store snapshots until Stage's frame loop starts
// writing to them.
const Stage = lazy(() => import('./stage/Stage').then((m) => ({ default: m.Stage })))

function App() {
  const { content } = useLanguage()

  useEffect(() => {
    document.title = content.meta.title
  }, [content.meta.title])

  return (
    <>
      <Header />
      {/* Mounted once, independent of document flow — Stage owns its own
          fixed positioning (brief 4.1). Lazily loaded (see the import
          above) — `fallback={null}` is fine since Stage renders nothing
          visible until the canvas itself mounts. */}
      <Suspense fallback={null}>
        <Stage />
      </Suspense>
      {/* Stack section's leader lines (brief 5.4) — a fixed SVG overlay,
          sibling to Stage rather than nested in Specs, since it draws over
          the whole viewport just like Stage's canvas. */}
      <SpecLines />
      {/* Speech bubble (brief 4.4) — same rationale as SpecLines above: a
          fixed overlay over the whole viewport, not nested in any one
          section. */}
      <SpeechBubble />
      <main>
        <Hero />
        <About />
        <Specs />
        <Work />
        <Contact />
      </main>
      <footer className="wrap mono site-footer">
        <span>{content.footer.copyright}</span>
      </footer>
    </>
  )
}

export default App
