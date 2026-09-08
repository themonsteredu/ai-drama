import type {DrawingProject,DrawingScene,DrawingMusic,DrawingMusicAsset} from '../../../packages/stage-core/src/drawing';

export const MUSIC_FILE_LIMIT=3_000_000, MUSIC_TOTAL_LIMIT=8_000_000; // 6MB binary after base64
// Original procedural compositions; no samples or external melodies. See docs/play-music.md.
export const musicPresets=[
 {id:'music-happy',label:'신나는',icon:'☀️',bpm:120,notes:[72,76,79,74,77,81,79,76],bass:48},
 {id:'music-calm',label:'잔잔한',icon:'🌿',bpm:64,notes:[67,74,71,69,64,71,69,67],bass:43},
 {id:'music-adventure',label:'모험',icon:'🧭',bpm:104,notes:[60,67,72,70,67,74,72,67],bass:36},
 {id:'music-tension',label:'긴장',icon:'🌘',bpm:96,notes:[57,58,64,58,57,63,64,58],bass:33},
 {id:'music-cute',label:'귀여운',icon:'🐣',bpm:132,notes:[79,84,81,79,76,81,84,86],bass:48},
 {id:'music-sad',label:'슬픈',icon:'🌧️',bpm:60,notes:[69,64,67,65,64,62,59,57],bass:45},
] as const;
export function effectiveMusic(p:DrawingProject,s:DrawingScene):DrawingMusic|null{return s.music===undefined?p.music??null:s.music;}
export function validMusicSource(v:unknown):v is string{return typeof v==='string'&&v.length<=4_000_100&&/^data:audio\/(mpeg|mp3|wav|x-wav|wave|mp4|x-m4a|aac|ogg|webm|flac);base64,[A-Za-z0-9+/]+={0,2}$/.test(v);}
export function validateMusic(p:Record<string,unknown>):boolean{
 const assets=p.musicAssets??[];if(!Array.isArray(assets)||assets.length>6)return false;
 const ids=new Set<string>(musicPresets.map(t=>t.id));let bytes=0;
 for(const a of assets){if(!a||typeof a!=='object'||typeof a.id!=='string'||!a.id.startsWith('audio-')||a.id.length>150||ids.has(a.id)||typeof a.name!=='string'||a.name.length>80||!validMusicSource(a.source)||typeof a.duration!=='number'||!Number.isFinite(a.duration)||a.duration<=0||a.duration>120)return false;ids.add(a.id);bytes+=a.source.length;}
 if(bytes>MUSIC_TOTAL_LIMIT)return false;
 const valid=(v:unknown)=>v===undefined||v===null||(typeof v==='object'&&'trackId' in v&&typeof v.trackId==='string'&&ids.has(v.trackId)&&'volume' in v&&typeof v.volume==='number'&&Number.isFinite(v.volume)&&v.volume>=0&&v.volume<=1&&'loop' in v&&typeof v.loop==='boolean');
 return valid(p.music)&&Array.isArray(p.scenes)&&p.scenes.every(s=>s&&typeof s==='object'&&valid(s.music));
}
export function applyMusic(p:DrawingProject,music:DrawingMusic|null,all:boolean,asset?:DrawingMusicAsset):DrawingProject{
 const next={...p,music:all?music:p.music,scenes:p.scenes.map(s=>all?{...s,music:undefined}:s.id===p.activeSceneId?{...s,music}:s)};
 const used=new Set([next.music?.trackId,...next.scenes.map(s=>s.music?.trackId)]);
 next.musicAssets=[...(p.musicAssets??[]),...(asset&&!(p.musicAssets??[]).some(a=>a.id===asset.id)?[asset]:[])].filter(a=>used.has(a.id));
 if(next.musicAssets.reduce((n,a)=>n+a.source.length,0)>MUSIC_TOTAL_LIMIT||next.musicAssets.length>6)throw new Error('작품의 음악은 모두 합쳐 6MB, 6개까지예요. 다른 장면의 음악을 빼고 다시 골라 주세요.');
 return next;
}
function synthWave(id:string):ArrayBuffer{
 const preset=musicPresets.find(t=>t.id===id);if(!preset)throw new Error('음악을 찾지 못했어요.');
 const rate=22050,beat=60/preset.bpm,length=beat*32,count=Math.ceil(rate*length),buffer=new ArrayBuffer(44+count*2),view=new DataView(buffer);
 const str=(offset:number,s:string)=>{for(let i=0;i<s.length;i++)view.setUint8(offset+i,s.charCodeAt(i));};
 str(0,'RIFF');view.setUint32(4,36+count*2,true);str(8,'WAVEfmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);str(36,'data');view.setUint32(40,count*2,true);
 const hz=(m:number)=>440*2**((m-69)/12);
 for(let i=0;i<count;i++){const t=i/rate,k=Math.floor(t/beat),u=t%beat,n=preset.notes[k%8],env=Math.min(1,u/.018)*Math.max(0,1-u/(beat*.93));const melody=Math.sin(2*Math.PI*hz(n)*u)+.22*Math.sin(4*Math.PI*hz(n)*u);const bass=.24*Math.sin(2*Math.PI*hz(preset.bass+(Math.floor(k/8)%2)*5)*t);const edge=Math.min(1,t/.025,(length-t)/.04);view.setInt16(44+i*2,Math.round((melody*.26*env+bass*.5)*edge*32767),true);}
 return buffer;
}
export function synthMusic(id:string):Blob{return new Blob([synthWave(id)],{type:'audio/wav'});}
export async function readMusic(file:File):Promise<DrawingMusicAsset>{
 if(!file.size||file.size>MUSIC_FILE_LIMIT)throw new Error('음악 파일은 3MB 이하로 골라 주세요.');
 const ext=file.name.split('.').at(-1)?.toLowerCase()??'';
 const mime=({mp3:'audio/mpeg',wav:'audio/wav',m4a:'audio/mp4',aac:'audio/aac',ogg:'audio/ogg',webm:'audio/webm',flac:'audio/flac'} as Record<string,string>)[ext];
 if(!mime)throw new Error('MP3, WAV, M4A, AAC 등 음악 파일을 골라 주세요.');
 const source=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).replace(/^data:[^;]*;/,`data:${mime};`));reader.onerror=()=>reject(new Error('음악 파일을 읽지 못했어요.'));reader.readAsDataURL(file);});
 const duration=await new Promise<number>((resolve,reject)=>{const audio=new Audio();const timer=setTimeout(()=>finish(new Error('음악을 읽는 시간이 길어요. MP3나 WAV로 다시 골라 주세요.')),10000);function finish(error?:Error){clearTimeout(timer);const d=audio.duration;audio.onloadedmetadata=null;audio.onerror=null;audio.removeAttribute('src');audio.load();error?reject(error):resolve(d);}audio.onloadedmetadata=()=>Number.isFinite(audio.duration)&&audio.duration>0&&audio.duration<=120?finish():finish(new Error('음악은 2분 이하로 골라 주세요.'));audio.onerror=()=>finish(new Error('이 브라우저에서 재생할 수 없는 음악이에요. MP3나 WAV로 바꿔 주세요.'));audio.src=source;});
 return {id:`audio-${crypto.randomUUID()}`,name:file.name.slice(0,80),source,duration};
}

