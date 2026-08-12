-- Existing team members may reserve an empty cast seat by name. The reserved
-- student can later claim that seat through join_team from their own device.
create or replace function public.reserve_team_member(target_team uuid, student_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  target public.teams;
  learner public.drama_students;
  member_count integer;
begin
  if auth.uid() is null or not public.is_team_member(target_team) then
    raise exception 'Team membership is required';
  end if;
  if nullif(trim(student_name), '') is null then
    raise exception 'Student name is required';
  end if;

  select * into target from public.teams where id = target_team for update;
  if target.id is null then raise exception 'Invalid team'; end if;

  select s.* into learner
  from public.drama_students s
  join public.team_members tm on tm.student_id = s.id
  where tm.team_id = target_team
    and lower(trim(s.display_name)) = lower(trim(student_name))
  limit 1;

  if learner.id is not null then
    return jsonb_build_object('student_id', learner.id, 'display_name', learner.display_name);
  end if;

  select count(*) into member_count from public.team_members where team_id = target_team;
  if member_count >= target.size then raise exception 'Team is full'; end if;

  insert into public.drama_students(display_name)
  values(trim(student_name))
  returning * into learner;

  insert into public.team_members(team_id, student_id)
  values(target_team, learner.id);

  return jsonb_build_object('student_id', learner.id, 'display_name', learner.display_name);
end $$;
