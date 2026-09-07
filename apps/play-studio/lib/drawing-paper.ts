/**
 * Photo paper is often grey (shadows / white balance), not RGB(255,255,255).
 * Find a broad neutral sheet enclosing ink, then keep its enclosed drawing.
 * This is a conservative colour/topology heuristic, NOT semantic AI matting.
 * Only alpha changes; enclosed white areas and original RGB are preserved.
 */
type Pixels = {width: number; height: number; data: Uint8ClampedArray};
type Rect = {x: number; y: number; width: number; height: number};
export function photographedPaperMask(pixels: Pixels, previous: Uint8ClampedArray, crop: Rect): Uint8ClampedArray | null {
  const {width: w, height: h, data} = pixels, size = w * h;
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 4 || h < 4 || w > 1600 || h > 1600 || data.length !== size * 4 || previous.length !== size) return null;
  if (![crop.x,crop.y,crop.width,crop.height].every(Number.isFinite)) return null;
  const x0 = Math.max(0,Math.min(w-1,Math.round(crop.x))), y0 = Math.max(0,Math.min(h-1,Math.round(crop.y)));
  const x1 = Math.min(w,x0+Math.max(1,Math.round(crop.width))), y1 = Math.min(h,y0+Math.max(1,Math.round(crop.height)));
  const area = (x1-x0)*(y1-y0), labels = new Int32Array(size), queue = new Int32Array(size);
  // Dark graphite and coloured crayon stay outside the sheet component.
  for (let y=y0;y<y1;y++) for (let x=x0;x<x1;x++) {
    const p=y*w+x,k=p*4,r=data[k],g=data[k+1],b=data[k+2];
    if(data[k+3]>16 && (r+g+b)/3>=90 && Math.max(r,g,b)-Math.min(r,g,b)<=32) labels[p]=-1;
  }
  let id=0,best=0,bestCount=0,bx0=0,by0=0,bx1=0,by1=0;
  for(let y=y0;y<y1;y++) for(let x=x0;x<x1;x++) {
    const start=y*w+x;if(labels[start]!==-1)continue;
    id++;let head=0,tail=1,minX=x,maxX=x,minY=y,maxY=y;queue[0]=start;labels[start]=id;
    while(head<tail){
      const p=queue[head++],px=p%w,py=Math.floor(p/w);
      minX=Math.min(minX,px);maxX=Math.max(maxX,px);minY=Math.min(minY,py);maxY=Math.max(maxY,py);
      if(px>x0&&labels[p-1]===-1){labels[p-1]=id;queue[tail++]=p-1;}
      if(px+1<x1&&labels[p+1]===-1){labels[p+1]=id;queue[tail++]=p+1;}
      if(py>y0&&labels[p-w]===-1){labels[p-w]=id;queue[tail++]=p-w;}
      if(py+1<y1&&labels[p+w]===-1){labels[p+w]=id;queue[tail++]=p+w;}
    }
    if(tail>bestCount){best=id;bestCount=tail;bx0=minX;bx1=maxX;by0=minY;by1=maxY;}
  }
  const bw=bx1-bx0+1,bh=by1-by0+1;
  if(!best || bestCount<area*.22 || bw<(x1-x0)*.6 || bh<(y1-y0)*.6 || bestCount<bw*bh*.36) return null;
  // Require a broad, approximately rectangular sheet around the artwork.
  const band=Math.max(1,Math.floor(Math.min(bw,bh)*.035));
  const counts=[0,0,0,0],totals=[0,0,0,0];
  for(let y=by0;y<=by1;y++) for(let x=bx0;x<=bx1;x++) {
    const hit=labels[y*w+x]===best?1:0;
    if(y<by0+band){totals[0]++;counts[0]+=hit;}
    if(y>by1-band){totals[1]++;counts[1]+=hit;}
    if(x<bx0+band){totals[2]++;counts[2]+=hit;}
    if(x>bx1-band){totals[3]++;counts[3]+=hit;}
  }
  const coverage=counts.map((n,i)=>n/Math.max(1,totals[i]));
  if(coverage.some(c=>c<.48) || coverage.reduce((a,b)=>a+b,0)/4<.7) return null;
  // Outside the sheet is desk/frame; enclosed areas are drawing, including
  // disconnected white interiors. Never erase all neutral pixels globally.
  const outside=new Uint8Array(size);let head=0,tail=0;
  function add(x:number,y:number){
    if(x<x0||y<y0||x>=x1||y>=y1)return;const p=y*w+x;
    if(outside[p]||labels[p]===best)return;outside[p]=1;queue[tail++]=p;
  }
  for(let x=x0;x<x1;x++){add(x,y0);add(x,y1-1);}
  for(let y=y0;y<y1;y++){add(x0,y);add(x1-1,y);}
  while(head<tail){const p=queue[head++],x=p%w,y=Math.floor(p/w);add(x-1,y);add(x+1,y);add(x,y-1);add(x,y+1);}
  let enclosed=0,contrast=0;
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
    const p=y*w+x,k=p*4;if(labels[p]===best||outside[p]||data[k+3]<16)continue;
    enclosed++;const hi=Math.max(data[k],data[k+1],data[k+2]),lo=Math.min(data[k],data[k+1],data[k+2]);
    if(hi-lo>38||hi<110)contrast++;
  }
  if(enclosed<Math.max(24,area*.006)||enclosed>area*.6||contrast<enclosed*.12)return null;
  const next=new Uint8ClampedArray(previous);let removed=0,remaining=0;
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
    const p=y*w+x;
    if(labels[p]===best||outside[p]){if(previous[p]>16&&data[p*4+3]>16)removed++;next[p]=0;}
    else if(next[p]>16&&data[p*4+3]>16)remaining++;
  }
  if(!removed||remaining<Math.max(16,area*.003))return null;
  return next;
}
