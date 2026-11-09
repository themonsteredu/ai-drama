import {drawingId,validateDrawingProject,type DrawingProject,type DrawingScene,type DrawingItem} from './drawing-project';
import {rasterImage} from './drawing-media';

export function selectedCharacterPixels(original:Uint8ClampedArray,marks:Uint8ClampedArray,width:number,height:number){
 const data=new Uint8ClampedArray(original);let left=width,top=height,right=-1,bottom=-1;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*4;
  if(marks[i]<128&&data[i+3]){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
  else data[i+3]=0;
 }
 if(right<left)throw new Error('움직일 주인공을 먼저 칠해 주세요.');
 return {data,left,top,width:right-left+1,height:bottom-top+1};
}

/** Original RGB is copied, never regenerated. Black selection pixels become the actor. */
export async function cutSceneCharacter(source:string,selection:string){
 const [image,mask]=await Promise.all([rasterImage(source),rasterImage(selection)]);
 const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
 const ctx=canvas.getContext('2d',{willReadFrequently:true})!;
 ctx.drawImage(mask,0,0,canvas.width,canvas.height);const marks=ctx.getImageData(0,0,canvas.width,canvas.height).data;
 ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
 const selected=selectedCharacterPixels(pixels.data,marks,canvas.width,canvas.height),{left,top}=selected;
 pixels.data.set(selected.data);
 ctx.putImageData(pixels,0,0);
 const cropped=document.createElement('canvas');cropped.width=selected.width;cropped.height=selected.height;
 cropped.getContext('2d')!.drawImage(canvas,left,top,cropped.width,cropped.height,0,0,cropped.width,cropped.height);
 return {source:cropped.toDataURL('image/png'),width:cropped.width,height:cropped.height,left,top,fullWidth:canvas.width,fullHeight:canvas.height};
}

export function actorPlacement(scene:DrawingScene,cut:{left:number;top:number;width:number;height:number;fullWidth:number;fullHeight:number}){
 const scale=scene.backgroundFit==='cover'?Math.max(1280/cut.fullWidth,720/cut.fullHeight):Math.min(1280/cut.fullWidth,720/cut.fullHeight);
 const x=((1280-cut.fullWidth*scale)/2+(cut.left+cut.width/2)*scale)/1280*100;
 const y=((720-cut.fullHeight*scale)/2+(cut.top+cut.height)*scale)/720*100;
 const width=cut.width*scale/1280*100;
 if(x<0||x>100||y<0||y>100||width>100||width<.1)throw new Error('그림 전체가 보이도록 배경을 맞춘 다음 다시 분리해 주세요.');
 return {x,y,width};
}

export async function separateSceneCharacter(project:DrawingProject,sceneId:string,selection:string,background:string,name:string){
 const scene=project.scenes.find(s=>s.id===sceneId),original=project.assets.find(a=>a.id===scene?.backgroundAssetId);
 if(!scene||!original)throw new Error('장면 그림을 먼저 올려 주세요.');
 const cut=await cutSceneCharacter(original.source,selection),actorId=drawingId('scene-actor'),backgroundId=drawingId('scene-clean');
 const item:DrawingItem={id:drawingId('drawing'),assetId:actorId,...actorPlacement(scene,cut),rotation:0,flipped:false,motion:'still',speed:'normal',speech:''};
 const assets=[...project.assets,{id:actorId,name:name.trim().slice(0,40)||'주인공',kind:'person' as const,source:cut.source,width:cut.width,height:cut.height},{id:backgroundId,name:`${scene.title} 빈 배경`.slice(0,40),kind:'background' as const,source:background,width:cut.fullWidth,height:cut.fullHeight}];
 const next={...project,assets,scenes:project.scenes.map(s=>s.id!==sceneId?s:{...s,backgroundAssetId:backgroundId,stillOriginalAssetId:backgroundId,protectedMask:undefined,items:[...s.items,item]})};
 if(!validateDrawingProject(next))throw new Error('작품 보관 용량이 부족해요. 원본은 그대로 보관했어요.');
 return {project:next,itemId:item.id};
}
