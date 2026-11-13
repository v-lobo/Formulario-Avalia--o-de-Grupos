-- Gestão de períodos e lixeira. Mantém respostas e cadastros anteriores.
begin;
create table public.stem_form_periods (
  academic_year integer not null check (academic_year between 2020 and 2100),
  semester integer not null check (semester in (1, 2)),
  is_current boolean not null default false,
  is_open boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (academic_year, semester),
  check (not is_open or is_current)
);
create unique index stem_one_current_period on public.stem_form_periods (is_current) where is_current;
alter table public.stem_form_periods enable row level security;
revoke all on public.stem_form_periods from public, anon, authenticated;
grant select, insert, update on public.stem_form_periods to service_role;

insert into public.stem_form_periods(academic_year, semester)
  select distinct academic_year, semester from public.stem_peer_submissions
  union select distinct academic_year, semester from public.stem_class_settings;
insert into public.stem_form_periods(academic_year, semester) values (2026, 2) on conflict do nothing;
update public.stem_form_periods set is_current = true, is_open = true where academic_year = 2026 and semester = 2;

alter table public.stem_peer_submissions add column deleted_at timestamptz;
alter table public.stem_peer_submissions add column delete_reason text not null default '' check (length(delete_reason) <= 300);
alter table public.stem_peer_submissions add column deleted_with_roster uuid references public.stem_group_rosters(id);
alter table public.stem_group_rosters add column deleted_at timestamptz;
alter table public.stem_group_rosters add column delete_reason text not null default '' check (length(delete_reason) <= 300);
grant update on public.stem_peer_submissions, public.stem_group_rosters to service_role;

-- Troca somente a unicidade do cadastro ativo; as FKs históricas ficam intactas.
do $$
declare constraint_name text;
begin
  select conname into constraint_name from pg_constraint
  where conrelid = 'public.stem_group_rosters'::regclass and contype = 'u'
    and pg_get_constraintdef(oid) = 'UNIQUE (academic_year, semester, unit, grade, class, group_number)';
  if constraint_name is null then raise exception 'Restrição de unicidade do cadastro não encontrada.'; end if;
  execute format('alter table public.stem_group_rosters drop constraint %I', constraint_name);
end;
$$;
create unique index stem_active_group_roster on public.stem_group_rosters
  (academic_year, semester, unit, grade, class, group_number) where deleted_at is null;
create index stem_submissions_roster_trash on public.stem_peer_submissions(deleted_with_roster)
  where deleted_with_roster is not null;

create function public.stem_manage_period(p_action text, p_year integer, p_semester integer,
  p_source_year integer default null, p_source_semester integer default null)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if p_action is null or p_action not in ('create', 'open', 'close')
    or p_year is null or p_year not between 2020 and 2100 or p_semester is null or p_semester not in (1, 2) then
    raise exception using errcode = '22023', message = 'Período ou ação inválida.';
  end if;
  -- Serializa trocas de período; envios bloqueiam a linha do período com FOR SHARE.
  perform pg_catalog.pg_advisory_xact_lock(73194201);
  if p_action = 'create' then
    perform 1 from public.stem_form_periods where academic_year = p_source_year and semester = p_source_semester;
    if not found then raise exception using errcode = '22023', message = 'Selecione um período de origem válido.'; end if;
    insert into public.stem_form_periods(academic_year, semester) values(p_year, p_semester);
    insert into public.stem_class_settings(academic_year, semester, unit, grade, class, group_count)
      select p_year, p_semester, unit, grade, class, group_count from public.stem_class_settings
      where academic_year = p_source_year and semester = p_source_semester;
  else
    perform 1 from public.stem_form_periods where academic_year = p_year and semester = p_semester;
    if not found then raise exception using errcode = 'P0002', message = 'Período não encontrado.'; end if;
    if p_action = 'open' then
      update public.stem_form_periods set is_open = false, is_current = false where is_current;
      update public.stem_form_periods set is_open = true, is_current = true where academic_year = p_year and semester = p_semester;
    else
      update public.stem_form_periods set is_open = false where academic_year = p_year and semester = p_semester;
    end if;
  end if;
end;
$$;

create function public.stem_check_submission_open()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare allowed boolean; active_roster uuid;
begin
  -- Uma repetição idempotente segue para a PK, sem criar nova resposta.
  if exists(select 1 from public.stem_peer_submissions where id = new.id) then return new; end if;
  select is_open and is_current into allowed from public.stem_form_periods
    where academic_year = new.academic_year and semester = new.semester for share;
  if allowed is distinct from true then
    raise exception using errcode = '22023', message = 'O formulário está fechado ou o período mudou. Atualize a página.';
  end if;
  select id into active_roster from public.stem_group_rosters where id = new.roster_id
    and deleted_at is null and academic_year = new.academic_year and semester = new.semester
    and unit = new.unit and grade = new.grade and class = new.class and group_number = new.group_number for share;
  if active_roster is null then
    raise exception using errcode = '22023', message = 'Este cadastro foi removido ou não corresponde ao formulário. Selecione o grupo novamente.';
  end if;
  return new;
end;
$$;
create trigger stem_submission_open before insert on public.stem_peer_submissions
  for each row execute function public.stem_check_submission_open();

