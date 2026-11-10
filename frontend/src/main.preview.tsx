import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import '@/index.css'
import { AppProviders, AppRoutes } from './App'
import { AppShell } from '@/components/layout/app-shell'

/**
 * Entry point for the self-contained single-file preview build.
 * Uses HashRouter so the app works inside sandboxed iframes (e.g. the
 * workspace file viewer), where history-based routing is unavailable.
 */
const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element #root not found')

createRoot(rootElement).render(
  <StrictMode>
    <AppProviders>
      <HashRouter>
        <AppShell>
          <AppRoutes />
        </AppShell>
      </HashRouter>
    </AppProviders>
  </StrictMode>,
)
