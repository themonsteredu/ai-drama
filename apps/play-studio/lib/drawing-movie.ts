import type {DrawingProject,DrawingScene} from '../../../packages/stage-core/src/drawing';
import {drawDrawingScene,DRAW_WIDTH,DRAW_HEIGHT,type RasterCache} from './drawing-renderer';
import {effectiveMusic,musicPlaybackKey,synthMusic} from './drawing-music';
import {activeNarration,narrationDurations} from './film-narration';
import {createTransitionPainter,incomingTransition} from './drawing-transition';
import {loadDrawingImages} from './drawing-media';

/** Automatic scenes start with their recording and cut when that recording ends. */
export const SCENE_PAD=0,SCENE_MIN=2.5,SCENE_SILENT=4,VOICE_LEAD=0;
export function sceneSeconds(scene:DrawingScene){
 const minimum=scene.voice?scene.voice.duration:scene.durationSeconds!==undefined?1:SCENE_MIN;
 return Math.max(minimum,scene.durationSeconds??scene.voice?.duration??SCENE_SILENT);
}
export function movieTimeline(project:DrawingProject){
 const durations=narrationDurations(project);let at=0;
 return project.scenes.map((scene,index)=>{const seconds=durations?.[index]??sceneSeconds(scene),step={scene,seconds,at};at+=seconds;return step;});
}
export function movieSeconds(project:DrawingProject){return movieTimeline(project).reduce((n,s)=>n+s.seconds,0);}
export function clockLabel(seconds:number){
 const rounded=Math.max(0,Math.round(seconds*100)/100),minutes=Math.floor(rounded/60),rest=Number((rounded-minutes*60).toFixed(2));
 return `${minutes}분 ${rest<10?'0':''}${rest}초`;
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
 const preset=/^\/play-music\/(music-[a-z]+)\.wav$/.exec(url);
 if(preset)return context.decodeAudioData(await synthMusic(preset[1]).arrayBuffer());
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

type MovieStep=ReturnType<typeof movieTimeline>[number];
type MovieTrack={buffer:AudioBuffer;at:number;seconds:number;volume:number;loop:boolean};

async function movieTracks(project:DrawingProject,plan:MovieStep[],context:AudioContext){
 const tracks:MovieTrack[]=[],cache=new Map<string,AudioBuffer|null>();
 async function audio(url:string){
  if(!cache.has(url))cache.set(url,await decodeQuietly(context,url));
  return cache.get(url);
 }
 const narration=activeNarration(project);
 if(narration){
  const buffer=await audio(narration.source);
  if(!buffer)throw new Error('전체 녹음을 읽지 못했어요. 녹음을 다시 올려 주세요.');
  const last=plan[plan.length-1];
  tracks.push({buffer,at:0,seconds:last.at+last.seconds,volume:1,loop:false});
 }
 let previousMusic:{track:MovieTrack;key:string;settings:string}|null=null;
 for(const {scene,at,seconds} of plan){
  const music=musicSource(project,scene);
  if(music){
   const buffer=await audio(music.url);
   if(!buffer)throw new Error('배경음악을 읽지 못했어요. 음악을 다시 선택해 주세요.');
   const key=musicPlaybackKey(scene),settings=JSON.stringify(music);
   // Keep a soundtrack continuous across adjacent scenes with the same settings.
   if(previousMusic&&previousMusic.key===key&&previousMusic.settings===settings){
    previousMusic.track.seconds+=seconds;
   }else{
    const track={buffer,at,seconds,volume:music.volume,loop:music.loop};
    previousMusic={track,key,settings};
    tracks.push(track);
   }
  }else{
   previousMusic=null;
  }
  if(scene.voice&&!narration){
   const buffer=await audio(scene.voice.source);
   if(!buffer)throw new Error(`${scene.title}의 대사 파일을 읽지 못했어요. 녹음 파일을 다시 넣어 주세요.`);
   tracks.push({buffer,at:at+VOICE_LEAD,seconds,volume:1,loop:false});
  }
 }
 return tracks;
}

function scheduleTracks(context:AudioContext,destination:AudioNode,tracks:MovieTrack[],base:number,sources:AudioBufferSourceNode[]){
 for(const {buffer,at,seconds,volume,loop} of tracks){
  sources.push(schedule(context,destination,buffer,base+at,seconds,volume,loop));
 }
}

function movieFrames(project:DrawingProject,plan:MovieStep[],ctx:CanvasRenderingContext2D,images:RasterCache){
 const paintTransition=createTransitionPainter();
 return (elapsed:number)=>{
  const index=plan.findIndex(step=>elapsed<step.at+step.seconds);
  if(index<0)return null;
  const step=plan[index],localSeconds=Math.max(0,elapsed-step.at);
  if(!paintTransition(ctx,project,step.scene,images,localSeconds,incomingTransition(plan,index))){
   drawDrawingScene(ctx,project,step.scene,images,localSeconds);
  }
  return {index,remaining:step.at+step.seconds-elapsed};
 };
}

/** Play the export timeline onto a visible canvas without encoding a file. */
export async function previewMovie(project:DrawingProject,canvas:HTMLCanvasElement,onProgress:MovieProgress,signal:AbortSignal){
 const ctx=canvas.getContext('2d');
 if(!ctx||typeof AudioContext==='undefined')throw new Error('이 기기에서 영상 미리보기를 열지 못했어요.');
 const context=new AudioContext(),plan=movieTimeline(project),total=movieSeconds(project);
 let frame=0;
 const stopAudio=()=>{void context.close().catch(()=>{});};
 signal.addEventListener('abort',stopAudio,{once:true});
 try{
  // Resume before awaiting the image or audio decoding to retain the tap's user activation.
  await context.resume();
  const [images,tracks]=await Promise.all([loadDrawingImages(project.assets),movieTracks(project,plan,context)]);
  if(signal.aborted)return;
  const paint=movieFrames(project,plan,ctx,images);
  paint(0);
  const base=context.currentTime;
  scheduleTracks(context,context.destination,tracks,base,[]);
  await new Promise<void>((resolve,reject)=>{
   const stop=()=>{cancelAnimationFrame(frame);resolve();};
   signal.addEventListener('abort',stop,{once:true});
   const tick=()=>{
    try{
     const elapsed=Math.max(0,context.currentTime-base),step=paint(elapsed);
     if(step){
      onProgress(elapsed/total,`장면 ${step.index+1} / ${plan.length}`);
      frame=requestAnimationFrame(tick);
     }else finish();
    }catch(error){finish(error);}
   };
   const finish=(error?:unknown)=>{
    signal.removeEventListener('abort',stop);
    if(error)reject(error);else resolve();
   };
   tick();
  });
 }finally{
  cancelAnimationFrame(frame);
  signal.removeEventListener('abort',stopAudio);
  stopAudio();
 }
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
 const total=movieSeconds(project),plan=movieTimeline(project);
 const canvas=document.createElement('canvas');canvas.width=DRAW_WIDTH;canvas.height=DRAW_HEIGHT;
 const ctx=canvas.getContext('2d');
 if(!ctx)throw new Error('영상을 만들 도구를 열지 못했어요.');
 const context=new AudioContext();
 const chunks:Blob[]=[];
 let recorder:MediaRecorder|null=null;
 const sources:AudioBufferSourceNode[]=[];
 const captureTracks:MediaStreamTrack[]=[];
 const cleanup=()=>{sources.forEach(s=>{try{s.stop();}catch{}});captureTracks.forEach(track=>track.stop());void context.close().catch(()=>{});};
 try{
  await context.resume().catch(()=>{});
  onProgress(0,'소리를 준비하고 있어요…');
  // Decode every track once up front: a stall mid-capture would be recorded as silence.
  const audio=await movieTracks(project,plan,context);
  if(canceled())throw new Error('영상 만들기를 그만두었어요.');

  const destination=context.createMediaStreamDestination();
  // An unconnected audio destination may never emit a frame. Some Chrome encoders
  // then wait forever for audio and return only a WebM header, even with valid video.
  // Feed continuous digital silence so silent scenes and gaps also have timestamps.
  const silence=context.createBufferSource();silence.buffer=context.createBuffer(1,context.sampleRate,context.sampleRate);
  silence.loop=true;silence.connect(destination);silence.start();sources.push(silence);
  const monitor=context.createGain();monitor.gain.value=1;monitor.connect(context.destination);
  const stream=canvas.captureStream(30);
  const videoTrack=stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack|undefined;
  const tracks=[...stream.getVideoTracks(),...destination.stream.getAudioTracks()];
  captureTracks.push(...tracks);
  if(!tracks.length)throw new Error('이 기기에서는 영상 파일을 만들 수 없어요. 아래 「화면 녹화로 만들기」를 눌러 주세요.');
  recorder=new MediaRecorder(new MediaStream(tracks),{mimeType,videoBitsPerSecond:1_800_000,audioBitsPerSecond:128_000});
  recorder.ondataavailable=event=>{if(event.data?.size)chunks.push(event.data);};
  const stopped=new Promise<void>((resolve,reject)=>{
   recorder!.onstop=()=>resolve();
   recorder!.onerror=()=>reject(new Error('영상을 만드는 중에 멈췄어요. 장면을 줄이고 다시 해 볼까요?'));
  });

  // The first frame must exist before capture starts, or the file opens on a blank screen.
  const paint=movieFrames(project,plan,ctx,images);
  paint(0);
  // One blob, no timeslice: asking for chunks makes Chrome drop the header's Duration
  // field altogether, and the saved movie then reports no length at all.
  recorder.start();
  videoTrack?.requestFrame?.();
  const base=context.currentTime;
  scheduleTracks(context,destination,audio,base,sources);
  scheduleTracks(context,monitor,audio,base,sources);

  await new Promise<void>((resolve,reject)=>{
   const tick=()=>{
    if(canceled()){reject(new Error('영상 만들기를 그만두었어요.'));return;}
    // Use the same clock that schedules the dialogue; rendering delays must not advance the cut early.
    const elapsed=Math.max(0,context.currentTime-base);
    try{
     const step=paint(elapsed);
     if(!step){resolve();return;}
     videoTrack?.requestFrame?.();
     onProgress(Math.min(.99,elapsed/total),`${step.index+1} / ${plan.length} 장면을 담는 중…`);
     // An off-screen canvas can be throttled. Wake on the audio clock at the next frame or cut.
     window.setTimeout(tick,Math.max(1,Math.min(1000/30,step.remaining*1000)));
    }catch(error){reject(error);}
   };
   tick();
  });

  onProgress(.99,'영상을 마무리하는 중…');
  recorder.stop();
  await stopped;
  const raw=new Blob(chunks,{type:recorder.mimeType||mimeType});
  if(raw.size<1024)throw new Error('영상에 장면이 담기지 않았어요. 다시 저장하거나 「화면 녹화로 만들기」를 써 주세요.');
  const blob=await stampWebmDuration(raw,total).catch(()=>raw);
  return {blob,extension:movieExtension(recorder.mimeType||mimeType),seconds:total,lostVoices:0};
 }finally{
  if(recorder&&recorder.state!=='inactive'){try{recorder.stop();}catch{}}
  cleanup();
 }
}
