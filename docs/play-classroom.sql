-- MOAKIT PLAY classrooms. All access goes through the server's scoped sessions.
create table public.play_classrooms (
 id uuid primary key default gen_random_uuid(),
 code text not null unique check (code ~ '^[0-9]{6}$'),
 title text not null check (char_length(title) between 1 and 80),
 group_count integer not null check (group_count between 1 and 12),
 is_open boolean not null default true,
 created_at timestamptz not null default now()
);
create table public.play_class_groups (
 class_id uuid not null references public.play_classrooms(id) on delete cascade,
 group_no integer not null check (group_no between 1 and 12),
 revision integer not null default 0,
 object_path text,
 submitted boolean not null default false,
 summary jsonb not null default '{}'::jsonb,
 updated_at timestamptz,
 primary key(class_id,group_no)
);
create table public.play_class_uploads (
 path text primary key,
 class_id uuid not null references public.play_classrooms(id) on delete cascade,
 group_no integer not null,
 created_at timestamptz not null default now()
);
create index play_class_uploads_cleanup on public.play_class_uploads(class_id,group_no,created_at);
alter table public.play_classrooms enable row level security;
alter table public.play_class_groups enable row level security;
alter table public.play_class_uploads enable row level security;
revoke all on public.play_classrooms, public.play_class_groups, public.play_class_uploads from public,anon,authenticated;
grant select,insert,update,delete on public.play_classrooms, public.play_class_groups, public.play_class_uploads to service_role;
create function public.play_create_class(p_code text,p_title text,p_groups integer)
returns setof public.play_classrooms language plpgsql security invoker set search_path='' as $$
declare room public.play_classrooms;
begin
 insert into public.play_classrooms(code,title,group_count) values(p_code,p_title,p_groups)
 on conflict(code) do nothing returning * into room;
 if room.id is null then return; end if;
 insert into public.play_class_groups(class_id,group_no) select room.id,n from generate_series(1,p_groups) n;
 return next room;
end; $$;
create function public.play_save_group(p_class uuid,p_group integer,p_revision integer,p_path text,p_summary jsonb,p_submitted boolean)
returns setof public.play_class_groups language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.play_classrooms where id=p_class and is_open for share;
 if not found then return; end if;
 return query update public.play_class_groups set revision=revision+1,object_path=p_path,
 summary=p_summary,submitted=p_submitted,updated_at=now()
 where class_id=p_class and group_no=p_group and revision=p_revision returning *;
end; $$;
revoke all on function public.play_create_class(text,text,integer),public.play_save_group(uuid,integer,integer,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.play_create_class(text,text,integer),public.play_save_group(uuid,integer,integer,text,jsonb,boolean) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('play-class-work','play-class-work',false,50000000,array['application/json'])
on conflict(id) do nothing;
