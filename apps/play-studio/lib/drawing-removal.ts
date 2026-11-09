import type {DrawingProject} from './drawing-project';

/** Remove every reference to a library picture without touching audio or other drawings. */
export function removeDrawingAsset(project:DrawingProject,assetId:string):DrawingProject{
 if(!project.assets.some(a=>a.id===assetId))return project;
 return {...project,assets:project.assets.filter(a=>a.id!==assetId),scenes:project.scenes.map(scene=>{
  const backgroundRemoved=scene.backgroundAssetId===assetId,originalRemoved=scene.stillOriginalAssetId===assetId;
  return {...scene,items:scene.items.filter(item=>item.assetId!==assetId),
   ...(backgroundRemoved?{backgroundAssetId:undefined}:{}),
   ...(backgroundRemoved||originalRemoved?{stillOriginalAssetId:undefined,protectedMask:undefined}:{})};
 })};
}

/** Take the background off this stage, leaving the picture available in the library. */
export function removeSceneBackground(project:DrawingProject,sceneId:string):DrawingProject{
 if(!project.scenes.some(s=>s.id===sceneId&&s.backgroundAssetId))return project;
 return {...project,scenes:project.scenes.map(s=>s.id===sceneId?{...s,backgroundAssetId:undefined,stillOriginalAssetId:undefined,protectedMask:undefined}:s)};
}
