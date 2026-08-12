create extension if not exists pgcrypto;

do $$ begin
  create type public.team_phase as enum ('work-selection','role-assignment','script','stage','music','recording','rendering','submitted');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.recording_status as enum ('not-recorded','recorded','retake','confirmed');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.asset_category as enum ('background','building','character','prop','animal','nature','effect');
exception when duplicate_object then null; end $$;

create table public.drama_classes (
  id uuid primary key default gen_random_uuid(),
  school_name text not null,
  name text not null,
  teacher_name text not null,
  admin_code_hash text not null,
  created_at timestamptz not null default now()
);

create table public.works (
  id text primary key,
  title text not null,
  tagline text not null,
  easy_context text not null,
  highlight_title text not null,
  scene_context text not null,
  props jsonb not null default '[]',
  backgrounds jsonb not null default '[]',
  emotions jsonb not null default '[]',
  bgm_keywords jsonb not null default '[]',
  color text not null,
  accent text not null,
  created_at timestamptz not null default now()
);

create table public.work_variants (
  id text primary key,
  work_id text not null references public.works(id) on delete cascade,
  team_size smallint not null check (team_size between 4 and 6),
  unique (work_id, team_size)
);

create table public.characters (
  id text primary key,
  variant_id text not null references public.work_variants(id) on delete cascade,
  name text not null,
  sort_order smallint not null,
  personality jsonb not null default '[]',
  action_cue text not null,
  line_cue text not null,
  unique (variant_id, sort_order)
);

