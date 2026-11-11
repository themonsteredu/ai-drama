'use client';
import {useEffect,useRef,useState} from 'react';
import {voiceSupported,readVoice,applyVoice} from '@/lib/drawing-voice';
import {sceneSeconds,movieTimeline,movieSeconds,clockLabel,SCENE_MIN} from '@/lib/drawing-movie';
import type {useDrawingEditor} from './use-drawing-editor';
import './drawing-voice.css';
const seconds=(n:number)=>`${Number(n.toFixed(2))}초`;
export function DrawingVoicePanel({e}:{e:ReturnType<typeof useDrawingEditor>}){
 const [usable,setUsable]=useState(true),[uploading,setUploading]=useState(false),[draft,setDraft]=useState('');
 const file=useRef<HTMLInputElement>(null),lock=useRef(false);
 useEffect(()=>setUsable(voiceSupported()),[]);
 const scene=e.scene,voice=scene.voice,full=e.project.narration?.enabled===true;
 const disabled=!e.loaded||e.busy||e.storyPlaying||e.playing||uploading;
 const left=Math.max(0,e.maxVoiceSeconds-e.recordSeconds),length=sceneSeconds(scene),minimum=voice?.duration??SCENE_MIN;
 const index=e.project.scenes.findIndex(s=>s.id===scene.id),plan=movieTimeline(e.project);
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
  <div className="draw-voice-head"><div><h2>{index+1}장면 대사 올리기</h2><p>{scene.title}에 사용할 녹음을 넣어요. 녹음이 끝나면 다음 장면으로 넘어가요.</p></div></div>
  {full?<div className="draw-scene-audio-mode"><p>현재 전체 녹음을 사용 중이에요. 장면별 파일을 올리면 장면별 녹음으로 전환돼요.</p><button disabled={disabled||e.recording} onClick={useSceneAudio}>장면별 녹음 사용하기</button></div>:null}
  {!e.recording?<><button type="button" className="draw-voice-upload" disabled={disabled} onClick={()=>file.current?.click()}>{uploading?'대사 여는 중…':voice?'이 장면 녹음 바꾸기':'이 장면 녹음 올리기'}</button><input ref={file} hidden type="file" aria-label="녹음한 대사 파일" accept=".mp3,.m4a,.mp4,.wav,.aac,.ogg,.webm,audio/*" onChange={event=>{const value=event.target.files?.[0];event.target.value='';if(value)void upload(value);}}/><p className="draw-voice-hint">MP3·M4A·WAV 등 · 장면마다 3분·8MB까지</p></>:null}
  {voice&&!e.recording?<div className="draw-voice-saved"><p>녹음 <b>{seconds(voice.duration)}</b> · 장면 <b>{seconds(length)}</b>{scene.durationSeconds===undefined?' · 녹음 길이에 자동 맞춤':''}</p><div className="draw-voice-actions"><button type="button" disabled={disabled} onClick={()=>e.voicePlaying?e.stopVoice():e.playVoice()}>{e.voicePlaying?'이 장면 대사 멈추기':'이 장면 대사 듣기'}</button><button type="button" disabled={disabled} onClick={e.removeVoice}>이 장면 녹음 지우기</button></div></div>:null}
  {!voice&&!e.recording?<p className="draw-voice-hint">아직 녹음이 없어요. 현재 이 장면은 {seconds(length)} 동안 보여요.</p>:null}
  {!full?<><label className="draw-scene-auto"><input type="checkbox" checked={scene.durationSeconds===undefined} disabled={disabled||e.recording} onChange={event=>e.editScene({durationSeconds:event.target.checked?undefined:length})}/>녹음 길이에 자동으로 맞추기</label>{scene.durationSeconds!==undefined?<label className="draw-scene-duration">장면 길이 <input aria-label="장면 길이 초" type="number" min={minimum} max="600" step="0.01" value={draft} disabled={disabled||e.recording} onChange={event=>setDraft(event.target.value)} onBlur={()=>{const value=Math.min(600,Math.max(minimum,Number(draft)||minimum));e.editScene({durationSeconds:value});setDraft(String(Number(value.toFixed(2))));}}/> 초 <small>녹음보다 짧아지지 않아요.</small></label>:null}</>:null}
  <details className="draw-voice-record" open={e.recording||undefined}><summary>직접 녹음하기</summary>
   {usable?(e.recording?<><button type="button" className="draw-voice-button recording" onClick={()=>void e.finishVoice()}><span className="draw-voice-dot" aria-hidden="true"/>다 말했어요</button><p className="draw-voice-timer" role="status">담는 중… {seconds(e.recordSeconds)} <small>({seconds(left)} 남음)</small></p></>:<button type="button" className="draw-voice-button" disabled={disabled} onClick={()=>void e.startVoice()}>{voice?'다시 녹음하기':'말하기 시작'}</button>):<p className="draw-voice-hint">이 기기에서는 녹음 파일을 올려 주세요.</p>}
   {usable&&!e.recording?<p className="draw-voice-hint">직접 녹음은 {seconds(e.maxVoiceSeconds)}까지 담아요.</p>:null}
  </details>
  <div className="draw-scene-audio-list" aria-label="장면별 녹음 현황">{plan.map((step,i)=><button type="button" key={step.scene.id} disabled={disabled||e.recording} aria-pressed={step.scene.id===scene.id} onClick={()=>e.switchScene(step.scene.id)}><strong>{i+1}. {step.scene.title}</strong><span>{full?'전체 녹음':step.scene.voice?`녹음 ${seconds(step.scene.voice.duration)}`:'녹음 없음'} · 장면 {seconds(step.seconds)}</span></button>)}</div>
  <div className="draw-scene-audio-finish"><strong>완성 영상 {clockLabel(movieSeconds(e.project))}</strong><button disabled={!e.loaded||e.busy||e.recording||uploading} onClick={()=>e.storyPlaying?e.stop():e.playStory()}>{e.storyPlaying?'전체 미리보기 멈추기':'전체 영상 미리보기'}</button>{index<e.project.scenes.length-1?<button disabled={disabled||e.recording} onClick={()=>e.switchScene(e.project.scenes[index+1].id)}>다음 장면 준비하기</button>:null}</div>
  {!full&&e.project.scenes.some(s=>s.voice&&s.durationSeconds!==undefined)?<button className="draw-text-button" disabled={disabled||e.recording} onClick={useSceneAudio}>모든 장면을 녹음 길이에 맞추기</button>:null}
 </section>;
}
