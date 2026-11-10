import {drawingId,validateDrawingProject,type DrawingAsset,type DrawingProject} from './drawing-project';
import {rasterImage} from './drawing-media';
type Direction=-1|1;

/** Integer quarter-turns keep all original RGBA values and avoid clipping portrait pictures. */
export function quarterTurnPixels(data:Uint8ClampedArray,width:number,height:number,direction:Direction){
 const rotated=new Uint8ClampedArray(data.length);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const nx=direction===1?height-1-y:y,ny=direction===1?x:width-1-x;
  rotated.set(data.subarray((y*width+x)*4,(y*width+x)*4+4),(ny*height+nx)*4);
 }
 return {data:rotated,width:height,height:width};
}
export async function rotateRaster(source:string,direction:Direction){
 const image=await rasterImage(source),canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw new Error('그림 회전 도구를 열지 못했어요.');
 ctx.drawImage(image,0,0);const rotated=quarterTurnPixels(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height,direction);
 canvas.width=rotated.width;canvas.height=rotated.height;const pixels=ctx.createImageData(canvas.width,canvas.height);pixels.data.set(rotated.data);ctx.putImageData(pixels,0,0);
 return {source:canvas.toDataURL('image/png'),width:canvas.width,height:canvas.height};
}
async function rotateAsset(asset:DrawingAsset,direction:Direction):Promise<DrawingAsset>{
 const rotated=await rotateRaster(asset.source,direction);let edit=asset.edit;
 if(edit){
  const original=await rotateRaster(edit.original,direction),mask=await rotateRaster(edit.mask,direction),c=edit.crop;
  const crop={x:direction===1?edit.height-c.y-c.height:c.y,y:direction===1?c.x:edit.width-c.x-c.width,width:c.height,height:c.width};
  edit={...edit,width:original.width,height:original.height,original:original.source,mask:mask.source,crop};
 }
 return {...asset,...rotated,edit};
}
/** Replace only this scene's background/original; shared library assets are copied first. */
export function applyRotatedBackground(project:DrawingProject,sceneId:string,rotated:Map<string,DrawingAsset>,protectedMask?:string){
 const scene=project.scenes.find(s=>s.id===sceneId);if(!scene)throw new Error('장면을 찾지 못했어요.');
 const assets=[...project.assets],ids=new Map<string,string>();
 for(const [id,asset] of rotated){
  const shared=project.scenes.some(s=>s.items.some(i=>i.assetId===id)||(s.id!==sceneId&&(s.backgroundAssetId===id||s.stillOriginalAssetId===id)));
  const nextId=shared?drawingId('rotated'):id;ids.set(id,nextId);
  if(shared)assets.push({...asset,id:nextId});else assets[assets.findIndex(a=>a.id===id)]={...asset,id};
 }
 const next={...project,assets,scenes:project.scenes.map(s=>s.id===sceneId?{...s,backgroundAssetId:ids.get(s.backgroundAssetId!),stillOriginalAssetId:s.stillOriginalAssetId?ids.get(s.stillOriginalAssetId):undefined,protectedMask,backgroundFit:'contain' as const}:s)};
 if(!validateDrawingProject(next))throw new Error('회전한 그림을 보관할 공간이 부족해요. 보관함에서 쓰지 않는 그림을 삭제해 주세요. 기존 그림은 그대로예요.');
 return next;
}
export async function rotateSceneBackground(project:DrawingProject,sceneId:string,direction:Direction){
 const scene=project.scenes.find(s=>s.id===sceneId);if(!scene?.backgroundAssetId)return project;
 const ids=new Set([scene.backgroundAssetId,scene.stillOriginalAssetId].filter((id):id is string=>!!id)),rotated=new Map<string,DrawingAsset>();
 for(const id of ids){const asset=project.assets.find(a=>a.id===id);if(!asset)throw new Error('장면 그림을 찾지 못했어요.');rotated.set(id,await rotateAsset(asset,direction));}
 const mask=scene.protectedMask?(await rotateRaster(scene.protectedMask,direction)).source:undefined;
 return applyRotatedBackground(project,sceneId,rotated,mask);
}
