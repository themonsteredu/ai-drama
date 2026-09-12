# MOAKIT PLAY voice and movie

The raster DrawingStudio entry point owns both features. The legacy SVG character editor is unchanged.

Together they close the loop a classroom needs: a child records what their drawing says, the scenes play through on their own, and the result leaves the tablet as one file.

## Recording a voice

- One voice per scene, stored at `scene.voice` as `{id, source, duration}`. The field is optional, so version-1 projects written before this change still validate and load unchanged.
- `startVoiceRecording` (`lib/drawing-voice.ts`) asks for the microphone, picks the first supported recorder MIME from `audio/webm;codecs=opus`, `audio/webm`, `audio/mp4`, `audio/mp4;codecs=mp4a.40.2`, `audio/aac`, `audio/ogg;codecs=opus`, and records at 64 kbps mono. Android Chrome lands on webm/opus, iPad Safari on mp4/aac.
- Length comes from the wall clock, never from the file: a webm take from MediaRecorder carries no duration and reads back as `Infinity`. Recording auto-stops at `VOICE_MAX_SECONDS` (20).
- Limits: 1,400,000 bytes per take, 6,000,000 base64 characters across a project. `applyVoice` refuses a take that would push the project over the total.
- `validateVoices` runs inside `validateDrawingProject`, so an imported file cannot smuggle in oversized, mistyped or unplayable audio. IndexedDB auto-save and the JSON project backup both carry voices.
- Permission denial, a missing microphone and a device already using it each get their own plain-Korean message. A device with no `MediaRecorder` or `getUserMedia` shows a panel that says so instead of a dead button.
- Nothing is uploaded. The take is read into a data URL in the browser and stays in the project.

## Playing the story through

`playStory` in `use-drawing-editor.ts` walks the scenes in order. A scene lasts `sceneSeconds`: its voice length plus a `VOICE_LEAD` (0.25 s) head start and a `SCENE_PAD` (0.7 s) breath, floored at `SCENE_MIN` (2.5 s); a silent scene runs `SCENE_SILENT` (4 s). Music plays through the existing `DrawingMusicPlayer`, the voice through a separate `VoicePlayer`, so a scene change never leaves an earlier take talking. Any edit, `stop()`, or unmount ends the run.

## Saving a movie

`recordMovie` (`lib/drawing-movie.ts`) draws the story onto an off-screen 1280×720 canvas, takes `canvas.captureStream(30)`, and mixes audio in Web Audio rather than through media elements: every track is decoded once up front with `decodeAudioData` and scheduled as `AudioBufferSourceNode`s, which is sample-accurate and cannot stall mid-capture. Audio goes to both a `MediaStreamDestination` (recorded) and the speakers (heard). Capture is real time — a MediaRecorder cannot run faster than the story does.

- Container preference: `video/mp4;codecs=avc1…` first, then webm VP8/VP9, and bare `video/mp4` last. A browser with no H.264 encoder answers yes to bare `video/mp4` and then writes VP9 inside an `.mp4` that many players refuse, so plain webm is the honest fallback there. iPad, which cannot record webm at all, still lands on MP4.
- `recorder.start()` takes no timeslice on purpose. Asking for chunks makes Chrome omit the header's `Duration` field entirely and the saved movie then reports no length.
- `stampWebmDuration` fills in that header field afterwards. Chrome writes a 1 ms placeholder at its final size, so replacing the value moves no other byte. The Info element is located by ID, skipping the copy that appears only as a SeekHead pointer.
- A take recorded on one kind of tablet may not decode on another; that loses a voice, not the movie, and the result says how many were lost.
- `movieSupported()` gates the whole path. Where it is false the dialog replaces the save button with iPad and Galaxy screen-recording steps, which pair with 처음부터 쭉 보기. A child never presses a button that does nothing.

## Verified

Headless Chromium, fake media device: a two-scene story exported to a 1280×720 webm of 5.95 s carrying one audio track and non-blank frames; voices round-trip through the project file; a project file with the `voice` fields stripped still loads; PNG save, undo/redo, music and presentation are unchanged. Real iPad and Galaxy behaviour is not covered by this and needs a device check.
