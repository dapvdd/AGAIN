# AGAIN

A personal life tracker and a searchable archive of one honest life.

## Philosophy

> If today fails, start AGAIN.

Motto: **AGAIN. REPEAT. DISCIPLINE.**

## Core pillars

- GYM
- BUILD
- STUDY
- PRAY
- REFLECT
- LOVE
- FAMILY

## Tech stack

- Next.js (App Router, TypeScript)
- Tailwind CSS
- Supabase (Auth + PostgreSQL, with Row Level Security)
- Vercel

## Project structure

```
src/
  app/                    # Routes, layout, global styles
  app/app/                # Protected application area (server-enforced auth)
  app/app/logs/new/       # Create a log
  app/app/logs/[id]/      # Read, delete one log
  app/app/logs/[id]/edit/ # Edit one log
  app/(auth)/login/       # Sign in / sign up
  app/auth/callback/      # OAuth / magic-link code exchange
  app/actions/            # Server Actions (mutations)
  components/             # Reusable UI
  lib/                    # Shared utilities, constants, types
  lib/auth.ts             # Auth DAL (getCurrentUser, requireUser)
  lib/logs.ts             # Logs DAL (the only reader of the domain tables)
  lib/log-input.ts        # Shared validation rules for the log forms
  lib/supabase/           # Supabase client infrastructure (browser, server, proxy)
  proxy.ts                # Next.js 16 proxy (session refresh + route guards)
supabase/migrations/      # Database migrations (profiles, domain schema + RLS)
.env.local.example        # Required environment variables (template)
```

## Routes

| Path                    | Access                              |
| ----------------------- | ----------------------------------- |
| `/`                     | Public — AGAIN identity             |
| `/login`                | Public — sign in / sign up          |
| `/app`                  | Protected — recent logs             |
| `/app/logs/new`         | Protected — create a log            |
| `/app/logs/[id]`        | Protected — one log, edit, delete   |
| `/app/logs/[id]/edit`   | Protected — change one log          |

## Authentication

Supabase Auth with server-side sessions (HttpOnly cookies via `@supabase/ssr`).

- Login writes the session through the browser client; the auth proxy refreshes
  it and guards routes; a server-side DAL enforces auth at every protected
  page, Server Action, and Route Handler.
- Authorization never relies on the frontend. Row Level Security isolates each
  user's data; `profiles` is created on signup by a database trigger.
- The service-role key is never used or referenced in this codebase.

### Environment setup

```bash
cp .env.local.example .env.local
```

Fill in `.env.local` with your Supabase project URL and anon key. The file is
git-ignored; never commit real credentials.

### Database

Apply the migrations to your Supabase project:

```bash
npx supabase db push
# or run supabase/migrations/*.sql in the Supabase dashboard SQL editor
```

The initial migration creates the `profiles` table, enables Row Level Security
(select/update own row only), and wires a trigger that auto-creates a profile
for each new user.

The domain migration adds `pillars` (the seven fixed, read-only rows),
`categories` (user-owned labels), `logs` (the entries themselves), and
`log_categories` (the join between them), with the same RLS treatment plus the
privileges that go with it.

## Logging

A log is a day, an optional pillar, optional categories, an optional title, and
a note. Nothing but the note is required: friction is the enemy of the habit.

- The day defaults to the user's own calendar day, not the server's.
- Categories can be created inline: type a name on the form and it is created
  and attached when the log is saved. A name that already exists for that user
  is reused, because the schema allows one name per user.
- Every write goes through a Server Action that re-checks the session, and
  then through RLS. No `user_id` is ever sent by the client, so ownership is
  assigned by the database and cannot be forged.
- Category ids submitted in a form are re-checked against the caller's own
  categories before they are attached.
- Validation is server-authoritative: day, note, title length, pillar, and
  category ownership. The database constraints remain the backstop.

## Development

### Prerequisites

- Node.js 20+ (Node 24 recommended)
- npm
- A [Supabase](https://supabase.com) project

### Installation

```bash
npm install
```

## Commands

```bash
npm run dev    # development server at http://localhost:3000
npm run build  # production build
npm start      # serve the production build
npm run lint   # ESLint
```

## Deployment

Deployed on Vercel. Set the same environment variables in the Vercel project
settings.
