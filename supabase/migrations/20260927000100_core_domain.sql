-- AGAIN — Phase 3: core domain schema.
-- Builds on the Phase 2 authentication foundation. Nothing here modifies
-- profiles, its policies, or its triggers: this file only adds the
-- user-owned domain tables and the fixed pillar reference table.
--
-- Like every migration in this repository, it is idempotent: re-running it
-- must be a no-op.

-- ---------------------------------------------------------------------------
-- pillars
-- ---------------------------------------------------------------------------
-- The seven fixed AGAIN pillars. Not user-owned: the compass is the same for
-- every user, so this is global reference data rather than a per-user table.
-- The database owns the rows (seeded below, no client-writable policies), the
-- same principle that makes profiles trigger-created.
--
-- A table rather than a text constant or a Postgres enum so a pillar can carry
-- a display label and a compass position without a schema change.

create table if not exists public.pillars (
  key text primary key,
  label text not null,
  -- "position" is a SQL keyword; sort_order carries the compass order 1..7.
  sort_order smallint not null,
  created_at timestamptz not null default now()
);

insert into public.pillars (key, label, sort_order)
values
  ('GYM', 'GYM', 1),
  ('BUILD', 'BUILD', 2),
  ('STUDY', 'STUDY', 3),
  ('PRAY', 'PRAY', 4),
  ('REFLECT', 'REFLECT', 5),
  ('LOVE', 'LOVE', 6),
  ('FAMILY', 'FAMILY', 7)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
