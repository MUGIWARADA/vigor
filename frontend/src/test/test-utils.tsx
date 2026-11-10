import type { ReactElement, ReactNode } from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { SettingsProvider } from '@/state/settings'
import { FiltersProvider } from '@/state/filters'
import { DataProvider } from '@/state/data'

/**
 * Render a page element with all app providers and a memory router.
 * Pass `path` when the component reads route params (e.g. "/players/:playerId").
 */
export function renderWithApp(
  element: ReactElement,
  { route = '/', path }: { route?: string; path?: string } = {},
) {
  return render(
    <SettingsProvider>
      <FiltersProvider>
        <DataProvider>
          <TooltipProvider>
            <MemoryRouter initialEntries={[route]}>
              {path ? (
                <Routes>
                  <Route path={path} element={element} />
                </Routes>
              ) : (
                element
              )}
            </MemoryRouter>
          </TooltipProvider>
        </DataProvider>
      </FiltersProvider>
    </SettingsProvider>,
  )
}

export function Wrapper({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <FiltersProvider>
        <DataProvider>
          <TooltipProvider>
            <MemoryRouter>{children}</MemoryRouter>
          </TooltipProvider>
        </DataProvider>
      </FiltersProvider>
    </SettingsProvider>
  )
}
