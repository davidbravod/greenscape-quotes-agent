-- Greenscape Quotes Agent - initial schema
-- Apply via Supabase SQL editor or `supabase db push`.

create extension if not exists pgcrypto;

create type user_role as enum ('admin', 'estimator');
create type catalog_kind as enum ('material', 'labor', 'composite');
create type recording_status as enum (
  'uploaded', 'transcribing', 'transcribed', 'drafting', 'drafted', 'failed'
);
create type quote_status as enum ('draft', 'final');

create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'estimator',
  full_name text,
  created_at timestamptz not null default now()
);

create table catalog_items (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null,
  name text not null,
  aliases text,
  category text,
  subcategory text,
  kind catalog_kind not null default 'material',
  unit text not null,
  unit_price numeric(12,2),
  labor_rate numeric(12,2),
  labor_unit text,
  min_qty numeric(12,2) default 0,
  description text,
  active boolean not null default true,
  sheet_row_id text unique,
  updated_at timestamptz not null default now()
);
create index catalog_items_active_idx on catalog_items(active);
create index catalog_items_category_idx on catalog_items(category);
create index catalog_items_name_trgm_idx on catalog_items using gin (name gin_trgm_ops);
-- enable trigram for fuzzy match
create extension if not exists pg_trgm;

create table catalog_sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  rows_upserted int default 0,
  rows_deactivated int default 0,
  error text
);

create table recordings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  duration_s int,
  status recording_status not null default 'uploaded',
  error text,
  created_at timestamptz not null default now()
);
create index recordings_user_idx on recordings(user_id);
create index recordings_status_idx on recordings(status);

create table transcripts (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references recordings(id) on delete cascade,
  model text not null,
  text text not null,
  raw_response_json jsonb,
  created_at timestamptz not null default now()
);

create table quotes (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid references recordings(id) on delete set null,
  transcript_id uuid references transcripts(id) on delete set null,
  status quote_status not null default 'draft',
  client_name text,
  site_address text,
  scope_narrative text,
  notes text,
  terms_md text,
  assumptions jsonb default '[]'::jsonb,
  subtotal numeric(12,2) default 0,
  tax_rate numeric(6,4) default 0,
  tax numeric(12,2) default 0,
  total numeric(12,2) default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index quotes_created_by_idx on quotes(created_by);

create table quote_sections (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  title text not null,
  sort_order int not null default 0
);
create index quote_sections_quote_idx on quote_sections(quote_id);

create table quote_line_items (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references quote_sections(id) on delete cascade,
  catalog_item_id uuid references catalog_items(id) on delete set null,
  description text not null,
  quantity numeric(12,2) not null default 0,
  unit text,
  unit_price numeric(12,2) not null default 0,
  line_total numeric(12,2) not null default 0,
  is_labor boolean not null default false,
  is_ad_hoc boolean not null default false,
  sort_order int not null default 0
);
create index quote_line_items_section_idx on quote_line_items(section_id);

create table settings (
  id int primary key default 1,
  transcription_model text,
  agent_model text,
  default_tax_rate numeric(6,4) default 0,
  default_terms_md text,
  updated_at timestamptz not null default now(),
  constraint settings_singleton check (id = 1)
);
insert into settings (id) values (1) on conflict do nothing;

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  entity text not null,
  entity_id uuid,
  action text not null,
  diff jsonb,
  created_at timestamptz not null default now()
);

-- ----------- Row Level Security -----------
alter table profiles enable row level security;
alter table catalog_items enable row level security;
alter table catalog_sync_runs enable row level security;
alter table recordings enable row level security;
alter table transcripts enable row level security;
alter table quotes enable row level security;
alter table quote_sections enable row level security;
alter table quote_line_items enable row level security;
alter table settings enable row level security;
alter table audit_log enable row level security;

create or replace function is_admin() returns boolean
language sql stable as $$
  select exists (
    select 1 from profiles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

-- profiles: a user sees their own row; admins see all
create policy profiles_self_select on profiles
  for select using (user_id = auth.uid() or is_admin());
create policy profiles_admin_write on profiles
  for all using (is_admin()) with check (is_admin());

-- catalog: all signed-in users read; only admins write
create policy catalog_read on catalog_items
  for select using (auth.uid() is not null);
create policy catalog_admin_write on catalog_items
  for all using (is_admin()) with check (is_admin());

create policy sync_runs_read on catalog_sync_runs
  for select using (auth.uid() is not null);

-- recordings + transcripts: owner or admin
create policy recordings_owner on recordings
  for all using (user_id = auth.uid() or is_admin())
  with check (user_id = auth.uid() or is_admin());
create policy transcripts_owner on transcripts
  for select using (
    is_admin() or exists (
      select 1 from recordings r
      where r.id = transcripts.recording_id and r.user_id = auth.uid()
    )
  );

-- quotes: creator or admin
create policy quotes_owner on quotes
  for all using (created_by = auth.uid() or is_admin())
  with check (created_by = auth.uid() or is_admin());
create policy sections_owner on quote_sections
  for all using (
    is_admin() or exists (
      select 1 from quotes q
      where q.id = quote_sections.quote_id and q.created_by = auth.uid()
    )
  );
create policy lines_owner on quote_line_items
  for all using (
    is_admin() or exists (
      select 1 from quote_sections s
      join quotes q on q.id = s.quote_id
      where s.id = quote_line_items.section_id
        and q.created_by = auth.uid()
    )
  );

-- settings: read all, write admin
create policy settings_read on settings for select using (auth.uid() is not null);
create policy settings_admin_write on settings
  for all using (is_admin()) with check (is_admin());

-- audit_log: admin read
create policy audit_admin on audit_log for select using (is_admin());

-- ----------- Storage bucket for audio -----------
-- Create the bucket via the Supabase dashboard or:
-- insert into storage.buckets (id, name, public) values ('recordings', 'recordings', false);
-- Policies for the bucket should be added in the dashboard or in a follow-up migration.

-- ----------- Auto-create profile on signup -----------
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (user_id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