create table public.cut_templates (
  id text primary key,
  variant_id text not null references public.work_variants(id) on delete cascade,
  sort_order smallint not null,
  title text not null,
  summary text not null,
  active_characters jsonb not null default '[]',
  emotions jsonb not null default '[]',
  line_prompt text not null,
  props jsonb not null default '[]',
  atmosphere text not null,
  unique (variant_id, sort_order)
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.drama_classes(id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9]{6,8}$'),
  name text not null,
  size smallint not null check (size between 4 and 6),
  phase public.team_phase not null default 'work-selection',
  work_id text references public.works(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.drama_students (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  student_id uuid not null references public.drama_students(id) on delete cascade,
  character_id text references public.characters(id) on delete set null,
  production_role text,
  joined_at timestamptz not null default now(),
  unique (team_id, student_id),
  unique (team_id, character_id),
  unique (team_id, production_role)
);

create table public.scripts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  template_id text references public.cut_templates(id) on delete set null,
  sort_order smallint not null,
  title text not null,
  summary text not null default '',
  participants jsonb not null default '[]',
  emotions jsonb not null default '[]',
  key_line text not null default '',
  props jsonb not null default '[]',
  atmosphere text not null default '',
  notes text not null default '',
  confirmed boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (team_id, sort_order)
);

create table public.stage_layouts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  script_id uuid not null references public.scripts(id) on delete cascade,
  confirmed boolean not null default false,
  version integer not null default 1,
  updated_by uuid references public.drama_students(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (team_id, script_id)
);

create table public.stage_items (
  id uuid primary key,
  layout_id uuid not null references public.stage_layouts(id) on delete cascade,
  cut_id uuid not null references public.scripts(id) on delete cascade,
  asset_id text not null,
  x numeric(6,3) not null check (x between 0 and 100),
  y numeric(6,3) not null check (y between 0 and 100),
  scale numeric(5,3) not null check (scale between 0.1 and 3),
  rotation smallint not null default 0,
  facing text not null default 'right' check (facing in ('left','right')),
  z_index integer not null default 1,
  locked_by uuid references public.drama_students(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.music_candidates (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  student_id uuid not null references public.drama_students(id) on delete cascade,
  title text not null,
  source text not null check (source in ('upload','link')),
  url text not null,
  mood text not null default '',
  selected boolean not null default false,
  created_at timestamptz not null default now(),
  unique (team_id, student_id)
);

create table public.music_votes (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  candidate_id uuid not null references public.music_candidates(id) on delete cascade,
  student_id uuid not null references public.drama_students(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (team_id, student_id)
);

create table public.recordings (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  script_id uuid not null references public.scripts(id) on delete cascade,
  storage_path text,
  public_url text,
  status public.recording_status not null default 'not-recorded',
  duration_seconds numeric(7,2),
  take_number integer not null default 1,
  created_at timestamptz not null default now(),
  unique (team_id, script_id)
);

create table public.dubbings (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references public.recordings(id) on delete cascade,
  student_id uuid references public.drama_students(id) on delete set null,
  storage_path text not null,
  public_url text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (recording_id, public_url)
);

create table public.final_videos (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  storage_path text,
  public_url text,
  thumbnail_url text,
  render_status text not null default 'queued' check (render_status in ('queued','processing','completed','failed')),
  render_log text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.drama_classes(id) on delete cascade,
  team_id uuid not null unique references public.teams(id) on delete cascade,
  final_video_id uuid not null references public.final_videos(id) on delete restrict,
  screening_order integer,
  submitted_at timestamptz not null default now()
);

create table public.stage_assets (
  id text primary key,
  work_id text references public.works(id) on delete cascade,
  category public.asset_category not null,
  title text not null,
  file_path text not null,
  width integer not null,
  height integer not null,
  default_scale numeric(5,3) not null,
  facing_options jsonb not null default '["left","right"]',
  allowed_rotations jsonb not null default '[0]',
  tags jsonb not null default '[]'
);

create index on public.teams(class_id);
create index on public.team_members(student_id);
create index on public.scripts(team_id);
create index on public.stage_items(layout_id, z_index);
create index on public.music_candidates(team_id);
create index on public.recordings(team_id);

create or replace function public.is_team_member(target_team uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.team_members tm
    join public.drama_students s on s.id = tm.student_id
    where tm.team_id = target_team and s.auth_user_id = auth.uid()
  );
$$;

create or replace function public.join_team(team_code text, student_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare target public.teams; learner public.drama_students; member_count integer;
begin
  if auth.uid() is null then raise exception 'Anonymous auth is required'; end if;
  if nullif(trim(student_name), '') is null then raise exception 'Student name is required'; end if;
  select * into target from public.teams where code = upper(trim(team_code)) for update;
  if target.id is null then raise exception 'Invalid team code'; end if;
  select count(*) into member_count from public.team_members where team_id = target.id;
  select * into learner from public.drama_students where auth_user_id = auth.uid();
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
      insert into public.drama_students(auth_user_id,display_name)
      values(auth.uid(),trim(student_name))
      returning * into learner;
    end if;
  else
    update public.drama_students set display_name = trim(student_name) where id = learner.id returning * into learner;
  end if;
  insert into public.team_members(team_id,student_id) values(target.id,learner.id) on conflict(team_id,student_id) do nothing;
  return jsonb_build_object('team_id',target.id,'student_id',learner.id,'team_name',target.name);
end $$;

create or replace function public.save_stage_items(target_team uuid, target_cut uuid, payload jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare target_layout uuid;
begin
  if not public.is_team_member(target_team) then raise exception 'Not a team member'; end if;
  if not exists (select 1 from public.scripts where id=target_cut and team_id=target_team) then raise exception 'Invalid cut'; end if;
  insert into public.stage_layouts(team_id,script_id) values(target_team,target_cut)
  on conflict(team_id,script_id) do update set version=stage_layouts.version+1,updated_at=now()
  returning id into target_layout;
  delete from public.stage_items where layout_id=target_layout and id not in (select (value->>'id')::uuid from jsonb_array_elements(payload));
  insert into public.stage_items(id,layout_id,cut_id,asset_id,x,y,scale,rotation,facing,z_index,locked_by,updated_at)
  select (value->>'id')::uuid,target_layout,target_cut,value->>'assetId',(value->>'x')::numeric,(value->>'y')::numeric,(value->>'scale')::numeric,coalesce((value->>'rotation')::smallint,0),coalesce(value->>'facing','right'),coalesce((value->>'zIndex')::integer,1),null,now()
  from jsonb_array_elements(payload)
  on conflict(id) do update set x=excluded.x,y=excluded.y,scale=excluded.scale,rotation=excluded.rotation,facing=excluded.facing,z_index=excluded.z_index,updated_at=now();
end $$;

alter table public.drama_classes enable row level security;
alter table public.teams enable row level security;
alter table public.drama_students enable row level security;
alter table public.team_members enable row level security;
alter table public.scripts enable row level security;
alter table public.stage_layouts enable row level security;
alter table public.stage_items enable row level security;
alter table public.music_candidates enable row level security;
alter table public.music_votes enable row level security;
alter table public.recordings enable row level security;
alter table public.dubbings enable row level security;
alter table public.final_videos enable row level security;
alter table public.submissions enable row level security;
alter table public.works enable row level security;
alter table public.work_variants enable row level security;
alter table public.characters enable row level security;
alter table public.cut_templates enable row level security;
alter table public.stage_assets enable row level security;

create policy "Public curriculum reads" on public.works for select using (true);
create policy "Public variant reads" on public.work_variants for select using (true);
create policy "Public character reads" on public.characters for select using (true);
create policy "Public cut template reads" on public.cut_templates for select using (true);
create policy "Public asset reads" on public.stage_assets for select using (true);
create policy "Team members read team" on public.teams for select using (public.is_team_member(id));
create policy "Team members update team" on public.teams for update using (public.is_team_member(id)) with check (public.is_team_member(id));
create policy "Learner reads self" on public.drama_students for select using (auth_user_id = auth.uid());
create policy "Team members read classmates" on public.drama_students for select using (
  auth_user_id = auth.uid() or exists (
    select 1 from public.team_members member
    where member.student_id = drama_students.id and public.is_team_member(member.team_id)
  )
);
create policy "Team members read roster" on public.team_members for select using (public.is_team_member(team_id));
create policy "Team members update roles" on public.team_members for update using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy "Team scripts collaborate" on public.scripts for all using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy "Team layouts collaborate" on public.stage_layouts for all using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy "Team stage items collaborate" on public.stage_items for all using (public.is_team_member((select team_id from public.stage_layouts where id=layout_id))) with check (public.is_team_member((select team_id from public.stage_layouts where id=layout_id)));
create policy "Team music collaborate" on public.music_candidates for all using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy "Team voting" on public.music_votes for all using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy "Team recordings" on public.recordings for all using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy "Team dubbings" on public.dubbings for all using (public.is_team_member((select team_id from public.recordings where id=recording_id))) with check (public.is_team_member((select team_id from public.recordings where id=recording_id)));
create policy "Team final videos" on public.final_videos for all using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy "Team submissions" on public.submissions for all using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
  ('recordings','recordings',true,524288000,array['video/webm','video/mp4']),
  ('dubbings','dubbings',true,52428800,array['audio/webm','audio/mpeg','audio/wav']),
  ('music','music',true,104857600,array['audio/mpeg','audio/wav','audio/webm','audio/mp4']),
  ('final-videos','final-videos',true,1073741824,array['video/mp4'])
on conflict(id) do nothing;

create policy "Authenticated media uploads" on storage.objects for insert to authenticated with check (bucket_id in ('recordings','dubbings','music','final-videos'));
create policy "Public class playback" on storage.objects for select using (bucket_id in ('recordings','dubbings','music','final-videos'));
create policy "Owner replaces media" on storage.objects for update to authenticated using (owner_id = auth.uid()::text);
create policy "Owner removes media" on storage.objects for delete to authenticated using (owner_id = auth.uid()::text);

alter publication supabase_realtime add table public.team_members;
alter publication supabase_realtime add table public.scripts;
alter publication supabase_realtime add table public.stage_layouts;
alter publication supabase_realtime add table public.stage_items;
alter publication supabase_realtime add table public.music_candidates;
alter publication supabase_realtime add table public.music_votes;
alter publication supabase_realtime add table public.recordings;
