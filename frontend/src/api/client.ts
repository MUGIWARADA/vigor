import type { PlatformData } from '@/data/platform'
import { buildPlatformData } from '@/data/platform'

/**
 * ============================================================================
 * TEMPORARY MOCK API — PHASE 1 ONLY (clearly labelled, per spec §3 and §19)
 * ============================================================================
 *
 * The intended architecture is a Java 21 / Spring Boot REST backend serving
 * /api/v1/* endpoints backed by PostgreSQL (see /backend/README.md). That
 * backend is NOT implemented in Phase 1, so this module stands in for the
 * future HTTP client.
 *
 * What it does:
 *   - If VITE_API_BASE_URL is configured, it attempts a real fetch of the
 *     future bootstrap endpoint (ready for Phase 2+).
 *   - Otherwise it returns the in-browser demo dataset (fictional data,
 *     provenance label DEMO) or null when demo mode is disabled — in which
 *     case the UI must show empty states rather than inventing values.
 */

const RAW_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').trim()
/**
 * Backend wiring modes:
 *  - ''     → no backend (in-browser demo dataset; real-data sections gated off)
 *  - '/'    → same-origin: fetch relative /api/... (dev-server proxy or a
 *             co-deployed frontend+backend; no CORS involved)
 *  - URL    → absolute backend origin (e.g. http://localhost:8080)
 */
const API_BASE = RAW_BASE === '/' ? '' : RAW_BASE.replace(/\/+$/, '')

export interface ApiStatus {
  backendConfigured: boolean
  backendReachable: boolean
  lastError: string | null
}

export const apiStatus: ApiStatus = {
  backendConfigured: API_BASE.length > 0,
  backendReachable: false,
  lastError: null,
}

/** Thrown when VITE_API_BASE_URL is empty — the backend is not wired up. */
export class ApiNotConfiguredError extends Error {
  constructor(message = 'Backend API is not configured (VITE_API_BASE_URL is empty).') {
    super(message)
    this.name = 'ApiNotConfiguredError'
  }
}

/** Thrown when the backend answered with an error or was unreachable. */
export class ApiRequestError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
  }
}

export function isBackendConfigured(): boolean {
  return RAW_BASE.length > 0
}

/**
 * GET a JSON resource from the backend (Phase 4a+ modules fetch on demand).
 * Keeps the shared connection status up to date and surfaces the backend's
 * error-envelope message on failure.
 */
export async function apiGetJson<T>(path: string): Promise<T> {
  if (!RAW_BASE) {
    throw new ApiNotConfiguredError()
  }
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, { headers: { Accept: 'application/json' } })
  } catch (err) {
    apiStatus.backendReachable = false
    apiStatus.lastError = err instanceof Error ? err.message : 'Backend unreachable'
    throw new ApiRequestError(apiStatus.lastError, 0)
  }
  if (!res.ok) {
    apiStatus.backendReachable = false
    let message = `Backend responded ${res.status}`
    try {
      const body = (await res.json()) as { message?: string }
      if (body.message) message = body.message
    } catch {
      // keep the default message
    }
    apiStatus.lastError = message
    throw new ApiRequestError(message, res.status)
  }
  apiStatus.backendReachable = true
  apiStatus.lastError = null
  return (await res.json()) as T
}

export interface LoadOptions {
  /** When false (demo mode disabled in Settings), no data is substituted. */
  includeDemoData: boolean
}

export async function loadPlatformData(options: LoadOptions): Promise<PlatformData | null> {
  if (RAW_BASE && RAW_BASE !== '/') {
    try {
      const res = await fetch(`${API_BASE}/api/v1/bootstrap`, {
        headers: { Accept: 'application/json' },
      })
      if (res.ok) {
        // Phase 2 will map the real API payload here. The shape is expected
        // to match PlatformData; until the backend exists this branch is
        // only reachable against a development stub.
        const json = (await res.json()) as PlatformData
        apiStatus.backendReachable = true
        apiStatus.lastError = null
        return json
      }
      apiStatus.lastError = `Backend responded ${res.status}`
    } catch (err) {
      apiStatus.lastError = err instanceof Error ? err.message : 'Backend unreachable'
    }
  }

  if (options.includeDemoData) {
    return buildPlatformData()
  }
  return null
}
