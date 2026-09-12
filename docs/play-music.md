# MOAKIT PLAY music

The raster DrawingStudio entry point owns this feature. The legacy SVG character editor is unchanged and is not reintroduced into navigation.

## Included audio and provenance

All six presets (신나는, 잔잔한, 모험, 긴장, 귀여운, 슬픈) are original procedural miniatures authored for this change on 2026-09-08. Their complete source scores, tempos, oscillator synthesis and PCM WAV encoder are in `apps/play-studio/lib/drawing-music.ts` (`musicPresets`, `synthMusic`). Run `node scripts/generate-play-music.mjs` to reproduce the six committed WAV files in `apps/play-studio/public/play-music/`. They contain no recordings, samples, downloaded assets, or copied third-party melodies. No external music license or attribution is required for these generated sounds; no third-party rights are asserted or relicensed. Each preset is 32 beats (about 15–32 seconds), with a synthesized melody and bass. They are simple instrumental loops, not full arranged songs.

## Storage and limits

- Optional version-1 fields preserve older project compatibility. `project.music` is common music; absent scene music inherits it; `scene.music: null` means silence; an object overrides it.
- `musicAssets` stores each uploaded audio data URL once. Scenes only hold a track ID, volume (0–1) and loop flag. Apply-to-all clears overrides and also covers subsequently added scenes.
- Upload: at most 3,000,000 bytes and 120 seconds per file; supported extensions MP3/WAV/M4A/AAC/OGG/WebM/FLAC, subject to actual browser codec support. Metadata loading rejects unreadable/unsupported media and times out after 10 seconds. No transcoding or uploading to a server occurs.
- At most six referenced upload assets and 8,000,000 base64 characters (about 6MB binary) per project. Applying music prunes unreferenced audio. Repeated apply-to-all does not copy audio per scene. Undo history retains existing immutable asset strings, not serialized audio copies.
- IndexedDB auto-save and the JSON project backup both include uploads. Total imported project file limit is 20MB (previously 12MB), alongside the unchanged 10MB raster budget. Restore validates references, settings, MIME/data URL format and per-asset/aggregate limits. Corrupt projects do not replace existing work.
- Device storage remains subject to browser quota/eviction; the existing save-failure notice directs users to export a project file. Wait for ‘이 기기에 저장됨’ before closing. PNG remains a silent still image; recorded voices and movie export are covered in `play-voice-movie.md`.

## Playback

One reusable HTMLAudioElement owns stage audio. Play and presentation buttons call `play()` synchronously from the user gesture. No restored project auto-starts audio. Pause retains audio and motion time; reset/edit/presentation-exit clears both. A playing scene switch resets motion; scene-specific tracks switch, while inherited common music keeps its existing media element, source and playhead. Common non-looping music does not restart at scene boundaries. There is no crossfade between different tracks.

Music dialog opening pauses stage playback. Preview owns a separate player that is stopped on selection changes, apply, close, unmount or tab hiding. Browser hiding pauses stage playback too. Native modal dialog provides focus containment and Escape; focus returns to the music button. Media errors are shown without deleting the user's project.

Technical references: [Next.js client boundary](https://nextjs.org/docs/app/api-reference/directives/use-client), [HTMLMediaElement.play](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play).

## Verification

Run the app build, then `pnpm exec tsx scripts/play-music-qa.mjs` from the repository root (tsx is a root development dependency). Set `PLAY_QA_URL` to test a running build/production. The test uses actual Chromium and WebKit media elements, project downloads/imports, IndexedDB restore, and responsive screenshots. The existing `play-speech-qa.mjs` remains the dialogue/raster regression suite.

The Windows Playwright WebKit engine used for this change plays HTTP WAV files but fails data/blob audio URLs, including a standalone native Audio probe. The WebKit suite therefore verifies actual built-in music playback, playback transitions, responsive UI, upload-error handling and uploaded data persistence, but **does not claim uploaded-audio playback passed**. Chromium verifies real WAV uploads and playback. Physical Safari/iPhone/iPad and additional uploaded MP3/M4A/AAC codec combinations remain unverified; availability depends on the browser's decoder. No media calls are mocked to hide this limitation. See [Playwright browser/platform media differences](https://playwright.dev/docs/browsers).

The app-specific lockfile is committed and Vercel uses frozen installation so deployment uses the dependency versions validated locally.
