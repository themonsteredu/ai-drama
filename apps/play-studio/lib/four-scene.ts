import {drawingId,emptyDrawingProject,newDrawingScene,validateDrawingProject,type DrawingProject,type DrawingAsset} from './drawing-project';
import {rasterImage} from './drawing-media';
export function emptyFourSceneProject():DrawingProject{
 const scenes=Array.from({length:4},(_,i)=>({...newDrawingScene(`film-scene-${i+1}`,`장면 ${i+1}`),backgroundFit:'contain' as const}));
 return {...emptyDrawingProject(),id:'four-scene-starter',title:'우리의 네 장면 이야기',activeSceneId:scenes[0].id,scenes};
}
export function prepareFourScenes(project:DrawingProject):DrawingProject{
 const scenes=[...project.scenes];
 while(scenes.length<4)scenes.push(newDrawingScene(drawingId('scene'),`장면 ${scenes.length+1}`));
 return {...project,scenes};
}
export function putScenePicture(project:DrawingProject,sceneId:string,picture:Pick<DrawingAsset,'source'|'width'|'height'>):DrawingProject{
 const scene=project.scenes.find(s=>s.id===sceneId);
 if(!scene)throw new Error('장면을 찾지 못했어요.');
 const id=drawingId('still');
 const asset:DrawingAsset={...picture,id,kind:'background',name:scene.title};
  const scenes=project.scenes.map(s=>s.id===sceneId?{...s,backgroundAssetId:id,stillOriginalAssetId:id,protectedMask:undefined,backgroundFit:'contain' as const}:s);
  const next={...project,scenes,assets:[...project.assets,asset]};
  if(!validateDrawingProject(next))throw new Error('그림 보관함의 개수 또는 용량 한도에 도달했어요. 기존 작품은 그대로 보관했어요.');
  return next;
}
/** Mask black pixels are copied byte-for-byte from the normalized original. */
export async function preserveCharacters(original:string,edited:string,mask:string){
 const [a,b,m]=await Promise.all([rasterImage(original),rasterImage(edited),rasterImage(mask)]);
 const c=document.createElement('canvas');c.width=a.naturalWidth;c.height=a.naturalHeight;
 const ctx=c.getContext('2d',{willReadFrequently:true});if(!ctx)throw new Error('그림 도구를 열지 못했어요.');
 ctx.drawImage(a,0,0);const first=ctx.getImageData(0,0,c.width,c.height);
 ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(m,0,0,c.width,c.height);const protection=ctx.getImageData(0,0,c.width,c.height);
 ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(b,0,0,c.width,c.height);const result=ctx.getImageData(0,0,c.width,c.height);
 for(let i=0;i<result.data.length;i+=4)if(protection.data[i]<128)result.data.set(first.data.subarray(i,i+4),i);
 ctx.putImageData(result,0,0);
 const source=c.toDataURL('image/png');
 if(source.length>4_000_000)throw new Error('결과 그림이 너무 커요. 더 작은 원본 그림으로 다시 해 주세요. 원본은 그대로예요.');
 return {source,width:c.width,height:c.height};
}
