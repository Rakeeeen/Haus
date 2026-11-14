import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/app/App'
import { ErrorBoundary } from '@/app/ErrorBoundary'
import { applyStoredTheme } from '@/lib/theme'
import { holdForFonts } from '@/lib/holdForFonts'

// Before the first paint, so a refresh on any page keeps the theme (only Home used to apply it).
applyStoredTheme()
// Show the page once its fonts are in, so the titles are not redrawn when they arrive (see lib/holdForFonts.ts).
holdForFonts()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
