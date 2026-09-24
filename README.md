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
  app/(auth)/login/       # Sign in / sign up
  app/auth/callback/      # OAuth / magic-link code exchange
  app/actions/            # Server Actions (mutations)
  components/             # Reusable UI
  lib/                    # Shared utilities, constants, types
  lib/auth.ts             # Auth DAL (getCurrentUser, requireUser)
  lib/supabase/           # Supabase client infrastructure (browser, server, proxy)
  proxy.ts                # Next.js 16 proxy (session refresh + route guards)
supabase/migrations/      # Database migrations (profiles + RLS)
.env.local.example        # Required environment variables (template)
```

## Routes

| Path    | Access                          |
| ------- | ------------------------------- |
| `/`     | Public — AGAIN identity         |
| `/login`| Public — sign in / sign up      |
| `/app`  | Protected — requires a session  |

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
