'use client';
import {useEffect,useRef,useState} from 'react';
import {voiceSupported,readVoice,applyVoice} from '@/lib/drawing-voice';
import {sceneSeconds,movieSeconds,clockLabel,SCENE_MIN} from '@/lib/drawing-movie';
import type {useDrawingEditor} from './use-drawing-editor';
import './drawing-voice.css';
const seconds=(n:number)=>`${Number(n.toFixed(2))}초`;
export function DrawingVoicePanel({e,onFullNarration}:{e:ReturnType<typeof useDrawingEditor>;onFullNarration?:()=>void}){
 const [usable,setUsable]=useState(true),[uploading,setUploading]=useState(false),[draft,setDraft]=useState('');
 const file=useRef<HTMLInputElement>(null),lock=useRef(false);
 useEffect(()=>setUsable(voiceSupported()),[]);
 const scene=e.scene,voice=scene.voice,full=e.project.narration?.enabled===true;
 const disabled=!e.loaded||e.busy||e.storyPlaying||e.playing||uploading;
 const left=Math.max(0,e.maxVoiceSeconds-e.recordSeconds),length=sceneSeconds(scene),minimum=voice?.duration??SCENE_MIN;
 const index=e.project.scenes.findIndex(s=>s.id===scene.id);
 useEffect(()=>setDraft(String(Number(length.toFixed(2)))),[scene.id,length]);
 async function upload(value:File){
  if(disabled||e.recording||lock.current)return;lock.current=true;setUploading(true);e.setError('');e.stop();
  const id=scene.id,projectId=e.project.id;
  try{const next=await readVoice(value);e.commit(p=>p.id===projectId?applyVoice(p,id,next):p);}
  catch(error){e.setError(error instanceof Error?error.message:'대사 파일을 열지 못했어요.');}
  finally{lock.current=false;setUploading(false);}
 }
 function useSceneAudio(){e.commit(p=>({...p,...(p.narration?{narration:{...p.narration,enabled:false}}:{}),scenes:p.scenes.map(s=>s.voice?{...s,durationSeconds:undefined}:s)}));}
 return <section className="draw-voice" aria-label="장면별 대사와 자동 전환" data-recording={e.recording?'yes':'no'}>
  <div className="draw-voice-head"><h2>{index+1}장면 녹음</h2><p>{voice?`녹음 ${seconds(voice.duration)} · 장면 ${seconds(length)}`:`녹음 없음 · 장면 ${seconds(length)}`}</p><strong>총 {clockLabel(movieSeconds(e.project))}</strong></div>
  {full?<div className="draw-scene-audio-mode"><p>전체 녹음 사용 중 · 파일을 올리면 장면별 녹음으로 전환돼요.</p><button disabled={disabled||e.recording} onClick={useSceneAudio}>장면별 녹음 사용하기</button></div>:null}
  <div className="draw-voice-main-actions">
   <button type="button" className="draw-voice-upload" disabled={disabled||e.recording} onClick={()=>file.current?.click()}>{uploading?'대사 여는 중…':voice?'이 장면 녹음 바꾸기':'이 장면 녹음 올리기'}</button>
   <input ref={file} hidden type="file" aria-label="녹음한 대사 파일" accept=".mp3,.m4a,.mp4,.wav,.aac,.ogg,.webm,audio/*" onChange={event=>{const value=event.target.files?.[0];event.target.value='';if(value)void upload(value);}}/>
   {voice?<><button type="button" disabled={disabled||e.recording} aria-label={e.voicePlaying?'이 장면 대사 멈추기':'이 장면 대사 듣기'} onClick={()=>e.voicePlaying?e.stopVoice():e.playVoice()}>{e.voicePlaying?'대사 멈춤':'대사 듣기'}</button><button type="button" disabled={disabled||e.recording} aria-label="이 장면 녹음 지우기" onClick={e.removeVoice}>녹음 삭제</button></>:null}
   {usable?<button type="button" className={e.recording?'recording':''} disabled={disabled&&!e.recording} onClick={()=>void(e.recording?e.finishVoice():e.startVoice())}>{e.recording?`녹음 완료 · ${seconds(e.recordSeconds)}`:'직접 녹음'}</button>:null}
  </div>
  <div className="draw-voice-timing">
   {!full?<><label className="draw-scene-auto"><input type="checkbox" checked={scene.durationSeconds===undefined} disabled={disabled||e.recording} onChange={event=>e.editScene({durationSeconds:event.target.checked?undefined:length})}/>녹음 길이에 자동으로 맞추기</label>{scene.durationSeconds!==undefined?<label className="draw-scene-duration">장면 <input aria-label="장면 길이 초" type="number" min={minimum} max="600" step="0.01" value={draft} disabled={disabled||e.recording} onChange={event=>setDraft(event.target.value)} onBlur={()=>{const value=Math.min(600,Math.max(minimum,Number(draft)||minimum));e.editScene({durationSeconds:value});setDraft(String(Number(value.toFixed(2))));}}/> 초</label>:null}</>:null}
   <small>{e.recording?`${seconds(left)} 남음`: '파일 3분·8MB / 직접 녹음 20초'}</small>
  </div>
  <div className="draw-scene-audio-finish">
   <button disabled={!e.loaded||e.busy||e.recording||uploading} onClick={()=>e.storyPlaying?e.stop():e.playStory()}>{e.storyPlaying?'전체 미리보기 멈추기':'전체 영상 미리보기'}</button>
   {index<e.project.scenes.length-1?<button disabled={disabled||e.recording} onClick={()=>e.switchScene(e.project.scenes[index+1].id)}>다음 장면 준비하기</button>:null}
   {onFullNarration?<button disabled={disabled||e.recording} onClick={onFullNarration}>전체 녹음 · AI 배역</button>:null}
   {!full&&e.project.scenes.some(s=>s.voice&&s.durationSeconds!==undefined)?<button className="draw-text-button" disabled={disabled||e.recording} onClick={useSceneAudio}>모든 장면 자동 맞춤</button>:null}
  </div>
 </section>;
}
