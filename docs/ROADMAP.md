# Vigor — Phase Roadmap

Each phase ends with a report (features, test results, limitations) and an explicit approval gate.
Phases are small and coherent; no phase starts without approval of the previous one.

## Phase 1 — Frontend shell (COMPLETE)

- Project structure, design system, navigation for all 13 modules.
- Player database with functional filters; deep player profiles; contextual analysis configuration;
  comparison; similarity search; top performers; Tactical Lab; match analysis; news; discussion
  rooms; AI assistant interface (deterministic mock); settings with demo-mode master switch.
- Deterministic fictional demo dataset with provenance labels and explicit empty states.
- Vitest + RTL test suite; production build.

**Verified:** 45/45 tests passing, `tsc` clean, production build succeeds.

## Phase 2a — Backend core domain (IMPLEMENTED — pending local verification)

Narrowed from the original Phase 2 scope per the user's direction (auth and user-content
persistence deferred; flagged explicitly below).

- Java 21 / Spring Boot 3.5 / Maven project with the layout in `backend/README.md`.
- Flyway `V1__core_schema.sql`: competitions, seasons, teams, players, player_season_stats,
  matches, player_match_minutes, match_events, import_sources — all with provenance columns and
  CHECK constraints; `V2__demo_seed.sql` seeds an internally-consistent DEMO-labelled dataset.
- REST `/api/v1` with pagination/whitelisted sorting/validation and a consistent error envelope:
  bootstrap (frontend PlatformData shape), competitions, seasons, teams, players (+ minutes),
  matches (+ events/minutes), manual match-event tagging (POST/DELETE, provenance forced MANUAL).
- Integration tests (Testcontainers PostgreSQL 17 or a local test DB via `-Dit.db.url`) + a
  pure-JVM validation unit test.

**Status caveat:** written but not compiled/executed in the authoring environment (no JDK 21/Maven
available there). Verify locally with `mvn clean verify` (exact commands in `backend/README.md`).

## Phase 2b — Auth, users and user-content persistence (PROPOSED NEXT)

Deferred from the original Phase 2 scope by user direction:

- Spring Security: registration/login, roles (analyst, scout, moderator, admin), server-side
  permission checks; tests for permissions and invalid input.
- Users/roles tables in Flyway `V3`.
- User content persisted server-side: shortlists, saved research, manual tags written through the
  API (frontend wiring), scenario storage.
- Metric tables (`metric_definitions`, `metric_results`) if Phase 3 needs them first.

## Phase 3 — Analysis engine server-side

- Move contextual analysis, similarity and composite scoring into tested services.
- Configurable phase rules (build-up possession definition) stored per-tenant/season.
- Metric definitions table becomes the single source of truth driving both API and UI.
- Import pipeline skeleton with source, import time and attribution per record (IMPORTED label).

## Phase 4 — Real data integration

- Connect a licensed or permitted data source (e.g. StatsBomb open data for validation, then a
  commercial provider); provenance: IMPORTED + VERIFIED workflows.
- Keep demo mode fully separable; empty states when a metric's source is absent.
- Audit events for imports; attribution display in the UI.

## Phase 5 — Community platform

- Discussion rooms with real identities, moderation queue, reporting workflow, saved research,
  permission-gated posting; rate limiting on writes.

## Phase 6 — Tactical Lab backend + match module persistence

- Scenario CRUD, sharing, duplication history; manual match tags and notes persisted and
  attributable; report generation server-side.

## Phase 7 — External intelligence

- AI assistant with a real LLM provider through the backend (retrieval-grounded, citations, keys
  server-side); news ingestion from official feeds with per-article provenance; optional social
  embeds via official APIs only.

## Phase 8 — Video analysis service (assessment first)

- Separate Python service: frame extraction, player/ball tracking, event detection, video-to-event
  alignment. Requires explicit decisions on models, hardware, processing time, accuracy targets and
  licensing before implementation. All detected events labelled as automatic until human-verified.

## Phase 2 approval checklist

- [x] Phase 1 report reviewed; known limitations accepted.
- [x] Confirmed: Java 21 + Spring Boot 3.5 + PostgreSQL 16+.
- [x] Confirmed: seed strategy for the demo dataset server-side (Flyway-located V2, all rows DEMO).
- [ ] `mvn clean verify` passes locally on Windows (build/test report to the user).
- [ ] Auth mechanism (session vs JWT) and initial roles — decide before Phase 2b starts.
- [ ] Any UI/UX changes requested from Phase 1 usability feedback.
