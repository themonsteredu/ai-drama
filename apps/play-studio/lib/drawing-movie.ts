import type {DrawingProject,DrawingScene} from '../../../packages/stage-core/src/drawing';
import {drawDrawingScene,DRAW_WIDTH,DRAW_HEIGHT,type RasterCache} from './drawing-renderer';
import {effectiveMusic} from './drawing-music';

/** A scene lasts as long as its voice, plus a breath. Silent scenes get a readable default. */
export const SCENE_PAD=.7,SCENE_MIN=2.5,SCENE_SILENT=4,VOICE_LEAD=.25;
export function sceneSeconds(scene:DrawingScene){
 return Math.max(SCENE_MIN,scene.voice?scene.voice.duration+VOICE_LEAD+SCENE_PAD:SCENE_SILENT);
}
export function movieSeconds(project:DrawingProject){
 return project.scenes.reduce((sum,scene)=>sum+sceneSeconds(scene),0);
}
export function clockLabel(seconds:number){
 const whole=Math.max(0,Math.round(seconds));
 return `${Math.floor(whole/60)}분 ${String(whole%60).padStart(2,'0')}초`;
}

// H.264 MP4 travels furthest — school computers, Padlet, messengers — so ask for it by name first.
// Bare 'video/mp4' comes last on purpose: a browser without an H.264 encoder answers yes to it and
// then writes VP9 inside an .mp4, which many players refuse. Plain webm is the honest fallback there,
// and iPad, which cannot record webm at all, still lands on MP4.
const MOVIE_TYPES=['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4;codecs=avc1,mp4a.40.2','video/webm;codecs=vp8,opus','video/webm;codecs=vp9,opus','video/webm','video/mp4'];
export function movieMimeType(){
 if(typeof MediaRecorder==='undefined')return '';
 return MOVIE_TYPES.find(type=>{try{return MediaRecorder.isTypeSupported(type);}catch{return false;}})??'';
}
export function movieExtension(mimeType:string){return mimeType.startsWith('video/mp4')?'mp4':'webm';}
/** Some tablets can play a story back but cannot write a video file; the screen recorder is their way out. */
export function movieSupported(){
 if(typeof window==='undefined')return false;
 const audio=typeof window.AudioContext!=='undefined';
 const capture=typeof HTMLCanvasElement!=='undefined'&&typeof HTMLCanvasElement.prototype.captureStream==='function';
 return audio&&capture&&typeof MediaRecorder!=='undefined'&&!!movieMimeType();
}

function musicSource(project:DrawingProject,scene:DrawingScene){
 const music=effectiveMusic(project,scene);
 if(!music)return null;
 const asset=project.musicAssets?.find(a=>a.id===music.trackId);
 return {url:asset?asset.source:`/play-music/${music.trackId}.wav`,volume:music.volume,loop:music.loop};
}
async function decode(context:AudioContext,url:string){
 const response=await fetch(url);
 if(!response.ok)throw new Error('소리를 읽지 못했어요.');
 return context.decodeAudioData(await response.arrayBuffer());
}
/** A take recorded on one kind of tablet may not decode on another; that loses a voice, not the movie. */
async function decodeQuietly(context:AudioContext,url:string){
 try{return await decode(context,url);}catch{return null;}
}
function schedule(context:AudioContext,destination:AudioNode,buffer:AudioBuffer,at:number,seconds:number,volume:number,loop:boolean){
 const source=context.createBufferSource(),gain=context.createGain();
 source.buffer=buffer;source.loop=loop&&buffer.duration<seconds;
 gain.gain.value=volume;source.connect(gain);gain.connect(destination);
 source.start(at,0,loop?seconds:Math.min(buffer.duration,seconds));
 return source;
}

