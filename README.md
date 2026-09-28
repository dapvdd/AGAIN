# AGAIN

> If today fails, start AGAIN.

AGAIN is a personal life tracker and searchable life archive built around
one simple idea:

**record what matters, remember what happened, and keep going.**

AGAIN is not intended to be a conventional productivity app, social platform,
or gamification-heavy habit tracker.

It is a personal record of becoming.

---

## Philosophy

AGAIN is built around seven pillars:

- GYM
- BUILD
- STUDY
- PRAY
- REFLECT
- LOVE
- FAMILY

### GYM. BUILD. STUDY. PRAY. REFLECT. LOVE. FAMILY. REPEAT.

The goal is not perfection.

Missed days are part of the story.

If today fails:

**AGAIN.**

---

## What AGAIN Is

AGAIN allows a person to record meaningful moments, actions, and reflections
from everyday life.

The long-term purpose is to make those records useful in three ways:

1. **Daily Record**
   - What happened today?

2. **History**
   - What did I do on this day?

3. **Searchable Life Archive**
   - When did I do, experience, or write about this?

Over time, AGAIN should become a personal archive of life rather than
just another productivity dashboard.

---

## MVP

The first complete version of AGAIN focuses on:

- Authentication
- Log creation
- Log editing
- Log deletion
- Calendar / history
- Search
- Dashboard / consistency visualization

The MVP intentionally avoids unnecessary complexity.

### Out of Scope for MVP

- AI assistant
- AI life analysis
- Notifications
- Mobile application
- PWA
- Complex goals
- Gamification systems
- Achievements / badges
- Social feed
- Public profiles
- Attachments
- Image storage
- Markdown editor
- Complex analytics
- Recommendation engine
- Calendar integrations
- Wearable integrations

---

# Current Status

AGAIN is currently in the transition from its authentication and database
foundation into the core logging experience.

## Implemented

- Next.js App Router foundation
- React
- TypeScript
- Tailwind CSS
- Supabase SSR integration
- Supabase Authentication
- Login
- Logout
- Protected `/app` area
- Server-side authentication verification
- Profile foundation
- PostgreSQL core domain schema
- PostgreSQL Row Level Security
- User isolation
- Seven fixed pillars
- User-owned categories
- User-owned logs
- Log/category relationship model
- Full-text search vector foundation

## Not Yet Implemented

- Create log UI
- Log list
- Log detail page
- Edit log
- Delete log
- Category management UI
- Calendar
- Search UI
- Dashboard statistics
- Contribution / consistency visualization

The database foundation for logging is already in place, but the actual
Core Logging user experience is the next development step.

---

# Tech Stack

## Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS

## Backend / Data

- Supabase
- PostgreSQL
- Supabase Auth
- PostgreSQL Row Level Security

## Deployment

- Vercel

The architecture intentionally remains simple.

AGAIN does not use an unnecessary API layer when Next.js Server Actions
and server-side data access are sufficient.

---

# Architecture

```text
Browser
   │
   ▼
Next.js App Router
   │
   ├── Server Components
   ├── Client Components
   └── Server Actions
          │
          ▼
   Supabase SSR
          │
          ▼
      PostgreSQL
          │
          └── Row Level Security
