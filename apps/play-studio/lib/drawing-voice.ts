import type {DrawingProject,DrawingScene,DrawingVoice} from '../../../packages/stage-core/src/drawing';
import {audioDataUrl, monoSamples, wavBytes} from './film-narration';

/** A second-grader's line is one or two sentences; twenty seconds is already generous. */
export const VOICE_MAX_SECONDS=20;
export const VOICE_FILE_LIMIT=1_400_000,VOICE_TOTAL_LIMIT=96_000_000;
const RECORD_TYPES = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/aac'];

function recordedType(reported: string) {
  const base = reported.split(';')[0].trim().toLowerCase().replace(/^video\//, 'audio/');
  return /^audio\/(webm|mp4|aac|mpeg|ogg|wav|x-wav|x-m4a|m4a)$/.test(base) ? base : '';
}
export function validVoiceSource(v:unknown):v is string{
 return typeof v==='string'&&v.length<=27_000_000&&/^data:audio\/(webm|mp4|aac|mpeg|ogg|wav|x-wav|x-m4a|m4a)(;codecs=[\w.,=-]+)?;base64,[A-Za-z0-9+/]+={0,2}$/.test(v);
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
  if(typeof v.duration!=='number'||!Number.isFinite(v.duration)||v.duration<=0||v.duration>600.5)return false;
 }
 return voiceBytes(p as {scenes?:unknown})<=VOICE_TOTAL_LIMIT;
}
export function sceneVoice(scene:DrawingScene){return scene.voice??null;}
export function applyVoice(p:DrawingProject,sceneId:string,voice:DrawingVoice|null):DrawingProject{
 if(!p.scenes.some(s=>s.id===sceneId))return p;
 const next={...p,...(voice&&p.narration?{narration:{...p.narration,enabled:false}}:{}),scenes:p.scenes.map(s=>{
  if(s.id!==sceneId)return s;
  const copy={...s};
  if(voice){copy.voice=voice;delete copy.durationSeconds;}else delete copy.voice;
  return copy;
 })};
 if(voiceBytes(next)>VOICE_TOTAL_LIMIT)throw new Error('담은 목소리가 모두 합쳐 96MB를 넘어요. 다른 장면의 목소리를 지우고 다시 담아 주세요.');
 return next;
}

function friendlyMicError(cause: unknown) {
  const name = cause instanceof Error ? cause.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return '주소창의 사이트 설정에서 마이크를 허용한 뒤 다시 눌러 주세요. 앱 안에서 열었다면 Safari나 Chrome으로 열어 주세요.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return '마이크를 찾지 못했어요. 연결된 마이크를 확인해 주세요.';
  if (name === 'NotReadableError' || name === 'AbortError') return '마이크를 켜지 못했어요. 마이크를 쓰는 다른 앱을 닫고 다시 눌러 주세요.';
  return '마이크를 켜지 못했어요. 사이트의 마이크 권한을 확인하고 다시 눌러 주세요.';
}

export type VoiceSession = {
  stop: () => void;
  finished: Promise<DrawingVoice | null>;
};

// A browser can advertise a type and still reject it when the encoder starts.
function startRecorder(stream: MediaStream) {
  for (const type of [undefined, ...RECORD_TYPES]) {
    try {
      if (type && !MediaRecorder.isTypeSupported(type)) continue;
      const recorder = type ? new MediaRecorder(stream, {mimeType: type}) : new MediaRecorder(stream);
      recorder.start();
      return recorder;
    } catch {
      // Try the next encoder on the same microphone stream.
    }
  }
  throw new Error('이 브라우저에서 녹음을 시작할 수 없어요. Safari나 Chrome으로 열거나 이 장면에 녹음 파일을 올려 주세요.');
}

async function readRecordedTake(chunks: Blob[], reportedType: string, elapsed: number): Promise<DrawingVoice | null> {
  if (!chunks.length) return null;
  const type = recordedType(chunks[0].type) || recordedType(reportedType);
  let blob = new Blob(chunks, {type});
  let duration = elapsed;
  // Short, mono WAV clips can also be played and mixed on the teacher's device.
  try {
    const decoder = new OfflineAudioContext(1, 1, 16000);
    const buffer = await decoder.decodeAudioData(await blob.arrayBuffer());
    const samples = monoSamples(buffer).subarray(0, VOICE_MAX_SECONDS * 16000);
    if (!samples.length) return null;
    blob = new Blob([wavBytes(samples)], {type: 'audio/wav'});
    duration = samples.length / 16000;
  } catch {
    // Some browsers can play their native recordings but cannot decode them with Web Audio.
    if (!type) throw new Error('녹음 형식을 읽지 못했어요. 이 장면에 녹음 파일을 올려 주세요.');
  }
  if (blob.size > VOICE_FILE_LIMIT) throw new Error('녹음 파일이 너무 커요. 대사를 나누어 녹음해 주세요.');
  const source = await audioDataUrl(blob);
  if (!validVoiceSource(source)) throw new Error('녹음 파일을 읽지 못했어요. 다시 녹음해 주세요.');
  return {id: `voice-${crypto.randomUUID()}`, source, duration: Math.max(.01, Number(duration.toFixed(2)))};
}