/** Reads an EBML variable-length integer and says how many bytes it used. */
function varint(bytes:Uint8Array,at:number){
 const first=bytes[at];if(first===undefined||first===0)return null;
 let width=1;for(let mask=0x80;mask&&!(first&mask);mask>>=1)width++;
 if(at+width>bytes.length)return null;
 let value=first&(0xff>>width);
 for(let i=1;i<width;i++)value=value*256+bytes[at+i];
 return {value,width};
}
/**
 * Chrome writes a placeholder Duration into the webm header and never comes back to
 * correct it, so players show the movie as having no length. The element is already
 * there at its final size, so filling in the real value moves no other byte.
 */
export async function stampWebmDuration(blob:Blob,seconds:number):Promise<Blob>{
 if(!blob.type.includes('webm')||!(seconds>0))return blob;
 const size=Math.min(blob.size,2048);
 const head=new Uint8Array(await blob.slice(0,size).arrayBuffer());
 for(let i=0;i<head.length-8;i++){
  // The Info element id, skipping the copy that only appears as a SeekHead pointer.
  if(head[i]!==0x15||head[i+1]!==0x49||head[i+2]!==0xa9||head[i+3]!==0x66)continue;
  if(i>=3&&head[i-3]===0x53&&head[i-2]===0xab&&head[i-1]===0x84)continue;
  const length=varint(head,i+4);
  if(!length)continue;
  const from=i+4+length.width,to=Math.min(head.length,from+length.value);
  for(let j=from;j<to-2;j++){
   if(head[j]!==0x44||head[j+1]!==0x89)continue;
   const width=head[j+2]===0x84?4:head[j+2]===0x88?8:0;
   if(!width||j+3+width>to)break;
   const view=new DataView(head.buffer,head.byteOffset,head.byteLength);
   // Duration counts TimecodeScale units, and Chrome's scale is one millisecond.
   if(width===4)view.setFloat32(j+3,seconds*1000);else view.setFloat64(j+3,seconds*1000);
   return new Blob([head,blob.slice(size)],{type:blob.type});
  }
 }
 return blob;
}

export type MovieProgress=(ratio:number,label:string)=>void;
export type MovieResult={blob:Blob;extension:string;seconds:number;lostVoices:number};

/**
 * Plays the whole story once onto an off-screen canvas and records what plays.
 * Capture is real time — a MediaRecorder cannot run faster than the story does.
 */
