import type {DrawingProject,DrawingScene,DrawingVoice} from '../../../packages/stage-core/src/drawing';

/** A second-grader's line is one or two sentences; twenty seconds is already generous. */
export const VOICE_MAX_SECONDS=20;
export const VOICE_FILE_LIMIT=1_400_000,VOICE_TOTAL_LIMIT=6_000_000;
/** 64 kbps mono keeps a full-length take near 200 KB once base64-encoded. */
const VOICE_BITRATE=64_000;

// Devices disagree on what they can record: Android Chrome gives webm/opus, iPad Safari mp4/aac.
const RECORD_TYPES=['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/mp4;codecs=mp4a.40.2','audio/aac','audio/ogg;codecs=opus'];
export function voiceMimeType(){
 if(typeof MediaRecorder==='undefined')return '';
 return RECORD_TYPES.find(type=>{try{return MediaRecorder.isTypeSupported(type);}catch{return false;}})??'';
}
export function voiceSupported(){
 return typeof navigator!=='undefined'&&!!navigator.mediaDevices?.getUserMedia&&typeof MediaRecorder!=='undefined';
}
export function validVoiceSource(v:unknown):v is string{
 return typeof v==='string'&&v.length<=2_000_000&&/^data:audio\/(webm|mp4|aac|mpeg|ogg|wav|x-m4a)(;codecs=[\w.,=-]+)?;base64,[A-Za-z0-9+/]+={0,2}$/.test(v);
}
export function voiceBytes(p:{scenes?:unknown}){
 return Array.isArray(p.scenes)?p.scenes.reduce((sum:number,s:unknown)=>{const v=(s as {voice?:{source?:unknown}})?.voice;return sum+(typeof v?.source==='string'?v.source.length:0);},0):0;
}
/** Loading a file must not be a way to smuggle in oversized or unplayable audio. */
export function validateVoices(p:Record<string,unknown>):boolean{
 if(!Array.isArray(p.scenes))return false;
 for(const scene of p.scenes){
  if(!scene||typeof scene!=='object')return false;
  const voice=(scene as Record<string,unknown>).voice;
  if(voice===undefined)continue;
  if(!voice||typeof voice!=='object'||Array.isArray(voice))return false;
  const v=voice as Record<string,unknown>;
  if(typeof v.id!=='string'||!v.id.startsWith('voice-')||v.id.length>150)return false;
  if(!validVoiceSource(v.source))return false;
  if(typeof v.duration!=='number'||!Number.isFinite(v.duration)||v.duration<=0||v.duration>VOICE_MAX_SECONDS+2)return false;
 }
 return voiceBytes(p as {scenes?:unknown})<=VOICE_TOTAL_LIMIT;
}
export function sceneVoice(scene:DrawingScene){return scene.voice??null;}
export function applyVoice(p:DrawingProject,sceneId:string,voice:DrawingVoice|null):DrawingProject{
 const next={...p,scenes:p.scenes.map(s=>{
  if(s.id!==sceneId)return s;
  const copy={...s};
  if(voice)copy.voice=voice;else delete copy.voice;
  return copy;
 })};
 if(voiceBytes(next)>VOICE_TOTAL_LIMIT)throw new Error('담은 목소리가 모두 합쳐 6MB를 넘어요. 다른 장면의 목소리를 지우고 다시 담아 주세요.');
 return next;
}

function friendlyMicError(cause:unknown){
 const name=cause instanceof Error?cause.name:'';
 if(name==='NotAllowedError'||name==='SecurityError')return '마이크를 쓰도록 허락해 주세요. 화면에 뜬 물음에 「허용」을 누르면 돼요.';
 if(name==='NotFoundError'||name==='OverconstrainedError')return '이 기기에서 마이크를 찾지 못했어요. 선생님께 말씀드려 주세요.';
 if(name==='NotReadableError')return '다른 앱이 마이크를 쓰고 있어요. 그 앱을 닫고 다시 해 볼까요?';
 return '마이크를 켜지 못했어요. 잠시 뒤에 다시 해 볼까요?';
}

export type VoiceSession={
 /** Resolves with the take, or null when nothing was captured. */
 stop:()=>Promise<DrawingVoice|null>;
 cancel:()=>void;
};

