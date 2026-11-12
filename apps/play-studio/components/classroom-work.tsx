'use client';
import {useEffect,useRef,useState} from 'react';
import type {useDrawingEditor} from './use-drawing-editor';
import {ClassError,classStorageKey,uploadClassProject,type Classroom} from '@/lib/play-class-client';
import {saveDrawing} from '@/lib/drawing-storage';
import type {DrawingProject} from '@/lib/drawing-project';
export type LocalClassState={revision:number;dirty:boolean};
export function localClassState(key:string):LocalClassState|null{try{return JSON.parse(localStorage.getItem(key+':sync')||'null');}catch{return null;}}
export function saveClassState(key:string,state:LocalClassState){localStorage.setItem(key+':sync',JSON.stringify(state));}
export function ClassroomWorkBar({e,room,group,revision,initialDirty,initialConflict,onLeave,onReload}:{e:ReturnType<typeof useDrawingEditor>;room:Classroom;group:number;revision:number;initialDirty:boolean;initialConflict:boolean;onLeave:()=>void;onReload:()=>Promise<void>}){
 const key=classStorageKey(room.id,group),latest=useRef(e.project),saved=useRef<DrawingProject|null>(null),version=useRef(revision),lock=useRef(false),initialized=useRef(false),alive=useRef(true);
 const [dirty,setDirty]=useState(initialDirty),[busy,setBusy]=useState(false),[conflict,setConflict]=useState(initialConflict),[message,setMessage]=useState(initialConflict?'다른 패드에 새 저장이 있어요. 현재 작업을 보관한 뒤 새 작품을 불러와 주세요.':initialDirty?'기기에 남은 작업을 이어하고 있어요. 우리 모둠 저장을 눌러 주세요.':'우리 모둠에 저장됨'),[error,setError]=useState('');
 latest.current=e.project;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{
  if(!e.loaded)return;
  if(!initialized.current){initialized.current=true;if(!initialDirty)saved.current=e.project;return;}
  const changed=!saved.current||e.project.updatedAt!==saved.current.updatedAt;setDirty(changed);if(changed){try{saveClassState(key,{revision:version.current,dirty:true});}catch{setError('이 기기의 저장 공간을 확인해 주세요.');}if(!lock.current&&!conflict)setMessage('바뀐 내용을 저장해 주세요.');}
 },[e.project,e.loaded,key,initialDirty,conflict]);
 async function save(submitted=false){
  if(lock.current||conflict||!e.loaded)return;lock.current=true;setBusy(true);setError('');setMessage('우리 모둠에 저장 중…');const snapshot=latest.current;
  try{
   await saveDrawing(snapshot,key);saveClassState(key,{revision:version.current,dirty:true});
   const result=await uploadClassProject(room.id,group,version.current,snapshot,submitted);
   version.current=result.revision;saved.current=snapshot;const more=latest.current.updatedAt!==snapshot.updatedAt;saveClassState(key,{revision:version.current,dirty:more});
   if(alive.current){setDirty(more);setMessage(more?'추가로 바뀐 내용이 있어요. 다시 저장해 주세요.':submitted?'선생님께 보냈어요. 고친 뒤 다시 보낼 수 있어요.':'우리 모둠에 저장됨');}
  }catch(cause){if(alive.current){setDirty(true);setError(cause instanceof Error?cause.message:'연결을 확인하고 다시 저장해 주세요.');setMessage('기기에 보관됨 · 다시 저장 필요');if(cause instanceof ClassError&&cause.status===409)setConflict(true);}}
  finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 useEffect(()=>{if(!dirty||busy||conflict||!e.loaded||e.busy||e.recording||error)return;const timer=setTimeout(()=>void save(),20000);return()=>clearTimeout(timer);},[dirty,busy,conflict,e.project,e.loaded,e.busy,e.recording,error]);
 useEffect(()=>{const warn=(event:BeforeUnloadEvent)=>{if(dirty||lock.current){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
 async function leave(){if(busy)return;if(dirty&&!confirm('아직 모둠에 저장하지 않은 내용이 있어요. 이 기기에는 남겨 두고 나갈까요?'))return;await saveDrawing(latest.current,key);onLeave();}
 return <section className="class-work-bar" aria-label="우리 모둠 저장"><div><strong>{room.title} · {group}모둠</strong><span>수업코드 {room.code}</span><small role="status">{message}</small></div><div className="class-work-actions"><button disabled={busy||conflict||!e.loaded||e.busy||e.recording} onClick={()=>void save()}>우리 모둠 저장{dirty?' *':''}</button><button className="class-primary" disabled={busy||conflict||!e.loaded||e.busy||e.recording} onClick={()=>void save(true)}>선생님께 보내기</button><button disabled={busy||e.recording} onClick={()=>void leave()}>모둠 바꾸기</button></div>{error?<p role="alert">{error}</p>:null}{conflict?<div><button onClick={e.backup}>지금 작업 파일 보관</button><button onClick={()=>{if(confirm('새 저장을 불러올까요? 현재 작업은 먼저 파일로 보관해 주세요.'))void onReload();}}>새 작품 불러오기</button></div>:null}</section>;
}
