import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { store } from './state/store'
import { exec } from './terminal/commands'

// dev-only handle for e2e drives — import.meta.env.DEV is dead-code-eliminated
// from production builds, so the store never leaks to a shipped page
if (import.meta.env.DEV) {
  ;(window as unknown as { __store?: typeof store; __exec?: typeof exec }).__store = store
  ;(window as unknown as { __exec?: typeof exec }).__exec = exec
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
