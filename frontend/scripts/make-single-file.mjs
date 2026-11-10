#!/usr/bin/env node
/**
 * Inlines the dist-preview build into a single self-contained HTML file:
 *   - CSS inlined into a <style> tag
 *   - JS inlined into a <script type="module"> tag
 *   - Only the Latin Inter subset is kept (base64 data URI); other font
 *     subsets are dropped so the file works fully offline.
 *
 * Output: ../PHASE1-PREVIEW.html (repository root, next to README.md)
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(here, '../dist-preview')
const outFile = path.resolve(here, '../../PHASE1-PREVIEW.html')

const htmlPath = path.join(distDir, 'preview.html')
if (!existsSync(htmlPath)) {
  console.error('dist-preview/preview.html not found — run `vite build --config vite.preview.config.ts` first.')
  process.exit(1)
}
let html = readFileSync(htmlPath, 'utf8')

const assetsDir = path.join(distDir, 'assets')
const files = readdirSync(assetsDir)
const cssFiles = files.filter((f) => f.endsWith('.css'))
const jsFiles = files.filter((f) => f.endsWith('.js'))

if (cssFiles.length !== 1 || jsFiles.length !== 1) {
  console.error(`Expected exactly 1 CSS and 1 JS asset, found ${cssFiles.length} CSS and ${jsFiles.length} JS.`)
  console.error('Files:', files.join(', '))
  process.exit(1)
}

let css = readFileSync(path.join(assetsDir, cssFiles[0]), 'utf8')
const js = readFileSync(path.join(assetsDir, jsFiles[0]), 'utf8')

/* ---------------- Font handling: keep only the Latin subset ---------------- */
const fontFaceRe = /@font-face\s*\{[^}]*\}/g
const faces = css.match(fontFaceRe) ?? []
let kept = 0
for (const face of faces) {
  if (/inter-latin[\w-]*\.woff2/.test(face)) {
    const m = face.match(/url\(([^)]*inter-latin[\w-]*\.woff2)\)/)
    if (m) {
      const fontPath = path.join(assetsDir, path.basename(m[1]))
      const b64 = readFileSync(fontPath).toString('base64')
      css = css.replace(face, face.replace(m[1], `data:font/woff2;base64,${b64}`))
      kept += 1
    }
  } else {
    css = css.replace(face, '')
  }
}
css = css.replace(/\n{2,}/g, '\n')
console.log(`Fonts: kept ${kept} Latin @font-face (inlined), dropped ${faces.length - kept} subsets.`)

/* ---------------- Inline CSS ---------------- */
const cssTag = `<style>\n${css}\n</style>`
html = html.replace(/<link[^>]*rel="stylesheet"[^>]*>/, () => cssTag)
if (!html.includes(cssTag)) {
  console.error('Failed to inline the stylesheet link.')
  process.exit(1)
}

/* ---------------- Inline JS ---------------- */
// Guard against the inline script accidentally closing the tag early.
const safeJs = js.replace(/<\/script/gi, '<\\/script')
const jsTag = `<script type="module">\n${safeJs}\n</script>`
// Function replacement: the JS bundle can contain '$&'-style sequences that
// would otherwise be interpreted as replacement patterns.
html = html.replace(/<script[^>]*type="module"[^>]*src="[^"]*"[^>]*><\/script>/, () => jsTag)
if (!html.includes(jsTag)) {
  console.error('Failed to inline the module script.')
  process.exit(1)
}

/* ---------------- Sanity checks: no remaining external references ---------------- */
// Scan only markup — the inlined JS/CSS bodies legitimately contain string
// literals like href="'+p+'" from the minified router code.
const markupOnly = html
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
const leftovers = markupOnly.match(/(src|href)="(?!#|data:)[^"]*"/g) ?? []
const bad = leftovers.filter((ref) => !ref.includes('icon') && !ref.startsWith('href="#"'))
if (bad.length > 0) {
  console.error('External references remain:', bad)
  process.exit(1)
}

writeFileSync(outFile, html)
console.log(`Wrote ${outFile} (${Math.round(html.length / 1024)} KB)`)
