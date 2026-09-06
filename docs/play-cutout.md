# MOAKIT PLAY photo cutout

The `/draw` image picker opens a child-friendly, non-destructive crop and mask editor. It is not a generated mockup and it does not replace uploaded drawings with vector characters.

## Controls
- Rectangle crop by dragging or four corner handles (also arrow-key accessible).
- Erase / restore strokes, brush width, 2× zoom with a scrollable viewport.
- Original comparison, local undo / redo, full original reset, crop-to-visible-content.
- Optional white-paper cleanup (border-connected bright colours; not AI).
- Background removal with OpenCV GrabCut in a cancellable dedicated worker. Input is downsampled to a maximum side of 480 pixels for CPU cost; the cutout mask is scaled back to the original working image. A tight rectangle and manual touch-up are important for busy backgrounds, hair and similarly coloured subjects. No semantic person/animal recognition is claimed.
- OpenCV runtime: pinned `@techstark/opencv-js@4.10.0-release.1/dist/opencv.js` from jsDelivr. Apache-2.0: https://github.com/TechStark/opencv-js/blob/main/LICENSE ; upstream https://github.com/opencv/opencv/blob/4.x/LICENSE . Runtime source contains its license notice. Only library code is fetched. Image pixels stay in the browser; no external inference service is called. Network/worker failure preserves the current mask and leaves crop/manual tools usable.

## Storage and compatibility
The optional `DrawingAsset.edit` holds a normalized/resized editing original, full-resolution grayscale PNG mask, source dimensions and crop rectangle. It is not the exact original camera file: `readDrawingImage` already normalizes the upload. `source` is the composited transparent PNG; very large output is downscaled to the existing per-image limit. Crop and brushes never alter the editing original. The same asset can be reopened from `다시 다듬기`; applying changes updates all placements of that asset without changing motion, position or scene IDs. Existing version-1 assets without edit metadata remain valid.

Original + mask + rendered image all count towards the existing 10MB asset budget and 12MB backup limit. URLs, malformed edit metadata and out-of-bounds crops are rejected on import. Both files and IndexedDB retain the edit metadata. Old A4/export code and the classic root app are not migrated or replaced.

## Deliberate boundaries
No HEIC conversion, semantic AI cutout, generated missing body parts, skeletal walking or video export is introduced. Cancellation does not mutate the stored project. Final QA results are recorded separately after checks run.