create or replace function public.stem_register_group(p_roster jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare allowed_count integer; allowed boolean;
begin
  select is_open and is_current into allowed from public.stem_form_periods
    where academic_year = (p_roster->>'academic_year')::integer and semester = (p_roster->>'semester')::integer for share;
  if allowed is distinct from true then
    raise exception using errcode = '22023', message = 'O formulário está fechado ou o período mudou. Atualize a página.';
  end if;
  select s.group_count into allowed_count from public.stem_class_settings s
    where s.academic_year = (p_roster->>'academic_year')::integer and s.semester = (p_roster->>'semester')::integer
      and s.unit = p_roster->>'unit' and s.grade = p_roster->>'grade' and s.class = p_roster->>'class' for update;
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
    where s.academic_year = (p_selection->>'academic_year')::integer and s.semester = (p_selection->>'semester')::integer
      and s.unit = p_selection->>'unit' and s.grade = p_selection->>'grade' and s.class = p_selection->>'class' for update;
  if current_count is null then raise exception using errcode = '22023', message = 'Turma não configurada.'; end if;
  select max(r.group_number) into highest_group from public.stem_group_rosters r
    where r.academic_year = (p_selection->>'academic_year')::integer and r.semester = (p_selection->>'semester')::integer
      and r.unit = p_selection->>'unit' and r.grade = p_selection->>'grade' and r.class = p_selection->>'class' and r.deleted_at is null;
  if highest_group > p_group_count then
    raise exception using errcode = '22023', message = format('O Grupo %s já tem integrantes cadastrados. A quantidade mínima para esta turma é %s.', highest_group, highest_group);
  end if;
  update public.stem_class_settings s set group_count = p_group_count
    where s.academic_year = (p_selection->>'academic_year')::integer and s.semester = (p_selection->>'semester')::integer
      and s.unit = p_selection->>'unit' and s.grade = p_selection->>'grade' and s.class = p_selection->>'class';
end;
$$;

create function public.stem_manage_record(p_kind text, p_id uuid, p_restore boolean, p_reason text default '')
returns void language plpgsql security invoker set search_path = '' as $$
declare r public.stem_group_rosters%rowtype; target_roster uuid; allowed_count integer;
begin
  if p_kind is null or p_kind not in ('submission', 'roster') or p_id is null or p_restore is null
    or p_reason is null or length(p_reason) > 300 then
    raise exception using errcode = '22023', message = 'Registro ou ação inválida.';
  end if;
  if p_kind = 'roster' then
    -- Mesma ordem de bloqueios do cadastro/limite: configuração, depois cadastro.
    select * into r from public.stem_group_rosters where id = p_id;
    if not found then raise exception using errcode = 'P0002', message = 'Cadastro não encontrado.'; end if;
    select group_count into allowed_count from public.stem_class_settings
      where academic_year = r.academic_year and semester = r.semester and unit = r.unit and grade = r.grade and class = r.class for update;
    select * into r from public.stem_group_rosters where id = p_id for update;
    if p_restore then
      if r.deleted_at is null then return; end if;
      if allowed_count is null or r.group_number > allowed_count then
        raise exception using errcode = '22023', message = 'Aumente a quantidade de grupos da turma antes de restaurar este cadastro.';
      end if;
      if exists(select 1 from public.stem_group_rosters where id <> p_id and deleted_at is null
        and academic_year = r.academic_year and semester = r.semester and unit = r.unit and grade = r.grade
        and class = r.class and group_number = r.group_number) then
        raise exception using errcode = '22023', message = 'Este grupo já possui um novo cadastro. Remova o cadastro novo antes de restaurar o anterior.';
      end if;
      update public.stem_group_rosters set deleted_at = null, delete_reason = '' where id = p_id;
      update public.stem_peer_submissions set deleted_at = null, delete_reason = '', deleted_with_roster = null where deleted_with_roster = p_id;
    else
      if r.deleted_at is not null then return; end if;
      update public.stem_group_rosters set deleted_at = now(), delete_reason = p_reason where id = p_id;
      update public.stem_peer_submissions set deleted_at = now(), delete_reason = 'Cadastro removido: ' || left(p_reason, 280),
        deleted_with_roster = p_id where roster_id = p_id and deleted_at is null;
    end if;
  else
    select roster_id into target_roster from public.stem_peer_submissions where id = p_id;
    if not found then raise exception using errcode = 'P0002', message = 'Resposta não encontrada.'; end if;
    if target_roster is not null then
      select * into r from public.stem_group_rosters where id = target_roster for share;
      if p_restore and r.deleted_at is not null then
        raise exception using errcode = '22023', message = 'Restaure primeiro o cadastro deste grupo.';
      end if;
    end if;
    if p_restore then
      update public.stem_peer_submissions set deleted_at = null, delete_reason = '', deleted_with_roster = null where id = p_id;
    else
      update public.stem_peer_submissions set deleted_at = now(), delete_reason = p_reason, deleted_with_roster = null
        where id = p_id and deleted_at is null;
    end if;
  end if;
end;
$$;

revoke all on function public.stem_manage_period(text, integer, integer, integer, integer),
  public.stem_manage_record(text, uuid, boolean, text), public.stem_check_submission_open(),
  public.stem_register_group(jsonb), public.stem_set_group_limit(jsonb, integer) from public, anon, authenticated;
grant execute on function public.stem_manage_period(text, integer, integer, integer, integer),
  public.stem_manage_record(text, uuid, boolean, text), public.stem_check_submission_open(),
  public.stem_register_group(jsonb), public.stem_set_group_limit(jsonb, integer) to service_role;
commit;
