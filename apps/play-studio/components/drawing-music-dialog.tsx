'use client';
import {useEffect,useRef,useState} from 'react';
import type {DrawingProject,DrawingScene,DrawingMusicAsset,DrawingMusic} from '@/lib/drawing-project';
import {applyMusic,DrawingMusicPlayer,effectiveMusic,musicPresets,readMusic} from '@/lib/drawing-music';
import './drawing-music.css';
export function DrawingMusicDialog({project,scene,onApply,onClose}:{project:DrawingProject;scene:DrawingScene;onApply:(p:DrawingProject)=>void;onClose:()=>void}){
 const initial=effectiveMusic(project,scene),dialog=useRef<HTMLDialogElement>(null),player=useRef<DrawingMusicPlayer|null>(null),alive=useRef(true);
 const [track,setTrack]=useState(initial?.trackId??''),[volume,setVolume]=useState(initial?.volume??.3),[loop,setLoop]=useState(initial?.loop??true),[all,setAll]=useState(scene.music===undefined&&!!project.music);
 const [upload,setUpload]=useState<DrawingMusicAsset>(),[busy,setBusy]=useState(false),[error,setError]=useState(''),[preview,setPreview]=useState(false);
 useEffect(()=>{alive.current=true;const previous=document.activeElement as HTMLElement|null;dialog.current?.showModal();const hidden=()=>{if(document.hidden){player.current?.pause();setPreview(false);}};document.addEventListener('visibilitychange',hidden);return()=>{alive.current=false;player.current?.dispose();document.removeEventListener('visibilitychange',hidden);previous?.focus();};},[]);
 function stopPreview(){player.current?.stop();setPreview(false);}
 function select(id:string){stopPreview();setTrack(id);setError('');}
 const music:DrawingMusic|null=track?{trackId:track,volume,loop}:null;
 async function uploadFile(file:File){stopPreview();setBusy(true);setError('');try{const asset=await readMusic(file);if(alive.current){setUpload(asset);setTrack(asset.id);}}catch(cause){if(alive.current)setError(cause instanceof Error?cause.message:'음악을 읽지 못했어요.');}finally{if(alive.current)setBusy(false);}}
 function listen(){if(preview){stopPreview();return;}if(!music)return;player.current??=new DrawingMusicPlayer();const p={...project,musicAssets:[...(project.musicAssets??[]),...(upload?[upload]:[])]};player.current.play(p,{...scene,music},message=>{setError(message);setPreview(false);},()=>setPreview(false));setPreview(true);}
 function apply(){try{const next=applyMusic(project,music,all,upload);stopPreview();onApply(next);onClose();}catch(cause){setError(cause instanceof Error?cause.message:'음악을 적용하지 못했어요.');}}
 return <dialog ref={dialog} className="music-dialog" aria-labelledby="music-title" onCancel={onClose} onClick={event=>{if(event.target===event.currentTarget)onClose();}}><div className="music-content"><header><div><h2 id="music-title">🎵 음악</h2><p>이야기에 어울리는 소리를 골라요.</p></div><button type="button" aria-label="음악 창 닫기" onClick={onClose}>×</button></header>
 <div className="music-presets" aria-label="기본 음악">{musicPresets.map(t=><button type="button" key={t.id} aria-pressed={track===t.id} onClick={()=>select(t.id)}><span aria-hidden="true">{t.icon}</span>{t.label}</button>)}</div>
 <label className="music-upload">＋ 내 음악 올리기<input type="file" aria-label="내 음악 파일 선택" accept=".mp3,.wav,.m4a,.aac,.ogg,.webm,.flac,audio/*" disabled={busy} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)void uploadFile(file);}}/></label>
 <small>파일당 3MB·2분 이하 / 작품 전체 음악 6MB 이하</small>
 {(project.musicAssets?.length||upload)?<label>내 음악<select aria-label="보관한 음악" value={track.startsWith('audio-')?track:''} onChange={event=>select(event.target.value)}><option value="" disabled>음악 고르기</option>{[...(project.musicAssets??[]),...(upload?[upload]:[])].map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>:null}
 <button type="button" className="music-none" aria-pressed={!track} onClick={()=>select('')}>🔇 음악 없음</button>
 <fieldset><legend>어디에 넣을까요?</legend><label><input type="radio" name="music-scope" checked={!all} onChange={()=>setAll(false)}/>이 장면만</label><label><input type="radio" name="music-scope" checked={all} onChange={()=>setAll(true)}/>모든 장면</label></fieldset>
 {all?<small>모든 장면의 음악을 이 선택으로 바꿔요. 새 장면에도 이어져요.</small>:null}
 <label className="music-volume">소리 크기 <output>{Math.round(volume*100)}%</output><input aria-label="음악 소리 크기" type="range" min="0" max="100" value={Math.round(volume*100)} onChange={event=>{stopPreview();setVolume(Number(event.target.value)/100);}}/></label>
 <label className="music-loop"><input type="checkbox" checked={loop} onChange={event=>{stopPreview();setLoop(event.target.checked);}}/>반복해서 듣기</label>
 {busy?<p role="status">음악을 확인하고 있어요…</p>:null}{error?<p role="alert">{error}</p>:null}
 <footer><button type="button" disabled={!track||busy} onClick={listen}>{preview?'미리 듣기 멈춤':'미리 듣기'}</button><button type="button" className="music-apply" disabled={busy} onClick={apply}>적용하기</button></footer><small>기본 음악은 MOAKIT PLAY 자체 합성 음악이에요.</small></div></dialog>;
}
