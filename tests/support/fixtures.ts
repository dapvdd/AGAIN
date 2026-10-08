/**
 * Deterministic fixtures shared by the tests: fixed ids, the seeded pillar
 * compass as the database returns it, and helpers for the public Supabase env
 * vars the session check reads.
 *
 * The env values below are placeholders for a loopback address, not
 * credentials. Nothing here reads .env.local, and no test talks to a real
 * Supabase project.
 */

import type { FakeSession } from "./fake-supabase";

export const CURRENT_USER: FakeSession = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "reader@example.test",
};

export const LOG_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const CATEGORY_A = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const CATEGORY_B = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
export const FOREIGN_CATEGORY = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

/** An id a forged form might try to write as the owner of a row. */
export const ATTACKER_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

/** The seven seeded pillars, in compass order, as the `pillars` table reads. */
export const PILLAR_ROWS = [
  { key: "GYM", label: "Gym", sort_order: 1 },
  { key: "BUILD", label: "Build", sort_order: 2 },
  { key: "STUDY", label: "Study", sort_order: 3 },
  { key: "PRAY", label: "Pray", sort_order: 4 },
  { key: "REFLECT", label: "Reflect", sort_order: 5 },
  { key: "LOVE", label: "Love", sort_order: 6 },
  { key: "FAMILY", label: "Family", sort_order: 7 },
] as const;

export const PILLAR_RESPONSE = { data: [...PILLAR_ROWS] };

export const TEST_ENV = {
  url: "http://127.0.0.1:54321",
  anonKey: "unit-test-anon-key",
} as const;

const ENV_KEYS = {
  url: "NEXT_PUBLIC_SUPABASE_URL",
  anonKey: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
} as const;

/**
 * Sets (or, with `null`, removes) the public Supabase env vars and returns a
 * function that puts the previous values back.
 */
export function applyEnv(values: {
  url: string | null;
  anonKey: string | null;
}): () => void {
  const keys = Object.values(ENV_KEYS);
  const saved = keys.map((key) => ({ key, value: process.env[key] }));

  for (const [key, value] of [
    [ENV_KEYS.url, values.url],
    [ENV_KEYS.anonKey, values.anonKey],
  ] as const) {
    if (value === null) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  return () => {
    for (const { key, value } of saved) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}
