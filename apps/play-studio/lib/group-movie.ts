import {movieExtension,movieMimeType,movieSupported,stampWebmDuration,type MovieProgress} from './drawing-movie';

export type GroupMovie={id:string;name:string;url:string;seconds:number;file:File};
export const GROUP_MOVIE_LIMIT=30;
export function moveGroupMovie<T>(items:T[],index:number,direction:-1|1):T[]{
 const to=index+direction;if(index<0||index>=items.length||to<0||to>=items.length)return items;
 const next=[...items];[next[index],next[to]]=[next[to],next[index]];return next;
}
export function containVideo(width:number,height:number){
 const scale=Math.min(1280/width,720/height);return {x:(1280-width*scale)/2,y:(720-height*scale)/2,width:width*scale,height:height*scale};
}
function openVideo(url:string,signal?:AbortSignal):Promise<HTMLVideoElement>{
 return new Promise((resolve,reject)=>{
  const video=document.createElement('video');video.playsInline=true;video.preload='auto';
  const done=(error?:Error)=>{clearTimeout(timer);video.onloadeddata=null;video.onerror=null;signal?.removeEventListener('abort',abort);if(error){video.removeAttribute('src');video.load();reject(error);}else resolve(video);};
  const abort=()=>done(new Error('영상 합치기를 그만두었어요.'));
  const timer=window.setTimeout(()=>done(new Error('영상 파일을 읽는 데 오래 걸려요. 이 기기에서 재생되는 MP4·WebM 파일로 다시 골라 주세요.')),20000);
  video.onloadeddata=()=>{if(!Number.isFinite(video.duration)||video.duration<=0||!video.videoWidth||!video.videoHeight)done(new Error('영상의 길이를 읽지 못했어요. 원래 기기에서 영상을 다시 저장해 주세요.'));else done();};
  video.onerror=()=>done(new Error('이 기기에서 재생할 수 없는 영상이에요. MP4·WebM 파일을 확인해 주세요.'));
  signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted){abort();return;}
  video.src=url;video.load();
 });
}
export async function readGroupMovie(file:File):Promise<GroupMovie>{
 if(!file.size||!(/\.(mp4|webm|mov|m4v)$/i.test(file.name)||file.type.startsWith('video/')))throw new Error('영상 파일(MP4·WebM)을 골라 주세요.');
 if(file.size>300_000_000)throw new Error('영상 한 개는 300MB 이하로 골라 주세요.');
 const url=URL.createObjectURL(file);
 try{const video=await openVideo(url),seconds=video.duration;video.removeAttribute('src');video.load();if(seconds>1800)throw new Error('영상 한 개는 30분 이하로 골라 주세요.');return {id:crypto.randomUUID(),name:file.name.replace(/\.[^.]+$/,''),url,seconds,file};}
 catch(error){URL.revokeObjectURL(url);throw error;}
}

