import {drawingMotions,type DrawingProject} from '../../../packages/stage-core/src/drawing';
import {validateMusic} from './drawing-music';
import {validateVoices} from './drawing-voice';
import {validateNarration} from './film-narration';
export * from '../../../packages/stage-core/src/drawing';
export const DRAWING_FILE_LIMIT=320_000_000;
export const DRAWING_MAX_SCENES=32,DRAWING_MAX_ASSETS=128,DRAWING_ASSET_BYTES=96_000_000;
// A lossless 1600×1600 RGBA PNG can exceed 4 MB after base64 encoding.
// Keep generated/rotated originals lossless while retaining the total project budget.
export const DRAWING_RASTER_LIMIT=16_000_000;
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown,max:number)=>typeof v==='string'&&v.length<=max;
const num=(v:unknown,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const one=(v:unknown,choices:string[])=>typeof v==='string'&&choices.includes(v);
const ids=(v:unknown[])=>v.every(x=>record(x)&&typeof x.id==='string'&&x.id.length>0)&&new Set(v.map(x=>(x as Record<string,unknown>).id)).size===v.length;
export function validRasterSource(v:unknown):v is string{
  if(typeof v!=='string'||v.length>DRAWING_RASTER_LIMIT||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(v))return false;
  try{
    const [header,payload]=v.split(',');const b=atob(payload.slice(0,48));
    if(header.includes('png')){
      if(b.slice(1,4)!=='PNG'||b.charCodeAt(0)!==137||b.length<24)return false;
      const n=(i:number)=>b.charCodeAt(i)*16777216+(b.charCodeAt(i+1)<<16)+(b.charCodeAt(i+2)<<8)+b.charCodeAt(i+3);
      return n(16)>0&&n(20)>0&&n(16)<=1600&&n(20)<=1600;
    }
    if(header.includes('jpeg'))return b.charCodeAt(0)===255&&b.charCodeAt(1)===216&&b.charCodeAt(2)===255;
    return b.slice(0,4)==='RIFF'&&b.slice(8,12)==='WEBP';
  }catch{return false;}
}
function validEdit(v:unknown):boolean{
  if(!record(v)||v.version!==1||!validRasterSource(v.original)||!validRasterSource(v.mask)||!v.mask.startsWith('data:image/png;'))return false;
  if(!num(v.width,1,1600)||!num(v.height,1,1600)||!Number.isInteger(v.width)||!Number.isInteger(v.height)||!record(v.crop))return false;
  const c=v.crop,w=v.width as number,h=v.height as number;
  return num(c.x,0,w-1)&&num(c.y,0,h-1)&&num(c.width,1,w)&&num(c.height,1,h)&&['x','y','width','height'].every(k=>Number.isInteger(c[k]))&&(c.x as number)+(c.width as number)<=w&&(c.y as number)+(c.height as number)<=h;
}
export function validateDrawingProject(v:unknown):v is DrawingProject{
  if(!record(v)||!validateMusic(v)||!validateVoices(v)||!validateNarration(v.narration))return false;
  if(!record(v)||v.format!=='moakit-drawing'||v.version!==1||!text(v.id,150)||!text(v.title,80)||!text(v.updatedAt,80))return false;
  if(!Array.isArray(v.assets)||v.assets.length>DRAWING_MAX_ASSETS||!ids(v.assets))return false;
  let bytes=0;
  for(const a of v.assets){
    if(!record(a)||!text(a.id,150)||!text(a.name,40)||!one(a.kind,['person','animal','plant','nature','prop','background'])||!num(a.width,1,1600)||!num(a.height,1,1600)||!validRasterSource(a.source))return false;
    bytes+=a.source.length;
    if(a.edit!==undefined){if(!validEdit(a.edit))return false;const e=a.edit as Record<string,unknown>;bytes+=(e.original as string).length+(e.mask as string).length;}
  }
  if(bytes>DRAWING_ASSET_BYTES||!Array.isArray(v.scenes)||!v.scenes.length||v.scenes.length>DRAWING_MAX_SCENES||!ids(v.scenes))return false;
  const assets=new Set(v.assets.map(a=>a.id));
  for(const scene of v.scenes)if(record(scene)&&Array.isArray(scene.items))for(const item of scene.items)if(record(item)&&item.separation!==undefined){
    const cut=item.separation;if(!record(cut)||!assets.has(cut.sourceAssetId)||!validRasterSource(cut.mask)||!cut.mask.startsWith('data:image/png;'))return false;
    bytes+=cut.mask.length;if(bytes>DRAWING_ASSET_BYTES)return false;
  }
  if(!v.scenes.some(s=>record(s)&&s.id===v.activeSceneId))return false;
  return v.scenes.every(s=>{
    if(!record(s)||!text(s.id,150)||!text(s.title,40)||typeof s.background!=='string'||!/^#[0-9a-f]{6}$/i.test(s.background)||!text(s.caption,120))return false;
    if(s.durationSeconds!==undefined&&!num(s.durationSeconds,1,600))return false;
    if(s.transition!==undefined&&!one(s.transition,['cut','dissolve','fade']))return false;
    if(s.musicGroup!==undefined&&!text(s.musicGroup,150))return false;
    if(s.backgroundAssetId!==undefined&&!assets.has(s.backgroundAssetId))return false;
    if(s.stillOriginalAssetId!==undefined&&!assets.has(s.stillOriginalAssetId))return false;
    if(s.protectedMask!==undefined&&(!validRasterSource(s.protectedMask)||!(s.protectedMask as string).startsWith('data:image/png;')))return false;
    if(!one(s.backgroundFit,['cover','contain'])||!one(s.weather,['none','wind','rain','snow'])||!one(s.wind,['left','right'])||!one(s.strength,['gentle','strong']))return false;
    if(!Array.isArray(s.items)||s.items.length>40||!ids(s.items))return false;
    return s.items.every(i=>record(i)&&text(i.id,150)&&assets.has(i.assetId)&&num(i.x,0,100)&&num(i.y,0,100)&&num(i.width,.1,100)&&num(i.rotation,-180,180)&&typeof i.flipped==='boolean'&&typeof i.speech==='string'&&one(i.motion,drawingMotions.map(m=>m.id))&&one(i.speed,['slow','normal','fast'])&&(i.target===undefined||(record(i.target)&&num(i.target.x,0,100)&&num(i.target.y,0,100))));
  });
}
export function parseDrawingFile(raw:string):DrawingProject{
  if(new Blob([raw]).size>DRAWING_FILE_LIMIT)throw new Error('작품 파일은 320MB 이하로 골라 주세요.');
  let v:unknown;try{v=JSON.parse(raw);}catch{throw new Error('작품 파일을 읽지 못했어요. 기존 작품은 그대로예요.');}
  if(!validateDrawingProject(v))throw new Error('내 그림 움직이기 작품 파일이 아니거나 손상됐어요. 기존 작품은 그대로예요.');return v;
}