export async function recordMovie(project:DrawingProject,images:RasterCache,onProgress:MovieProgress,canceled:()=>boolean):Promise<MovieResult>{
 const mimeType=movieMimeType();
 if(!movieSupported()||!mimeType)throw new Error('이 기기에서는 영상 파일을 만들 수 없어요. 아래 「화면 녹화로 만들기」를 눌러 주세요.');
 const total=movieSeconds(project);
 const canvas=document.createElement('canvas');canvas.width=DRAW_WIDTH;canvas.height=DRAW_HEIGHT;
 const ctx=canvas.getContext('2d');
 if(!ctx)throw new Error('영상을 만들 도구를 열지 못했어요.');
 const context=new AudioContext();
 const chunks:Blob[]=[];
 let recorder:MediaRecorder|null=null;
 const sources:AudioBufferSourceNode[]=[];
 const cleanup=()=>{sources.forEach(s=>{try{s.stop();}catch{}});void context.close().catch(()=>{});};
 try{
  await context.resume().catch(()=>{});
  onProgress(0,'소리를 준비하고 있어요…');
  // Decode every track once up front: a stall mid-capture would be recorded as silence.
  const cache=new Map<string,AudioBuffer|null>();
  let lostVoices=0;
  const plan:{scene:DrawingScene;at:number;seconds:number;music:ReturnType<typeof musicSource>;voice:AudioBuffer|null}[]=[];
  let at=0;
  for(const scene of project.scenes){
   const music=musicSource(project,scene);
   if(music&&!cache.has(music.url))cache.set(music.url,await decodeQuietly(context,music.url));
   let voice:AudioBuffer|null=null;
   if(scene.voice){
    if(!cache.has(scene.voice.source))cache.set(scene.voice.source,await decodeQuietly(context,scene.voice.source));
    voice=cache.get(scene.voice.source)??null;
    if(!voice)lostVoices+=1;
   }
   plan.push({scene,at,seconds:sceneSeconds(scene),music,voice});
   at+=sceneSeconds(scene);
  }
  if(canceled())throw new Error('영상 만들기를 그만두었어요.');

  const destination=context.createMediaStreamDestination();
  const monitor=context.createGain();monitor.gain.value=1;monitor.connect(context.destination);
  const stream=canvas.captureStream(30);
  const tracks=[...stream.getVideoTracks(),...destination.stream.getAudioTracks()];
  if(!tracks.length)throw new Error('이 기기에서는 영상 파일을 만들 수 없어요. 아래 「화면 녹화로 만들기」를 눌러 주세요.');
  recorder=new MediaRecorder(new MediaStream(tracks),{mimeType,videoBitsPerSecond:1_800_000,audioBitsPerSecond:128_000});
  recorder.ondataavailable=event=>{if(event.data?.size)chunks.push(event.data);};
  const stopped=new Promise<void>((resolve,reject)=>{
   recorder!.onstop=()=>resolve();
   recorder!.onerror=()=>reject(new Error('영상을 만드는 중에 멈췄어요. 장면을 줄이고 다시 해 볼까요?'));
  });

  // The first frame must exist before capture starts, or the file opens on a blank screen.
  drawDrawingScene(ctx,project,plan[0].scene,images,0);
  // One blob, no timeslice: asking for chunks makes Chrome drop the header's Duration
  // field altogether, and the saved movie then reports no length at all.
  recorder.start();
  const base=context.currentTime+.15;
  for(const step of plan){
   if(step.music){
    const buffer=cache.get(step.music.url);
    if(buffer)sources.push(schedule(context,destination,buffer,base+step.at,step.seconds,step.music.volume,step.music.loop));
    if(buffer)sources.push(schedule(context,monitor,buffer,base+step.at,step.seconds,step.music.volume,step.music.loop));
   }
   if(step.voice){
    sources.push(schedule(context,destination,step.voice,base+step.at+VOICE_LEAD,step.seconds,1,false));
    sources.push(schedule(context,monitor,step.voice,base+step.at+VOICE_LEAD,step.seconds,1,false));
   }
  }

  const startedAt=performance.now()+150;
  await new Promise<void>((resolve,reject)=>{
   let frame=0;
   const paint=()=>{
    if(canceled()){cancelAnimationFrame(frame);reject(new Error('영상 만들기를 그만두었어요.'));return;}
    const elapsed=(performance.now()-startedAt)/1000;
    if(elapsed>=total){resolve();return;}
    const index=Math.max(0,plan.findIndex(step=>elapsed<step.at+step.seconds));
    const step=plan[index<0?plan.length-1:index];
    drawDrawingScene(ctx,project,step.scene,images,Math.max(0,elapsed-step.at));
    onProgress(Math.min(.99,Math.max(0,elapsed)/total),`${index+1} / ${plan.length} 장면을 담는 중…`);
    frame=requestAnimationFrame(paint);
   };
   frame=requestAnimationFrame(paint);
  });

  onProgress(.99,'영상을 마무리하는 중…');
  recorder.stop();
  await stopped;
  const raw=new Blob(chunks,{type:recorder.mimeType||mimeType});
  if(!raw.size)throw new Error('영상이 비어 있어요. 이 기기에서는 「화면 녹화로 만들기」를 써 주세요.');
  const blob=await stampWebmDuration(raw,total).catch(()=>raw);
  return {blob,extension:movieExtension(recorder.mimeType||mimeType),seconds:total,lostVoices};
 }finally{
  if(recorder&&recorder.state!=='inactive'){try{recorder.stop();}catch{}}
  cleanup();
 }
}
