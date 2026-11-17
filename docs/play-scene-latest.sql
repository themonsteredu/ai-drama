alter table public.play_scene_submissions add column superseded_at timestamptz;

-- Keep the most recently completed upload for each slot when upgrading existing classrooms.
with ranked as (
 select id, row_number() over (
  partition by class_id, group_no, scene_no order by submitted_at desc, created_at desc, id desc
 ) as position
 from public.play_scene_submissions where submitted_at is not null
)
update public.play_scene_submissions work set superseded_at = now()
from ranked where work.id = ranked.id and ranked.position > 1;

create unique index play_scene_submissions_latest_idx
 on public.play_scene_submissions(class_id, group_no, scene_no)
 where submitted_at is not null and superseded_at is null;

create index play_scene_submissions_superseded_idx
 on public.play_scene_submissions(class_id, group_no, superseded_at)
 where superseded_at is not null;

create function public.play_reserve_scene_submission(p_id uuid, p_class uuid, p_group integer, p_scene integer, p_bucket text)
returns text language plpgsql security invoker set search_path = '' as $$
begin
 perform 1 from public.play_classrooms room where room.id = p_class and room.is_open for share;
 if not found then return 'closed'; end if;

 perform 1 from public.play_class_groups crew where crew.class_id = p_class and crew.group_no = p_group;
 if not found then return 'missing-group'; end if;

 if not public.play_film_rate_limit(p_bucket, 30, 60) then return 'rate-limited'; end if;

 insert into public.play_scene_submissions(id, class_id, group_no, scene_no)
  values(p_id, p_class, p_group, p_scene);
 return 'ok';
end;
$$;

revoke all on function public.play_reserve_scene_submission(uuid, uuid, integer, integer, text) from public, anon, authenticated;
grant execute on function public.play_reserve_scene_submission(uuid, uuid, integer, integer, text) to service_role;

create or replace function public.play_finish_scene_submission(p_id uuid, p_class uuid, p_group integer, p_title text, p_count integer)
returns setof public.play_scene_submissions language plpgsql security invoker set search_path = '' as $$
declare
 receipt public.play_scene_submissions;
 completed_at timestamptz;
 older_than_latest boolean;
begin
 -- Successful requests stay idempotent after supersession and after a room closes.
 return query select work.* from public.play_scene_submissions work
  where work.id = p_id and work.class_id = p_class and work.group_no = p_group and work.submitted_at is not null;
 if found then return; end if;

 perform 1 from public.play_classrooms room where room.id = p_class and room.is_open for share;
 if not found then
  return query select work.* from public.play_scene_submissions work
   where work.id = p_id and work.class_id = p_class and work.group_no = p_group and work.submitted_at is not null;
  return;
 end if;

 -- The group row serializes check-and-replace operations, including the first submission to an empty slot.
 perform 1 from public.play_class_groups crew where crew.class_id = p_class and crew.group_no = p_group for no key update;
 select work.* into receipt from public.play_scene_submissions work
  where work.id = p_id and work.class_id = p_class and work.group_no = p_group for update;
 if not found then return; end if;
 if receipt.submitted_at is not null then
  return next receipt;
  return;
 end if;

 -- Compare reservation order so a slow older upload cannot replace a newer completed one.
 select exists (
  select 1 from public.play_scene_submissions work
  where work.class_id = p_class and work.group_no = p_group and work.scene_no = receipt.scene_no
   and work.submitted_at is not null and work.superseded_at is null
   and (work.created_at, work.id) > (receipt.created_at, receipt.id)
 ) into older_than_latest;
 completed_at := clock_timestamp();

 if not older_than_latest then
  update public.play_scene_submissions work set superseded_at = completed_at
   where work.class_id = p_class and work.group_no = p_group and work.scene_no = receipt.scene_no
    and work.submitted_at is not null and work.superseded_at is null;
 end if;
 return query update public.play_scene_submissions work
  set submitted_at = completed_at, title = p_title, scene_count = p_count,
   superseded_at = case when older_than_latest then completed_at else null end
  where work.id = p_id returning work.*;
end;
$$;
