-- ENCLAVE registrations (Supabase / Postgres)
-- Run in the Supabase SQL editor once. Safe to re-run (IF NOT EXISTS).

create extension if not exists pgcrypto;

create table if not exists public.enclave_registrations (
  id uuid primary key default gen_random_uuid(),
  submitted_at timestamptz not null default now(),
  pass_id text not null,
  name text not null,
  rrn text not null,
  dept text not null,
  section text not null,
  year text not null,
  phone text not null,
  entry text not null default 'Solo',
  team_name text not null default '',
  teammate text not null default '',
  team_id text not null default '',
  -- path inside the enclave-payments storage bucket, e.g. "2026/ENC-ABCDE.png"
  payment_path text,
  payment_verified boolean not null default false
);

create unique index if not exists enclave_registrations_pass_id_uidx
  on public.enclave_registrations (pass_id);

-- one registration per person (RRN), case-insensitive
create unique index if not exists enclave_registrations_rrn_uidx
  on public.enclave_registrations (upper(rrn));

create index if not exists enclave_registrations_submitted_at_idx
  on public.enclave_registrations (submitted_at desc);

create index if not exists enclave_registrations_team_id_idx
  on public.enclave_registrations (team_id)
  where team_id <> '';

alter table public.enclave_registrations enable row level security;

-- no public policies: the Next.js server uses the service role key (bypasses RLS)

-- Payment screenshots (private bucket; open via signed URLs from /admin)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'enclave-payments',
  'enclave-payments',
  false,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- storage is also private; only the service role uploads / signs URLs