/**
 * Recorded length comes from the clock, not from the file: a webm take from
 * MediaRecorder usually carries no duration and reads back as Infinity.
 */
export async function startVoiceRecording(onTick:(seconds:number)=>void):Promise<VoiceSession>{
 if(!voiceSupported())throw new Error('이 기기에서는 목소리를 담을 수 없어요. 선생님께 말씀드려 주세요.');
 const mimeType=voiceMimeType();
 let stream:MediaStream;
 try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});}
 catch(cause){throw new Error(friendlyMicError(cause));}
 let recorder:MediaRecorder;
 try{recorder=new MediaRecorder(stream,mimeType?{mimeType,audioBitsPerSecond:VOICE_BITRATE}:{audioBitsPerSecond:VOICE_BITRATE});}
 catch{stream.getTracks().forEach(t=>t.stop());throw new Error('이 기기에서는 목소리를 담을 수 없어요. 선생님께 말씀드려 주세요.');}

 const chunks:Blob[]=[];let canceled=false,settled=false,timer=0,ticker=0;
 const started=performance.now();
 const elapsed=()=>Math.min(VOICE_MAX_SECONDS,(performance.now()-started)/1000);
 const release=()=>{clearTimeout(timer);clearInterval(ticker);stream.getTracks().forEach(t=>t.stop());};
 recorder.ondataavailable=event=>{if(event.data?.size)chunks.push(event.data);};
 const finished=new Promise<DrawingVoice|null>((resolve,reject)=>{
  recorder.onerror=()=>{if(settled)return;settled=true;release();reject(new Error('녹음을 마치지 못했어요. 다시 해 볼까요?'));};
  recorder.onstop=()=>{
   if(settled)return;settled=true;const seconds=elapsed();release();
   if(canceled||!chunks.length){resolve(null);return;}
   const blob=new Blob(chunks,{type:recorder.mimeType||mimeType||'audio/webm'});
   if(!blob.size){resolve(null);return;}
   if(blob.size>VOICE_FILE_LIMIT){reject(new Error('목소리가 너무 길게 담겼어요. 조금 더 짧게 다시 담아 주세요.'));return;}
   const reader=new FileReader();
   reader.onerror=()=>reject(new Error('담은 목소리를 읽지 못했어요. 다시 해 볼까요?'));
   reader.onload=()=>{
    const source=String(reader.result);
    if(!validVoiceSource(source)){reject(new Error('이 기기가 만든 소리 파일을 쓸 수 없어요. 선생님께 말씀드려 주세요.'));return;}
    resolve({id:`voice-${crypto.randomUUID()}`,source,duration:Math.max(.4,Number(seconds.toFixed(2)))});
   };
   reader.readAsDataURL(blob);
  };
 });
 recorder.start();
 ticker=window.setInterval(()=>onTick(elapsed()),100);
 timer=window.setTimeout(()=>{if(recorder.state==='recording')recorder.stop();},VOICE_MAX_SECONDS*1000);
 const halt=()=>{clearTimeout(timer);clearInterval(ticker);if(recorder.state==='recording')recorder.stop();else if(!settled){settled=true;release();}};
 return {
  stop:()=>{halt();return finished;},
  cancel:()=>{canceled=true;halt();void finished.catch(()=>{});},
 };
}

/** One element at a time, so a scene change never leaves an earlier take talking. */
export class VoicePlayer{
 private audio:HTMLAudioElement|null=null;
 private element(){if(!this.audio){this.audio=new Audio();this.audio.dataset.moakitVoice='true';this.audio.preload='auto';}return this.audio;}
 play(voice:DrawingVoice,onError:(message:string)=>void,onEnded?:()=>void){
  const audio=this.element();
  if(audio.dataset.voiceId!==voice.id){audio.pause();audio.dataset.voiceId=voice.id;audio.src=voice.source;}
  audio.currentTime=0;audio.onended=onEnded??null;
  void audio.play().catch(()=>onError('담은 목소리를 들려주지 못했어요. 화면을 한 번 누르고 다시 해 볼까요?'));
 }
 stop(){if(this.audio){this.audio.pause();this.audio.onended=null;try{this.audio.currentTime=0;}catch{}}}
 dispose(){if(this.audio){this.audio.pause();this.audio.onended=null;this.audio.removeAttribute('src');this.audio.load();this.audio=null;}}
}
