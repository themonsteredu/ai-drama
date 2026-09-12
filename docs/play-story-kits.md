# MOAKIT PLAY story kits

A story kit is the class's current story, reduced to the facts a child needs to start building: who is in it, where it happens, and what the scenes feel like. Kits live in `apps/play-studio/lib/story-kits.ts` and appear as a collapsed card at the top of the drawing studio's left column.

The first kit is 「빈집에 온 손님」 (글 황선미 · 그림 김중석), from 2학년 국어 단원 8 「이어질 이야기 상상하기」 — the same story the grade-2 web textbook uses for its 9차시.

## What a kit does and does not carry

**Carries** — character names with a one-line role, place names, and scene moods. These are facts about a story the class has read, and they are what a blank stage cannot supply.

**Does not carry artwork.** The textbook's illustrations belong to their illustrator, and an app published at a public URL is not a classroom screen. More to the point, the unit's own task is for the child to imagine the next scene, so the child draws each character. The kit says so in its own footer, next to the credit.

## The three rows

- **누가 나올까요** — picking a character reserves its name and kind, then opens the picture picker. The cutout editor's name field is already filled in when the child's drawing arrives, and the reservation clears once used. Choosing nothing changes nothing: the picker still names a drawing after its file.
- **어디에서 일어날까요** — picking a place renames the current scene, so the scene list and the movie dialog read as the story's own beats.
- **어떤 마음일까요** — picking a mood applies one of the six built-in tracks to this scene only (무서움→긴장, 걱정→슬픈, 반가움→신나는, 안심→잔잔한). This is the same picker the 12차시 lesson teaches, reached one tap sooner.

## Adding a kit

Append to `storyKits`. `credit` and `lesson` are printed with the kit and are not optional — a kit names its work. Mood `trackId`s must match `musicPresets` ids in `drawing-music.ts`. Only the first kit is shown today; a picker belongs here once a second one exists.

## Verified

Headless Chromium: the kit opens and closes, a place renames the scene, a mood applies its track, and picking 작은방울 then uploading a drawing lands 작은방울 with kind 동물 in the cutout editor. Desktop and 390px both render without horizontal overflow, and no page errors.
