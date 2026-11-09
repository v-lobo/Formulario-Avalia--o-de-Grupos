-- Execute no projeto escolhido. Não altera as tabelas das avaliações anteriores.
create table if not exists public.stem_peer_submissions (
  id uuid primary key,
  evaluator_name text not null check (length(trim(evaluator_name)) between 1 and 160),
  unit text not null check (unit in ('Farol', 'Jatiúca')),
  grade text not null check (grade in ('6', '7')),
  class text not null check (class in ('A', 'B', 'C', 'D', 'E')),
  group_number integer not null check (group_number between 1 and 99),
  academic_year integer not null,
  semester integer not null check (semester in (1, 2)),
  members jsonb not null check (jsonb_typeof(members) = 'array' and jsonb_array_length(members) between 1 and 15),
  created_at timestamptz not null default now()
);
alter table public.stem_peer_submissions enable row level security;
revoke all on public.stem_peer_submissions from anon, authenticated;
grant select, insert on public.stem_peer_submissions to service_role;
create index if not exists stem_peer_submissions_period on public.stem_peer_submissions (academic_year, semester, unit, grade, class, group_number);
