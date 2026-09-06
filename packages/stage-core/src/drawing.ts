/** Raster drawings are separate from legacy stage documents. */
export type DrawingKind = 'person' | 'animal' | 'plant' | 'nature' | 'prop' | 'background';
export type DrawingMotion = 'still' | 'move' | 'hop' | 'sway' | 'float' | 'swim' | 'bounce';
export type DrawingSpeed = 'slow' | 'normal' | 'fast';
export type DrawingWeather = 'none' | 'wind' | 'rain' | 'snow';
export interface DrawingAsset { id: string; name: string; kind: DrawingKind; source: string; width: number; height: number; }
export interface DrawingItem {
  id: string; assetId: string; x: number; y: number; width: number;
  rotation: number; flipped: boolean; motion: DrawingMotion; speed: DrawingSpeed;
  target?: { x: number; y: number }; speech: string;
}
export interface DrawingScene {
  id: string; title: string; background: string; backgroundAssetId?: string;
  backgroundFit: 'cover' | 'contain'; weather: DrawingWeather;
  wind: 'left' | 'right'; strength: 'gentle' | 'strong'; caption: string; items: DrawingItem[];
}
export interface DrawingProject {
  format: 'moakit-drawing'; version: 1; id: string; title: string;
  activeSceneId: string; assets: DrawingAsset[]; scenes: DrawingScene[]; updatedAt: string;
}
export const drawingKinds: {id:DrawingKind;label:string}[] = [
  {id:'person',label:'사람'},{id:'animal',label:'동물'},{id:'plant',label:'식물'},
  {id:'nature',label:'자연'},{id:'prop',label:'소품'},{id:'background',label:'배경'},
];
export const drawingMotions: {id:DrawingMotion;label:string;description:string}[] = [
  {id:'still',label:'가만히',description:'원래 그림 그대로 있어요.'},
  {id:'move',label:'이동',description:'그림 전체가 이동해요. 다리가 따로 걷는 동작은 아니에요.'},
  {id:'hop',label:'폴짝폴짝',description:'위아래로 뛰며 움직여요.'},
  {id:'sway',label:'살랑살랑',description:'식물은 아래쪽을 고정하고 부드럽게 휘어요.'},
  {id:'float',label:'둥실둥실',description:'공중에 떠 있는 듯 움직여요. 날개 관절은 바뀌지 않아요.'},
  {id:'swim',label:'헤엄',description:'그림 전체를 물결처럼 살짝 휘어요.'},
  {id:'bounce',label:'통통',description:'공처럼 위아래로 튕겨요.'},
];
export function motionsFor(kind:DrawingKind):DrawingMotion[]{
  if(kind==='plant')return ['still','sway','hop'];
  if(kind==='nature')return ['still','move','float','sway'];
  if(kind==='animal')return ['still','move','hop','float','swim'];
  return ['still','move','hop','sway','bounce'];
}
export const drawingId=(prefix:string)=>`${prefix}-${globalThis.crypto.randomUUID()}`;
export const bounded=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
export function newDrawingScene(id=drawingId('scene'),title='장면 1'):DrawingScene{
  return {id,title,background:'#f2f7f4',backgroundFit:'cover',weather:'none',wind:'right',strength:'gentle',caption:'',items:[]};
}
export function emptyDrawingProject():DrawingProject{
  return {format:'moakit-drawing',version:1,id:'drawing-starter',title:'내 그림의 작은 모험',activeSceneId:'drawing-scene-1',assets:[],scenes:[newDrawingScene('drawing-scene-1')],updatedAt:'2026-09-06T00:00:00.000Z'};
}
export function drawingFrame(item:DrawingItem,seconds:number){
  const duration=item.speed==='slow'?8:item.speed==='fast'?3:5;
  const t=Math.max(0,seconds),phase=t*(item.speed==='slow'?.65:item.speed==='fast'?1.5:1);
  const progress=item.target&&item.motion!=='still'?Math.min(1,t/duration):0;
  const x=item.x+((item.target?.x??item.x)-item.x)*progress;
  let y=item.y+((item.target?.y??item.y)-item.y)*progress,angle=item.rotation;
  if(item.motion==='hop'||item.motion==='bounce')y-=Math.abs(Math.sin(phase*Math.PI*1.5))*(item.motion==='hop'?7:4);
  if(item.motion==='float')y-=Math.sin(phase*1.6)*2.5;
  if(item.motion==='sway')angle+=Math.sin(phase*2)*4;
  return {x,y,angle,phase,progress};
}
