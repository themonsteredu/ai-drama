# 내 그림 움직이기 — /draw

A separate child-friendly entry within apps/play-studio. Existing / editor and classic root src app remain intact.

## Implemented scope

- Raster-only JPEG/PNG/WebP upload, camera picker, resized local processing; no drawing uploads to a server.
- Optional border-connected near-white cleanup and transparent-margin trim with preview. Not semantic background removal.
- Drawing categories: person, animal, plant, nature, prop, background.
- Whole-drawing move, hop, bounce, float; plant-root-anchored texture-band bend; stylized whole-image swimming.
- Point-to-destination paths plus keyboard-accessible direction controls, play/pause/reset. Playback does not change source positions.
- Wind, rain, snow, strength and direction; wind bends drawings classified as plants. No automatic hair/fur detection.
- Six scenes, forty items per scene, twelve unique raster assets with capped data sizes; original colors/lines are kept subject to resampling/compression.
- Separate IndexedDB document storage and validated .moakit-drawing.json portable backups; static PNG output 2560×1440.
- No server credentials, database migrations, third-party AI inference or paid API are required.

## Honest limits

Animal/human articulated walking, wing/fin joints, automatic character rigging and video export are NOT implemented. Move means whole-image translation, not a generated walk cycle. The stored drawing format is separate from the older .moakit.json format to protect existing work. Storage is per browser/origin; backups are needed to move devices. White-paper cleanup may erase pale connected regions: default off and reversible before adding.

## Verification

scripts/play-drawings-qa.mjs runs real Chromium and WebKit upload, cleanup, animation, drag, history, weather, scenes, backup/import, malformed-file rejection, PNG and responsive checks. Test success must be confirmed from CI; this document is not a test result.
