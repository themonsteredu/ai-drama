import {validRasterSource,type DrawingAsset} from './drawing-project';
export function rasterImage(source:string):Promise<HTMLImageElement>{
  return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>image.naturalWidth*image.naturalHeight>24_000_000?reject(new Error('그림이 너무 커요. 해상도를 줄여 주세요.')):resolve(image);image.onerror=()=>reject(new Error('그림을 읽지 못했어요. JPG·PNG·WebP로 다시 저장해 주세요.'));image.src=source;});
}
/** Simple white-paper cleanup, NOT semantic AI background removal. */
function clearPaper(ctx:CanvasRenderingContext2D,w:number,h:number){
  const pixels=ctx.getImageData(0,0,w,h),data=pixels.data,seen=new Uint8Array(w*h),queue=new Int32Array(w*h);let head=0,tail=0;
  const add=(x:number,y:number)=>{if(x<0||y<0||x>=w||y>=h)return;const p=y*w+x;if(seen[p])return;seen[p]=1;const k=p*4;const low=Math.min(data[k],data[k+1],data[k+2]),high=Math.max(data[k],data[k+1],data[k+2]);if(data[k+3]<16||(low>220&&high-low<28)){data[k+3]=0;queue[tail++]=p;}};
  for(let x=0;x<w;x++){add(x,0);add(x,h-1);}for(let y=0;y<h;y++){add(0,y);add(w-1,y);}
  while(head<tail){const p=queue[head++],x=p%w,y=Math.floor(p/w);add(x-1,y);add(x+1,y);add(x,y-1);add(x,y+1);}ctx.putImageData(pixels,0,0);
}
export async function prepareRaster(source:string,removePaper=false,trim=true){
  const image=await rasterImage(source),ratio=Math.min(1,1280/Math.max(image.naturalWidth,image.naturalHeight));
  let canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));
  const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw new Error('그림 도구를 열지 못했어요.');ctx.drawImage(image,0,0,canvas.width,canvas.height);
  if(removePaper)clearPaper(ctx,canvas.width,canvas.height);
  if(trim){const {data}=ctx.getImageData(0,0,canvas.width,canvas.height);let x0=canvas.width,y0=canvas.height,x1=-1,y1=-1;
    for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(data[(y*canvas.width+x)*4+3]>20){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
    if(x1<0)throw new Error('남은 그림이 없어요. 흰 종이 지우기를 꺼 주세요.');
    x0=Math.max(0,x0-4);y0=Math.max(0,y0-4);x1=Math.min(canvas.width-1,x1+4);y1=Math.min(canvas.height-1,y1+4);
    const cropped=document.createElement('canvas');cropped.width=x1-x0+1;cropped.height=y1-y0+1;cropped.getContext('2d')?.drawImage(canvas,x0,y0,cropped.width,cropped.height,0,0,cropped.width,cropped.height);canvas=cropped;
  }
  let encoded=canvas.toDataURL('image/webp',.9);
  if(encoded.length>1_350_000){const small=document.createElement('canvas');small.width=Math.max(1,Math.round(canvas.width*.7));small.height=Math.max(1,Math.round(canvas.height*.7));small.getContext('2d')?.drawImage(canvas,0,0,small.width,small.height);canvas=small;encoded=canvas.toDataURL('image/webp',.8);}
  if(!validRasterSource(encoded))throw new Error('그림 용량이 커요. 크기를 줄여서 다시 골라 주세요.');return {source:encoded,width:canvas.width,height:canvas.height};
}
export async function readDrawingImage(file:File){
  if(file.size>10_000_000)throw new Error('그림은 10MB 이하로 골라 주세요.');
  const bytes=new Uint8Array(await file.slice(0,32).arrayBuffer());
  const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71,jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255,webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
  if(!png&&!jpeg&&!webp)throw new Error('JPG·PNG·WebP 그림만 가능해요. HEIC 사진은 JPG로 바꿔 주세요.');
  if(png&&bytes.length>=24){const view=new DataView(bytes.buffer);if(view.getUint32(16)*view.getUint32(20)>24_000_000)throw new Error('그림 해상도를 줄여서 다시 골라 주세요.');}
  const url=URL.createObjectURL(file);try{return await prepareRaster(url,false,false);}finally{URL.revokeObjectURL(url);}
}
export async function loadDrawingImages(assets:DrawingAsset[]){
  const images=new Map<string,HTMLImageElement>();await Promise.all(assets.map(async a=>{if(!validRasterSource(a.source))throw new Error('지원하지 않는 그림 형식이에요.');const image=await rasterImage(a.source);if(image.naturalWidth>1600||image.naturalHeight>1600)throw new Error('그림 크기를 다시 확인해 주세요.');images.set(a.id,image);}));return images;
}
