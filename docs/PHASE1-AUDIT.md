# Phase 1 Frontend Audit — Vigor

**Date:** 15 October 2026 · **Scope:** full frontend audit before new features (no backend work, per instruction)

## Method

1. Mechanical verification: `tsc -b --noEmit`, full Vitest suite, production build, single-file preview build.
2. Source review of all 13 page modules + AppShell + shared components + stores + mock API (≈5,300 lines).
3. New automated route audit: every route rendered in jsdom and key controls exercised (`src/pages/__tests__/audit-routes.test.tsx`, 18 tests).
4. Fixes applied for every defect found, each covered by a regression test.

## Verification results

| Check | Result |
|---|---|
| TypeScript (`tsc -b --noEmit`) | ✅ clean |
| Tests | ✅ **66/66 passed, 11 files** (48 pre-audit → 66 after: +18 audit tests) |
| Production build (`npm run build`) | ✅ vendor-react 50.8 kB · vendor-radix 124.0 kB · vendor-charts 310.4 kB · app 490.0 kB |
| Single-file offline preview | ✅ `PHASE1-PREVIEW.html` (1,170 kB, self-contained) |
| Dev server | ✅ 200 on :5173 with all fixes |

## Defects found and fixed (8)

| # | Module | Defect | Fix |
|---|---|---|---|
| 1 | Top performers | "Per-90 values" checkbox changed the unit **label** only — the numbers stayed per-90 while the column said "total" (data mislabeling) | Values, peer percentiles, sorting and CSV export now all follow the toggle |
| 2 | Tactical Lab | Saving an edited **demo scenario** stored the copy under the *same id* → duplicate list entries; reopening loaded the demo original and silently shadowed your edits | Save on a demo seed now creates your own copy under a fresh id ("… (my copy)") |
| 3 | Tactical Lab | Edits to your own scenario were **silently lost** if you navigated away without clicking Save | Debounced autosave (400 ms) for user-owned scenarios; demo seeds keep explicit Save-to-copy |
| 4 | Tactical Lab | `?scenario=` **deep links were broken on cold load** — the mount effect ran before the async dataset arrived, so profile → "Tactical Lab scenario" links did nothing after a refresh | Load effect re-runs when data arrives (still never clobbers an open working copy) |
| 5 | Discussions | **Replying to a demo post silently discarded the reply** (submit only mapped over local posts) | Replies are keyed by post id and merge into any post, demo or local |
| 6 | Discussions | Local posts **leaked across rooms** when the route param changed (component is reused, state wasn't reset) | Local posts filtered to the current room's player |
| 7 | Match analysis | Per-match working state (notes draft, tag position, selection, focus) leaked across matches via back/forward — notes from match A could be **saved against match B** | Per-match state resets when `matchId` changes |
| 8 | Match analysis | Manual tags were **always attributed to the home team**, even when the tagged player plays for the away team (wrong ring colour on the pitch, wrong team in exports) | Tag team is derived from the tagged player (home team as fallback) |

Test-infrastructure additions (jsdom gaps, not app bugs): `scrollIntoView` and pointer-capture mocks in `setup.ts`; `renderWithApp` now supports mounting a page under a route pattern so `useParams` works.

## Genuinely functional (verified by interaction tests)

- **Navigation/shell** — 15 routes + 404, responsive sidebar, mobile drawer (Esc/backdrop/route-change close), demo-mode indicator, "no data source" state.
- **Global filter bar** — competition, season, position group, team, age range, min minutes; persisted; feeds Players/Overview.
- **Player database** — name search, preferred-foot filter, 10 sort options, pagination with clamping, compare selection (max 3) → `/compare?ids=…`, row → profile.
- **Player profile** — 4 controlled tabs; 30-metric registry with numerator/denominator/unit/direction/source tooltips; percentile bars vs same-position peers; radar; match-by-match evidence table; deterministic similar-players; related news/rooms/scenarios; recently-viewed tracking.
- **Contextual analysis** — player, match phase, position group, team style, min-minutes slider, age range → live peer group + phase metric table (value, unit, sample, percentile, interpretation, peer median/best, small-n warning) + gated "not available" section with reasons.
- **Comparison** — up to 3 URL-synced slots; shared-metric intersection; direction-aware best-value highlighting; per-player own-peer percentile radar; never zero-fills.
- **Similarity search** — deterministic z-score engine; 6 dimension weights with role defaults, custom weights, reset; candidate filters; biggest-gap badges; per-pair excluded metrics reported; score formula documented in-page.
- **Top performers** — metric select (grouped), phase filter, position/style/age/minutes filters, per-90 ⇄ totals toggle (now correct), percentile column, opt-in composite with visible weighting, CSV export, compare selection.
- **Tactical Lab** — 5 tools; attack/defence formation presets; draggable tokens; action create/select/reorder/delete/annotate/link-to-player; ghost overlay comparison; scenario browser; new/save/duplicate/delete; autosave; working deep links.
- **Match analysis** — list with team filter; timeline with type filters and selection; pitch event positions; player-focus event map (click a player name, or use the selector); manual tagging with position picker and validation; per-match tactical notes (persisted); Markdown report export (includes MANUAL tags + limitations).
- **News** — category filter; demo-labelled articles with source/date/provenance; explicit "no external article exists" notes.
- **Discussions** — rooms list; saved-research bookmarks (persisted); post + reply with length validation (10–4000); MANUAL provenance on your content; report flag; links to records.
- **AI assistant** — deterministic mock provider (labelled "MOCK · DEMONSTRATION"); answers grounded in the demo dataset with clickable citations and limitations; provider interface (`isMock`) ready for a real backend.
- **Settings** — demo-data master switch (off → every module shows explicit empty states, verified); inline-definitions toggle; settings reset; local-content inventory + confirm-gated clear; provenance legend; API connection status.

## Honest placeholders / visual-only (by design, labelled in-UI)

- **All statistics are fictional DEMO data** — labelled at dataset, page and row level; header indicator when active.
- **Profile touch maps** — synthetic spatial samples generated for position/minutes/style, labelled as such; no tracking data exists.
- **Match event-position maps** — built from tagged events with coordinates; explicitly *not* positional heat maps.
- **Tactical Lab** — planning/visualisation tool only; "not a simulation" warning in place; drawn arrows carry no validation claims.
- **News** — fictional articles, no real feed, no scraping; real sources deferred to Phase 7 with licensed/official feeds.
- **Assistant** — rule-based mock, no LLM connected; clearly labelled; keys will stay server-side.
- **Discussions** — fictional authors, no authentication; your posts/replies are session-local (bookmarks persist); moderation queues arrive with the backend.
- **Backend** — none; the mock API client documents the `/api/v1/bootstrap` contract and honours `VITE_API_BASE_URL`; Spring Boot is *not* silently replaced, only stubbed with a labelled in-browser stand-in.
- **Accounts/auth** — not implemented (Phase 2), stated in Settings; no secrets in frontend code.
- **Gated metrics** (opponent pressure, between-the-lines receipts, xT, passing networks) — shown as unavailable with reasons, never zero-filled or approximated.

## Known limitations (accepted, not defects)

- Age min/max inputs are not cross-clamped; an inverted range yields "0 players" with an explicit empty peer group rather than an error.
- Pitch token drag in the Tactical Lab can drop if the pointer leaves the SVG (no pointer capture on tokens); click-to-redraw position is unaffected.
- Similarity search reads `?player=` once on mount (documented behaviour).
- Discussion posts/replies and match note *drafts* are session-only; scenarios, manual tags, notes, bookmarks and recently-viewed persist to localStorage.
- CSV/Markdown exports use browser Blob downloads (no server round-trip), and carry a DEMO provenance column.
- ESLint is not yet wired (documented in README known limitations).

## Files changed in this audit

- `src/pages/TopPerformersPage.tsx` — per-90 basis fix (+ CSV unit), dead code removed
- `src/pages/TacticalLabPage.tsx` — save-creates-copy, autosave, cold-load deep-link fix, hint copy
- `src/pages/DiscussionsPages.tsx` — replies keyed per post, room-scoped local posts
- `src/pages/MatchPages.tsx` — per-match state reset, tag team attribution
- `src/test/setup.ts` — jsdom mocks (scrollIntoView, pointer capture)
- `src/test/test-utils.tsx` — route-pattern mounting support
- `src/pages/__tests__/audit-routes.test.tsx` — **new**, 18 tests (9 route smoke, 9 interaction/regression)

**Backend was not started**, per instruction. Phase 2 approval remains pending.
