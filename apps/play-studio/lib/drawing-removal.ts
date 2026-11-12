import {newDrawingScene,type DrawingProject} from './drawing-project';

/** Keep assets for reuse/undo; an empty final slot lets a child start again. */
export function deleteDrawingScene(project:DrawingProject,sceneId:string):DrawingProject{
 const index=project.scenes.findIndex(s=>s.id===sceneId);if(index<0)return project;
 const remaining=project.scenes.filter(s=>s.id!==sceneId);
 const scenes=remaining.length?remaining:[newDrawingScene(sceneId,'장면 1')];
 const activeSceneId=project.activeSceneId===sceneId?scenes[Math.max(0,index-1)]?.id??scenes[0].id:project.activeSceneId;
 // Whole-story audio contains dialogue from the removed scene. Keep the recording,
 // but switch to scene audio until the teacher chooses a new whole-story timeline.
 return {...project,scenes,activeSceneId,...(project.narration?{narration:{...project.narration,enabled:false}}:{})};
}

/** Remove every reference to a library picture without touching audio or other drawings. */
export function removeDrawingAsset(project:DrawingProject,assetId:string):DrawingProject{
 if(!project.assets.some(a=>a.id===assetId))return project;
 return {...project,assets:project.assets.filter(a=>a.id!==assetId),scenes:project.scenes.map(scene=>{
  const backgroundRemoved=scene.backgroundAssetId===assetId,originalRemoved=scene.stillOriginalAssetId===assetId;
  return {...scene,items:scene.items.filter(item=>item.assetId!==assetId).map(item=>item.separation?.sourceAssetId===assetId?{...item,separation:undefined}:item),
   ...(backgroundRemoved?{backgroundAssetId:undefined}:{}),
   ...(backgroundRemoved||originalRemoved?{stillOriginalAssetId:undefined,protectedMask:undefined}:{})};
 })};
}

/** Take the background off this stage, leaving the picture available in the library. */
export function removeSceneBackground(project:DrawingProject,sceneId:string):DrawingProject{
 if(!project.scenes.some(s=>s.id===sceneId&&s.backgroundAssetId))return project;
 return {...project,scenes:project.scenes.map(s=>s.id===sceneId?{...s,backgroundAssetId:undefined,stillOriginalAssetId:undefined,protectedMask:undefined}:s)};
}
