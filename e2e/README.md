# End-to-end tests (gated)

These Playwright specs exercise the **real** app against a **real** Supabase
project — a scripted fake would prove nothing about the browser cookie,
the token refresh, or Row Level Security, so this tier is deliberately the
opposite of `tests/`'s scripted tier. It is **gated**: the specs skip unless
these are set:

```
AGAIN_E2E_URL            http://localhost:3000
AGAIN_E2E_SUPABASE_URL   <project URL>
AGAIN_E2E_ANON_KEY       <project anon key>
AGAIN_E2E_EMAIL          <a known-valid account>
AGAIN_E2E_EMAIL_PASSWORD <its password>
```

## Run

```bash
# 1. Disposable project -> migrations -> dev/build
npm run build && npm run start

# 2. Set the five vars above, then
npx playwright install chromium   # once
npm run test:e2e                  # npx playwright test
```

## What it covers

- the root page renders;
- an unauthenticated `/app` is redirected to `/login`;
- a real sign-in through the form lands in the app;
- `/api/export` returns the signed-in user's own archive JSON;
- sign-out makes `/app` unreachable again.

The RLS integration test (`tests/rls-isolation.integration.test.ts`) needs the
same class of disposable project minus a browser; see its header.
