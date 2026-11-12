import {drawingId,emptyDrawingProject,validateDrawingProject,DRAWING_MAX_SCENES,DRAWING_MAX_ASSETS,type DrawingProject,type DrawingVoice,type DrawingScene} from './drawing-project';
import {activeNarration,monoSamples,wavBytes,audioDataUrl} from './film-narration';
import {effectiveMusic,musicPlaybackKey} from './drawing-music';
import {movieTimeline} from './drawing-movie';

export type GroupWork={id:string;name:string;project:DrawingProject;fingerprint?:string};
export function moveDrawingScene(project:DrawingProject,sceneId:string,direction:-1|1){
 if(activeNarration(project))return project;
 const index=project.scenes.findIndex(s=>s.id===sceneId),to=index+direction;
 if(index<0||to<0||to>=project.scenes.length)return project;
 const scenes=[...project.scenes];[scenes[index],scenes[to]]=[scenes[to],scenes[index]];return {...project,scenes};
}
/** Shared sample boundaries ensure no speech is lost or repeated between scene clips. */
export function narrationSampleRanges(project:DrawingProject,count:number,rate=16000){
 return movieTimeline(project).map(step=>({sceneId:step.scene.id,seconds:step.seconds,from:Math.min(count,Math.round(step.at*rate)),to:Math.min(count,Math.round((step.at+step.seconds)*rate))}));
}
async function sceneNarration(project:DrawingProject):Promise<Map<string,DrawingVoice|undefined>>{
 const result=new Map<string,DrawingVoice|undefined>(),voice=activeNarration(project);if(!voice)return result;
 const context=new AudioContext();
 try{
  const bytes=await (await fetch(voice.source)).arrayBuffer(),buffer=await context.decodeAudioData(bytes),samples=monoSamples(buffer);
  for(const range of narrationSampleRanges(project,samples.length)){
   const part=samples.slice(range.from,range.to);
   result.set(range.sceneId,part.length?{id:drawingId('voice'),duration:part.length/16000,source:await audioDataUrl(new Blob([wavBytes(part)],{type:'audio/wav'}))}:undefined);
  }
  return result;
 }catch{throw new Error(`${project.title}의 전체 녹음을 읽지 못했어요. 녹음이 빠지지 않도록 합치기를 멈췄어요.`);}
 finally{await context.close().catch(()=>{});}
}

/** Remap every reference: different pads often start with identical scene/asset IDs. */
export function assembleGroupProjects(works:GroupWork[],title:string,narrations:Map<string,DrawingVoice|undefined>[]=[]):DrawingProject{
 if(!works.length)throw new Error('모을 작품을 먼저 넣어 주세요.');
 if(works.reduce((n,w)=>n+w.project.scenes.length,0)>DRAWING_MAX_SCENES)throw new Error(`장면은 모두 ${DRAWING_MAX_SCENES}개까지 모을 수 있어요.`);
 const next:DrawingProject={...emptyDrawingProject(),id:drawingId('group-project'),title:title.trim().slice(0,80)||'우리 반 이야기',assets:[],scenes:[],musicAssets:[],updatedAt:new Date().toISOString()};
 for(const [index,work] of works.entries()){
  const p=work.project;if(!validateDrawingProject(p))throw new Error(`${work.name} 작품 파일을 확인해 주세요.`);
  if(activeNarration(p)&&!narrations[index]?.size)throw new Error('전체 녹음을 먼저 장면별로 준비해 주세요.');
  const assets=new Map(p.assets.map(a=>[a.id,drawingId('group-asset')])),music=new Map((p.musicAssets??[]).map(a=>[a.id,drawingId('audio')]));
  next.assets.push(...p.assets.map(a=>({...a,id:assets.get(a.id)!})));
  next.musicAssets!.push(...(p.musicAssets??[]).map(a=>({...a,id:music.get(a.id)!})));
  const plan=movieTimeline(p),musicGroups=new Map(p.scenes.map(s=>[musicPlaybackKey(s),drawingId('music-group')]));
  for(const [sceneIndex,s] of p.scenes.entries()){
   const track=effectiveMusic(p,s),narration=activeNarration(p);
   const scene:DrawingScene={...s,id:drawingId('scene'),title:`${work.name} · ${s.title}`.slice(0,40),backgroundAssetId:s.backgroundAssetId?assets.get(s.backgroundAssetId):undefined,stillOriginalAssetId:s.stillOriginalAssetId?assets.get(s.stillOriginalAssetId):undefined,
    music:track?{...track,trackId:music.get(track.trackId)??track.trackId}:null,musicGroup:musicGroups.get(musicPlaybackKey(s)),
    voice:narration?narrations[index].get(s.id):s.voice?{...s.voice,id:drawingId('voice')}:undefined,
    ...(narration?{durationSeconds:plan[sceneIndex].seconds}:{}),
    items:s.items.map(i=>({...i,id:drawingId('drawing'),assetId:assets.get(i.assetId)!,target:i.target?{...i.target}:undefined,separation:i.separation?{...i.separation,sourceAssetId:assets.get(i.separation.sourceAssetId)!}:undefined}))};
   next.scenes.push(scene);
  }
 }
 next.activeSceneId=next.scenes[0].id;
 if(next.assets.length>DRAWING_MAX_ASSETS)throw new Error(`그림이 ${DRAWING_MAX_ASSETS}개를 넘어요. 각 작품에서 쓰지 않는 그림을 정리한 뒤 다시 모아 주세요.`);
 if(!validateDrawingProject(next))throw new Error('모은 작품의 그림·녹음 용량이 커요. 작품을 나눠서 모아 주세요. 기존 작업은 그대로예요.');
 return next;
}
export async function mergeGroupProjects(works:GroupWork[],title:string,onProgress:(message:string)=>void){
 const prepared:Map<string,DrawingVoice|undefined>[]=[];
 for(const [index,work] of works.entries()){onProgress(`${index+1} / ${works.length} 모둠의 그림과 녹음을 준비해요…`);prepared.push(await sceneNarration(work.project));}
 return assembleGroupProjects(works,title,prepared);
}
