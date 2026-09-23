import { useEffect, useRef } from 'react'
import { Header } from './components/Header/Header'
import { Hero } from './components/Hero/Hero'
import { About } from './components/About/About'
import { Experience } from './components/Experience/Experience'
import { Contact } from './components/Contact/Contact'
import { AvatarDock } from './components/Avatar/AvatarDock'
import { useLanguage } from './hooks/useLanguage'
import './App.css'

function App() {
  const { content } = useLanguage()
  const avatarSlotRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    document.title = content.meta.title
  }, [content.meta.title])

  return (
    <>
      <Header />
      {/* Mounted once so the R3F canvas/WebGL context survives scrolling;
          docks onto Hero's avatar slot, then into a fixed corner badge. */}
      <AvatarDock heroSlotRef={avatarSlotRef} />
      <main>
        <Hero avatarSlotRef={avatarSlotRef} />
        <About />
        <Experience />
        <Contact />
      </main>
      <footer className="site-footer">
        <p>
          &copy; {new Date().getFullYear()} {content.hero.name} &mdash;{' '}
          {content.footer.rights}
        </p>
      </footer>
    </>
  )
}

export default App
