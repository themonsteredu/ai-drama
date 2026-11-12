create table if not exists public.play_film_ai_credentials (
 id text primary key check (id = 'openai'),
 encrypted_key text not null,
 updated_at timestamptz not null default now()
);
alter table public.play_film_ai_credentials enable row level security;
revoke all on public.play_film_ai_credentials from public, anon, authenticated;
grant select, insert, update on public.play_film_ai_credentials to service_role;

create table if not exists public.play_film_request_limits (
 bucket text primary key,
 attempts integer not null,
 window_start timestamptz not null default now()
);
alter table public.play_film_request_limits enable row level security;
revoke all on public.play_film_request_limits from public, anon, authenticated;
grant select, insert, update, delete on public.play_film_request_limits to service_role;

create or replace function public.play_film_rate_limit(p_bucket text, p_limit integer, p_seconds integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare count_now integer;
begin
 if p_limit < 1 or p_limit > 100 or p_seconds < 1 or p_seconds > 3600 or length(p_bucket) > 128 then
  raise exception 'invalid rate window';
 end if;
 delete from public.play_film_request_limits where window_start < now() - interval '1 day';
 insert into public.play_film_request_limits as limits(bucket,attempts,window_start)
 values(p_bucket,1,now())
 on conflict(bucket) do update
 set attempts = case when limits.window_start < now() - make_interval(secs=>p_seconds) then 1 else limits.attempts+1 end,
 window_start = case when limits.window_start < now() - make_interval(secs=>p_seconds) then now() else limits.window_start end
 returning attempts into count_now;
 return count_now <= p_limit;
end;
$$;
revoke all on function public.play_film_rate_limit(text,integer,integer) from public, anon, authenticated;
grant execute on function public.play_film_rate_limit(text,integer,integer) to service_role;

-- Correct classroom logins do not consume the shared Wi-Fi failure budget.
-- Checking and counting failures happen under one row lock, including valid
-- attempts after a lockout, so the PIN cannot be brute-forced past the cap.
create or replace function public.play_film_pin_attempt(p_bucket text, p_valid boolean)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare attempts_now integer; started timestamptz;
begin
 if length(p_bucket)>128 or p_valid is null then raise exception 'invalid PIN attempt'; end if;
 insert into public.play_film_request_limits(bucket,attempts,window_start)
 values(p_bucket,0,now()) on conflict(bucket) do nothing;
 select attempts,window_start into attempts_now,started from public.play_film_request_limits where bucket=p_bucket for update;
 if started < now()-interval '10 minutes' then
  attempts_now:=0;
  update public.play_film_request_limits set attempts=0,window_start=now() where bucket=p_bucket;
 end if;
 if attempts_now>=8 then return false; end if;
 if not p_valid then update public.play_film_request_limits set attempts=attempts+1 where bucket=p_bucket; end if;
 return true;
end;
$$;
revoke all on function public.play_film_pin_attempt(text,boolean) from public, anon, authenticated;
grant execute on function public.play_film_pin_attempt(text,boolean) to service_role;
