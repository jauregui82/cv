import { useEffect } from 'react'
import { Header } from './components/Header/Header'
import { Hero } from './components/Hero/Hero'
import { About } from './components/About/About'
import { Experience } from './components/Experience/Experience'
import { Contact } from './components/Contact/Contact'
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
