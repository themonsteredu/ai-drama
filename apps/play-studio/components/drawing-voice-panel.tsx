'use client';
import {useEffect,useRef,useState} from 'react';
import {voiceSupported,readVoice,applyVoice} from '@/lib/drawing-voice';
import type {useDrawingEditor} from './use-drawing-editor';
import './drawing-voice.css';
const seconds=(n:number)=>`${Math.floor(n)}초`;
const taken=(n:number)=>`${Math.max(1,Math.round(n))}초`;
export function DrawingVoicePanel({e}:{e:ReturnType<typeof useDrawingEditor>}){
 const [usable,setUsable]=useState(true),[uploading,setUploading]=useState(false);
 const file=useRef<HTMLInputElement>(null),lock=useRef(false);
 useEffect(()=>setUsable(voiceSupported()),[]);
 const voice=e.scene.voice,disabled=!e.loaded||e.busy||e.storyPlaying||uploading;
 const left=Math.max(0,e.maxVoiceSeconds-e.recordSeconds);
 async function upload(value:File){
  if(disabled||e.recording||lock.current)return;lock.current=true;setUploading(true);e.setError('');e.stop();const id=e.scene.id;
  try{const next=await readVoice(value);e.commit(p=>applyVoice(p,id,next));}
  catch(error){e.setError(error instanceof Error?error.message:'대사 파일을 열지 못했어요.');}
  finally{lock.current=false;setUploading(false);}
 }
 return <section className="draw-voice" aria-label="목소리 담기" data-recording={e.recording?'yes':'no'}>
  <div className="draw-voice-head"><span aria-hidden="true">🎤</span><div><strong>목소리 담기</strong><small>직접 녹음하거나, 미리 녹음한 대사 파일을 넣어요.</small></div></div>
  {!e.recording?<><button type="button" className="draw-voice-upload" disabled={disabled} onClick={()=>file.current?.click()}>{uploading?'대사 여는 중…':voice?'녹음 파일 바꾸기':'녹음 파일 올리기'}</button><input ref={file} hidden type="file" aria-label="녹음한 대사 파일" accept=".mp3,.m4a,.mp4,.wav,.aac,.ogg,.webm,audio/*" onChange={event=>{const value=event.target.files?.[0];event.target.value='';if(value)void upload(value);}}/><p className="draw-voice-hint">대사 파일은 장면마다 3분·8MB까지 넣을 수 있어요.</p></>:null}
  {usable?(e.recording?<><button type="button" className="draw-voice-button recording" onClick={()=>void e.finishVoice()}><span className="draw-voice-dot" aria-hidden="true"/>다 말했어요</button><p className="draw-voice-timer" role="status" aria-live="polite">담는 중… {seconds(e.recordSeconds)} <small>({seconds(left)} 남음)</small></p></>:<button type="button" className="draw-voice-button" disabled={disabled} onClick={()=>void e.startVoice()}><span aria-hidden="true">●</span>{voice?'다시 담기':'말하기 시작'}</button>):<p className="draw-voice-hint">이 기기에서는 직접 녹음 대신 녹음 파일을 올려 주세요.</p>}
  {usable&&!e.recording?<p className="draw-voice-hint">직접 녹음은 {seconds(e.maxVoiceSeconds)}까지 담아요.</p>:null}
  {voice&&!e.recording?<div className="draw-voice-saved"><p>담은 목소리 <b>{taken(voice.duration)}</b></p><div className="draw-voice-actions"><button type="button" disabled={disabled} onClick={()=>e.voicePlaying?e.stopVoice():e.playVoice()}>{e.voicePlaying?'■ 멈춤':'▶ 들어보기'}</button><button type="button" disabled={disabled} onClick={e.removeVoice}>✕ 지우기</button></div></div>:null}
  {!voice&&!e.recording?<p className="draw-voice-hint">아직 이 장면에는 목소리가 없어요.</p>:null}
 </section>;
}
