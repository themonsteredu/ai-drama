import { rasterImage } from './drawing-media';
import { validRasterSource } from './drawing-project';
import { photographedPaperMask } from './drawing-paper';

export type CropRect = { x: number; y: number; width: number; height: number };
export type CutoutDocument = { version: 1; original: string; mask: string; width: number; height: number; crop: CropRect };
export type CutoutResult = { source: string; width: number; height: number; edit: CutoutDocument };
export const cutoutBytes = (asset: {source: string; edit?: CutoutDocument}) => asset.source.length + (asset.edit?.original.length ?? 0) + (asset.edit?.mask.length ?? 0);
export const fullCrop = (width: number, height: number): CropRect => ({x: 0, y: 0, width, height});
export function safeCrop(rect: CropRect, width: number, height: number): CropRect {
  const x = Math.max(0, Math.min(width - 1, Math.round(rect.x)));
  const y = Math.max(0, Math.min(height - 1, Math.round(rect.y)));
  return {x, y, width: Math.max(1, Math.min(width - x, Math.round(rect.width))), height: Math.max(1, Math.min(height - y, Math.round(rect.height)))};
}
export function canvasOf(width: number, height: number) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d', {willReadFrequently: true});
  if (!context) throw new Error('그림 도구를 열지 못했어요.');
  return {canvas, context};
}
export async function openCutout(source: string, edit?: CutoutDocument) {
  const image = await rasterImage(edit?.original ?? source);
  const width = image.naturalWidth, height = image.naturalHeight;
  if (width > 1600 || height > 1600) throw new Error('그림 크기가 너무 커요.');
  const {context} = canvasOf(width, height); context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, width, height);
  const mask = new Uint8ClampedArray(width * height).fill(255);
  if (edit) {
    if (edit.width !== width || edit.height !== height) throw new Error('편집 원본의 크기가 맞지 않아요.');
    const saved = await rasterImage(edit.mask);
    if (saved.naturalWidth !== width || saved.naturalHeight !== height) throw new Error('수정 정보의 크기가 맞지 않아요.');
    context.clearRect(0, 0, width, height); context.drawImage(saved, 0, 0);
    const data = context.getImageData(0, 0, width, height).data;
    for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4];
  }
  return {pixels, mask, crop: safeCrop(edit?.crop ?? fullCrop(width, height), width, height), original: edit?.original ?? source};
}
export function maskedPixels(original: ImageData, mask: Uint8ClampedArray) {
  const pixels = new ImageData(new Uint8ClampedArray(original.data), original.width, original.height);
  for (let i = 0; i < mask.length; i++) pixels.data[i * 4 + 3] = Math.round(original.data[i * 4 + 3] * mask[i] / 255);
  return pixels;
}
/** Stroke edits only the mask; restoring never invents pixels or changes original colours. */
export function brushMask(mask: Uint8ClampedArray, width: number, height: number, from: {x: number; y: number}, to: {x: number; y: number}, radius: number, restore: boolean) {
  const dx = to.x - from.x, dy = to.y - from.y, length = dx * dx + dy * dy;
  const x0 = Math.max(0, Math.floor(Math.min(from.x, to.x) - radius)), x1 = Math.min(width - 1, Math.ceil(Math.max(from.x, to.x) + radius));
  const y0 = Math.max(0, Math.floor(Math.min(from.y, to.y) - radius)), y1 = Math.min(height - 1, Math.ceil(Math.max(from.y, to.y) + radius));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const t = length ? Math.max(0, Math.min(1, ((x - from.x) * dx + (y - from.y) * dy) / length)) : 0;
    const distance = Math.hypot(x - from.x - dx * t, y - from.y - dy * t);
    const coverage = Math.max(0, Math.min(1, radius - distance));
    const index = y * width + x;
    mask[index] = restore ? Math.max(mask[index], Math.round(coverage * 255)) : Math.min(mask[index], Math.round((1 - coverage) * 255));
  }
}
/** Local paper cleanup includes photographed grey sheets, not only white RGB. */
export function paperMask(pixels: ImageData, previous: Uint8ClampedArray, crop: CropRect) {
  const photographed = photographedPaperMask(pixels, previous, crop);
  if (photographed) return photographed;
  const {width: w, height: h, data} = pixels, next = new Uint8ClampedArray(previous);
  const r = safeCrop(crop, w, h), seen = new Uint8Array(w * h), queue = new Int32Array(w * h); let head = 0, tail = 0;
  function visit(x: number, y: number) {
    if (x < r.x || y < r.y || x >= r.x + r.width || y >= r.y + r.height) return;
    const p = y * w + x; if (seen[p]) return; seen[p] = 1;
    const k = p * 4, low = Math.min(data[k], data[k+1], data[k+2]), high = Math.max(data[k], data[k+1], data[k+2]);
    if (previous[p] < 16 || data[k+3] < 16 || (low > 215 && high - low < 32)) { next[p] = 0; queue[tail++] = p; }
  }
  for (let x = r.x; x < r.x+r.width; x++) { visit(x, r.y); visit(x, r.y+r.height-1); }
  for (let y = r.y; y < r.y+r.height; y++) { visit(r.x, y); visit(r.x+r.width-1, y); }
  while (head < tail) { const p = queue[head++], x = p % w, y = Math.floor(p/w); visit(x-1,y);visit(x+1,y);visit(x,y-1);visit(x,y+1); }
  return next;
}
export function visibleCrop(pixels: ImageData, mask: Uint8ClampedArray, rect: CropRect) {
  const r = safeCrop(rect, pixels.width, pixels.height); let x0 = r.x+r.width, y0 = r.y+r.height, x1 = -1, y1 = -1;
  for (let y = r.y; y < r.y+r.height; y++) for (let x = r.x; x < r.x+r.width; x++) {
    const i = y*pixels.width+x;
    if (mask[i] * pixels.data[i*4+3] > 400) { x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y); }
  }
  if (x1 < 0) throw new Error('남은 그림이 없어요. 다시 살리기나 실행 취소를 눌러 주세요.');
  x0=Math.max(r.x,x0-4);y0=Math.max(r.y,y0-4);x1=Math.min(r.x+r.width-1,x1+4);y1=Math.min(r.y+r.height-1,y1+4);
  return {x:x0,y:y0,width:x1-x0+1,height:y1-y0+1};
}
export async function finishCutout(original: string, pixels: ImageData, mask: Uint8ClampedArray, rect: CropRect, trim: boolean): Promise<CutoutResult> {
  const crop = trim ? visibleCrop(pixels, mask, rect) : safeCrop(rect, pixels.width, pixels.height);
  visibleCrop(pixels, mask, crop);
  const work = canvasOf(pixels.width, pixels.height); work.context.putImageData(maskedPixels(pixels, mask), 0, 0);
  let output = canvasOf(crop.width, crop.height).canvas;
  output.getContext('2d')!.drawImage(work.canvas, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
  let source = output.toDataURL('image/png');
  while (source.length > 1_350_000 && output.width > 80 && output.height > 80) {
    const smaller = canvasOf(Math.max(1,Math.round(output.width*.8)),Math.max(1,Math.round(output.height*.8))).canvas;
    smaller.getContext('2d')!.drawImage(output,0,0,smaller.width,smaller.height); output=smaller;source=output.toDataURL('image/png');
  }
  const maskImage = new ImageData(pixels.width, pixels.height);
  for (let i=0;i<mask.length;i++) { maskImage.data[i*4]=mask[i];maskImage.data[i*4+1]=mask[i];maskImage.data[i*4+2]=mask[i];maskImage.data[i*4+3]=255; }
  work.context.putImageData(maskImage,0,0); const encodedMask=work.canvas.toDataURL('image/png');
  if (!validRasterSource(source) || !validRasterSource(encodedMask)) throw new Error('수정 정보가 너무 커요. 그림 크기를 줄여서 다시 골라 주세요.');
  return {source,width:output.width,height:output.height,edit:{version:1,original,mask:encodedMask,width:pixels.width,height:pixels.height,crop}};
}

// Only pinned library code is downloaded. Photo pixels stay in the browser.
const workerProgram = `
self.onmessage = async ({data}) => {
  const allocated=[];
  try {
    importScripts('https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.10.0-release.1/dist/opencv.js');
    let engine=self.cv;
    if (engine instanceof Promise) engine=await engine;
    else if (!engine.Mat) await new Promise(resolve=>{engine.onRuntimeInitialized=resolve;});
    if (!engine || typeof engine.grabCut!=='function') throw new Error('engine unavailable');
    const cv=engine, {width,height,crop}=data;
    const make=(v)=>{allocated.push(v);return v;};
    const rgba=make(cv.matFromArray(height,width,cv.CV_8UC4,new Uint8Array(data.pixels)));
    const rgb=make(new cv.Mat());cv.cvtColor(rgba,rgb,cv.COLOR_RGBA2RGB);
    const labels=make(new cv.Mat(height,width,cv.CV_8UC1,new cv.Scalar(0)));
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const i=y*width+x;
      labels.data[i]=x>crop.x&&y>crop.y&&x<crop.x+crop.width-1&&y<crop.y+crop.height-1&&rgba.data[i*4+3]>8?3:0;
    }
    const bg=make(new cv.Mat()),fg=make(new cv.Mat());
    cv.grabCut(rgb,labels,new cv.Rect(0,0,0,0),bg,fg,3,cv.GC_INIT_WITH_MASK);
    const result=new Uint8ClampedArray(width*height);let kept=0;
    for(let i=0;i<result.length;i++){result[i]=(labels.data[i]===1||labels.data[i]===3)?255:0;if(result[i])kept++;}
    if(kept<4)throw new Error('empty foreground');
    self.postMessage({mask:result.buffer,width,height},[result.buffer]);
  }catch(error){self.postMessage({error:'배경을 자동으로 나누지 못했어요. 그림 주위를 자르거나 흰 종이 지우기·지우개를 사용해 주세요.'});}
  finally{for(const item of allocated)item.delete();}
};`;
export function automaticMask(pixels: ImageData, crop: CropRect, signal: AbortSignal): Promise<Uint8ClampedArray> {
  return new Promise((resolve,reject)=>{
    const ratio=Math.min(1,480/Math.max(pixels.width,pixels.height));
    const original=canvasOf(pixels.width,pixels.height);original.context.putImageData(pixels,0,0);
    const small=canvasOf(Math.max(8,Math.round(pixels.width*ratio)),Math.max(8,Math.round(pixels.height*ratio)));
    small.context.drawImage(original.canvas,0,0,small.canvas.width,small.canvas.height);
    const buffer=small.context.getImageData(0,0,small.canvas.width,small.canvas.height).data;
    const url=URL.createObjectURL(new Blob([workerProgram],{type:'text/javascript'}));
    let worker: Worker;
    try{worker=new Worker(url);}catch{URL.revokeObjectURL(url);reject(new Error('자동 도구를 열지 못했어요. 자르기와 손수정은 계속 사용할 수 있어요.'));return;}
    const done=()=>{clearTimeout(timer);worker.terminate();URL.revokeObjectURL(url);signal.removeEventListener('abort',abort);};
    const abort=()=>{done();reject(new Error('자동 정리를 취소했어요. 그림은 그대로예요.'));};
    const timer=setTimeout(()=>{done();reject(new Error('자동 도구를 불러오지 못했어요. 인터넷 연결을 확인하거나 손수정으로 다듬어 주세요.'));},45000);
    signal.addEventListener('abort',abort,{once:true});if(signal.aborted){abort();return;}
    worker.onerror=()=>{done();reject(new Error('자동 도구를 불러오지 못했어요. 자르기와 손수정은 계속 사용할 수 있어요.'));};
    worker.onmessage=({data})=>{
      done();if(data.error){reject(new Error(data.error));return;}
      const mask=new Uint8ClampedArray(data.mask),next=new Uint8ClampedArray(pixels.width*pixels.height);
      for(let y=0;y<pixels.height;y++)for(let x=0;x<pixels.width;x++)next[y*pixels.width+x]=mask[Math.min(data.height-1,Math.floor(y/pixels.height*data.height))*data.width+Math.min(data.width-1,Math.floor(x/pixels.width*data.width))];
      // GrabCut may correctly select the whole paper sheet instead of its ink.
      // Refine that sheet, including its grey shadows, without replacing RGB.
      resolve(photographedPaperMask(pixels,next,crop) ?? next);
    };
    worker.postMessage({width:small.canvas.width,height:small.canvas.height,crop:{x:crop.x*ratio,y:crop.y*ratio,width:crop.width*ratio,height:crop.height*ratio},pixels:buffer.buffer},[buffer.buffer]);
  });
}
