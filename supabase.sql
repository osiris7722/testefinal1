-- Enable extension for UUIDs
create extension if not exists "pgcrypto";

-- Feedback table
create table if not exists public.feedback (
  row_id uuid primary key default gen_random_uuid(),
  id bigint unique,
  grau_satisfacao text not null,
  data text not null,
  hora text not null,
  dia_semana text not null,
  created_at timestamptz not null default now(),
  client_timestamp text
);

-- Basic indexes
create index if not exists feedback_created_at_idx on public.feedback (created_at desc);
create index if not exists feedback_data_idx on public.feedback (data);
create index if not exists feedback_grau_idx on public.feedback (grau_satisfacao);

-- Row Level Security
alter table public.feedback enable row level security;

-- Public read (needed for kiosk summary/dashboard)
create policy "public read feedback"
  on public.feedback
  for select
  using (true);

-- Public insert (kiosk writes)
create policy "public insert feedback"
  on public.feedback
  for insert
  with check (true);
