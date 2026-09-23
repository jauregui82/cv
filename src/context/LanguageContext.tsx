import { createContext, useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  content,
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  type Language,
} from '../content'
import type { Content } from '../content/types'

interface LanguageContextValue {
  language: Language
  content: Content
  setLanguage: (language: Language) => void
  toggleLanguage: () => void
}

export const LanguageContext = createContext<LanguageContextValue | null>(
  null,
)

function readStoredLanguage(): Language {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  return stored === 'es' || stored === 'en' ? stored : DEFAULT_LANGUAGE
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readStoredLanguage)

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next)
    }
  }, [])

  const toggleLanguage = useCallback(() => {
    setLanguage(language === 'es' ? 'en' : 'es')
  }, [language, setLanguage])

  const value = useMemo(
    () => ({
      language,
      content: content[language],
      setLanguage,
      toggleLanguage,
    }),
    [language, setLanguage, toggleLanguage],
  )

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}
