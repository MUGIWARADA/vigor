# Bundle audit — `frontend/dist`

*The queue item was "audit the shipped bundle" using `rea` (the MCP/CLI reverse
engineering toolkit). `rea` exists to take apart *unknown* binaries — Hopper,
Ghidra and IDA for native code, a JS analyser for Electron apps. We have the
source. Running a reverse-engineering toolkit against our own build would recover
what we already wrote, so the audit was done by reading the artefact directly.
That is the same conclusion the earlier repo assessment reached: `rea` is the
right instrument for someone else's binary, not ours.*

Build audited: `vite build` output of 22 Oct, 13 files, 1.7 MB.

## What is in it

| file | size |
|---|---|
| `assets/index-*.js` | 932 KB |
| `assets/vendor-charts-*.js` (recharts + d3) | 304 KB |
| `assets/vendor-radix-*.js` | 124 KB |
| `assets/index-*.css` | ~90 KB |
| Inter variable woff2, latin + latin-ext | 84 KB |
| `index.html` | 1.2 KB |

No source maps. That is deliberate and correct here: shipping `.map` files would
publish the full source including comments about internal design. It also means
there is nothing recoverable beyond the minified bundle itself.

## Checks and results

| check | result |
|---|---|
| source maps published | **none** |
| `eval` / `new Function` in our bundle | **0** |
| `console.log` / `debug` / `warn` left in | **0** |
| absolute filesystem paths (`/home/...`, `file://`) | **none** |
| credentials, API keys, bearer tokens | **none** |
| `http://localhost` | 2 hits, **both inside React Router**'s internal `new URL('http://localhost')` placeholder — not a configured endpoint |
| `import.meta.env` leaking | **0** (build-time substitution only) |
| external hosts referenced | `w3.org` (SVG namespace, 20×), library documentation URLs inside error strings (`react.dev`, `redux.js.org`, `bit.ly/3cXEKWf` = Immer's error link), and our own outbound links (`x.com/search`, `youtube.com/results`) |
| third-party licences bundled | React, React Router, Radix UI, Recharts/d3, lucide, class-variance-authority, clsx, tailwind-merge — all MIT or ISC |
| AGPL code in the bundle | **none** — there is no YOLO, no Ultralytics, no model runtime in the frontend build |

The one string that looks like a disclosure but is not:

> "planned for Phase 2 with the Spring Boot backend (Spring Security). No
> passwords or personal data are collected in this build, and no secrets are
> stored…"

That is copy on our own About/settings page, and it is accurate: the build makes
no network requests at all, so all state is in `localStorage`.

## What it means

- **No secrets can leak**, because there are none in the frontend and nothing in
  it talks to a server.
- **The source is not exposed** — no maps, and `dist/` is not in version control
  (`.gitignore` excludes it), so this audit describes an artefact, not a
  committed file.
- **The AGPL question does not apply to the frontend.** When the video pipeline
  lands it will be browser-side inference; if an AGPL model runtime ships in this
  bundle, §13 of that licence attaches to the bundle itself and the notice has to
  travel with it. That is the moment to re-run this audit, and it is written into
  the video plan.
- All state is client-side (`localStorage`), so a stale bundle is the only
  upgrade path — there is no server to enforce a version.

## Not covered

- **Dependency vulnerabilities.** This is a contents audit, not `npm audit`;
  the dependency tree was installed fresh with `npm ci` and no automatic advisory
  scan was run. Worth doing before any public deployment.
- **CSP / security headers.** There is no server here to set them. The inline
  theme-restore script in `index.html` would need a nonce or hash under a strict
  CSP — noted for whenever a backend starts serving this.
- **Runtime behaviour.** Covered elsewhere: 337 tests, typecheck, and the
  engine integrity suite.
