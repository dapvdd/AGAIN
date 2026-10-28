import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /api/export
 * Returns the user's entire archive as a JSON document. RLS already restricts
 * the query to the caller's own rows; the RPC is an additional defence and makes
 * the query a single round-trip rather than several. A user who has never
 * written anything gets `{"logs":[]}`.
 *
 * This is the "take your data out" path that the product's privacy promise
 * requires ("your data stays yours"). The same data can be backed up by
 * running the SQL in the export migration manually; this is the in-app path.
 */
export async function GET() {
  const user = await requireUser();

  try {
    const supabase = await createSupabaseServerClient();

    // Use the stored procedure if it exists (after migration is applied), falling
    // back to a direct query for pre-migration or self-hosted setups.
    const { data, error } = await supabase.rpc("export_archive").maybeSingle();

    if (!error && data !== null) {
      return NextResponse.json(data, {
        headers: {
          "Content-Disposition": `attachment; filename="again-archive-${user.id}.json"`,
          "Content-Type": "application/json",
        },
      });
    }

    // Fallback: direct query. Same RLS boundary, same result, a few more round
    // trips. Works against any Supabase project regardless of migration state.
    const { data: logs, error: logsError } = await supabase
      .from("logs")
      .select(
        "id, logged_on, pillar, title, body, created_at, updated_at, categories:log_categories(category_id, categories(id, name))",
      )
      .order("logged_on", { ascending: false })
      .order("created_at", { ascending: false });

    if (logsError) {
      return NextResponse.json(
        { error: "The archive could not be read." },
        { status: 500 },
      );
    }

    const archive = {
      exported_at: new Date().toISOString(),
      user_id: user.id,
      logs: (logs ?? []).map((log: Record<string, unknown>) => ({
        id: log.id,
        logged_on: log.logged_on,
        pillar: log.pillar,
        title: log.title,
        body: log.body,
        created_at: log.created_at,
        updated_at: log.updated_at,
        categories: (
          (log.categories as Array<{ categories: { id: string; name: string } }>) ?? []
        ).map((lc) => ({ id: lc.categories.id, name: lc.categories.name })),
      })),
    };

    return NextResponse.json(archive, {
      headers: {
        "Content-Disposition": `attachment; filename="again-archive-${user.id}.json"`,
        "Content-Type": "application/json",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "The archive could not be read." },
      { status: 500 },
    );
  }
}
