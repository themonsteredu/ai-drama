'use client';
import {useEffect,useRef,useState} from 'react';
import {useDrawingEditor} from './use-drawing-editor';
import {emptyFourSceneProject,putScenePicture} from '@/lib/four-scene';
import {readDrawingImage} from '@/lib/drawing-media';
import {readVoice,applyVoice} from '@/lib/drawing-voice';
import {parseDrawingFile,DRAWING_FILE_LIMIT} from '@/lib/drawing-project';
import {movieSeconds,clockLabel,sceneSeconds,VOICE_LEAD} from '@/lib/drawing-movie';
import {DrawingMusicDialog} from './drawing-music-dialog';
import {DrawingMovieDialog} from './drawing-movie-dialog';
import {BackgroundEditDialog} from './background-edit-dialog';
import './four-scene.css';

export function FourSceneStudio(){
 const e=useDrawingEditor('four-scene-film',emptyFourSceneProject);
 const [working,setWorking]=useState(false),[music,setMusic]=useState(false),[movie,setMovie]=useState(false),[background,setBackground]=useState(false);
 const importInput=useRef<HTMLInputElement>(null),lock=useRef(false);
 const scene=e.scene,index=e.project.scenes.findIndex(s=>s.id===scene.id);
 const picture=e.project.assets.find(a=>a.id===scene.backgroundAssetId);
 const [timeDraft,setTimeDraft]=useState('');
 useEffect(()=>setTimeDraft(String(Math.ceil(sceneSeconds(scene)))),[scene.id,scene.durationSeconds,scene.voice]);
 const minSeconds=Math.max(3,Math.ceil((scene.voice?.duration??0)+VOICE_LEAD));
 const disabled=!e.loaded||working||e.busy||e.storyPlaying;
 const complete=e.project.scenes.length===4&&e.project.scenes.every(s=>s.backgroundAssetId&&s.voice);
 async function upload(file:File,kind:'picture'|'voice'){
  if(lock.current||disabled)return;lock.current=true;setWorking(true);e.stop();e.setError('');const id=scene.id;
  try{if(kind==='picture'){const value=await readDrawingImage(file);e.commit(p=>putScenePicture(p,id,value));}else{const value=await readVoice(file);e.commit(p=>applyVoice(p,id,value));}}
  catch(cause){e.setError(cause instanceof Error?cause.message:'파일을 불러오지 못했어요.');}
  finally{lock.current=false;setWorking(false);}
 }
 async function importProject(file:File){
  if(disabled)return;
  try{if(file.size>DRAWING_FILE_LIMIT)throw new Error('작품 파일은 64MB 이하로 골라 주세요.');const value=parseDrawingFile(await file.text());if(value.scenes.length!==4)throw new Error('4장면 영상 작품 파일을 골라 주세요.');await e.importWork(file);}
  catch(cause){e.setError(cause instanceof Error?cause.message:'작품을 읽지 못했어요.');}
 }
 return <main className="film-app">
  <header className="film-header"><a className="film-brand" href="/draw">MOAKIT <b>PLAY</b></a><nav aria-label="작품 관리"><button disabled={disabled} onClick={e.backup}>작품 보관</button><button disabled={disabled} onClick={()=>importInput.current?.click()}>불러오기</button><button disabled={disabled} onClick={e.newWork}>새 작품</button></nav></header>
  <div className="film-intro"><div><p className="film-eyebrow">우리 그림, 우리 목소리</p><h1>네 장면이 하나의 이야기가 돼요</h1><p>장면마다 그림과 녹음한 대사를 넣어 주세요.</p></div><span className="film-save" role="status">{e.saveState}</span></div>
  <div className="film-title-row"><label>작품 제목<input value={e.project.title} maxLength={80} disabled={disabled} onChange={v=>e.commit(p=>({...p,title:v.target.value}))}/></label><div><button disabled={disabled||!e.canUndo} onClick={e.undo}>되돌리기</button><button disabled={disabled||!e.canRedo} onClick={e.redo}>다시 적용</button></div></div>
  {e.error?<p className="film-alert" role="alert">{e.error}<button aria-label="안내 닫기" onClick={()=>e.setError('')}>닫기</button></p>:null}
  <div className="film-workspace"><section className="film-stage"><div className="film-stage-head"><h2>{scene.title}</h2><span>{String(index+1).padStart(2,'0')} / 04</span></div>
   <div className="film-picture">{picture?<img src={picture.source} alt={`${scene.title} 그림`}/>:<div><strong>첫 번째 그림부터 올려 볼까요?</strong><p>등장인물이 있는 장면 전체를 넣어 주세요.</p></div>}</div>
   <div className="film-play"><button disabled={!complete||disabled} onClick={e.playStory}>전체 미리보기</button><button disabled={!e.storyPlaying} onClick={e.stop}>재생 멈추기</button><span>{e.storyPlaying?`${scene.title} 재생 중`:clockLabel(movieSeconds(e.project))}</span></div>
  </section><aside className="film-settings"><section><div className="film-step">01</div><h2>장면 그림</h2><label className="film-upload">{picture?'그림 바꾸기':'그림 올리기'}<input type="file" aria-label="장면 그림 올리기" accept="image/png,image/jpeg,image/webp" disabled={disabled} onChange={v=>{const f=v.target.files?.[0];v.target.value='';if(f)void upload(f,'picture');}}/></label><p>JPG·PNG·WebP · 10MB 이하</p><button className="film-background" disabled={disabled||!picture} onClick={()=>setBackground(true)}>배경만 AI로 다듬기</button></section>
   <section><div className="film-step">02</div><h2>녹음한 대사</h2><label className="film-upload">{scene.voice?'대사 파일 바꾸기':'대사 파일 올리기'}<input type="file" aria-label="대사 파일 올리기" accept=".mp3,.m4a,.mp4,.wav,.aac,.ogg,.webm,audio/*" disabled={disabled} onChange={v=>{const f=v.target.files?.[0];v.target.value='';if(f)void upload(f,'voice');}}/></label><p>장면마다 3분·8MB 이하</p>{scene.voice?<><audio key={scene.voice.id} controls src={scene.voice.source} preload="metadata"/><p>대사 {Math.round(scene.voice.duration)}초 · 대사가 끝나면 다음 장면으로 넘어가요.</p></>:null}</section>
  <section><div className="film-step">03</div><h2>장면 길이</h2><label className="film-auto"><input type="checkbox" checked={scene.durationSeconds===undefined} disabled={disabled} onChange={v=>e.editScene({durationSeconds:v.target.checked?undefined:Math.ceil(sceneSeconds(scene))})}/>대사 길이에 자동으로 맞추기</label><label className="film-duration">이 장면을 <input aria-label="장면 길이 초" type="number" min={minSeconds} max={600} step={1} disabled={disabled||scene.durationSeconds===undefined} value={timeDraft} onChange={v=>setTimeDraft(v.target.value)} onBlur={()=>{const value=Math.min(600,Math.max(minSeconds,Number(timeDraft)||minSeconds));e.editScene({durationSeconds:value});setTimeDraft(String(value));}}/> 초 동안 보여줘요</label><p>대사가 잘리지 않도록 최소 {minSeconds}초로 맞춰요. 끝난 뒤 여유 시간을 늘릴 수 있어요.</p></section></aside></div>
  <nav className="film-scenes" aria-label="네 장면">{e.project.scenes.map((s,i)=>{const asset=e.project.assets.find(a=>a.id===s.backgroundAssetId);return <button key={s.id} disabled={disabled} aria-current={s.id===scene.id?'step':undefined} onClick={()=>{e.stop();e.switchScene(s.id);}}>{asset?<img src={asset.source} alt=""/>:<span className="film-no-picture">그림을 넣어 주세요</span>}<span className="film-scene-label"><b>{String(i+1).padStart(2,'0')} {s.title}</b><small>{s.voice?`대사 ${Math.round(s.voice.duration)}초`:'대사 없음'}</small></span></button>;})}</nav>
  <footer className="film-finish"><div><h2>음악을 더하고 영상으로 저장해요</h2><p>그림과 대사 {e.project.scenes.filter(s=>s.backgroundAssetId&&s.voice).length} / 4장면 준비됨</p></div><div><button disabled={disabled} onClick={()=>setMusic(true)}>배경음악 고르기</button><button className="film-primary" disabled={disabled||!complete} onClick={()=>setMovie(true)}>영상 저장</button></div></footer>
  <p className="film-storage-note">작업은 이 기기에 자동 저장돼요. 다른 기기에서 이어 하려면 ‘작품 보관’으로 파일을 받아 주세요.</p>
  <input ref={importInput} hidden type="file" accept=".json" aria-label="4장면 작품 파일" onChange={v=>{const f=v.target.files?.[0];v.target.value='';if(f)void importProject(f);}}/>
  {music?<DrawingMusicDialog project={e.project} scene={scene} defaultAll onApply={p=>e.commit(()=>p)} onClose={()=>setMusic(false)}/>:null}
  {movie?<DrawingMovieDialog project={e.project} onPlayStory={e.playStory} onClose={()=>setMovie(false)}/>:null}
  {background&&picture?<BackgroundEditDialog project={e.project} scene={scene} onApply={p=>e.commit(()=>p)} onClose={()=>setBackground(false)}/>:null}
 </main>;
}
