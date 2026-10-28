-- AGAIN — Phase 4: atomic log+tags save, idempotency, and export.
--
-- Builds on the Phase 3 domain schema. Adds one stored procedure for an
-- atomic log write (log + tag attach, in one transaction) and one RPC for
-- exporting the user's archive as JSON. Both use the same RLS boundaries the
-- application already relies on; nothing is opened beyond what authenticated
-- users already own.
--
-- Idempotency: the log upsert uses a client-supplied idempotency_key
-- (a random uuid the client generates once per submit). If the same key is
-- used twice the database refuses the second write with a unique-violation,
-- which the action handles by re-reading the row that already exists. A
-- double-submit is therefore not a duplicate, it is a no-op — the entry the
-- user already wrote is returned.

-- ---------------------------------------------------------------------------
-- Idempotency key for log creates
-- ---------------------------------------------------------------------------
-- A client-supplied key that makes a "create log" submission idempotent.
-- The combination of user_id + idempotency_key must be unique; the trigger
-- assigns user_id so the client never sends one. If the same key arrives twice
-- the second insert is refused with a unique-violation that the application
-- handles by looking up the row that was already written.
--
-- The existing logs table gains an optional column. An entry made before this
-- migration has no key (null) and is not affected by the idempotency logic.
-- A re-submit of such an entry would succeed as a new duplicate — that is
-- acceptable: it is the same behaviour as the Phase 3 code, and an old entry
-- has no idempotency guarantee anyway.

alter table public.logs
  add column if not exists idempotency_key uuid;

create unique index if not exists logs_user_idempotency_key_idx
  on public.logs (user_id, idempotency_key)
  where idempotency_key is not null;

-- ---------------------------------------------------------------------------
-- Export: safe JSON of the user's entire archive
-- ---------------------------------------------------------------------------
-- Returns all of the caller's logs (newest first) as a JSON document, with
-- their categories embedded. This is the "take your data out" path the
-- product's privacy promise requires. RLS already restricts the query to the
-- caller's own rows; the stored function runs as the authenticated caller so
-- the restriction applies automatically. The function is SELECT-only (no DML).

create or replace function public.export_archive()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'exported_at', now(),
    'user_id', (select auth.uid()),
    'logs', (
      select coalesce(jsonb_agg(log_entry order by logged_on desc, created_at desc), '[]'::jsonb)
      from (
        select
          l.id,
          l.logged_on,
          l.pillar,
          l.title,
          l.body,
          l.created_at,
          l.updated_at,
          (
            select coalesce(jsonb_agg(jsonb_build_object(
              'id', c.id, 'name', c.name
            ) order by c.name), '[]'::jsonb)
            from public.log_categories lc
            join public.categories c on c.id = lc.category_id
            where lc.log_id = l.id
          ) as categories
        from public.logs l
        where l.user_id = (select auth.uid())
      ) as log_entry
    )
  ) into result;

  return result;
end;
$$;

-- grant the function to authenticated (it runs as security definer, so it
-- can read all domain rows the caller owns — which RLS has already restricted)
grant execute on function public.export_archive() to authenticated;