/** One active media element per player; common tracks keep their element across scenes. */
export class DrawingMusicPlayer{
 private audio:HTMLAudioElement|null=null;private key='';private generation=0;
 private element(){if(!this.audio){this.audio=new Audio();this.audio.dataset.moakitMusic='true';this.audio.preload='auto';}return this.audio;}
 play(p:DrawingProject,s:DrawingScene,onError:(message:string)=>void,onEnded?:()=>void){
  const m=effectiveMusic(p,s);if(!m){this.stop();return;}
  const key=`${s.music===undefined?'all':s.id}:${m.trackId}`;
  if(this.key!==key){this.stop();this.key=key;const next=this.element(),asset=p.musicAssets?.find(a=>a.id===m.trackId);next.src=asset?asset.source:`/play-music/${m.trackId}.wav`;}
  const audio=this.element();
  audio.onended=onEnded??null;audio.volume=m.volume;audio.loop=m.loop;const generation=++this.generation;
  // A finished non-looping track stays finished across a common-music scene switch.
  if(audio.ended&&!audio.loop)return;
  void audio.play().catch(error=>{if(generation===this.generation&&error?.name!=='AbortError')onError('음악을 재생하지 못했어요. 음악 파일을 확인하고 움직여 보기를 다시 눌러 주세요.');});
 }
 pause(){this.generation++;this.audio?.pause();}
 // Preserve a paused common track's source and playback position across scenes.
 stop(){this.pause();if(this.audio?.readyState){this.audio.currentTime=0;}this.key='';}
 dispose(){this.stop();if(this.audio){this.audio.removeAttribute('src');this.audio.load();this.audio=null;}}
}
