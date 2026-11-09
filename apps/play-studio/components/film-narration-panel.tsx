'use client';
import {useEffect,useRef,useState} from 'react';
import {activeNarration,addNarration,fitNarration,readNarration,setNarrationBoundary,dialogueKey} from '@/lib/film-narration';
import {movieTimeline,clockLabel} from '@/lib/drawing-movie';
import {validateDrawingProject} from '@/lib/drawing-project';
import type {useDrawingEditor} from './use-drawing-editor';
import {FilmDialogueDialog} from './film-dialogue-dialog';
import './film-narration.css';
const precise=(n:number)=>`${Math.floor(n/60)}:${(n%60).toFixed(1).padStart(4,'0')}`;
export function FilmNarrationPanel({e}:{e:ReturnType<typeof useDrawingEditor>}){
 const file=useRef<HTMLInputElement>(null),audio=useRef<HTMLAudioElement>(null),lock=useRef(false);
 const [uploading,setUploading]=useState(false),[dialogue,setDialogue]=useState(false),[time,setTime]=useState(0),[notice,setNotice]=useState('');
 const n=e.project.narration,voice=activeNarration(e.project),plan=movieTimeline(e.project),disabled=!e.loaded||e.busy||e.recording||uploading||e.playing;
 useEffect(()=>{if(e.playing||dialogue)audio.current?.pause();},[e.playing,dialogue]);
 async function upload(value:File){
  if(lock.current)return;lock.current=true;setUploading(true);e.stop();setNotice('');audio.current?.pause();const projectId=e.project.id;
  try{const voice=await readNarration(value);e.commit(p=>{if(p.id!==projectId)return p;const next=addNarration(p,voice);if(!validateDrawingProject(next))throw new Error('녹음 보관 용량이 부족해요.');return next;});setTime(0);}
  catch(error){e.setError(error instanceof Error?error.message:'전체 녹음을 읽지 못했어요.');}
  finally{lock.current=false;setUploading(false);}
 }
 function boundary(index:number){
  try{const at=audio.current?.currentTime??time;e.commit(p=>setNarrationBoundary(p,index,at));setNotice(`${index+1}장면 시작을 ${precise(at)}로 바꿨어요.`);}
  catch(error){setNotice(error instanceof Error?error.message:'시작 시간을 확인해 주세요.');}
 }
 return <section className="film-narration" aria-label="전체 녹음과 장면 전환">
  <header><div><h2>전체 대사와 장면 시간</h2><p>네 장면의 녹음을 파일 하나로 올려요.</p></div><button disabled={disabled} onClick={()=>file.current?.click()}>{uploading?'녹음 여는 중…':n?'전체 녹음 바꾸기':'전체 녹음 올리기'}</button></header>
  <input ref={file} type="file" hidden accept=".mp3,.m4a,.mp4,.wav,.aac,.ogg,.webm" aria-label="네 장면 전체 녹음 파일" onChange={event=>{const value=event.target.files?.[0];event.target.value='';if(value)void upload(value);}}/>
  {!n?<p>최대 10분·40MB. 장면별 녹음 기능도 아래에서 사용할 수 있어요.</p>:<>
   <label className="film-check"><input type="checkbox" checked={n.enabled} disabled={disabled} onChange={event=>{audio.current?.pause();e.commit(p=>({...p,narration:{...p.narration!,enabled:event.target.checked}}));}}/>전체 녹음으로 이어서 재생</label>
   {n.enabled?<>
    <div className="film-audio-choice"><label>사용할 목소리<select aria-label="사용할 목소리" value={n.useGenerated?'ai':'original'} disabled={disabled} onChange={event=>{audio.current?.pause();e.commit(p=>fitNarration({...p,narration:{...p.narration!,useGenerated:event.target.value==='ai'}}));setNotice('목소리 길이에 맞춰 장면 시간을 다시 나눴어요. 전환 지점을 확인해 주세요.');}}><option value="original">원본 녹음</option><option value="ai" disabled={!n.generated||n.generatedKey!==dialogueKey(n)}>AI 역할 목소리</option></select></label><button disabled={disabled} onClick={()=>{audio.current?.pause();setDialogue(true);}}>AI 배역·목소리 만들기</button></div>
    <audio key={voice?.id} ref={audio} controls src={voice?.source} onTimeUpdate={()=>setTime(audio.current?.currentTime??0)} onPlay={()=>e.stop()} aria-label="전체 녹음 듣기"/>
    <p>재생 위치 <b>{precise(time)}</b> / {clockLabel(voice?.duration??0)}{n.useGenerated?' · AI가 만든 목소리':''}</p>
    <div className="film-timeline" aria-label="장면 전환 시간표">{plan.map((step,index)=><div className="film-time-row" key={step.scene.id}><strong>{index+1}. {step.scene.title}</strong><span>{precise(step.at)}–{precise(step.at+step.seconds)}</span><label>길이<input key={`${step.scene.id}-${step.seconds}`} aria-label={`${index+1}장면 길이 초`} type="number" min="1" max="600" step="0.1" defaultValue={Number(step.seconds.toFixed(2))} disabled={disabled} onBlur={event=>{const value=Math.max(1,Math.min(600,Number(event.target.value)||1));if(Math.abs(value-step.seconds)>.005){audio.current?.pause();e.commit(p=>({...p,narration:{...p.narration!,durations:{...p.narration!.durations,[step.scene.id]:value}}}));}}}/>초</label>{index>0?<button disabled={disabled} onClick={()=>boundary(index)}>지금부터 {index+1}장면</button>:<span>처음부터 시작</span>}</div>)}</div>
    <div className="film-narration-actions"><button disabled={disabled} onClick={()=>{audio.current?.pause();e.commit(p=>fitNarration(p));setNotice('녹음 길이를 장면 수에 맞춰 고르게 나눴어요.');}}>장면 시간 고르게 나누기</button><button disabled={!e.loaded||e.recording||uploading} onClick={()=>{audio.current?.pause();e.storyPlaying?e.stop():e.playStory();}}>{e.storyPlaying?'전체 재생 멈추기':'처음부터 전체 미리보기'}</button></div>
    <p>녹음을 들으며 ‘지금부터 다음 장면’을 누르거나 길이를 직접 바꾸세요. 마지막 장면은 남은 대사가 끝날 때까지 유지돼요.</p>
   </>:<p>현재는 기존 장면별 녹음을 사용해요. 전체 녹음은 보관돼 있어요.</p>}
   {notice?<p role="status">{notice}</p>:null}
  </>}
  {dialogue&&n?<FilmDialogueDialog project={e.project} onUpdate={change=>e.commit(p=>p.narration?.original.id===n.original.id?change(p):p)} onClose={()=>setDialogue(false)}/>:null}
 </section>;
}
