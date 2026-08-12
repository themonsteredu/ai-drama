-- A seeded or previously joined student can re-enter from a new anonymous
-- browser session by reclaiming the existing named seat in the same team.
-- The team row lock keeps the capacity check safe when students join together.
create or replace function public.join_team(team_code text, student_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare target public.teams; learner public.drama_students; member_count integer;
begin
  if auth.uid() is null then raise exception 'Anonymous auth is required'; end if;
  if nullif(trim(student_name), '') is null then raise exception 'Student name is required'; end if;

  select * into target
  from public.teams
  where code = upper(trim(team_code))
  for update;

  if target.id is null then raise exception 'Invalid team code'; end if;

  select count(*) into member_count
  from public.team_members
  where team_id = target.id;

  select * into learner
  from public.drama_students
  where auth_user_id = auth.uid();

  if learner.id is null then
    select s.* into learner
    from public.drama_students s
    join public.team_members tm on tm.student_id = s.id
    where tm.team_id = target.id
      and lower(trim(s.display_name)) = lower(trim(student_name))
    limit 1;

    if learner.id is not null then
      update public.drama_students
      set auth_user_id = auth.uid(), display_name = trim(student_name)
      where id = learner.id
      returning * into learner;
    elsif member_count >= target.size then
      raise exception 'Team is full';
    else
      insert into public.drama_students(auth_user_id, display_name)
      values(auth.uid(), trim(student_name))
      returning * into learner;
    end if;
  else
    update public.drama_students
    set display_name = trim(student_name)
    where id = learner.id
    returning * into learner;
  end if;

  insert into public.team_members(team_id, student_id)
  values(target.id, learner.id)
  on conflict(team_id, student_id) do nothing;

  return jsonb_build_object(
    'team_id', target.id,
    'student_id', learner.id,
    'team_name', target.name
  );
end $$;
