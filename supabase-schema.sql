-- Lifestyle Hikers Studio production schema for Supabase/Postgres.
-- Run this once in the Supabase SQL editor.

create table if not exists users (
  id text primary key,
  email text unique not null,
  name text,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists projects (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  name text not null,
  location text not null default '',
  hike_date date,
  context text not null default '',
  slug text not null unique,
  status text not null default 'Draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists media_assets (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  source_id text not null unique,
  kind text not null,
  mime_type text not null,
  filename text not null,
  width integer not null default 0,
  height integer not null default 0,
  orientation text not null default 'landscape',
  bytes bigint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists enhancement_profiles (
  asset_id text primary key references media_assets(id) on delete cascade,
  profile jsonb not null default '{}'::jsonb,
  engine text not null,
  qa_confidence double precision not null default 1,
  camera_analysis jsonb,
  analysis jsonb
);

create table if not exists concepts (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  data jsonb not null,
  score_total double precision not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists carousels (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  concept_id text,
  title text not null default '',
  pillar text,
  data jsonb not null,
  status text not null default 'Draft',
  updated_at timestamptz not null default now()
);

create table if not exists google_connections (
  id text primary key,
  user_id text not null unique references users(id) on delete cascade,
  access_token_enc text not null,
  refresh_token_enc text,
  expires_at timestamptz,
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists instagram_connections (
  id text primary key,
  user_id text not null unique references users(id) on delete cascade,
  access_token_enc text not null,
  instagram_account_id text,
  username text,
  account_type text,
  expires_at timestamptz,
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table instagram_connections add column if not exists account_type text;
alter table instagram_connections add column if not exists expires_at timestamptz;
alter table instagram_connections add column if not exists scope text;
alter table instagram_connections add column if not exists updated_at timestamptz not null default now();
create unique index if not exists idx_instagram_connections_user on instagram_connections(user_id);

create table if not exists publish_jobs (
  id text primary key,
  carousel_id text not null references carousels(id) on delete cascade,
  kind text not null,
  status text not null,
  meta_media_id text,
  meta_container_id text,
  error text,
  created_at timestamptz not null default now()
);

create table if not exists exports (
  id text primary key,
  carousel_id text not null references carousels(id) on delete cascade,
  kind text not null,
  path text not null,
  created_at timestamptz not null default now()
);

create table if not exists reference_posts (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  title text not null,
  hook text,
  pillar text,
  performance text not null default 'average',
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_projects_user_updated on projects(user_id, updated_at desc);
create index if not exists idx_media_project on media_assets(project_id, created_at);
create index if not exists idx_concepts_project on concepts(project_id, created_at);
create index if not exists idx_carousels_project on carousels(project_id, updated_at desc);

insert into storage.buckets (id, name, public)
values ('lifestyle-hikers-media', 'lifestyle-hikers-media', false)
on conflict (id) do nothing;
