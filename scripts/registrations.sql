create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  submitted_at timestamptz not null default now(),
  name text not null,
  rrn text not null,
  dept text not null,
  section text not null,
  year text not null,
  phone text not null,
  ntc text not null
);

create index if not exists registrations_submitted_at_idx
  on public.registrations (submitted_at desc);

alter table public.registrations enable row level security;
