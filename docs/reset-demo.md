# CampuSphere Reset And Demo Data Notes

Milestone 8, Section 8.10. Use these notes to prepare a clean demo database and
repeatable evidence run.

## Safety Rules

- Confirm you are using a demo/local database before resetting or reseeding.
- Do not run destructive reset steps against production data.
- Do not commit database dumps, `.env`, screenshots with secrets, cookies,
  session IDs, or raw logs.
- Supabase SQL files are applied manually by the project owner in the Supabase
  SQL editor; do not paste service-role keys into screenshots or docs.

## MySQL Demo Reset

For normal local reseeding:

```bash
node database/seed.js
```

The seed creates `campusphere_db`, applies `database/schema.sql`, ensures the
Milestone 8.8 performance indexes for existing DBs, and inserts demo content
idempotently.

For deployment rehearsal, run strict mode so duplicate identity rows fail the
seed instead of being skipped:

```bash
SEED_STRICT_CONSTRAINTS=true node database/seed.js
```

`NODE_ENV=production` also implies strict seed constraint behavior.

## Seeded Demo Accounts

The MySQL seed creates a deterministic admin and sample-student fixture for
**local development only**; their local-only values live in `database/seed.js`
and the shared test-only loader (`scripts/regressionCredentials.js`) and are
deliberately not listed in documentation. They are not valid live credentials.

Live/Supabase regression sign-ins use the four regression identities whose
private owner-managed passwords exist only as the test-only
`SUPABASE_REGRESSION_*` variables in the ignored local `.env` (names in
`.env.example`; values never committed or printed). Change or remove seeded
local fixtures before any non-demo deployment.

## Supabase Demo Preparation

For a fresh Supabase project, apply the SQL files in order:

```text
0001_initial_schema.sql
0002_seed_data.sql
0003_auth_profile_functions.sql
0004_building_backfill.sql
0005_building_write_functions.sql
0006_admin_content_and_logs.sql
0007_route_graph_admin_write_functions.sql
0008_profile_update_atomic_function.sql
0009_public_registration_trust_policy.sql
0010_performance_indexes.sql
0011_supabase_session_store.sql
```

For an existing project, apply only missing migrations in ascending order.
Migrations through `0011_supabase_session_store.sql` must be applied before final
production GO (`0011` creates the server-only `public.app_sessions` table used when
`SESSION_STORE=supabase`).

## Evidence Run Order

1. Prepare env vars from `.env.example` without exposing real values.
2. Seed MySQL:
   ```bash
   node database/seed.js
   ```
3. Run gates:
   ```bash
   npm run qa
   npm run qa:db
   npm run qa:smoke
   npm run qa:identity
   npm run qa:audit
   ```
4. Capture only final pass/fail lines for evidence.
5. Run the manual checklist in `docs/test-evidence.md`.
6. Store sanitized screenshots/recordings outside the repo unless explicitly
   approved for commit.

## Docker Rehearsal

Docker full deployment finalization is Milestone 13, verified on a Docker-enabled
machine (Milestone 9.8 is the Supabase session-store end-to-end GO/NO-GO):

```bash
docker build -t campusphere:m9 .
docker run --rm campusphere:m9 node --check server.js
docker compose -f docker-compose.testing.yml config
```

If using compose for local MySQL fallback rehearsal:

```bash
docker compose -f docker-compose.testing.yml up --build
docker compose -f docker-compose.testing.yml run --rm app node database/seed.js
```

Inside the app container, `DB_HOST` must be the compose service name `mysql`,
not `localhost`.
