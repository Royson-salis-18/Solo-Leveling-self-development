# Life RPG / Shadow System

Gamified productivity SaaS: tasks are ranked "gates", XP is awarded by the server, and there are real stakes (streaks, decay, penalties).

**Stack:** Vite + React + TypeScript · Supabase (Postgres, Auth, Realtime, Edge Functions).
**Behaviour layer:** if-then gate plans, one-tap lapse diagnosis, no-XP reflection, XP pledges and personal insights, each tied to the research it comes from (and its limits) in `docs/GAME_RULES.md`.
**Principle:** the browser never decides XP. All game logic is in Postgres functions (`web/supabase/migrations`), protected by RLS and column grants.

## Run locally
```bash
cd web && npm install && cp .env.example .env   # fill the two Supabase values
npm run dev
```
## Quality gates
```bash
npm run typecheck && npm test      # TypeScript + unit tests (incl. TS↔SQL parity)
npm run test:db                    # needs local PostgreSQL; builds a Supabase-like DB and runs 530+ SQL assertions + concurrency tests
```
See `SETUP.md` to deploy, `docs/GAME_RULES.md` for the rules, and `web/supabase/functions` for the AI and billing functions.
