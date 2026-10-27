<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:db-migration-rules -->
# Database Migrations — Supabase (PostgreSQL)

The database is a **Supabase Postgres** project. Auth is **Supabase Auth**. The connection string lives in `.env` under `DATABASE_URL`. Schema lives in `supabase/migrations/` and `src/data/schema.sql`.

## Running migrations / DDL
provide the sql command thats it. 

**Rules for agents:**
- Never hardcode a DATABASE_URL in source code — always read it from `process.env.DATABASE_URL` via `src/lib/env.ts`.
- Always add `IF NOT EXISTS` / `ON CONFLICT DO NOTHING` guards so migrations are idempotent.
- Schema source of truth lives in `src/data/schema.sql` — keep it in sync with every DDL change.
<!-- END:db-migration-rules -->
