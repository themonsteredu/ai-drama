import type {DrawingScene} from './drawing-project';
/** Soft canvas particles, not SVG stickers. Deterministic clock also serves thumbnails/PNG. */
export function drawAtmosphere(ctx:CanvasRenderingContext2D,scene:DrawingScene,seconds:number){
 if(scene.weather==='none')return;const strong=scene.strength==='strong',dir=scene.wind==='left'?-1:1,t=Math.max(0,seconds),count=strong?95:48;
 ctx.save();
 if(scene.weather==='rain'){ctx.fillStyle='rgba(58,85,123,.06)';ctx.fillRect(0,0,1280,720);}
 for(let i=0;i<count;i++){
  const seed=(i*397.37)%1280,offset=(i*193.13)%720,depth=.45+(i%7)/7;
  if(scene.weather==='rain'){
   const x=((seed+dir*t*80*depth)%1360+1360)%1360-40,y=(offset+t*(strong?600:380)*depth)%800-40,len=20*depth;
   const gradient=ctx.createLinearGradient(x,y,x+dir*len*.25,y+len);gradient.addColorStop(0,'rgba(160,191,221,0)');gradient.addColorStop(1,`rgba(211,231,247,${.28+depth*.3})`);ctx.strokeStyle=gradient;ctx.lineWidth=depth*1.8;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+dir*len*.25,y+len);ctx.stroke();
  }else if(scene.weather==='snow'){
   const x=((seed+dir*t*14+Math.sin(t*.7+i)*26)%1360+1360)%1360-40,y=(offset+t*(strong?80:38)*depth)%800-40,r=2+depth*3;
   const glow=ctx.createRadialGradient(x,y,0,x,y,r*2);glow.addColorStop(0,'rgba(255,255,255,.95)');glow.addColorStop(.5,'rgba(233,242,252,.65)');glow.addColorStop(1,'rgba(160,187,218,0)');ctx.fillStyle=glow;ctx.fillRect(x-r*2,y-r*2,r*4,r*4);
  }else{
   const x=((seed+dir*t*(strong?200:85)*depth)%1420+1420)%1420-70,y=offset+Math.sin(t*.9+i)*30,r=2+depth*3;
   ctx.save();ctx.translate(x,y);ctx.rotate(t+i);ctx.scale(1.8,.6);const glow=ctx.createRadialGradient(0,0,0,0,0,r*2);glow.addColorStop(0,'rgba(218,177,83,.6)');glow.addColorStop(.35,'rgba(166,173,97,.3)');glow.addColorStop(1,'rgba(160,175,110,0)');ctx.fillStyle=glow;ctx.fillRect(-r*2,-r*2,r*4,r*4);ctx.restore();
  }
 }
 ctx.restore();
}
