import { useEffect } from 'react'
import { Header } from './components/Header/Header'
import { Hero } from './sections/Hero'
import { About } from './sections/About'
import { Specs } from './sections/Specs'
import { Work } from './sections/Work'
import { Contact } from './sections/Contact'
import { Stage } from './stage/Stage'
import { useLanguage } from './hooks/useLanguage'
import './App.css'

function App() {
  const { content } = useLanguage()

  useEffect(() => {
    document.title = content.meta.title
  }, [content.meta.title])

  return (
    <>
      <Header />
      {/* Mounted once, independent of document flow — Stage owns its own
          fixed positioning (brief 4.1). */}
      <Stage />
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