-- User-owned categories: the user's own vocabulary for organising logs.
-- Ownership is tied to auth.users, not to a client-supplied value: the
-- set_user_id trigger below overwrites user_id on insert, and the RLS
-- policies constrain every other statement.

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  -- A blank label is not a category; 60 chars matches the UI affordance.
  constraint categories_name_not_blank check (btrim(name) <> ''),
  constraint categories_name_length check (char_length(name) <= 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- logs
-- ---------------------------------------------------------------------------
-- The core entity: a dated, honest entry in one user's archive.
--
-- logged_on is the calendar day being recorded (the tracker reasons in days);
-- created_at still orders entries within a day. Multiple logs per day are
-- allowed by design — "if today fails, start AGAIN" implies repeated attempts.
--
-- pillar is a nullable reference to the fixed compass, not a free-text value:
-- a log may be filed under one pillar or none. No UPDATE policy path can
-- repoint ownership, and the FK means an unknown pillar is impossible.

create table if not exists public.logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  logged_on date not null,
  pillar text references public.pillars (key) on update cascade,
  title text,
  constraint logs_title_length check (char_length(title) <= 140),
  body text not null,
  constraint logs_body_length check (char_length(body) <= 20000),
  -- "searchable archive" is the product's purpose, so search is part of the
  -- table rather than a later retrofit. 'simple' is used instead of the
  -- default config because stemming a personal archive is surprising
  -- ("praying" collapsing into "pray"). The regconfig cast is required: the
  -- two-argument to_tsvector(text, text) is STABLE, and a generated column
  -- must be built from an IMMUTABLE expression.
  search_vector tsvector generated always as (
    to_tsvector('simple'::regconfig, coalesce(title, '') || ' ' || body)
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- log_categories
-- ---------------------------------------------------------------------------
-- Many-to-many between logs and categories. A log can carry several
-- categories; a category can span many logs.
--
-- There is deliberately no user_id here. A second copy of ownership on the
-- join table would be a drift-prone duplicate of the truth; instead the RLS
-- policies derive ownership through *both* parents, so a user can never
-- attach their own log to somebody else's category.

create table if not exists public.log_categories (
  log_id uuid not null references public.logs (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (log_id, category_id)
);

-- ---------------------------------------------------------------------------
-- indexes
-- ---------------------------------------------------------------------------

-- The primary read: one user's archive, newest day first.
create index if not exists logs_user_logged_on_idx
  on public.logs (user_id, logged_on desc, created_at desc);

-- Full-text search over the generated column.
create index if not exists logs_search_vector_idx
  on public.logs using gin (search_vector);

-- Reverse lookup from a category to its logs.
create index if not exists log_categories_category_id_idx
  on public.log_categories (category_id);

-- One category name per user, case-insensitively ("Work" and "work" collide).
-- A unique *index* rather than a table constraint: Postgres does not allow
-- expressions inside a UNIQUE table constraint. Its leading column is user_id,
-- so it also serves per-user category lookups; a separate categories_user_id_idx
-- would be redundant.
create unique index if not exists categories_user_lower_name_key
  on public.categories (user_id, lower(name));

-- ---------------------------------------------------------------------------
-- row level security
-- ---------------------------------------------------------------------------
-- RLS is the security boundary. The application connects with the anon key
-- and the user's JWT, so every statement is evaluated as `authenticated`
-- under these policies. The service-role key is never used: it would bypass
-- RLS entirely.

alter table public.pillars enable row level security;
alter table public.categories enable row level security;
alter table public.logs enable row level security;
alter table public.log_categories enable row level security;

-- ---------------------------------------------------------------------------
-- policies: pillars
-- ---------------------------------------------------------------------------
-- The only non-user-scoped read in the schema. It exposes seven constant,
-- non-sensitive rows and is restricted to authenticated callers. There are no
-- insert/update/delete policies, so only the table owner (this migration) can
-- change the compass.

drop policy if exists "pillars_select_authenticated" on public.pillars;
create policy "pillars_select_authenticated"
  on public.pillars
  for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- policies: logs
-- ---------------------------------------------------------------------------

drop policy if exists "logs_select_own" on public.logs;
create policy "logs_select_own"
  on public.logs
  for select
  using ((select auth.uid()) = user_id);

drop policy if exists "logs_insert_own" on public.logs;
create policy "logs_insert_own"
  on public.logs
  for insert
  with check ((select auth.uid()) = user_id);

-- WITH CHECK is stated explicitly as well as USING: USING decides which
-- existing rows may be updated, WITH CHECK decides what they may be changed
-- into, which is what blocks repointing user_id at another user.
drop policy if exists "logs_update_own" on public.logs;
create policy "logs_update_own"
  on public.logs
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Users may remove their own entries: an archive they cannot correct is not
-- an honest one.
drop policy if exists "logs_delete_own" on public.logs;
create policy "logs_delete_own"
  on public.logs
  for delete
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- policies: categories
-- ---------------------------------------------------------------------------

drop policy if exists "categories_select_own" on public.categories;
create policy "categories_select_own"
  on public.categories
  for select
  using ((select auth.uid()) = user_id);

drop policy if exists "categories_insert_own" on public.categories;
create policy "categories_insert_own"
  on public.categories
  for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "categories_update_own" on public.categories;
create policy "categories_update_own"
  on public.categories
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "categories_delete_own" on public.categories;
create policy "categories_delete_own"
  on public.categories
  for delete
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- policies: log_categories
-- ---------------------------------------------------------------------------
-- Both parents must belong to the caller. Checking only the logs side would
-- let a user insert a row pairing their own log with another user's category,
-- and a later join would then disclose that category's name. Each exists()
-- is additionally filtered by the RLS on logs and categories, so breaking
-- this requires weakening two policies at once.
--
-- No UPDATE policy: a join row has no mutable attribute but created_at, and
-- retagging is delete-then-insert.

drop policy if exists "log_categories_select_own" on public.log_categories;
create policy "log_categories_select_own"
  on public.log_categories
  for select
  using (
    exists (
      select 1 from public.logs l
      where l.id = log_categories.log_id
        and l.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.categories c
      where c.id = log_categories.category_id
        and c.user_id = (select auth.uid())
    )
  );

drop policy if exists "log_categories_insert_own" on public.log_categories;
create policy "log_categories_insert_own"
  on public.log_categories
  for insert
  with check (
    exists (
      select 1 from public.logs l
      where l.id = log_categories.log_id
        and l.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.categories c
      where c.id = log_categories.category_id
        and c.user_id = (select auth.uid())
    )
  );

drop policy if exists "log_categories_delete_own" on public.log_categories;
create policy "log_categories_delete_own"
  on public.log_categories
  for delete
  using (
    exists (
      select 1 from public.logs l
      where l.id = log_categories.log_id
        and l.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.categories c
      where c.id = log_categories.category_id
        and c.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- ownership: set_user_id
-- ---------------------------------------------------------------------------
-- Ownership is assigned by the database, never taken from the request. The
-- client does not send user_id at all; if it does, the value is overwritten
-- here. That holds even if a policy were mis-written.
--
-- Invoker security (not SECURITY DEFINER) is deliberate: auth.uid() reads the
-- request's JWT, and no elevated privilege is needed to do that. An
-- unauthenticated caller yields NULL, which the not-null constraint rejects.

create or replace function public.set_user_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.user_id := (select auth.uid());
  return new;
end;
$$;

drop trigger if exists logs_set_user_id on public.logs;
create trigger logs_set_user_id
  before insert on public.logs
  for each row execute function public.set_user_id();

drop trigger if exists categories_set_user_id on public.categories;
create trigger categories_set_user_id
  before insert on public.categories
  for each row execute function public.set_user_id();

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
-- Reuses public.set_updated_at() from the Phase 2 migration. It is not
-- redefined here, which both avoids duplicating a proven function and
-- demonstrates that it generalises beyond profiles.

drop trigger if exists logs_set_updated_at on public.logs;
create trigger logs_set_updated_at
  before update on public.logs
  for each row execute function public.set_updated_at();

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- privileges
-- ---------------------------------------------------------------------------
-- RLS decides *which rows* a role may touch. It does not grant the SQL
-- privilege to touch any. Supabase's default privileges hand broad table
-- grants to anon and authenticated, so the surface is restated here from a
-- known state: revoke everything first, then grant exactly the intended
-- operations. This keeps the intended access legible in the migration and
-- independent of whatever the project's defaults happen to be.
--
-- anon is granted nothing. RLS would already block it (auth.uid() is null for
-- anon, so every row predicate fails), but revoking removes the grant instead
-- of relying on that. No sequence grants are needed: every id is generated by
-- gen_random_uuid(), so there is no identity sequence to grant usage on.
--
-- service_role is deliberately left untouched. It bypasses RLS by design and
-- the application never uses it.

revoke all on table public.pillars from anon, authenticated;
revoke all on table public.categories from anon, authenticated;
revoke all on table public.logs from anon, authenticated;
revoke all on table public.log_categories from anon, authenticated;

-- The compass is read-only reference data: no client-writable path exists, at
-- the privilege layer as well as in the policies.
grant select on table public.pillars to authenticated;

-- Full CRUD, narrowed to the caller's own rows by the policies above.
grant select, insert, update, delete on table public.logs to authenticated;
grant select, insert, update, delete on table public.categories to authenticated;

-- No update: a join row has no mutable attribute but created_at, and retagging
-- is delete-then-insert. The privilege mirrors the absent UPDATE policy.
grant select, insert, delete on table public.log_categories to authenticated;
