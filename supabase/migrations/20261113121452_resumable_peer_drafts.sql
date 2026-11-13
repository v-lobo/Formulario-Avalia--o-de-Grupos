begin;
create table public.stem_peer_drafts (
  roster_id uuid not null references public.stem_group_rosters(id),
  evaluator_id uuid not null,
  submission_id uuid not null,
  members jsonb not null check (jsonb_typeof(members) = 'array' and jsonb_array_length(members) between 1 and 15),
  updated_at timestamptz not null default now(),
  primary key (roster_id, evaluator_id)
);
alter table public.stem_peer_drafts enable row level security;
revoke all on public.stem_peer_drafts from public, anon, authenticated;
grant select, insert, update, delete on public.stem_peer_drafts to service_role;

create function public.stem_save_peer_draft(p_roster_id uuid, p_evaluator_id uuid, p_submission_id uuid, p_members jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare r public.stem_group_rosters; p public.stem_form_periods;
begin
  select * into r from public.stem_group_rosters where id = p_roster_id;
  select * into p from public.stem_form_periods where academic_year = r.academic_year and semester = r.semester for share;
  if p.is_open is distinct from true or p.is_current is distinct from true then
    raise exception using errcode='22023', message='O formulário está fechado.';
  end if;
  select * into r from public.stem_group_rosters where id = p_roster_id for share;
  if r.id is null or r.deleted_at is not null or not exists(select 1 from jsonb_array_elements(r.members) m where m->>'id' = p_evaluator_id::text) then
    raise exception using errcode='22023', message='Selecione seu nome no grupo cadastrado.';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_roster_id::text || ':' || p_evaluator_id::text, 0));
  if exists(select 1 from public.stem_peer_submissions where roster_id=p_roster_id and evaluator_id=p_evaluator_id and deleted_at is null) then
    raise exception using errcode='22023', message='Este integrante já enviou sua avaliação completa.';
  end if;
  if jsonb_typeof(p_members) is distinct from 'array' or p_submission_id is null then
    raise exception using errcode='22023', message='Rascunho inválido.';
  end if;
  insert into public.stem_peer_drafts(roster_id,evaluator_id,submission_id,members)
    values(p_roster_id,p_evaluator_id,p_submission_id,p_members)
    on conflict(roster_id,evaluator_id) do update set submission_id=excluded.submission_id,members=excluded.members,updated_at=now();
end;
$$;
revoke all on function public.stem_save_peer_draft(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.stem_save_peer_draft(uuid,uuid,uuid,jsonb) to service_role;

-- Finalização elimina o rascunho na mesma transação do envio completo.
create function public.stem_clear_peer_draft() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  delete from public.stem_peer_drafts where roster_id=new.roster_id and evaluator_id=new.evaluator_id;
  return new;
end;
$$;
create trigger stem_clear_peer_draft after insert on public.stem_peer_submissions for each row execute function public.stem_clear_peer_draft();
revoke all on function public.stem_clear_peer_draft() from public,anon,authenticated;
grant execute on function public.stem_clear_peer_draft() to service_role;
commit;
