'use client';
import {useEffect,useRef,useState} from 'react';
import {parseDrawingFile,DRAWING_FILE_LIMIT,DRAWING_MAX_SCENES,type DrawingProject} from '@/lib/drawing-project';
import {mergeGroupProjects,type GroupWork} from '@/lib/group-project';
import {moveGroupMovie} from '@/lib/group-movie';
import {clockLabel,movieSeconds} from '@/lib/drawing-movie';
import {loadDrawingImages} from '@/lib/drawing-media';
import './group-movie.css';

export function GroupProjectDialog({project,onApply,onClose,onVideos}:{project:DrawingProject;onApply:(p:DrawingProject)=>void;onClose:()=>void;onVideos:()=>void}){
 const hasWork=project.scenes.some(s=>s.backgroundAssetId||s.items.length||s.voice)||!!project.narration;
 const [works,setWorks]=useState<GroupWork[]>(()=>hasWork?[{id:'current-work',name:'현재 작품',project}]:[]),[title,setTitle]=useState('우리 반 이야기'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState('');
 const dialog=useRef<HTMLDialogElement>(null),input=useRef<HTMLInputElement>(null),alive=useRef(true),lock=useRef(false);
 const count=works.reduce((n,w)=>n+w.project.scenes.length,0),seconds=works.reduce((n,w)=>n+movieSeconds(w.project),0);
 useEffect(()=>{alive.current=true;const previous=document.activeElement as HTMLElement|null;dialog.current?.showModal();return()=>{alive.current=false;previous?.focus();};},[]);
 async function add(files:File[]){
  if(lock.current)return;lock.current=true;setBusy(true);setError('');
  try{
   const added:GroupWork[]=[];
   for(const file of files){
    if(file.size>DRAWING_FILE_LIMIT)throw new Error('작품 파일 하나는 320MB 이하로 골라 주세요.');
    const raw=await file.text(),p=parseDrawingFile(raw),digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));
    const fingerprint=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
    if([...works,...added].some(w=>w.fingerprint===fingerprint))throw new Error(`${file.name}은 이미 넣었어요. 같은 파일은 한 번만 넣어 주세요.`);
    added.push({id:crypto.randomUUID(),name:`${works.filter(w=>w.id!=='current-work').length+added.length+1}모둠`,project:p,fingerprint});
   }
   if(count+added.reduce((n,w)=>n+w.project.scenes.length,0)>DRAWING_MAX_SCENES)throw new Error(`장면은 모두 ${DRAWING_MAX_SCENES}개까지 모을 수 있어요.`);
   if(alive.current)setWorks([...works,...added]);
  }catch(cause){if(alive.current)setError(cause instanceof Error?cause.message:'작품을 읽지 못했어요.');}
  finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 async function merge(){
  if(lock.current)return;lock.current=true;setBusy(true);setError('');
  try{
   const result=await mergeGroupProjects(works,title,message=>{if(alive.current)setStatus(message);});
   await loadDrawingImages(result.assets);
   if(alive.current){onApply(result);onClose();}
  }catch(cause){if(alive.current)setError(cause instanceof Error?cause.message:'장면을 모으지 못했어요.');}
  finally{lock.current=false;if(alive.current){setBusy(false);setStatus('');}}
 }
 return <dialog ref={dialog} className="group-movie-dialog group-project-dialog" aria-labelledby="group-project-title" onCancel={e=>{if(busy)e.preventDefault();else onClose();}}>
  <header><div><h2 id="group-project-title">모둠 작품 모으기</h2><p>다른 패드에서 만든 장면·그림·녹음·움직임을 하나로 모아요.</p></div><button disabled={busy} onClick={onClose} aria-label="모둠 작품 창 닫기">닫기</button></header>
  <ol className="group-movie-steps"><li><b>1</b>각 패드에서 작품 보관</li><li><b>2</b>파일을 이 기기로 보내기</li><li><b>3</b>여기에 넣기</li></ol>
  <label className="group-movie-title">합친 작품 제목<input aria-label="합친 작품 제목" maxLength={80} value={title} disabled={busy} onChange={e=>setTitle(e.target.value)}/></label>
  <button className="group-movie-add" disabled={busy} onClick={()=>input.current?.click()}>+ 모둠 작품 파일 넣기</button>
  <input ref={input} hidden type="file" multiple accept=".json,application/json" onChange={e=>{const files=Array.from(e.target.files??[]);e.target.value='';if(files.length)void add(files);}}/>
  {!works.length?<p className="group-movie-empty">각 패드의 위쪽 ‘작품 보관’을 눌러 저장해 주세요.<br/>저장한 .moakit-drawing.json 파일을 넣어요.</p>:<ol className="group-movie-list group-project-list" aria-label="모둠 작품 순서">{works.map((work,index)=><li key={work.id}><b>{index+1}</b><div><input aria-label={`${index+1}번째 모둠 이름`} maxLength={20} value={work.name} disabled={busy} onChange={e=>setWorks(works.map(w=>w.id===work.id?{...w,name:e.target.value}:w))}/><small>{work.project.title} · 장면 {work.project.scenes.length}개 · {clockLabel(movieSeconds(work.project))}</small></div><div className="group-movie-order"><button aria-label={`${index+1}번째 작품 위로`} disabled={busy||index===0} onClick={()=>setWorks(moveGroupMovie(works,index,-1))}>위로</button><button aria-label={`${index+1}번째 작품 아래로`} disabled={busy||index===works.length-1} onClick={()=>setWorks(moveGroupMovie(works,index,1))}>아래로</button></div><button aria-label={`${index+1}번째 작품 빼기`} disabled={busy} onClick={()=>setWorks(works.filter(w=>w.id!==work.id))}>빼기</button></li>)}</ol>}
  <p className="group-movie-summary">모두 <strong>{count}장면 · {clockLabel(seconds)}</strong><span>합친 뒤에도 그림·움직임·장면 순서와 전환효과를 고칠 수 있어요.</span></p>
  <button className="group-movie-save" disabled={busy||!works.length||works.some(w=>!w.name.trim())} onClick={()=>void merge()}>{busy?'장면을 준비하고 있어요…':'장면을 한 작품으로 모으기'}</button>
  <p className="group-movie-note">현재 편집창에 합친 작품이 열려요. 실행 취소로 되돌릴 수 있어요. 각 패드의 원본 파일은 그대로예요.</p>
  {status?<p role="status">{status}</p>:null}{error?<p className="group-movie-error" role="alert">{error}</p>:null}
  <details><summary>이미 영상 파일로 저장했나요?</summary><button disabled={busy} onClick={onVideos}>완성된 영상 파일 합치기</button></details>
 </dialog>;
}
