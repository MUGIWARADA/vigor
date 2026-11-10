# Vigor — Backend (Phase 2: core domain)

**Status: implemented — not yet executed.** The full Spring Boot service, Flyway migrations and
test suite are committed here, but the development sandbox where this code was written only has
Java 21 + Maven + PostgreSQL 17 and verified end-to-end on **2026-10-16**:

- `mvn verify` (local-DB mode): **39/39 tests pass** (8 unit + 31 API integration)
- `mvn spring-boot:run`: boots clean, both Flyway migrations apply
- `/api/v1/fd/*` proxy verified against the live football-data.org API (real Premier League
  standings through the provenance envelope, cache hits, 404 whitelist guard, CORS for the
  dev origin)

Along the way this verification caught and fixed several latent bugs (C#-style generic syntax in
`BootstrapApiIT`, stale `ManualEventRequest` constructor arities, a duplicate variable in
`MatchesApiIT`, a `PgJDBC` null-binding bug that 500-ed `/api/v1/players` — fixed with explicit
`cast(... as string)` in the repository query, and a demo-seed carry row that predated the
two-point event convention). Re-running the commands below on Windows should now just work.

## What Phase 2 delivers (this module)

| Area | Included |
|---|---|
| Domains | competitions, seasons, teams, players (+ season stats), matches, player match minutes, match events, import sources |
| API | versioned REST under `/api/v1` + the `/api/v1/bootstrap` payload the Phase 1 frontend already knows how to consume |
| Persistence | Spring Data JPA + PostgreSQL; Flyway `V1__core_schema.sql` (schema + constraints) and `V2__demo_seed.sql` (DEMO-labelled seed) |
| Writes | manual match-event tagging (POST/DELETE) with full server-side validation; provenance `MANUAL` is forced by the server |
| Errors | one envelope for every failure: `{ code, message, details, timestamp }`; 422 for validation, 404/409 for domain rules |
| Tests | pure-JVM unit test (`mvn test`) + API integration tests (`mvn verify`) against a real PostgreSQL via Testcontainers or a local database |

**Explicitly out of scope (next increment — "Phase 2b")**: Spring Security users/roles/login,
server-side persistence of shortlists/saved research/scenarios/notes, analysis/ranking/similarity
endpoints (Phase 3), news/discussions (Phase 5+), AI provider (Phase 7), video (Phase 8). The
frontend keeps its clearly-labelled in-browser demo dataset and mock content until each piece is
real.

## Stack (pinned)

| Component | Choice |
|---|---|
| Java | 21 (LTS) |
| Spring Boot | **3.5.16** — the final, stabilized 3.x release. The 4.x line is current; upgrading is a tracked follow-up after the first successful local build. |
| Build | Maven (see setup) |
| Database | PostgreSQL 16+ (17 used in the test container) |
| Migrations | Flyway (schema is never auto-created — `ddl-auto: validate`) |
| Validation | Jakarta Bean Validation |
| Tests | JUnit 5, Spring Boot Test, TestRestTemplate, Testcontainers |

## Project layout

```
backend/
├── pom.xml
└── src
    ├── main
    │   ├── java/com/vigor/backend/
    │   │   ├── VigorApplication.java
    │   │   ├── api/          # thin REST controllers
    │   │   ├── common/       # error envelope + exception handling
    │   │   ├── config/       # CORS
    │   │   ├── domain/       # JPA entities (plain FK columns, no lazy-loading hazards)
    │   │   ├── dto/          # request/response records — names mirror the frontend types
    │   │   ├── repository/   # Spring Data JPA repositories
    │   │   └── service/      # business logic (validation lives here, not in controllers)
    │   └── resources
    │       ├── application.yml
    │       └── db/migration/ # Flyway V1 schema, V2 DEMO seed
    └── test/java/com/vigor/backend/
        ├── IntegrationTestBase.java   # Testcontainers, or -Dit.db.url override
        ├── BootstrapApiIT.java        # frontend payload shape + DEMO labelling
        ├── CatalogApiIT.java          # competitions / seasons / teams
        ├── PlayersApiIT.java          # filters, sorting, pagination, errors
        ├── MatchesApiIT.java          # matches, events, minutes, manual tagging
        └── ManualEventRequestValidationTest.java   # pure JVM, no database
```

