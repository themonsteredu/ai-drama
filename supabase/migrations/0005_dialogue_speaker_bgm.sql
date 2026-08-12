alter table public.teams
  add column if not exists custom_characters jsonb not null default '[]'::jsonb,
  add column if not exists bgm_volume numeric(4, 3) not null default 0.160
    check (bgm_volume between 0.040 and 0.400);

alter table public.scripts
  add column if not exists dialogue_lines jsonb not null default '[]'::jsonb;

alter table public.recordings
  add column if not exists speaker_cues jsonb not null default '[]'::jsonb;

-- Custom team roles use generated string IDs, so character_id can no longer
-- be restricted to the seeded characters table.
alter table public.team_members
  drop constraint if exists team_members_character_id_fkey;

comment on column public.teams.custom_characters is 'Team-created speaking roles stored as CharacterTemplate JSON.';
comment on column public.teams.bgm_volume is 'Final mix BGM gain from 0.04 to 0.40.';
comment on column public.scripts.dialogue_lines is 'Student-authored speaker-aware dialogue lines.';
comment on column public.recordings.speaker_cues is 'Character speaker changes with recording-relative millisecond timestamps.';
