import es from './es.json'
import en from './en.json'
import type { Content } from './types'

export type Language = 'es' | 'en'

export const content: Record<Language, Content> = {
  es: es as Content,
  en: en as Content,
}

export const LANGUAGE_STORAGE_KEY = 'preferredLanguage'
export const DEFAULT_LANGUAGE: Language = 'es'
