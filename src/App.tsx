import { useEffect } from 'react'
import { Header } from './components/Header/Header'
import { Hero } from './sections/Hero'
import { About } from './sections/About'
import { Specs } from './sections/Specs'
import { Work } from './sections/Work'
import { Contact } from './sections/Contact'
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
