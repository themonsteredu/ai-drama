'use client';
import {useEffect,useRef,useState} from 'react';
import type {DrawingProject} from '@/lib/drawing-project';
import {loadDrawingImages} from '@/lib/drawing-media';
import {clockLabel,movieSeconds,movieSupported,recordMovie,sceneSeconds} from '@/lib/drawing-movie';
import {downloadBlob,fileName} from '@/lib/project-files';
import './drawing-movie.css';

type Props={project:DrawingProject;onPlayStory:()=>void;onClose:()=>void};

export function DrawingMovieDialog({project,onPlayStory,onClose}:Props){
 const dialog=useRef<HTMLDialogElement>(null),canceled=useRef(false),alive=useRef(true);
 // Browser support is read on the client only; the server has no MediaRecorder to ask.
 const [usable,setUsable]=useState<boolean|null>(null);
 const [busy,setBusy]=useState(false),[ratio,setRatio]=useState(0),[label,setLabel]=useState('');
 const [error,setError]=useState(''),[done,setDone]=useState('');
 useEffect(()=>{
  alive.current=true;setUsable(movieSupported());
  const previous=document.activeElement as HTMLElement|null;
  dialog.current?.showModal();
  return()=>{alive.current=false;canceled.current=true;previous?.focus();};
 },[]);
 const total=movieSeconds(project);
 const withVoice=project.scenes.filter(s=>s.voice).length;
 function close(){if(busy)return;onClose();}
 async function make(){
  if(busy)return;
  canceled.current=false;setBusy(true);setError('');setDone('');setRatio(0);setLabel('그림을 준비하고 있어요…');
  try{
   const images=await loadDrawingImages(project.assets);
   const movie=await recordMovie(project,images,(value,text)=>{if(alive.current){setRatio(value);setLabel(text);}},()=>canceled.current);
   downloadBlob(movie.blob,`${fileName(project.title)}.${movie.extension}`);
   if(!alive.current)return;
   setRatio(1);setLabel('');
   setDone(movie.lostVoices
    ?`영상을 저장했어요. 다만 목소리 ${movie.lostVoices}개는 이 기기에서 읽지 못해 빠졌어요. 담았던 기기에서 다시 만들어 주세요.`
    :'영상을 저장했어요. 기기의 「파일」이나 「다운로드」에서 볼 수 있어요.');
  }catch(cause){
   if(alive.current)setError(cause instanceof Error?cause.message:'영상을 만들지 못했어요. 다시 해 볼까요?');
  }finally{if(alive.current){setBusy(false);setLabel('');}}
 }
 return <dialog ref={dialog} className="movie-dialog" aria-labelledby="movie-title" onCancel={event=>{if(busy)event.preventDefault();else onClose();}} onClick={event=>{if(event.target===event.currentTarget)close();}}>
  <div className="movie-content">
   <header><div><h2 id="movie-title">🎬 영상 만들기</h2><p>장면이 차례로 넘어가며 음악과 목소리가 함께 나와요.</p></div><button type="button" aria-label="영상 창 닫기" disabled={busy} onClick={close}>×</button></header>

   <ul className="movie-scenes" aria-label="장면 차례">
    {project.scenes.map((scene,index)=><li key={scene.id}>
     <b>{String(index+1).padStart(2,'0')}</b>
     <span>{scene.title}</span>
     <small>{scene.voice?`목소리 ${Math.max(1,Math.round(scene.voice.duration))}초`:'목소리 없음'} · {Math.round(sceneSeconds(scene))}초</small>
    </li>)}
   </ul>
   <p className="movie-total">모두 <b>{clockLabel(total)}</b>짜리 이야기예요. 목소리를 담은 장면은 {withVoice} / {project.scenes.length}개예요.</p>

   <button type="button" className="movie-watch" disabled={busy} onClick={()=>{onPlayStory();onClose();}}>▶ 처음부터 쭉 보기</button>

   {usable===false
    ?<section className="movie-fallback">
      <h3>이 기기는 영상 파일 저장이 안 돼요</h3>
      <p>대신 <b>기기의 화면 녹화</b>로 만들 수 있어요. 소리는 「미디어 소리」로 켜 주세요. 담은 목소리가 스피커로 나오기 때문에 마이크는 켜지 않아도 돼요.</p>
      <ol>
       <li><b>아이패드</b> — 오른쪽 위에서 아래로 쓸어내려 제어센터를 열고 ⏺(화면 기록)을 눌러요. 안 보이면 설정 &gt; 제어 센터에서 「화면 기록」을 더해요.</li>
       <li><b>갤럭시</b> — 위에서 아래로 쓸어내려 「화면 녹화」를 누르고, 소리를 「미디어 소리」로 골라요.</li>
       <li>녹화가 시작되면 위의 <b>▶ 처음부터 쭉 보기</b>를 눌러요.</li>
       <li>이야기가 끝나면 녹화를 멈춰요. 영상이 사진첩에 저장돼요.</li>
      </ol>
     </section>
    :<><button type="button" className="movie-make" disabled={busy||usable===null} onClick={()=>void make()}>{busy?'만드는 중…':'⬇ 영상 파일로 저장'}</button>
      <p className="movie-note">이야기 길이만큼 기다려야 해요({clockLabel(total)}). 만드는 동안 화면을 그대로 두세요.</p></>}

   {busy?<div className="movie-progress"><div className="movie-bar"><i style={{width:`${Math.round(ratio*100)}%`}}/></div><p role="status" aria-live="polite">{label||'만드는 중…'}</p><button type="button" className="movie-cancel" onClick={()=>{canceled.current=true;}}>그만하기</button></div>:null}
   {done?<p className="movie-done" role="status">{done}</p>:null}
   {error?<p className="movie-error" role="alert">{error}</p>:null}
  </div>
 </dialog>;
}
