import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

// The canvas card drawer measures text with Velvelyne's metrics
// (src/canvas/cardGeometry.ts). Load the weights we draw with (400 body,
// 600→Bold name) before the first render so the initial layout uses final
// metrics — no font-swap reflow. Never block boot on a font failure.
async function ensureFonts() {
  if (!('fonts' in document)) return
  try {
    await Promise.all([
      document.fonts.load('400 14px "Velvelyne"'),
      document.fonts.load('600 15px "Velvelyne"'),
    ])
    await document.fonts.ready
  } catch {
    // fall through to fallback metrics
  }
}

ensureFonts().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  )
})
