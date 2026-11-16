import type {DrawingProject} from './drawing-project';
import {effectiveMusic} from './drawing-music';
import {movieTimeline} from './drawing-movie';
import {activeNarration} from './film-narration';
import {sceneNarration} from './group-project';

/** Make a separate, single-scene file for the teacher while keeping the editor's full project. */
export async function submitSceneSnapshot(project: DrawingProject, sceneId: string): Promise<DrawingProject> {
 const scene = project.scenes.find(candidate => candidate.id === sceneId);
 if (!scene) throw new Error('보낼 장면을 다시 골라 주세요.');

 const assets = new Set([scene.backgroundAssetId, scene.stillOriginalAssetId]);
 for (const item of scene.items) {
  assets.add(item.assetId);
  assets.add(item.separation?.sourceAssetId);
 }
 const track = effectiveMusic(project, scene);
 const result: DrawingProject = {
  ...project,
  activeSceneId: scene.id,
  scenes: [scene],
  assets: project.assets.filter(asset => assets.has(asset.id)),
  music: scene.music === undefined ? project.music : undefined,
  musicAssets: project.musicAssets?.filter(asset => asset.id === track?.trackId),
  narration: undefined,
 };

 const narration = activeNarration(project);
 if (!narration) return result;

 const duration = movieTimeline(project).find(step => step.scene.id === scene.id)!.seconds;
 // Preserve a one-scene recording directly. Larger projects only send this scene's clip.
 const clip = project.scenes.length === 1 ? narration : (await sceneNarration(project, scene.id)).get(scene.id);
 const voice = clip && {...clip, duration: Math.min(duration, clip.duration)};
 return {...result, scenes: [{...scene, voice, durationSeconds: Math.min(600, duration)}]};
}

/** Older submissions could contain the entire story even though they occupied a single slot. */
export async function savedSceneSnapshot(project: DrawingProject, sceneNo: number): Promise<DrawingProject> {
 if (project.scenes.length === 1) return project;
 const scene = project.scenes[sceneNo - 1] ?? project.scenes.find(candidate => candidate.id === project.activeSceneId);
 return submitSceneSnapshot(project, scene?.id ?? project.scenes[0]?.id ?? '');
}
