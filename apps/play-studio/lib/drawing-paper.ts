/** Local paper-photo cleanup. Colour/connected-region analysis, not semantic AI.
 * Finds an enclosing neutral paper surface even when it is grey in a photo.
 * Only its connected exterior is erased: enclosed white drawing details remain.
 */
type Raster = {width:number;height:number;data:Uint8ClampedArray};
type Rect = {x:number;y:number;width:number;height:number};
export type PaperResult = {mask:Uint8ClampedArray;removed:number;kept:number};
export function detectPaper(pixels:Raster, crop:Rect):PaperResult|null {
  const {width:w,height:h,data}=pixels;
  if(!w||!h||data.length!==w*h*4)return null;
  const x0=Math.max(0,Math.floor(crop.x)),y0=Math.max(0,Math.floor(crop.y));
  const x1=Math.min(w,Math.ceil(crop.x+crop.width)),y1=Math.min(h,Math.ceil(crop.y+crop.height));
  const rw=x1-x0,rh=y1-y0,area=rw*rh;
  if(area<64)return null;
  const histogram=new Uint32Array(64);let opaque=0,neutral=0;
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
    const k=(y*w+x)*4,r=data[k],g=data[k+1],b=data[k+2];
    if(data[k+3]<240)continue;opaque++;
    const l=(r+g+b)/3;
    if(l>=65&&Math.max(r,g,b)-Math.min(r,g,b)<=32){histogram[Math.min(63,Math.floor(l/4))]++;neutral++;}
  }
  // Transparent artwork is not a photograph of a sheet of paper.
  if(opaque<area*.8||neutral<area*.3)return null;
  // Use a lower quantile, not the tallest brightness bin: a white area
  // inside the drawing must not outweigh a shaded sheet's broad histogram.
  let level=16,cumulative=0;
  for(;level<63;level++){cumulative+=histogram[level];if(cumulative>=neutral*.2)break;}
  const floor=Math.max(50,level*4-48);
  const candidate=new Uint8Array(w*h),labels=new Int32Array(w*h),queue=new Int32Array(area);
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
    const p=y*w+x,k=p*4,r=data[k],g=data[k+1],b=data[k+2];
    candidate[p]=data[k+3]>=240&&(r+g+b)/3>=floor&&Math.max(r,g,b)-Math.min(r,g,b)<=32?1:0;
  }
  let id=0,biggest=0,bestCount=0,bestBounds=[0,0,0,0];
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
    const start=y*w+x;if(!candidate[start]||labels[start])continue;
    id++;let head=0,tail=1,minX=x,maxX=x,minY=y,maxY=y;queue[0]=start;labels[start]=id;
    while(head<tail){
      const p=queue[head++],px=p%w,py=Math.floor(p/w);
      minX=Math.min(minX,px);maxX=Math.max(maxX,px);minY=Math.min(minY,py);maxY=Math.max(maxY,py);
      const visit=(q:number)=>{if(candidate[q]&&!labels[q]){labels[q]=id;queue[tail++]=q;}};
      if(px>x0)visit(p-1);if(px<x1-1)visit(p+1);if(py>y0)visit(p-w);if(py<y1-1)visit(p+w);
    }
    if(tail>bestCount){bestCount=tail;biggest=id;bestBounds=[minX,minY,maxX,maxY];}
  }
  if(bestCount<area*.3||bestBounds[2]-bestBounds[0]<rw*.6||bestBounds[3]-bestBounds[1]<rh*.6)return null;
  const outside=new Uint8Array(w*h);let head=0,tail=0,border=0,paperBorder=0;
  const visit=(p:number)=>{if(labels[p]!==biggest&&!outside[p]){outside[p]=1;queue[tail++]=p;}};
  const edge=(p:number)=>{border++;if(labels[p]===biggest)paperBorder++;};
  for(let x=x0;x<x1;x++){edge(y0*w+x);edge((y1-1)*w+x);}
  for(let y=y0+1;y<y1-1;y++){edge(y*w+x0);edge(y*w+x1-1);}
  // A sheet inside a desk photo encloses the drawing. Remove the desk too.
  // When paper reaches most image edges, retain drawings touching an edge.
  if(paperBorder<border*.7){
    for(let x=x0;x<x1;x++){visit(y0*w+x);visit((y1-1)*w+x);}
    for(let y=y0;y<y1;y++){visit(y*w+x0);visit(y*w+x1-1);}
    while(head<tail){const p=queue[head++],x=p%w,y=Math.floor(p/w);if(x>x0)visit(p-1);if(x<x1-1)visit(p+1);if(y>y0)visit(p-w);if(y<y1-1)visit(p+w);}
  }
  const mask=new Uint8ClampedArray(w*h).fill(255);let kept=0,removed=0;
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
    const p=y*w+x;
    if(labels[p]===biggest||outside[p]){mask[p]=0;removed++;}else if(data[p*4+3]>16)kept++;
  }
  // Fail closed on blank sheets or an ambiguous/near-empty result.
  if(kept<Math.max(8,area*.003)||kept>area*.65)return null;
  return {mask,removed,kept};
}
export function combinePaperMask(pixels:Raster,previous:Uint8ClampedArray,crop:Rect):Uint8ClampedArray {
  const found=detectPaper(pixels,crop);
  if(!found)throw new Error('종이와 그림을 구분하지 못했어요. 그림 주위를 먼저 자르거나 손수정으로 다듬어 주세요.');
  const next=new Uint8ClampedArray(previous);let changed=0,kept=0;
  for(let y=Math.max(0,Math.floor(crop.y));y<Math.min(pixels.height,Math.ceil(crop.y+crop.height));y++)
    for(let x=Math.max(0,Math.floor(crop.x));x<Math.min(pixels.width,Math.ceil(crop.x+crop.width));x++){
      const p=y*pixels.width+x;next[p]=Math.min(previous[p],found.mask[p]);
      if(pixels.data[p*4+3]>16){if(next[p]<previous[p])changed++;if(next[p]>16)kept++;}
    }
  if(!kept)throw new Error('그림이 거의 남지 않아요. 원래 상태를 유지했어요. 자르기나 손수정을 이용해 주세요.');
  if(!changed)throw new Error('더 지울 종이를 찾지 못했어요. 남은 부분은 손수정으로 다듬어 주세요.');
  return next;
}

/** Main green action: paper photos need no network/model download. */
export async function automaticPaperMask(pixels:ImageData,crop:Rect,signal:AbortSignal):Promise<Uint8ClampedArray>{
  const aborted=()=>{if(signal.aborted)throw new Error('자동 정리를 취소했어요. 그림은 그대로예요.');};
  aborted();await new Promise<void>(resolve=>setTimeout(resolve,0));aborted();
  const paper=detectPaper(pixels,crop);aborted();
  if(paper)return paper.mask;
  const {automaticMask}=await import('./drawing-cutout');aborted();
  return automaticMask(pixels,crop,signal);
}
