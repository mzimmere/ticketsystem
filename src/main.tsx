import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { SpracheProvider } from './lib/SpracheContext'

// registerType "autoUpdate" (vite.config.ts) laedt die Seite automatisch
// neu, sobald ein neuer Service Worker aktiv wird - dafuer muss die
// Registrierung ueber dieses reaktive Modul laufen statt ueber das
// bisherige, rein statische Auto-Inject-Script (das nie neu lud und
// dadurch dazu fuehrte, dass Nutzer nach jedem Deploy einmal manuell
// Strg+R druecken mussten).
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SpracheProvider>
      <App />
    </SpracheProvider>
  </StrictMode>,
)
