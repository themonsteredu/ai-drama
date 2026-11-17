import type {DrawingItem} from './drawing-project';

/** Reuse the child's pixels; no generated replacement poses or paid calls. */
export function actionPose(item:DrawingItem,phase:number,progress:number){
 const weight=Math.min(1,phase*5)*(item.target?Math.max(0,Math.min(1,(1-progress)*8)):1);
 const gait=(item.motion==='walk'||item.motion==='run')?Math.sin(phase*(item.motion==='run'?12:7))*weight:0;
 const squash=item.motion==='dance'?Math.sin(phase*10)*.045*weight:item.motion==='hop'?Math.sin(phase*Math.PI*3)*.06*weight:0;
 return {gait,scaleX:1-squash*.6,scaleY:1+squash};
}

/** A continuous lower-body warp, suited to upright front-facing drawings. */
export function gaitPoint(u:number,v:number,gait:number,running=false){
 const leg=Math.max(0,(v-.5)*2)**2,side=Math.max(-1,Math.min(1,(u-.5)*4));
 return {x:u+gait*side*leg*(running?.085:.055),y:v-Math.max(0,gait*side)*leg*(running?.065:.035)};
}

type Point={x:number;y:number};
function triangle(ctx:CanvasRenderingContext2D,image:HTMLImageElement,src:Point[],dst:Point[]){
 const [a,b,c]=src,[p,q,r]=dst;
 const ux=b.x-a.x,uy=b.y-a.y,vx=c.x-a.x,vy=c.y-a.y,det=ux*vy-vx*uy;
 const aa=((q.x-p.x)*vy-(r.x-p.x)*uy)/det,bb=((q.y-p.y)*vy-(r.y-p.y)*uy)/det;
 const cc=((r.x-p.x)*ux-(q.x-p.x)*vx)/det,dd=((r.y-p.y)*ux-(q.y-p.y)*vx)/det;
 ctx.save();ctx.beginPath();
 // Subpixel overlap prevents antialiased seams between adjacent pieces.
 const cx=(p.x+q.x+r.x)/3,cy=(p.y+q.y+r.y)/3;
 for(let i=0;i<3;i++){const d=dst[i],dx=d.x-cx,dy=d.y-cy,len=Math.hypot(dx,dy)||1;const x=d.x+dx/len*.45,y=d.y+dy/len*.45;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}
 ctx.closePath();ctx.clip();ctx.transform(aa,bb,cc,dd,p.x-aa*a.x-cc*a.y,p.y-bb*a.x-dd*a.y);
 ctx.drawImage(image,0,0);ctx.restore();
}

export function drawWalkingCutout(ctx:CanvasRenderingContext2D,image:HTMLImageElement,width:number,height:number,gait:number,running=false){
 if(Math.abs(gait)<.001){ctx.drawImage(image,-width/2,-height,width,height);return;}
 const iw=image.naturalWidth,ih=image.naturalHeight;
 ctx.drawImage(image,0,0,iw,ih*.5,-width/2,-height,width,height*.5);
 const cols=4,rows=6;
 for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
  const uv=[[col/cols,.5+row/rows*.5],[(col+1)/cols,.5+row/rows*.5],[(col+1)/cols,.5+(row+1)/rows*.5],[col/cols,.5+(row+1)/rows*.5]];
  const src=uv.map(([u,v])=>({x:u*iw,y:v*ih})),dst=uv.map(([u,v])=>{const p=gaitPoint(u,v,gait,running);return {x:(p.x-.5)*width,y:(p.y-1)*height};});
  for(const corners of [[0,1,2],[0,2,3]])triangle(ctx,image,corners.map(i=>src[i]),corners.map(i=>dst[i]));
 }
}
