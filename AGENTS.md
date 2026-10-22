<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Running this app in the Base44 sandbox

`docker-compose.base44.yml` is the sandbox/dev stack (it is not a production
deployment). It runs the app from the cloned source with `next dev`, so edits
appear without an image rebuild.

```bash
docker compose -f docker-compose.base44.yml up -d --build   # web entry point: :3000
```

Services: `db` (PostgreSQL 17, data in the `af7-db-data` volume), `install`
(one-shot: installs from `package-lock.json`), `migrate` (one-shot: `prisma db
migrate`, `npm run db:seed-access`) and `app` (`next dev -H 0.0.0.0 -p 3000`).
`app` starts only after `install` and `migrate` exit successfully, so
dependencies and the schema are always current before the server boots.

Things that are easy to get wrong:

- **Database credentials are local infrastructure, not secrets.** They live
  inline in the compose file (`postgresql://af7:af7_local_dev@db:5432/af7`).
  Do not move them to Base44 secrets: the dashboard must stay free to supply the
  app's real external credentials.
- **Dependencies live in the `af7-node-modules` volume**, installed from
  `package-lock.json` by the one-shot `install` service, which every other
  service waits for. The install is idempotent — the lockfile hash is recorded
  in `node_modules/.base44-lock-sha`, and a run with an unchanged lockfile does
  nothing — because `docker compose up` restarts exited one-shot services: an
  unconditional `npm ci` there would delete and rebuild the node_modules
  directory the running `next dev` is using (`Cannot find module
  'next/dist/pages/_error'` / 500s on every route until it finishes). `app`
  never installs. Only one container installs at a time, by construction.
- **Migrations are Prisma 8** (`@prisma/orm-postgres`, no `schema.prisma`, no
  `@prisma/client`). Apply with `npx prisma db migrate --db "$DATABASE_URL"`;
  read `.agents/skills/prisma-8/` before touching the contract or migrations.
  `npm run go-live` needs `pg_dump`/`pg_restore`, which the Node image does not
  have — it is for the owner's machine, not for this container.
- **No users are seeded.** The `migrate` service seeds permissions and roles
  only. Create an account with
  `docker compose -f docker-compose.base44.yml run --rm -v <file>:/tmp/a.json app npm run db:set-accounts -- --file=/tmp/a.json --confirm=APPLY`
  (rows are `["EMP-CODE","Name","email","password","ROLE"]`). The sandbox
  database has one: `admin@af7.example` / `Sandbox-Admin-2026` (SUPER_ADMIN).
  Replace it with real accounts via the same script (`--disable-others`).
- **The optional AI assistant** (`/api/assistant`) stays hidden until
  `GROQ_API_KEY` or `XAI_API_KEY` is set; the rest of the ERP does not need it.
- **Sandbox-only override in `next.config.mjs`:** `allowedDevOrigins` gains the
  preview origin `3000-$BASE44_PUBLIC_HOST_SUFFIX` when `BASE44_PREVIEW_MODE` is
  exactly `"1"` (with the flag unset or different, no origin is added and the
  config is unchanged). Next.js blocks cross-origin dev assets/HMR without it.

How to check it is working: `docker compose -f docker-compose.base44.yml ps`
(both `db` and `app` healthy) and `curl -s -o /dev/null -w '%{http_code}'
http://localhost:3000/login` → `200`. The `app` healthcheck also calls
`/api/auth/session` (401 signed out, 200 signed in; 500 means the database is
unreachable).
