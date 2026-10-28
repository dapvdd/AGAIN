/**
 * Cross-user isolation, proven against a REAL Supabase database.
 *
 * These tests are gated: they only run when `AGAIN_INTEGRATION_SUPABASE_URL`,
 * `AGAIN_INTEGRATION_ANON_KEY` AND `AGAIN_INTEGRATION_SERVICE_ROLE_KEY` are all
 * set. That is deliberate — this repository refuses to fake Row Level Security,
 * and the only true proof is two authenticated sessions against a real project.
 *
 * How to run (documented in reports/AGAIN_EXPORT_RECOVERY.md):
 *   1. Have a Supabase project (local `supabase start` or a dev project).
 *   2. Run the two migrations.
 *   3. `supabase db reset` if using the local stack so migrations apply clean.
 *   4. Set the three test env vars above.
 *   5. `npx vitest run tests/rls-isolation.integration.test.ts`
 *
 * What happens:
 *   - Two disposable users (A and B) are created via the service-role Admin API
 *     and given a disposable email each (unique per run, so reruns never collide
 *     and parallel runs are safe).
 *   - User A writes a private log and a private category, and links them.
 *   - User B — a completely separate authenticated session — attempts to read,
 *     update, and delete A's records, and to attach A's category to B's own log.
 *   - Every one of B's attempts must affect zero rows (or be refused), and no
 *     statement may leak A's data.
 *   - Both users are deleted at the end (cascading to their rows), so the run
 *     leaves no trace in the project.
 *
 * The service-role key is used ONLY for user creation/deletion (disposable
 * fixtures) and is never the session the assertions run under. Every assertion
 * runs as user A or user B through the anon key.
 */

import { afterAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const INT_URL = process.env.AGAIN_INTEGRATION_SUPABASE_URL;
const INT_ANON = process.env.AGAIN_INTEGRATION_ANON_KEY;
const INT_SERVICE = process.env.AGAIN_INTEGRATION_SERVICE_ROLE_KEY;

const gated = !(INT_URL && INT_ANON && INT_SERVICE);

const run = gated
  ? describe.skip
  : describe;

function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function createDisposableUser(
  admin: SupabaseClient,
  tag: string,
): Promise<{ id: string; email: string; client: SupabaseClient }> {
  const email = `again-it-${tag}-${Date.now()}${Math.floor(Math.random() * 10000)}@example.test`;
  const password = `again-test-${uuid()}`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`Could not create disposable user ${tag}: ${error?.message}`);
  }

  const client = createClient(INT_URL as string, INT_ANON as string, {
    auth: { persistSession: false },
    global: {
      // Sign in as this freshly-created user.
      headers: { apikey: INT_ANON as string },
    },
  });
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) {
    throw new Error(`Could not sign in ${tag}: ${signInError.message}`);
  }
  return { id: data.user.id, email, client };
}

async function deleteDisposableUsers(
  admin: SupabaseClient,
  ids: string[],
): Promise<void> {
  for (const id of ids) {
    await admin.auth.admin.deleteUser(id, true);
  }
}

run("RLS: two-user cross-access isolation against a real database", () => {
  let admin: SupabaseClient | null = null;
  const disposables: { id: string; email: string; client: SupabaseClient }[] = [];

  afterAll(async () => {
    if (gated || admin === null) return;
    await deleteDisposableUsers(admin, disposables.map((d) => d.id));
  });

  it(
    "user B cannot read, update, delete, or borrow user A's private records",
    { timeout: 60_000 },
    async () => {
      if (gated) return;
      admin = createClient(INT_URL as string, INT_SERVICE as string, {
        auth: { persistSession: false },
      });

      const a = await createDisposableUser(admin, "a");
      const b = await createDisposableUser(admin, "b");
      disposables.push(a, b);

      // A writes a private log.
      const { data: aLog, error: aLogError } = await a.client
        .from("logs")
        .insert({ logged_on: "2026-10-01", body: "A's private note." })
        .select("id")
        .single();
      expect(aLogError).toBeNull();
      expect(aLog).not.toBeNull();

      // A writes a private category.
      const { data: aCat, error: aCatError } = await a.client
        .from("categories")
        .insert({ name: "A-secret" })
        .select("id")
        .single();
      expect(aCatError).toBeNull();
      expect(aCat).not.toBeNull();

      // A links the category to the log.
      const { error: aLinkError } = await a.client
        .from("log_categories")
        .insert({ log_id: aLog!.id, category_id: aCat!.id });
      expect(aLinkError).toBeNull();

      // --- B tries to read A's log ---
      const bReadA = await b.client
        .from("logs")
        .select("id, body")
        .eq("id", aLog!.id);
      expect(bReadA.error).toBeNull();
      expect(bReadA.data ?? []).toHaveLength(0); // invisible, not an error

      // --- B tries to read A's category ---
      const bReadCat = await b.client
        .from("categories")
        .select("id, name")
        .eq("id", aCat!.id);
      expect(bReadCat.error).toBeNull();
      expect(bReadCat.data ?? []).toHaveLength(0);

      // --- B tries to update A's log ---
      const bUpdate = await b.client
        .from("logs")
        .update({ body: "hijacked" })
        .eq("id", aLog!.id)
        .select("id");
      expect(bUpdate.error).toBeNull();
      expect(bUpdate.data ?? []).toHaveLength(0); // zero rows affected

      // --- B tries to delete A's log ---
      const bDelete = await b.client
        .from("logs")
        .delete()
        .eq("id", aLog!.id)
        .select("id");
      expect(bDelete.error).toBeNull();
      expect(bDelete.data ?? []).toHaveLength(0);

      // --- B tries to attach A's category to B's own new log ---
      const { data: bLog, error: bLogError } = await b.client
        .from("logs")
        .insert({ logged_on: "2026-10-02", body: "B's own note." })
        .select("id")
        .single();
      expect(bLogError).toBeNull();
      expect(bLog).not.toBeNull();

      const borrow = await b.client
        .from("log_categories")
        .insert({ log_id: bLog!.id, category_id: aCat!.id })
        .select("log_id, category_id");
      expect(borrow.error).not.toBeNull(); // RLS must refuse the foreign category

      // --- confirm A's log is still intact and owned by A ---
      const aVerify = await a.client
        .from("logs")
        .select("id, body, user_id")
        .eq("id", aLog!.id)
        .single();
      expect(aVerify.data?.body).toBe("A's private note.");
      expect(aVerify.data?.user_id).toBe(a.id);

      // --- confirm the borrowed tag never landed on B's log ---
      const bTags = await b.client
        .from("log_categories")
        .select("category_id")
        .eq("log_id", bLog!.id);
      expect(bTags.data ?? []).toHaveLength(0);

      // --- export: B's archive contains only B's own log ---
      const bExport = await b.client.rpc("export_archive");
      expect(bExport.error).toBeNull();
      const bCount = (bExport.data?.logs as unknown[]) ?? [];
      expect(bCount).toHaveLength(1);
      expect((bCount[0] as { body: string }).body).toBe("B's own note.");
    },
  );
});