## Real-data proxy: football-data.org (Phase 4a)

The backend proxies [football-data.org](https://www.football-data.org) (free tier) for league
tables, fixtures/results and top scorers. The proxy adds a provenance envelope so the UI can
label imported data with its source and fetch time.

| Aspect | Behaviour |
| --- | --- |
| Auth | `X-Auth-Token` header, read from the `FOOTBALL_DATA_TOKEN` environment variable — server-side only, never in the browser bundle |
| Free-tier scope | `PL`, `PD`, `SA`, `BL1`, `FL1`, `CL` (verified 2026-10: the Europa League and Conference League return 403 on a free token) |
| Rate limit | Free tokens get 10 requests/minute. The client reads the provider's `X-Requests-Available-Minute` / `X-RequestCounter-Reset` response headers, waits out the reset window when the budget is exhausted, and retries once on 429 |
| Caching | In-memory, 5-minute TTL (`FOOTBALL_DATA_CACHE_TTL`) — UI refreshes do not re-spend budget |
| Errors | Upstream 401/403/404/429/5xx map to the standard error envelope with stable codes (`REAL_DATA_AUTH`, `REAL_DATA_FORBIDDEN`, `UPSTREAM_ERROR`, …) |

### Endpoints

```
GET /api/v1/fd/competitions                          # catalogue for this token
GET /api/v1/fd/competitions/{code}/standings         # league table (CL: league-phase table)
GET /api/v1/fd/competitions/{code}/matches?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD
GET /api/v1/fd/competitions/{code}/scorers           # top scorers
```

Every response is wrapped:

```json
{
  "source": "football-data.org (free tier)",
  "endpoint": "/competitions/PL/standings",
  "competition": "PL",
  "fetchedAt": "2026-10-16T13:14:07Z",
  "cached": false,
  "data": { ...provider payload... }
}
```

### Running with real data

```powershell
# In addition to the database variables from the setup above:
$env:FOOTBALL_DATA_TOKEN = "<your personal token>"
mvn spring-boot:run

# Verify (second PowerShell):
Invoke-RestMethod http://localhost:8080/api/v1/fd/competitions/PL/standings | ConvertTo-Json -Depth 3
```

Without `FOOTBALL_DATA_TOKEN` the proxy endpoints return `503 REAL_DATA_NOT_CONFIGURED` and the
rest of the API is unaffected. Free-tier data is delayed (not live) — fine for scouting analysis.

## REST API (v1)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/bootstrap` | full dataset in the frontend's `PlatformData` shape; `content` arrays are empty (no content modules yet — the UI shows explicit empty states) |
| GET | `/api/v1/competitions` | |
| GET | `/api/v1/seasons?competitionId=` | optional filter |
| GET | `/api/v1/teams` | all teams (teams are not competition-scoped until multi-competition support) |
| GET | `/api/v1/teams/{id}` | |
| GET | `/api/v1/players?teamId=&position=&name=&minMinutes=&page=&pageSize=&sort=&direction=` | sort whitelist: `name, minutes, goals, assists, xg, xa`; direction `asc|desc` |
| GET | `/api/v1/players/{id}` | includes `stats`; optional fields omitted, never `null` |
| GET | `/api/v1/players/{id}/minutes` | per-match minutes rows |
| GET | `/api/v1/matches?teamId=&seasonId=&round=&page=&pageSize=` | newest kickoff first |
| GET | `/api/v1/matches/{id}` | |
| GET | `/api/v1/matches/{id}/events?type=` | ordered by minute |
| GET | `/api/v1/matches/{id}/minutes` | |
| POST | `/api/v1/matches/{id}/events` | manual tag — validated, provenance forced to `MANUAL` |
| DELETE | `/api/v1/matches/{id}/events/{eventId}` | manual tags only (provider events → 409) |
| GET | `/actuator/health` | |

### Error envelope (every failure, no stack traces)

```json
{
  "code": "VALIDATION_ERROR",
  "message": "The request failed validation. Check 'details' for each field.",
  "details": { "minute": "minute must be between 1 and 90" },
  "timestamp": "2026-10-15T12:00:00Z"
}
```

Codes: `VALIDATION_ERROR` (422), `MALFORMED_REQUEST` (400), `NOT_FOUND` (404), `CONFLICT` (409),
`INTERNAL_ERROR` (500). Domain rules raise stable codes: `TEAM_NOT_IN_MATCH`,
`PLAYER_NOT_FOUND`, `PLAYER_TEAM_MISMATCH`, `DUPLICATE_EVENT_ACTOR`,
`ONLY_MANUAL_EVENTS_DELETABLE`.

### Manual tag request

```json
POST /api/v1/matches/1/events
{
  "minute": 55, "type": "turnover", "teamId": "1", "playerId": "4",
  "x": 42.5, "y": 61.0, "value": null, "note": "Loose touch under pressure."
}
```
Constraints: minute 1–90; `type` one of the ten event types; team must play in the match; the
player (if set) must belong to that team; `x`/`y` in 0–100; `value` (xG-style) in 0–1; note ≤ 500
chars. Provenance is always `MANUAL` — clients cannot choose it.

## Windows setup — exact commands

### 1. Install the toolchain

```powershell
# JDK 21 (Temurin) — verify afterwards with: java -version
winget install -e --id EclipseAdoptium.Temurin.21.JDK

# Maven — verify afterwards with: mvn -version
winget install -e --id Apache.Maven
```

(No winget? Download the installers: <https://adoptium.net> and <https://maven.apache.org/download.cgi>,
then add Maven's `bin` folder to `PATH`.) Open a **new** PowerShell window after installing so the
`PATH` updates are picked up.

### 2. Install PostgreSQL 16+

EDB installer with GUI: <https://www.postgresql.org/download/windows/> (remember the `postgres`
superuser password; port 5432). Or via winget:

```powershell
winget install -e --id PostgreSQL.PostgreSQL.16
```

### 3. Create the application database and user

```powershell
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -h localhost
```

```sql
CREATE DATABASE vigor;
CREATE USER vigor_app WITH ENCRYPTED PASSWORD 'change-me-strong';
-- IMPORTANT on PostgreSQL 15+: make the app user the owner, otherwise Flyway
-- cannot create tables in the public schema ("permission denied for schema public").
ALTER DATABASE vigor OWNER TO vigor_app;
-- Empty database for the integration tests (see "Running the tests"):
CREATE DATABASE touchline_iq_test OWNER vigor_app;
\q
```

> **Already have a `vigor` database from an older build?** The V1/V2 migrations changed
> (two-point event columns + cup seed), so Flyway will refuse with a checksum mismatch. The
> database holds only regenerable demo data — drop and recreate it:
>
> ```sql
> DROP DATABASE vigor;
> CREATE DATABASE vigor OWNER vigor_app;
> ```

### 4. Configure and run the backend

```powershell
cd <repo>\backend

$env:VIGOR_DB_URL      = "jdbc:postgresql://localhost:5432/vigor"
$env:VIGOR_DB_USER     = "vigor_app"
$env:VIGOR_DB_PASSWORD = "change-me-strong"

mvn spring-boot:run
```

First start applies both Flyway migrations and seeds the DEMO dataset. Verify from a second
PowerShell:

```powershell
Invoke-RestMethod http://localhost:8080/actuator/health     # {"status":"UP"}
Invoke-RestMethod http://localhost:8080/api/v1/bootstrap    | ConvertTo-Json -Depth 4
Invoke-RestMethod "http://localhost:8080/api/v1/players?sort=goals&pageSize=5"
```

### 5. Point the frontend at the backend

```powershell
cd <repo>\frontend
Copy-Item .env.example .env.local
# Edit .env.local and set:  VITE_API_BASE_URL=http://localhost:8080
npm run dev
```

The app now loads data from the API (`Settings → Connection status` shows the backend reachable).
Players/teams/matches/events come from PostgreSQL with `DEMO` provenance labels; news, discussions
and scenarios show their explicit empty states until those modules exist. Remove
`VITE_API_BASE_URL` (or the whole `.env.local`) to return to the self-contained in-browser demo
dataset at any time.

### 6. Running the tests

```powershell
cd <repo>\backend

# Unit tests — pure JVM, no PostgreSQL, no Docker needed.
mvn test

# Integration tests — hermetic PostgreSQL 17 container (requires Docker Desktop running).
mvn verify
```

**No Docker?** Run the integration tests against the empty `touchline_iq_test` database created in
step 3:

```powershell
mvn verify "-Dit.db.url=jdbc:postgresql://localhost:5432/touchline_iq_test" "-Dit.db.user=vigor_app" "-Dit.db.password=change-me-strong"
```

The test database must be **empty** (Flyway migrates and seeds it). Reset it with:

```sql
DROP DATABASE touchline_iq_test;
CREATE DATABASE touchline_iq_test OWNER vigor_app;
```

### Optional: PostgreSQL via Docker instead of a local install

```powershell
docker run --name touchline-pg -e POSTGRES_PASSWORD=change-me-strong `
  -e POSTGRES_DB=vigor -p 5432:5432 -d postgres:17
```

Docker remains **optional**; the primary path above uses a local PostgreSQL install only.

## Demo data, provenance and imports

- Every seed row carries `provenance = 'DEMO'` and `source_name = 'Demo seed dataset v0.2.0'`.
  The seed is internally consistent (scorelines ↔ goal events ↔ season aggregates ↔ minutes rows)
  so the demo holds up to inspection.
- `import_sources` exists from day one: **imported records will carry `provenance = 'IMPORTED'`
  and a `source_id`** tying each row to its source name, version and licence note (Phase 4 import
  pipeline). Nothing imported exists yet — and nothing is labelled imported that isn't.
- Missing values are `NULL`, never zero-as-missing; the API omits optional fields rather than
  sending `null` (the frontend distinguishes absent vs null).
- Manual tags are always `MANUAL`; provider events are read-only (delete → 409).

## Documented Phase 2 trade-offs

- Player/match lists sort and paginate in memory after DB filtering — deliberate for the Phase 2
  dataset scale (bootstrap already ships everything); DB-level pagination is a tracked follow-up.
- Bootstrap serves a single active (most recent) season; multi-season selection arrives with the
  analysis endpoints in Phase 3.
- No authentication yet: every endpoint is unauthenticated and bind to localhost by default. Do
  not expose this service publicly before Phase 2b (Spring Security) lands.
- `POST /api/v1/matches/{id}/events` is validated and persisted but the frontend still stores
  manual tags in `localStorage`; wiring the UI to the endpoint is part of Phase 6 (match module
  persistence).

## Security principles (carried from the project spec)

- Server-side validation on every write endpoint (Bean Validation + service-level rules).
- Credentials only in environment variables (`VIGOR_DB_*`) — never in source control; nothing
  secret in `VITE_*` frontend variables.
- CORS restricted to configured origins (`VIGOR_CORS_ORIGINS`, default the Vite dev server).
- Safe error responses (no stack traces or internals); unexpected errors are logged server-side
  only.
- Schema changes only through versioned Flyway migrations — `ddl-auto` stays on `validate`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `permission denied for schema public` during startup | You skipped `ALTER DATABASE vigor OWNER TO vigor_app;` (step 3). |
| `Connection refused` to PostgreSQL | Service not running: `Get-Service postgresql*` then `Start-Service postgresql-x64-16`. |
| `Flyway: validation failed` after editing a migration | Never edit applied migrations — add `V3__….sql`. To rebuild from scratch (dev only): drop and re-create the database. |
| Port 8080 busy | `$env:VIGOR_PORT=8081` before `mvn spring-boot:run` (and update `VITE_API_BASE_URL`). |
| Testcontainers fails to find Docker | Start Docker Desktop, or use the `-Dit.db.url` local-database mode. |