/** Record each local video with its own audio. No upload, AI call or microphone. */
export async function joinGroupMovies(clips:GroupMovie[],onProgress:MovieProgress,signal:AbortSignal){
 if(clips.length<2)throw new Error('합칠 영상을 두 개 이상 넣어 주세요.');
 if(!movieSupported())throw new Error('이 기기에서는 영상을 합쳐 저장할 수 없어요. 컴퓨터의 Chrome에서 열어 주세요.');
 const total=clips.reduce((n,c)=>n+c.seconds,0);
 if(total>3600)throw new Error('한 번에 합칠 영상은 모두 60분 이하로 골라 주세요.');
 const context=new AudioContext(),canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;
 const ctx=canvas.getContext('2d')!,destination=context.createMediaStreamDestination();
 const stream=canvas.captureStream(30),track=stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
 destination.stream.getAudioTracks().forEach(t=>stream.addTrack(t));
 const mimeType=movieMimeType(),recorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:2_500_000,audioBitsPerSecond:128_000});
 const chunks:Blob[]=[],videos:HTMLVideoElement[]=[],nodes:AudioNode[]=[];
 const failController=new AbortController();
 let failed:Error|undefined,recordedSeconds=0,startedAt=0,stoppedResolve=()=>{},stoppedReject=(_cause:Error)=>{};
 const stopped=new Promise<void>((resolve,reject)=>{stoppedResolve=resolve;stoppedReject=reject;});void stopped.catch(()=>{});
 recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onstop=()=>stoppedResolve();
 const fail=(error:Error)=>{failed??=error;failController.abort();};
 recorder.onerror=()=>{const error=new Error('영상을 합치는 중 오류가 생겼어요. 원본 영상은 그대로 있어요.');fail(error);stoppedReject(error);};
 const cancel=()=>fail(new Error('영상 합치기를 그만두었어요.'));
 const visibility=()=>{if(document.visibilityState==='hidden')fail(new Error('화면이 닫혀 영상 합치기를 멈췄어요. 화면을 켜 둔 상태로 다시 저장해 주세요.'));};
 signal.addEventListener('abort',cancel,{once:true});document.addEventListener('visibilitychange',visibility);
 const paint=(video:HTMLVideoElement)=>{ctx.fillStyle='#000';ctx.fillRect(0,0,1280,720);const box=containVideo(video.videoWidth,video.videoHeight);ctx.drawImage(video,box.x,box.y,box.width,box.height);track.requestFrame?.();};
 try{
  await context.resume();if(context.state!=='running')throw new Error('소리 재생을 허용한 뒤 다시 저장해 주세요.');
  if(signal.aborted)cancel();if(failed)throw failed;
  // A silent track keeps timestamps valid for movies that have no audio track.
  const silence=context.createConstantSource();silence.offset.value=0;silence.connect(destination);silence.start();nodes.push(silence);
  let completed=0;
  for(let index=0;index<clips.length;index++){
   if(failed)throw failed;
   onProgress(completed/total,`${index+1} / ${clips.length} 모둠 영상을 준비해요…`);
   const video=await openVideo(clips[index].url,failController.signal);videos.push(video);
   const audio=context.createMediaElementSource(video);audio.connect(destination);audio.connect(context.destination);nodes.push(audio);
   paint(video);
   // Pause capture while the next file loads, so loading time is never saved.
   if(recorder.state==='inactive')recorder.start();else recorder.resume();
   startedAt=context.currentTime;
   await new Promise<void>((resolve,reject)=>{
    let timer=0,lastTime=-1,lastAdvance=performance.now(),finished=false;
    const finish=(error?:Error)=>{if(finished)return;finished=true;clearTimeout(timer);video.onended=null;video.onerror=null;failController.signal.removeEventListener('abort',abort);if(error)reject(error);else resolve();};
    const abort=()=>finish(failed??new Error('영상 합치기를 그만두었어요.'));
    video.onended=()=>finish();video.onerror=()=>finish(new Error(`${clips[index].name} 재생이 멈췄어요. 원본 파일을 확인해 주세요.`));
    failController.signal.addEventListener('abort',abort,{once:true});
    const tick=()=>{
     if(finished)return;
     if(failed){abort();return;}
     if(video.currentTime!==lastTime){lastTime=video.currentTime;lastAdvance=performance.now();}
     if(performance.now()-lastAdvance>15000){finish(new Error('영상 재생이 멈췄어요. 해당 파일을 확인한 뒤 다시 합쳐 주세요.'));return;}
     paint(video);onProgress(Math.min(.99,(completed+video.currentTime)/total),`${index+1} / ${clips.length} 모둠 영상을 담는 중…`);timer=window.setTimeout(tick,1000/30);
    };
    void video.play().then(tick).catch(()=>finish(new Error('영상 재생을 시작하지 못했어요. 저장 버튼을 다시 눌러 주세요.')));
   });
   recordedSeconds+=context.currentTime-startedAt;startedAt=0;recorder.pause();
   video.pause();audio.disconnect();video.removeAttribute('src');video.load();
   completed+=clips[index].seconds;
  }
  if(failed)throw failed;
  recorder.stop();await stopped;
  const blob=await stampWebmDuration(new Blob(chunks,{type:recorder.mimeType||mimeType}),recordedSeconds);
  if(blob.size<1000)throw new Error('영상이 제대로 저장되지 않았어요. 컴퓨터에서 다시 시도해 주세요.');
  onProgress(1,'모둠 영상을 하나로 합쳤어요.');return {blob,extension:movieExtension(blob.type),seconds:recordedSeconds};
 }finally{
  signal.removeEventListener('abort',cancel);document.removeEventListener('visibilitychange',visibility);
  videos.forEach(v=>{v.pause();v.removeAttribute('src');v.load();});nodes.forEach(n=>n.disconnect());
  if(recorder.state!=='inactive'){recorder.stop();await stopped.catch(()=>{});}
  stream.getTracks().forEach(t=>t.stop());await context.close().catch(()=>{});
 }
}
