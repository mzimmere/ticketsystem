import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { SpracheProvider } from './lib/SpracheContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SpracheProvider>
      <App />
    </SpracheProvider>
  </StrictMode>,
)
