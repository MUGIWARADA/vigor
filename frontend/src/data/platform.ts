import type { DemoDataset } from './generate'
import { buildDemoDataset } from './generate'
import type { DemoContent } from './content'
import { buildDemoContent } from './content'

/** Full platform dataset exposed to the UI in Phase 1. */
export interface PlatformData {
  dataset: DemoDataset
  content: DemoContent
}

let cached: PlatformData | null = null

/**
 * Builds (and memoises) the complete demo platform data.
 * Deterministic: same seed, same output on every run.
 */
export function buildPlatformData(): PlatformData {
  if (cached) return cached
  const dataset = buildDemoDataset()
  cached = { dataset, content: buildDemoContent(dataset) }
  return cached
}
