begin;
create function public.stem_single_evaluator() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.deleted_at is not null or new.roster_id is null or new.evaluator_id is null then return new; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.roster_id::text || ':' || new.evaluator_id::text, 0));
 if exists(select 1 from public.stem_peer_submissions where roster_id=new.roster_id and evaluator_id=new.evaluator_id and deleted_at is null and id<>new.id) then
 raise exception using errcode='22023',message='Este integrante já enviou sua avaliação. Selecione outro nome ou procure o professor.';
 end if;
 return new;
end;
$$;
create trigger stem_single_evaluator before insert or update of deleted_at on public.stem_peer_submissions for each row execute function public.stem_single_evaluator();
revoke all on function public.stem_single_evaluator() from public,anon,authenticated;
grant execute on function public.stem_single_evaluator() to service_role;
commit;
