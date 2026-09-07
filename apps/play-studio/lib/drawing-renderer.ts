import {drawingFrame,type DrawingProject,type DrawingScene,type DrawingItem} from './drawing-project';
import {drawAtmosphere} from './drawing-weather';
import {renderDrawingSpeech,speechViewFor,type SpeechView,type SpeechActor} from './drawing-speech';
export const DRAW_WIDTH=1280,DRAW_HEIGHT=720;
export type RasterCache=Map<string,HTMLImageElement>;
function wrap(ctx:CanvasRenderingContext2D,text:string,width:number){const lines:string[]=[];let line='';for(const c of text){if(c==='\n'){lines.push(line);line='';continue;}if(ctx.measureText(line+c).width>width&&line){lines.push(line);line=c;}else line+=c;}if(line)lines.push(line);return lines;}
export function drawDrawingScene(ctx:CanvasRenderingContext2D,p:DrawingProject,scene:DrawingScene,images:RasterCache,seconds=0,selectedId?:string,showTarget=false,speechView:SpeechView=speechViewFor(scene),interactiveSpeech=false){
 const w=DRAW_WIDTH,h=DRAW_HEIGHT;ctx.clearRect(0,0,w,h);ctx.fillStyle='#ffffff';ctx.fillRect(0,0,w,h);
 const bg=scene.backgroundAssetId?images.get(scene.backgroundAssetId):undefined;
 if(bg){const r=scene.backgroundFit==='cover'?Math.max(w/bg.naturalWidth,h/bg.naturalHeight):Math.min(w/bg.naturalWidth,h/bg.naturalHeight);const bw=bg.naturalWidth*r,bh=bg.naturalHeight*r;ctx.drawImage(bg,(w-bw)/2,(h-bh)/2,bw,bh);}
 const bubbles:SpeechActor[]=[];
 for(const item of scene.items){
  const a=p.assets.find(a=>a.id===item.assetId),image=images.get(item.assetId);if(!a||!image)continue;
  const f=drawingFrame(item,seconds),iw=item.width/100*w,ih=iw*a.height/a.width,x=f.x/100*w,y=f.y/100*h,isPlant=a.kind==='plant';
  ctx.save();ctx.translate(x,y);ctx.rotate((isPlant?item.rotation:f.angle)*Math.PI/180);ctx.scale(item.flipped?-1:1,1);
  if(isPlant&&(item.motion==='sway'||scene.weather==='wind')){
   const wind=scene.weather==='wind',amp=iw*(wind&&scene.strength==='strong'?.12:.06),dir=scene.wind==='left'?-1:1;
   const breeze=wind?dir*(1-Math.cos(seconds*1.7))*.65:Math.sin(f.phase*2);
   for(let j=0;j<64;j++){const top=j/64,srcY=top*image.naturalHeight,srcH=Math.min(image.naturalHeight-srcY,image.naturalHeight/64+1),bend=amp*(1-top)*(1-top)*breeze;ctx.drawImage(image,0,srcY,image.naturalWidth,srcH,-iw/2+bend,-ih+top*ih,iw,ih/64+1);}
  }else if(item.motion==='swim'){
   for(let j=0;j<48;j++){const u=j/48,sx=u*image.naturalWidth,shift=Math.sin(f.phase*3.2-u*4)*ih*.055*Math.sin(f.phase);ctx.drawImage(image,sx,0,Math.min(image.naturalWidth-sx,image.naturalWidth/48+1),image.naturalHeight,-iw/2+u*iw,-ih+shift,iw/48+1,ih);}
  }else ctx.drawImage(image,-iw/2,-ih,iw,ih);
  if(item.id===selectedId){ctx.strokeStyle='#288fe7';ctx.lineWidth=3;ctx.setLineDash([10,7]);ctx.strokeRect(-iw/2-6,-ih-6,iw+12,ih+12);ctx.setLineDash([]);}
  ctx.restore();if(item.speech)bubbles.push({id:item.id,name:a.name,text:item.speech,x,y,width:iw,height:ih});
  if(showTarget&&item.id===selectedId&&item.target){ctx.save();ctx.strokeStyle='#288fe7';ctx.lineWidth=3;ctx.setLineDash([8,8]);ctx.beginPath();ctx.moveTo(item.x/100*w,item.y/100*h);ctx.lineTo(item.target.x/100*w,item.target.y/100*h);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.arc(item.target.x/100*w,item.target.y/100*h,13,0,Math.PI*2);ctx.stroke();ctx.font='500 22px "S-Core Dream",sans-serif';ctx.fillStyle='#24659c';ctx.fillText('도착',Math.min(w-65,item.target.x/100*w+18),Math.max(28,item.target.y/100*h));ctx.restore();}
 }
 drawAtmosphere(ctx,scene,seconds);
 let captionBottom=0;
 if(scene.caption){ctx.save();ctx.font='500 24px "S-Core Dream",sans-serif';const lines=wrap(ctx,scene.caption,w-100);captionBottom=20+lines.length*32+24;ctx.fillStyle='rgba(255,255,255,.92)';ctx.fillRect(20,20,w-40,lines.length*32+24);ctx.fillStyle='#20364f';lines.forEach((line,i)=>ctx.fillText(line,44,53+i*32));ctx.restore();}
 return renderDrawingSpeech(ctx,bubbles,speechView,w,h,captionBottom,interactiveSpeech);
}
export function hitDrawing(p:DrawingProject,s:DrawingScene,x:number,y:number):DrawingItem|undefined{return [...s.items].reverse().find(i=>{const a=p.assets.find(a=>a.id===i.assetId);if(!a)return false;const dx=(x-i.x)*12.8,dy=(y-i.y)*7.2,angle=-i.rotation*Math.PI/180,lx=dx*Math.cos(angle)-dy*Math.sin(angle),ly=dx*Math.sin(angle)+dy*Math.cos(angle),w=i.width*12.8,h=w*a.height/a.width;return Math.abs(lx)<=w/2&&ly<=8&&ly>=-h;});}
