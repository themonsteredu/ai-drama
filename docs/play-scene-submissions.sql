create table public.play_scene_submissions (
 id uuid primary key,
 class_id uuid not null references public.play_classrooms(id) on delete cascade,
 group_no integer not null,
 scene_no integer not null check (scene_no between 1 and 5),
 created_at timestamptz not null default now(),
 submitted_at timestamptz,
 title text check (char_length(title) <= 80),
 scene_count integer check (scene_count between 1 and 32),
 foreign key (class_id, group_no) references public.play_class_groups(class_id, group_no) on delete cascade,
 check ((submitted_at is null and title is null and scene_count is null)
     or (submitted_at is not null and title is not null and scene_count is not null))
);

create index play_scene_submissions_group_idx on public.play_scene_submissions(class_id, group_no, id);
create index play_scene_submissions_pending_idx on public.play_scene_submissions(class_id, group_no, created_at)
 where submitted_at is null;

alter table public.play_scene_submissions enable row level security;
revoke all on public.play_scene_submissions from public, anon, authenticated;
grant select, insert, update, delete on public.play_scene_submissions to service_role;

create function public.play_finish_scene_submission(p_id uuid, p_class uuid, p_group integer, p_title text, p_count integer)
returns setof public.play_scene_submissions language plpgsql security invoker set search_path = '' as $$
begin
 return query select work.* from public.play_scene_submissions work
  where work.id = p_id and work.class_id = p_class and work.group_no = p_group and work.submitted_at is not null;
 if found then return; end if;

 perform 1 from public.play_classrooms room where room.id = p_class and room.is_open for share;
 if found then
  return query update public.play_scene_submissions work
   set submitted_at = now(), title = p_title, scene_count = p_count
   where work.id = p_id and work.class_id = p_class and work.group_no = p_group and work.submitted_at is null
   returning work.*;
  if found then return; end if;
 end if;

 -- Another request may have completed the same upload before this request acquired its lock.
 return query select work.* from public.play_scene_submissions work
  where work.id = p_id and work.class_id = p_class and work.group_no = p_group and work.submitted_at is not null;
end;
$$;

revoke all on function public.play_finish_scene_submission(uuid, uuid, integer, text, integer) from public, anon, authenticated;
grant execute on function public.play_finish_scene_submission(uuid, uuid, integer, text, integer) to service_role;
