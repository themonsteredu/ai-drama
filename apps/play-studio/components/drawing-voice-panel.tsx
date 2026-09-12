'use client';
import {useEffect,useState} from 'react';
import {voiceSupported} from '@/lib/drawing-voice';
import type {useDrawingEditor} from './use-drawing-editor';
import './drawing-voice.css';

const seconds=(n:number)=>`${Math.floor(n)}초`;
/** A finished take is described, not counted down, so it rounds the same way the movie list does. */
const taken=(n:number)=>`${Math.max(1,Math.round(n))}초`;

export function DrawingVoicePanel({e}:{e:ReturnType<typeof useDrawingEditor>}){
 // The check touches browser APIs, so it waits for the client to avoid a mismatched first paint.
 const [usable,setUsable]=useState(true);
 useEffect(()=>setUsable(voiceSupported()),[]);
 const voice=e.scene.voice,disabled=!e.loaded||e.busy||e.storyPlaying;
 const left=Math.max(0,e.maxVoiceSeconds-e.recordSeconds);
 if(!usable)return <section className="draw-voice" aria-label="목소리 담기">
  <div className="draw-voice-head"><span aria-hidden="true">🎤</span><div><strong>목소리 담기</strong><small>이 기기에서는 목소리를 담을 수 없어요. 선생님께 말씀드려 주세요.</small></div></div>
 </section>;
 return <section className="draw-voice" aria-label="목소리 담기" data-recording={e.recording?'yes':'no'}>
  <div className="draw-voice-head"><span aria-hidden="true">🎤</span><div><strong>목소리 담기</strong><small>이 장면에서 할 말을 해요. {seconds(e.maxVoiceSeconds)}까지 담을 수 있어요.</small></div></div>
  {e.recording
   ?<><button type="button" className="draw-voice-button recording" onClick={()=>void e.finishVoice()}>
     <span className="draw-voice-dot" aria-hidden="true"/>다 말했어요
    </button>
    <p className="draw-voice-timer" role="status" aria-live="polite">담는 중… {seconds(e.recordSeconds)} <small>({seconds(left)} 남음)</small></p></>
   :<button type="button" className="draw-voice-button" disabled={disabled} onClick={()=>void e.startVoice()}>
     <span aria-hidden="true">●</span>{voice?'다시 담기':'말하기 시작'}
    </button>}
  {voice&&!e.recording
   ?<div className="draw-voice-saved">
     <p>담은 목소리 <b>{taken(voice.duration)}</b></p>
     <div className="draw-voice-actions">
      <button type="button" disabled={disabled} onClick={()=>e.voicePlaying?e.stopVoice():e.playVoice()}>{e.voicePlaying?'■ 멈춤':'▶ 들어보기'}</button>
      <button type="button" disabled={disabled} onClick={e.removeVoice}>✕ 지우기</button>
     </div>
    </div>
   :null}
  {!voice&&!e.recording?<p className="draw-voice-hint">아직 이 장면에는 목소리가 없어요.</p>:null}
 </section>;
}
