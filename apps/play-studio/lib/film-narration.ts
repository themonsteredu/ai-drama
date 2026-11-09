import type {DrawingProject,DrawingNarration,DrawingVoice,DialogueLine,DialogueSpeaker} from '../../../packages/stage-core/src/drawing';
export const NARRATION_MAX_SECONDS=600;
export const AI_VOICES=[{id:'coral',label:'코럴'},{id:'cedar',label:'시더'},{id:'marin',label:'마린'},{id:'ash',label:'애쉬'},{id:'sage',label:'세이지'},{id:'shimmer',label:'쉬머'}];
export const defaultSpeakers=():DialogueSpeaker[]=>[{name:'주인공 1',voice:'coral'},{name:'주인공 2',voice:'cedar'}];
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
function validAudio(v:unknown,maxSeconds=600){
 return object(v)&&typeof v.id==='string'&&v.id.startsWith('voice-')&&v.id.length<=150&&typeof v.duration==='number'&&Number.isFinite(v.duration)&&v.duration>0&&v.duration<=maxSeconds+.1&&typeof v.source==='string'&&v.source.length<=26_000_000&&/^data:audio\/wav;base64,[A-Za-z0-9+/]+={0,2}$/.test(v.source);
}
export function validateNarration(value:unknown){
 if(value===undefined)return true;
 if(!object(value)||!validAudio(value.original)||typeof value.enabled!=='boolean'||typeof value.useGenerated!=='boolean'||!object(value.durations))return false;
 if(value.transcript!==undefined&&(typeof value.transcript!=='string'||value.transcript.length>16000))return false;
 if(value.transcribedParts!==undefined&&(!Array.isArray(value.transcribedParts)||value.transcribedParts.length>12||!value.transcribedParts.every(t=>typeof t==='string'&&t.length<=16000)))return false;
 if(value.generated!==undefined&&!validAudio(value.generated))return false;
 if(value.useGenerated&&!value.generated)return false;
 if(Object.keys(value.durations).length>50||!Object.entries(value.durations).every(([k,v])=>k.length<=150&&typeof v==='number'&&Number.isFinite(v)&&v>=1&&v<=600))return false;
 if(!Array.isArray(value.speakers)||value.speakers.length<2||value.speakers.length>3||!value.speakers.every(s=>object(s)&&typeof s.name==='string'&&s.name.length<=40&&AI_VOICES.some(v=>v.id===s.voice)))return false;
 if(!Array.isArray(value.lines)||value.lines.length>80||!value.lines.every(l=>object(l)&&typeof l.id==='string'&&l.id.length<=150&&typeof l.sceneId==='string'&&l.sceneId.length<=150&&Number.isInteger(l.speaker)&&Number(l.speaker)>=0&&Number(l.speaker)<(value.speakers as unknown[]).length&&typeof l.text==='string'&&l.text.length<=500&&(l.clip===undefined||validAudio(l.clip,60))&&(l.clipKey===undefined||(typeof l.clipKey==='string'&&l.clipKey.length<=800))))return false;
 const bytes=(value.original as DrawingVoice).source.length+((value.generated as DrawingVoice)?.source.length??0)+(value.lines as DialogueLine[]).reduce((n,l)=>n+(l.clip?.source.length??0),0);
 return bytes<=78_000_000&&(value.generatedKey===undefined||(typeof value.generatedKey==='string'&&value.generatedKey.length<=65_000));
}
export function dialogueClipKey(line:DialogueLine,speakers:DialogueSpeaker[]){return `${speakers[line.speaker]?.voice??''}\n${line.text.trim()}`;}
export function dialogueKey(n:DrawingNarration){return n.lines.map(l=>dialogueClipKey(l,n.speakers)).join('\n---\n');}
export function activeNarration(p:DrawingProject):DrawingVoice|null{
 const n=p.narration;if(!n?.enabled)return null;
 return n.useGenerated&&n.generated?n.generated:n.original;
}
export function fitNarration(p:DrawingProject,voice=activeNarration(p)){
 if(!p.narration||!voice)return p;
 const seconds=Math.max(p.scenes.length,voice.duration)/p.scenes.length;
 return {...p,narration:{...p.narration,durations:Object.fromEntries(p.scenes.map(s=>[s.id,seconds]))}};
}
export function addNarration(p:DrawingProject,voice:DrawingVoice):DrawingProject{
 return fitNarration({...p,narration:{enabled:true,original:voice,useGenerated:false,durations:{},speakers:defaultSpeakers(),lines:[]}},voice);
}
/** Last scene always covers the remaining audio, so shortening a scene never clips speech. */
export function narrationDurations(p:DrawingProject){
 const voice=activeNarration(p);if(!voice)return null;
 const values=p.scenes.map(s=>Math.max(1,p.narration?.durations[s.id]??voice.duration/p.scenes.length));
 const before=values.slice(0,-1).reduce((n,x)=>n+x,0);
 values[values.length-1]=Math.max(values.at(-1)!,voice.duration-before);
 return values;
}
export function setNarrationBoundary(p:DrawingProject,index:number,time:number):DrawingProject{
 const values=narrationDurations(p);if(!values||!p.narration||index<1||index>=values.length)throw new Error('전환할 다음 장면을 선택해 주세요.');
 const start=values.slice(0,index-1).reduce((n,x)=>n+x,0),end=start+values[index-1]+values[index];
 if(!Number.isFinite(time)||time<start+1||time>end-1)throw new Error('앞뒤 장면이 각각 1초 이상 남는 위치를 골라 주세요.');
 values[index-1]=time-start;values[index]=end-time;
 return {...p,narration:{...p.narration,durations:Object.fromEntries(p.scenes.map((s,i)=>[s.id,values[i]]))}};
}
export function wavBytes(samples:Float32Array,rate=16000){
 const bytes=new Uint8Array(44+samples.length*2),view=new DataView(bytes.buffer);
 const text=(at:number,v:string)=>{for(let i=0;i<v.length;i++)bytes[at+i]=v.charCodeAt(i);};
 text(0,'RIFF');view.setUint32(4,bytes.length-8,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,samples.length*2,true);
 for(let i=0;i<samples.length;i++)view.setInt16(44+i*2,Math.max(-1,Math.min(1,samples[i]))*(samples[i]<0?32768:32767),true);
 return bytes;
}
export async function audioDataUrl(blob:Blob){return new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(new Error('녹음 파일을 읽지 못했어요.'));r.readAsDataURL(blob);});}
export function monoSamples(buffer:AudioBuffer,rate=16000){
 const length=Math.ceil(buffer.duration*rate),out=new Float32Array(length);
 for(let c=0;c<buffer.numberOfChannels;c++){const data=buffer.getChannelData(c);for(let i=0;i<length;i++){const at=i*buffer.sampleRate/rate,a=Math.floor(at),fraction=at-a;out[i]+=((data[a]??0)*(1-fraction)+(data[a+1]??data[a]??0)*fraction)/buffer.numberOfChannels;}}
 return out;
}
export async function readNarration(file:File):Promise<DrawingVoice>{
 if(file.size>40_000_000||!file.size)throw new Error('전체 녹음은 40MB 이하로 골라 주세요.');
 if(!/\.(mp3|m4a|mp4|wav|aac|ogg|webm)$/i.test(file.name))throw new Error('MP3·M4A·WAV 녹음 파일을 골라 주세요.');
 const ctx=new AudioContext();
 try{const buffer=await ctx.decodeAudioData(await file.arrayBuffer());if(buffer.duration>NARRATION_MAX_SECONDS||buffer.duration<1)throw new Error('전체 녹음은 1초 이상, 10분 이하로 넣어 주세요.');return {id:`voice-${crypto.randomUUID()}`,duration:buffer.duration,source:await audioDataUrl(new Blob([wavBytes(monoSamples(buffer))],{type:'audio/wav'}))};}
 finally{await ctx.close().catch(()=>{});}
}
/** Short upload chunks stay below the hosting request-body limit. */
export async function transcriptionChunks(voice:DrawingVoice){
 const ctx=new AudioContext();try{const buffer=await ctx.decodeAudioData(await (await fetch(voice.source)).arrayBuffer()),samples=monoSamples(buffer),chunks:Blob[]=[];
 for(let from=0;from<samples.length;){
 let end=Math.min(samples.length,from+80*16000);
 if(end<samples.length){let quiet=Infinity;const limit=end;for(let at=limit-4*16000;at<limit;at+=1600){let energy=0;for(let k=at;k<at+1600;k++)energy+=samples[k]*samples[k];if(energy<quiet){quiet=energy;end=at+800;}}}
 chunks.push(new Blob([wavBytes(samples.slice(from,end))],{type:'audio/wav'}));from=end;
 }return chunks;
 }finally{await ctx.close().catch(()=>{});}
}
export async function combineDialogue(lines:DialogueLine[]){
 const ctx=new AudioContext(),parts:Float32Array[]=[];let count=0;const sceneStarts:Record<string,number>={};
 try{for(const line of lines){if(!line.clip)throw new Error('아직 목소리가 없는 대사가 있어요.');if(sceneStarts[line.sceneId]===undefined)sceneStarts[line.sceneId]=count/16000;
 const buffer=await ctx.decodeAudioData(await (await fetch(line.clip.source)).arrayBuffer()),part=monoSamples(buffer);parts.push(part,new Float32Array(3200));count+=part.length+3200;if(count>600*16000)throw new Error('AI 대사가 10분을 넘어요. 대사를 줄여 주세요.');}
 const joined=new Float32Array(count);let offset=0;for(const part of parts){joined.set(part,offset);offset+=part.length;}
 return {voice:{id:`voice-${crypto.randomUUID()}`,source:await audioDataUrl(new Blob([wavBytes(joined)],{type:'audio/wav'})),duration:count/16000},sceneStarts};
 }finally{await ctx.close().catch(()=>{});}
}
