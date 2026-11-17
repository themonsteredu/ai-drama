# Whole-scene characters and continuous dialogue

The existing DrawingStudio remains the editor at `/draw` and `/film`. The latter keeps its earlier separate device-local project. No legacy project or feature is replaced.

## Character separation

Upload a whole scene, choose **주인공만 따로 움직이기**, and paint exactly one character. The current scene image and transparent removal mask go to the existing authenticated GPT image route. Only the selected region is replaced with reconstructed background; all other background pixels are copied back from the current image. The actor is an original-pixel PNG cutout placed at the same stage coordinates, including contain/cover scaling. After inspection and application, the normal motion/destination/size controls work. Repeat for another character. Selection is manual; AI does not reliably infer the desired character. Poorly selected edges or inpainting remnants require correction before applying. Original source assets and undo remain available.

## Whole recording

The optional `project.narration` stores the original normalized mono WAV, optional generated WAV, scene durations, editable role assignments and cached speech clips. Existing scene recordings remain in their original fields. Whole recordings up to ten minutes / 40 MB are decoded locally and normalized to 16 kHz mono. Preview uses the narration playback position for scene selection. Export schedules the whole voice once, without restarting it at cuts. A shortened last scene cannot truncate remaining dialogue. Switching audio versions redistributes scene times and asks for review.

The timing panel supports numeric durations and **지금부터 N장면** while listening. Changes to a boundary preserve the next boundary. Every scene must retain at least one second.

## AI dialogue

The same encrypted shared API key and teacher session are used. No keys enter project backups. `/api/film-dialogue` checks origin, session/PIN and persistent per-IP limits. Supported actions:

- `transcribe`: bounded PCM/WAV chunks to `gpt-transcribe`; successful parts are cached. Quiet boundaries near the upload limit reduce word splitting.
- `assign`: `gpt-6-luna`, low reasoning, strict structured output, `store:false`; preserve transcript words and propose role/scene assignments. Teacher review is necessary.
- `speak`: one server-side `gpt-realtime-2.1-mini` WebSocket per short line, with a fixed built-in voice, no tools or conversation history, 24 kHz mono PCM output. Requests have duration, size and cancellation bounds. No deprecated Speech endpoint model is used.

Roles can be added individually up to 30 and removed when no lines refer to them. Ten built-in voices can be assigned independently, with reuse across roles. Adding or removing an unused role preserves all other line assignments and cached clips. Lines are editable and can be entered without transcription. Previously completed clips are reused only when their text and voice match. Partial work persists; no automatic paid-request retries. The original recording is always available. AI-created voice is disclosed in the editor and movie dialog. This is generated speech from text, not preservation or cloning of a child's voice.

## Validation

Run app `typecheck` and `build`, `scripts/four-scene-logic-qa.mjs`, `scripts/play-gpt-settings-qa.mjs`, and `scripts/play-narration-qa.mjs`. New tests cover pixel preservation/placement, continuous timeline and legacy compatibility, malformed timing, WAV formatting, two/three voice routing, incomplete generation, auth/CSRF/rate limits and secret non-disclosure. Provider calls are mocked. Real generation quality and model permissions require an operator-provided key. Physical iPad export remains a device-specific check.

API references checked 2026-11-10: OpenAI image generation, file transcription, Realtime conversations/client events, GPT-6 Luna and structured output documentation. Work files remain device-local; only API settings are shared between devices.

Production browser QA imported an actual 12-second tone recording, changed the first scene from 3 to 4 seconds, and exported a 13-second 1280×720 WebM. Audio FFT checks at 1/4.5/7.5/10.5 seconds found 400/500/600/700 Hz respectively, proving the source recording continued across scene cuts. The three-role editor, persistent manual line assignment and character-selection brush were exercised. Paid generation remained disabled because the shared GPT key was not configured.
