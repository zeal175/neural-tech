-- ENCLAVE attendance (Supabase / Postgres)
-- Door scanner (/enclave/checkin) writes one row per person when their pass QR is scanned.
-- Run in the Supabase SQL editor once. Safe to re-run (IF NOT EXISTS).

create extension if not exists pgcrypto;

create table if not exists public.enclave_attendance (
  id uuid primary key default gen_random_uuid(),
  checked_in_at timestamptz not null default now(),
  -- ENC-XXXXX for registrants; "WALK-IN" for desk entries without a pass
  pass_id text not null,
  name text not null,
  rrn text not null,
  dept text not null default '',
  section text not null default '',
  year text not null default '',
  phone text not null default '',
  entry text not null default 'Solo',
  team_name text not null default '',
  teammate text not null default '',
  team_id text not null default ''
);

-- one check-in per registered pass (walk-ins share pass_id WALK-IN)
create unique index if not exists enclave_attendance_pass_id_uidx
  on public.enclave_attendance (pass_id)
  where pass_id <> 'WALK-IN';

-- one check-in per person (covers walk-ins and registered)
create unique index if not exists enclave_attendance_rrn_uidx
  on public.enclave_attendance (upper(rrn));

create index if not exists enclave_attendance_checked_in_at_idx
  on public.enclave_attendance (checked_in_at desc);

alter table public.enclave_attendance enable row level security;

-- no public policies: the Next.js server uses the service role key (bypasses RLS)
