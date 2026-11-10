'use client';
import {useEffect,useRef,useState} from 'react';
import type {useDrawingEditor} from './use-drawing-editor';
import {readDrawingImage} from '@/lib/drawing-media';
import {putScenePicture} from '@/lib/four-scene';
import {sceneSeconds,VOICE_LEAD} from '@/lib/drawing-movie';
import {BackgroundEditDialog} from './background-edit-dialog';
import './drawing-film-tools.css';

export function DrawingFilmTools({e}:{e:ReturnType<typeof useDrawingEditor>}){
 const [editing,setEditing]=useState<'background'|'separate'|null>(null),[uploading,setUploading]=useState(false),[draft,setDraft]=useState('');
 const file=useRef<HTMLInputElement>(null),camera=useRef<HTMLInputElement>(null),lock=useRef(false);
 const disabled=!e.loaded||e.busy||e.playing||e.recording||uploading;
 const scene=e.scene,min=Math.max(3,Math.ceil((scene.voice?.duration??0)+VOICE_LEAD));
 useEffect(()=>setDraft(String(Math.ceil(sceneSeconds(scene)))),[scene.id,scene.durationSeconds,scene.voice]);
 async function upload(value:File){
  if(disabled||lock.current)return;lock.current=true;setUploading(true);e.setError('');e.stop();const sceneId=scene.id;
  try{const image=await readDrawingImage(value);e.commit(p=>putScenePicture(p,sceneId,image));}
  catch(error){e.setError(error instanceof Error?error.message:'그림을 열지 못했어요.');}
  finally{lock.current=false;setUploading(false);}
 }
 return <section className="draw-film-tools" aria-label="장면 그림과 길이">
  <div className="draw-scene-upload"><button className="draw-primary" disabled={disabled} onClick={()=>file.current?.click()}>{uploading?'장면 그림 여는 중…':scene.backgroundAssetId?'장면 그림 바꾸기':'장면 그림 올리기'}</button><button disabled={disabled} onClick={()=>camera.current?.click()}>장면 사진 찍기</button><span>인물과 배경이 함께 있는 그림 한 장</span></div>
  <input ref={file} hidden type="file" accept="image/png,image/jpeg,image/webp" aria-label="장면 전체 그림 파일" onChange={event=>{const value=event.target.files?.[0];event.target.value='';if(value)void upload(value);}}/>
  <input ref={camera} hidden type="file" accept="image/*" capture="environment" aria-label="장면 사진 촬영" onChange={event=>{const value=event.target.files?.[0];event.target.value='';if(value)void upload(value);}}/>
  {scene.backgroundAssetId?<><div className="draw-scene-rotation" aria-label="장면 그림 방향"><strong>그림 방향</strong><button disabled={disabled} onClick={()=>void e.rotateScene(-1)}>왼쪽 90° 회전</button><button disabled={disabled} onClick={()=>void e.rotateScene(1)}>오른쪽 90° 회전</button><button disabled={disabled} onClick={e.removeBackground}>장면 그림 빼기</button></div><div className="draw-film-buttons"><button disabled={disabled} onClick={()=>setEditing('background')}>배경만 AI로 다듬기</button><button disabled={disabled} onClick={()=>setEditing('separate')}>주인공만 따로 움직이기</button></div></>:null}

  {!e.project.narration?.enabled?<details><summary>장면 길이 · {Math.ceil(sceneSeconds(scene))}초</summary><label className="draw-film-auto"><input type="checkbox" checked={scene.durationSeconds===undefined} disabled={disabled} onChange={event=>e.editScene({durationSeconds:event.target.checked?undefined:Math.ceil(sceneSeconds(scene))})}/>대사 길이에 자동으로 맞추기</label><label className="draw-film-duration">장면 길이 <input aria-label="장면 길이 초" type="number" min={min} max={600} value={draft} disabled={disabled||scene.durationSeconds===undefined} onChange={event=>setDraft(event.target.value)} onBlur={()=>{if(scene.durationSeconds===undefined)return;const value=Math.min(600,Math.max(min,Number(draft)||min));e.editScene({durationSeconds:value});setDraft(String(value));}}/> 초</label><p>대사가 잘리지 않도록 최소 {min}초로 맞춰요.</p></details>:null}
  {editing&&scene.backgroundAssetId?<BackgroundEditDialog mode={editing} onSelect={e.chooseItem} project={e.project} scene={scene} onApply={p=>e.commit(()=>p)} onClose={()=>setEditing(null)}/>:null}
 </section>;
}
