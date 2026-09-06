import {drawingFrame,type DrawingProject,type DrawingScene,type DrawingItem} from './drawing-project';
export const DRAW_WIDTH=1280,DRAW_HEIGHT=720;
export type RasterCache=Map<string,HTMLImageElement>;
function wrap(ctx:CanvasRenderingContext2D,text:string,width:number){const lines:string[]=[];let line='';for(const c of text){if(c==='\n'){lines.push(line);line='';continue;}if(ctx.measureText(line+c).width>width&&line){lines.push(line);line=c;}else line+=c;}if(line)lines.push(line);return lines;}
export function drawDrawingScene(ctx:CanvasRenderingContext2D,p:DrawingProject,scene:DrawingScene,images:RasterCache,seconds=0,selectedId?:string,showTarget=false){
  const w=DRAW_WIDTH,h=DRAW_HEIGHT;ctx.clearRect(0,0,w,h);ctx.fillStyle=scene.background;ctx.fillRect(0,0,w,h);
  const bg=scene.backgroundAssetId?images.get(scene.backgroundAssetId):undefined;
  if(bg){const r=scene.backgroundFit==='cover'?Math.max(w/bg.naturalWidth,h/bg.naturalHeight):Math.min(w/bg.naturalWidth,h/bg.naturalHeight);const bw=bg.naturalWidth*r,bh=bg.naturalHeight*r;ctx.drawImage(bg,(w-bw)/2,(h-bh)/2,bw,bh);}
  const bubbles:{item:DrawingItem;x:number;y:number;height:number}[]=[];
  for(const item of scene.items){
    const a=p.assets.find(a=>a.id===item.assetId),image=images.get(item.assetId);if(!a||!image)continue;
    const f=drawingFrame(item,seconds),iw=item.width/100*w,ih=iw*a.height/a.width,x=f.x/100*w,y=f.y/100*h,isPlant=a.kind==='plant';
    ctx.save();ctx.translate(x,y);ctx.rotate((isPlant?item.rotation:f.angle)*Math.PI/180);ctx.scale(item.flipped?-1:1,1);
    if(isPlant&&(item.motion==='sway'||scene.weather==='wind')){
      const amp=iw*(scene.strength==='strong'?.13:.065),direction=scene.wind==='left'?-1:1;
      const breeze=scene.weather==='wind'?direction*(1-Math.cos(f.phase*1.7))*.65:Math.sin(f.phase*2);
      // Texture bands preserve the raster drawing. The bottom/root stays fixed.
      for(let j=0;j<64;j++){const top=j/64,srcY=top*image.naturalHeight,srcH=Math.min(image.naturalHeight-srcY,image.naturalHeight/64+1);const bend=amp*(1-top)*(1-top)*breeze;ctx.drawImage(image,0,srcY,image.naturalWidth,srcH,-iw/2+bend,-ih+top*ih,iw,ih/64+1);}
    }else if(item.motion==='swim'){
      for(let j=0;j<48;j++){const u=j/48,sx=u*image.naturalWidth,shift=Math.sin(f.phase*3.2-u*4)*ih*.055*Math.sin(f.phase);ctx.drawImage(image,sx,0,Math.min(image.naturalWidth-sx,image.naturalWidth/48+1),image.naturalHeight,-iw/2+u*iw,-ih+shift,iw/48+1,ih);}
    }else ctx.drawImage(image,-iw/2,-ih,iw,ih);
    if(item.id===selectedId){ctx.strokeStyle='#16796c';ctx.lineWidth=3;ctx.setLineDash([10,7]);ctx.strokeRect(-iw/2-6,-ih-6,iw+12,ih+12);ctx.setLineDash([]);}
    ctx.restore();if(item.speech)bubbles.push({item,x,y,height:ih});
    if(showTarget&&item.id===selectedId&&item.target){ctx.save();ctx.strokeStyle='#16796c';ctx.lineWidth=3;ctx.setLineDash([8,8]);ctx.beginPath();ctx.moveTo(item.x/100*w,item.y/100*h);ctx.lineTo(item.target.x/100*w,item.target.y/100*h);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.arc(item.target.x/100*w,item.target.y/100*h,13,0,Math.PI*2);ctx.stroke();ctx.font='500 22px "S-Core Dream",sans-serif';ctx.fillStyle='#145e55';ctx.fillText('도착',Math.min(w-65,item.target.x/100*w+18),Math.max(28,item.target.y/100*h));ctx.restore();}
  }
  weather(ctx,scene,seconds);
  for(const b of bubbles){ctx.save();ctx.font='500 24px "S-Core Dream",sans-serif';const lines=wrap(ctx,b.item.speech,270),height=lines.length*32+30,width=302;const x=Math.max(8,Math.min(w-width-8,b.x-width/2)),y=Math.max(8,b.y-b.height-height-20);ctx.fillStyle='white';ctx.strokeStyle='#31483f';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(x,y,width,height,18);ctx.fill();ctx.stroke();ctx.fillStyle='#203d34';lines.forEach((line,i)=>ctx.fillText(line,x+16,y+34+i*32));ctx.restore();}
  if(scene.caption){ctx.save();ctx.font='500 24px "S-Core Dream",sans-serif';const lines=wrap(ctx,scene.caption,w-100);ctx.fillStyle='rgba(255,255,255,.9)';ctx.fillRect(20,20,w-40,lines.length*32+24);ctx.fillStyle='#17392c';lines.forEach((line,i)=>ctx.fillText(line,44,53+i*32));ctx.restore();}
}
function weather(ctx:CanvasRenderingContext2D,s:DrawingScene,t:number){
  if(s.weather==='none')return;ctx.save();const strong=s.strength==='strong',n=strong?64:32,dir=s.wind==='left'?-1:1;
  for(let i=0;i<n;i++){const seed=i*397%1280,offset=i*193%720;
    if(s.weather==='rain'){const y=(offset+t*(strong?540:330))%780-30,x=((seed+dir*t*90)%1340+1340)%1340-30;ctx.strokeStyle='rgba(72,135,185,.72)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+dir*8,y+23);ctx.stroke();}
    if(s.weather==='snow'){const y=(offset+t*(strong?85:42))%760-20,x=seed+Math.sin(t+i)*20;ctx.fillStyle='rgba(255,255,255,.95)';ctx.shadowColor='#718b9d';ctx.shadowBlur=3;ctx.beginPath();ctx.arc(x,y,3+i%4,0,Math.PI*2);ctx.fill();}
    if(s.weather==='wind'&&i<n/2){const x=((seed+dir*t*(strong?190:90))%1400+1400)%1400-60,y=offset+Math.sin(t*2+i)*25;ctx.strokeStyle='rgba(67,135,111,.45)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+dir*35,y-12,x+dir*70,y);ctx.stroke();if(i%3===0){ctx.save();ctx.translate(x,y);ctx.rotate(t*2+i);ctx.fillStyle='#7da665';ctx.beginPath();ctx.ellipse(0,0,9,3,0,0,Math.PI*2);ctx.fill();ctx.restore();}}
  }ctx.restore();
}
export function hitDrawing(p:DrawingProject,s:DrawingScene,x:number,y:number):DrawingItem|undefined{
  return [...s.items].reverse().find(i=>{const a=p.assets.find(a=>a.id===i.assetId);if(!a)return false;const dx=(x-i.x)*12.8,dy=(y-i.y)*7.2,angle=-i.rotation*Math.PI/180,lx=dx*Math.cos(angle)-dy*Math.sin(angle),ly=dx*Math.sin(angle)+dy*Math.cos(angle),w=i.width*12.8,h=w*a.height/a.width;return Math.abs(lx)<=w/2&&ly<=8&&ly>=-h;});
}