export async function startVoiceRecording(onTick: (seconds: number) => void, onStopping: () => void, signal: AbortSignal): Promise<VoiceSession> {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    throw new Error('이 화면에서는 마이크를 사용할 수 없어요. PLAY 주소를 Safari나 Chrome에서 직접 열거나 녹음 파일을 올려 주세요.');
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({audio: true});
  } catch (cause) {
    throw new Error(friendlyMicError(cause));
  }
  const releaseMic = () => stream.getTracks().forEach(track => track.stop());
  let recorder: MediaRecorder;
  try {
    if (signal.aborted) throw new Error('녹음 요청을 취소했어요.');
    recorder = startRecorder(stream);
  } catch (cause) {
    releaseMic();
    throw cause;
  }

  const chunks: Blob[] = [];
  const started = performance.now();
  const elapsed = () => Math.min(VOICE_MAX_SECONDS, (performance.now() - started) / 1000);
  let stoppedAt: number | undefined;
  let ticker = 0, timer = 0;
  function stop() {
    if (stoppedAt !== undefined) return;
    stoppedAt = elapsed();
    clearInterval(ticker);
    clearTimeout(timer);
    if (!signal.aborted) onStopping();
    if (recorder.state !== 'inactive') recorder.stop();
  }
  const finished = new Promise<DrawingVoice | null>((resolve, reject) => {
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    function release() {
      clearTimeout(timer);
      clearInterval(ticker);
      signal.removeEventListener('abort', stop);
      recorder.onstop = recorder.onerror = recorder.ondataavailable = null;
      releaseMic();
    }
    recorder.onerror = () => {
      release();
      reject(new Error('녹음이 중단됐어요. 마이크 연결을 확인하고 다시 눌러 주세요.'));
    };
    recorder.onstop = () => {
      const seconds = stoppedAt ?? elapsed();
      release();
      if (signal.aborted) { resolve(null); return; }
      if (stoppedAt === undefined) onStopping();
      resolve(readRecordedTake(chunks, recorder.mimeType, seconds));
    };
  });
  signal.addEventListener('abort', stop, {once: true});
  ticker = window.setInterval(() => onTick(elapsed()), 100);
  timer = window.setTimeout(stop, VOICE_MAX_SECONDS * 1000);
  return {stop, finished};
}

/** One element at a time, so a scene change never leaves an earlier take talking. */
export class VoicePlayer{
 private audio:HTMLAudioElement|null=null;
 private element(){if(!this.audio){this.audio=new Audio();this.audio.dataset.moakitVoice='true';this.audio.preload='auto';}return this.audio;}
 get currentTime(){return this.audio?.currentTime??0;}
 get paused(){return this.audio?.paused??true;}
 play(voice:DrawingVoice,onError:(message:string)=>void,onEnded?:()=>void,onStarted?:()=>void){
  const audio=this.element();
  if(audio.dataset.voiceId!==voice.id){audio.pause();audio.dataset.voiceId=voice.id;audio.src=voice.source;}
  audio.currentTime=0;audio.onended=onEnded??null;
  void audio.play().then(()=>onStarted?.()).catch(()=>onError('담은 목소리를 들려주지 못했어요. 화면을 한 번 누르고 다시 해 볼까요?'));
 }
 stop(){if(this.audio){this.audio.pause();this.audio.onended=null;try{this.audio.currentTime=0;}catch{}}}
 dispose(){if(this.audio){this.audio.pause();this.audio.onended=null;this.audio.removeAttribute('src');this.audio.load();this.audio=null;}}
}

/** Existing class recordings can be imported without recording them again. */
export const VOICE_UPLOAD_SECONDS=180,VOICE_UPLOAD_BYTES=8_000_000;
export async function readVoice(file:File):Promise<DrawingVoice>{
 if(!file.size||file.size>VOICE_UPLOAD_BYTES)throw new Error('대사 파일은 8MB 이하로 골라 주세요.');
 const ext=file.name.split('.').pop()?.toLowerCase();
 const types:Record<string,string>={mp3:'audio/mpeg',m4a:'audio/mp4',mp4:'audio/mp4',wav:'audio/wav',aac:'audio/aac',ogg:'audio/ogg',webm:'audio/webm'};
 const type=types[ext??''];
 if(!type)throw new Error('MP3·M4A·WAV·AAC·OGG·WEBM 녹음 파일을 골라 주세요.');
 const data=await file.arrayBuffer();
 const context=new AudioContext();
 let duration:number;
 try{const buffer=await context.decodeAudioData(data.slice(0));duration=buffer.duration;}catch{throw new Error('이 녹음 파일을 재생할 수 없어요. MP3 또는 M4A로 다시 저장해 주세요.');}finally{await context.close().catch(()=>{});}
 if(!Number.isFinite(duration)||duration<=0||duration>VOICE_UPLOAD_SECONDS)throw new Error('대사는 장면마다 3분 이하로 넣어 주세요.');
 const source=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('녹음 파일을 읽지 못했어요.'));reader.readAsDataURL(new Blob([data],{type}));});
 if(!validVoiceSource(source))throw new Error('지원하지 않는 녹음 형식이에요.');
 return {id:`voice-${crypto.randomUUID()}`,source,duration};
}
