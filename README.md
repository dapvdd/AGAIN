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
  app/          # Routes, layout, global styles
  components/   # Reusable UI
  lib/          # Shared utilities, constants, types
  lib/supabase/ # Supabase client infrastructure
.env.local.example  # Required environment variables (template)
```

## Development

### Prerequisites

- Node.js 20+ (Node 24 recommended)
- npm
- A [Supabase](https://supabase.com) project (needed once authentication and data are wired up)

### Installation

```bash
npm install
```

### Environment setup

```bash
cp .env.local.example .env.local
```

Fill in `.env.local` with your Supabase project URL and anon key. The file is
git-ignored; never commit real credentials.

### Commands

```bash
npm run dev    # development server at http://localhost:3000
npm run build  # production build
npm start      # serve the production build
npm run lint   # ESLint
```

## Deployment

Deployed on Vercel. Set the same environment variables in the Vercel project
settings.
