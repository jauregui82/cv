import { useCallback, useEffect, useState } from 'react'

export type Variant = 'noche' | 'dia'

const STORAGE_KEY = 'jau-v'
// `useVariant` is called independently by every component that needs the
// variant (Header, Stage, ...) — each gets its own `useState`, so toggling
// in one doesn't re-render the others on its own. Broadcast changes on this
// event so every mounted instance stays in sync without lifting state into
// a context.
const VARIANT_EVENT = 'jau-variant-change'

function readStoredVariant(): Variant | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === 'noche' || stored === 'dia' ? stored : null
  } catch {
    return null
  }
}

function getInitialVariant(): Variant {
  if (typeof document !== 'undefined' && document.documentElement.dataset.v) {
    // Already set synchronously by the inline script in index.html.
    const fromDom = document.documentElement.dataset.v
    if (fromDom === 'noche' || fromDom === 'dia') return fromDom
  }
  if (typeof window === 'undefined') return 'noche'
  const stored = readStoredVariant()
  if (stored) return stored
  const prefersLight = window.matchMedia?.(
    '(prefers-color-scheme: light)',
  ).matches
  return prefersLight ? 'dia' : 'noche'
}

/**
 * Live NOCHE/DÍA design-variant switch. Mirrors mockup.html's
 * `root.dataset.v` mechanism and its `jau-v` localStorage key, including the
 * same default-selection logic (stored value, else prefers-color-scheme).
 */
export function useVariant() {
  const [variant, setVariantState] = useState<Variant>(getInitialVariant)

  useEffect(() => {
    document.documentElement.dataset.v = variant
  }, [variant])

  useEffect(() => {
    function onVariantChange(event: Event) {
      const next = (event as CustomEvent<Variant>).detail
      if (next === 'noche' || next === 'dia') setVariantState(next)
    }
    window.addEventListener(VARIANT_EVENT, onVariantChange)
    return () => window.removeEventListener(VARIANT_EVENT, onVariantChange)
  }, [])

  const setVariant = useCallback((next: Variant) => {
    setVariantState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // localStorage unavailable (private mode, etc.) — variant still works
      // for this session, it just won't persist.
    }
    window.dispatchEvent(new CustomEvent<Variant>(VARIANT_EVENT, { detail: next }))
  }, [])

  return { variant, setVariant }
}
