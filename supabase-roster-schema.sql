-- Cadastro de integrantes e configuração de grupos por turma.
-- A alteração é aditiva e mantém as avaliações já existentes.
begin;
create table if not exists public.stem_class_settings (
  academic_year integer not null,
  semester integer not null check (semester in (1, 2)),
  unit text not null check (unit in ('Farol', 'Jatiúca')),
  grade text not null check (grade in ('6', '7')),
  class text not null check (class in ('A', 'B', 'C', 'D', 'E')),
  group_count integer not null check (group_count between 1 and 99),
  primary key (academic_year, semester, unit, grade, class)
);
create table if not exists public.stem_group_rosters (
  id uuid primary key,
  academic_year integer not null,
  semester integer not null check (semester in (1, 2)),
  unit text not null check (unit in ('Farol', 'Jatiúca')),
  grade text not null check (grade in ('6', '7')),
  class text not null check (class in ('A', 'B', 'C', 'D', 'E')),
  group_number integer not null check (group_number between 1 and 99),
  members jsonb not null check (jsonb_typeof(members) = 'array' and jsonb_array_length(members) between 2 and 16),
  created_at timestamptz not null default now(),
  unique (academic_year, semester, unit, grade, class, group_number)
);
alter table public.stem_class_settings enable row level security;
alter table public.stem_group_rosters enable row level security;
revoke all on public.stem_class_settings, public.stem_group_rosters from anon, authenticated;
grant select, insert, update on public.stem_class_settings to service_role;
grant select, insert on public.stem_group_rosters to service_role;
alter table public.stem_peer_submissions drop constraint if exists stem_peer_submissions_group_number_check;
alter table public.stem_peer_submissions add constraint stem_peer_submissions_group_number_check check (group_number between 1 and 99);
alter table public.stem_peer_submissions add column if not exists roster_id uuid references public.stem_group_rosters(id);
alter table public.stem_peer_submissions add column if not exists evaluator_id uuid;
create index if not exists stem_peer_submissions_roster on public.stem_peer_submissions(roster_id);

-- As duas operações bloqueiam a mesma configuração de turma para evitar corridas
-- entre um novo cadastro e a redução da quantidade de grupos.
create or replace function public.stem_register_group(p_roster jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare allowed_count integer;
begin
  select s.group_count into allowed_count from public.stem_class_settings s
    where s.academic_year = (p_roster->>'academic_year')::integer
      and s.semester = (p_roster->>'semester')::integer
      and s.unit = p_roster->>'unit' and s.grade = p_roster->>'grade' and s.class = p_roster->>'class'
    for update;
  if allowed_count is null or (p_roster->>'group_number')::integer not between 1 and allowed_count then
    raise exception using errcode = '22023', message = 'A quantidade de grupos desta turma mudou. Volte e selecione o grupo novamente.';
  end if;
  insert into public.stem_group_rosters(id, academic_year, semester, unit, grade, class, group_number, members)
    values ((p_roster->>'id')::uuid, (p_roster->>'academic_year')::integer, (p_roster->>'semester')::integer,
      p_roster->>'unit', p_roster->>'grade', p_roster->>'class', (p_roster->>'group_number')::integer, p_roster->'members');
end;
$$;
create or replace function public.stem_set_group_limit(p_selection jsonb, p_group_count integer)
returns void language plpgsql security invoker set search_path = '' as $$
declare current_count integer; highest_group integer;
begin
  if p_group_count is null or p_group_count not between 1 and 99 then
    raise exception using errcode = '22023', message = 'Informe uma quantidade de 1 a 99 grupos.';
  end if;
  select s.group_count into current_count from public.stem_class_settings s
    where s.academic_year = (p_selection->>'academic_year')::integer
      and s.semester = (p_selection->>'semester')::integer
      and s.unit = p_selection->>'unit' and s.grade = p_selection->>'grade' and s.class = p_selection->>'class'
    for update;
  if current_count is null then
    raise exception using errcode = '22023', message = 'Turma não configurada.';
  end if;
  select max(r.group_number) into highest_group from public.stem_group_rosters r
    where r.academic_year = (p_selection->>'academic_year')::integer
      and r.semester = (p_selection->>'semester')::integer
      and r.unit = p_selection->>'unit' and r.grade = p_selection->>'grade' and r.class = p_selection->>'class';
  if highest_group > p_group_count then
    raise exception using errcode = '22023', message = format('O Grupo %s já tem integrantes cadastrados. A quantidade mínima para esta turma é %s.', highest_group, highest_group);
  end if;
  update public.stem_class_settings s set group_count = p_group_count
    where s.academic_year = (p_selection->>'academic_year')::integer
      and s.semester = (p_selection->>'semester')::integer
      and s.unit = p_selection->>'unit' and s.grade = p_selection->>'grade' and s.class = p_selection->>'class';
end;
$$;
revoke all on function public.stem_register_group(jsonb), public.stem_set_group_limit(jsonb, integer) from public, anon, authenticated;
grant execute on function public.stem_register_group(jsonb), public.stem_set_group_limit(jsonb, integer) to service_role;
commit;
