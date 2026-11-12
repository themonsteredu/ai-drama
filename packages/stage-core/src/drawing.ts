/** Raster drawings are separate from legacy stage documents. */
export type DrawingKind = 'person' | 'animal' | 'plant' | 'nature' | 'prop' | 'background';
export type DrawingMotion = 'still' | 'move' | 'walk' | 'run' | 'dance' | 'hop' | 'sway' | 'float' | 'swim' | 'bounce';
export type DrawingSpeed = 'slow' | 'normal' | 'fast';
export type DrawingWeather = 'none' | 'wind' | 'rain' | 'snow';
export type DrawingTransition = 'cut' | 'dissolve' | 'fade';
/** Optional non-destructive editing metadata; version-1 projects without it still load. */
export interface DrawingEdit { version: 1; original: string; mask: string; width: number; height: number; crop: {x: number; y: number; width: number; height: number}; }
export interface DrawingAsset { id: string; name: string; kind: DrawingKind; source: string; width: number; height: number; edit?: DrawingEdit; }
export interface DrawingItem {
  /** Original scene and selection let a child correct this cutout without adding a copy. */
  separation?: {sourceAssetId:string;mask:string};
  id: string; assetId: string; x: number; y: number; width: number;
  rotation: number; flipped: boolean; motion: DrawingMotion; speed: DrawingSpeed;
  target?: { x: number; y: number }; speech: string;
}
export interface DrawingScene {
  /** Scenes imported from the same group's common soundtrack share playback. */
  musicGroup?: string;
  /** How this scene hands over to the next; absent in older projects means a cut. */
  transition?: DrawingTransition;
  durationSeconds?: number;
  stillOriginalAssetId?: string;
  protectedMask?: string;
  /** undefined inherits project music; null explicitly silences this scene. */
  music?: DrawingMusic | null;
  /** The recorded voice for this scene. Absent until the child records one. */
  voice?: DrawingVoice;
  id: string; title: string; background: string; backgroundAssetId?: string;
  backgroundFit: 'cover' | 'contain'; weather: DrawingWeather;
  wind: 'left' | 'right'; strength: 'gentle' | 'strong'; caption: string; items: DrawingItem[];
}
export interface DrawingProject {
  narration?: DrawingNarration;
  music?: DrawingMusic | null; musicAssets?: DrawingMusicAsset[];
  format: 'moakit-drawing'; version: 1; id: string; title: string;
  activeSceneId: string; assets: DrawingAsset[]; scenes: DrawingScene[]; updatedAt: string;
}
/** One voice the child records in the app, kept with the scene it belongs to. */
export interface DrawingVoice { id: string; source: string; duration: number; }
export interface DialogueLine { id:string; sceneId:string; speaker:number; text:string; clip?:DrawingVoice; clipKey?:string; }
export interface DialogueSpeaker { name:string; voice:string; }
export interface DrawingNarration {
 enabled:boolean; original:DrawingVoice; generated?:DrawingVoice; useGenerated:boolean;
 durations:Record<string,number>; speakers:DialogueSpeaker[]; lines:DialogueLine[];
 generatedKey?:string; transcript?:string; transcribedParts?:string[];
}
export interface DrawingMusic { trackId: string; volume: number; loop: boolean; }
export interface DrawingMusicAsset { id: string; name: string; source: string; duration: number; }
export const drawingKinds: {id:DrawingKind;label:string}[] = [
  {id:'person',label:'사람'},{id:'animal',label:'동물'},{id:'plant',label:'식물'},
  {id:'nature',label:'자연'},{id:'prop',label:'소품'},{id:'background',label:'배경'},
];
export const drawingMotions: {id:DrawingMotion;label:string;description:string}[] = [
  {id:'still',label:'가만히',description:'원래 그림 그대로 있어요.'},
  {id:'walk',label:'걷기',description:'원본 그림의 아래쪽을 번갈아 움직여 걷는 느낌을 내요. 정면으로 서 있는 인물에 잘 맞아요.'},
  {id:'run',label:'달리기',description:'몸을 살짝 기울이고 발 쪽을 빠르게 움직여요. 도착할 곳을 정하면 달려가요.'},
  {id:'dance',label:'춤추기',description:'몸을 좌우로 흔들고 리듬에 맞춰 쭉 늘었다 줄어요.'},
  {id:'move',label:'이동',description:'그림 전체가 이동해요. 다리가 따로 걷는 동작은 아니에요.'},
  {id:'hop',label:'점프',description:'무릎을 굽히듯 살짝 줄었다가 위로 폴짝 뛰어요.'},
  {id:'sway',label:'살랑살랑',description:'식물은 아래쪽을 고정하고 부드럽게 휘어요.'},
  {id:'float',label:'둥실둥실',description:'공중에 떠 있는 듯 움직여요. 날개 관절은 바뀌지 않아요.'},
  {id:'swim',label:'헤엄',description:'그림 전체를 물결처럼 살짝 휘어요.'},
  {id:'bounce',label:'통통',description:'공처럼 위아래로 튕겨요.'},
];
export function motionsFor(kind:DrawingKind):DrawingMotion[]{
  if(kind==='plant')return ['still','sway','hop'];
  if(kind==='nature')return ['still','move','float','sway'];
  if(kind==='animal')return ['still','walk','run','dance','move','hop','float','swim'];
  if(kind==='person')return ['still','walk','run','hop','dance','move','sway','bounce'];
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
  const duration=(item.speed==='slow'?8:item.speed==='fast'?3:5)*(item.motion==='run'?.65:1);
  const t=Math.max(0,seconds),phase=t*(item.speed==='slow'?.65:item.speed==='fast'?1.5:1);
  const traveling=!!item.target&&item.motion!=='still';
  const progress=traveling?Math.min(1,t/duration):0;
  const x=item.x+((item.target?.x??item.x)-item.x)*progress;
  let y=item.y+((item.target?.y??item.y)-item.y)*progress,angle=item.rotation;
  // A destination is a finite action: motion accents run while travelling, then the drawing settles exactly at the target.
  // Drawings without a destination keep their chosen idle motion looping.
  const animateAccent=!traveling||progress<1;
  if(animateAccent&&(item.motion==='hop'||item.motion==='bounce'))y-=Math.abs(Math.sin(phase*Math.PI*1.5))*(item.motion==='hop'?7:4);
  if(animateAccent&&item.motion==='float')y-=Math.sin(phase*1.6)*2.5;
  if(animateAccent&&item.motion==='sway')angle+=Math.sin(phase*2)*4;
  // Fade action poses at the start/end of a path so the original cutout settles cleanly.
  const weight=Math.min(1,phase*5)*(traveling?Math.min(1,(1-progress)*8):1);
  if(animateAccent&&(item.motion==='walk'||item.motion==='run')){
    const cycle=phase*(item.motion==='run'?12:7);
    y-=Math.abs(Math.sin(cycle))*(item.motion==='run'?1.8:.65)*weight;
    angle+=(Math.sin(cycle)*2+(item.motion==='run'?5:0))*weight;
  }
  if(animateAccent&&item.motion==='dance')angle+=Math.sin(phase*5)*9*weight;
  return {x,y,angle,phase,progress};
}
