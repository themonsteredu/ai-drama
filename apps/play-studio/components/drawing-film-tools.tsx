'use client';
import {useRef,useState} from 'react';
import type {useDrawingEditor} from './use-drawing-editor';
import {readDrawingImage} from '@/lib/drawing-media';
import {putScenePicture} from '@/lib/four-scene';
import {BackgroundEditDialog} from './background-edit-dialog';
import './drawing-film-tools.css';

export function DrawingFilmTools({e,onCharacterSelected}:{e:ReturnType<typeof useDrawingEditor>;onCharacterSelected?:()=>void}){
 const [editing,setEditing]=useState<'background'|'separate'|'repair'|null>(null),[editingItem,setEditingItem]=useState<string>(),[uploading,setUploading]=useState(false);
 const file=useRef<HTMLInputElement>(null),camera=useRef<HTMLInputElement>(null),lock=useRef(false);
 const disabled=!e.loaded||e.busy||e.playing||e.recording||uploading;
 const scene=e.scene;
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
  {scene.backgroundAssetId?<><div className="draw-scene-rotation" aria-label="장면 그림 방향"><strong>그림 방향</strong><button disabled={disabled} onClick={()=>void e.rotateScene(-1)}>왼쪽 90° 회전</button><button disabled={disabled} onClick={()=>void e.rotateScene(1)}>오른쪽 90° 회전</button><button disabled={disabled} onClick={e.removeBackground}>장면 그림 빼기</button></div><div className="draw-film-buttons"><button disabled={disabled} onClick={()=>setEditing('background')}>배경만 AI로 다듬기</button><button disabled={disabled} onClick={()=>{setEditingItem(undefined);setEditing('separate');}}>주인공만 따로 움직이기</button>{e.selected?.separation?<button disabled={disabled} onClick={()=>{setEditingItem(e.selected!.id);setEditing('separate');}}>선택한 주인공 분리 고치기</button>:null}{scene.items.length>0?<button disabled={disabled} onClick={()=>setEditing('repair')}>배경에 남은 주인공 지우기</button>:null}</div></>:null}


  {editing&&scene.backgroundAssetId?<BackgroundEditDialog existingItemId={editing==='separate'?editingItem:undefined} mode={editing} onSelect={id=>{e.chooseItem(id);onCharacterSelected?.();}} project={e.project} scene={scene} onApply={p=>e.commit(()=>p)} onClose={()=>{setEditing(null);setEditingItem(undefined);}}/>:null}
 </section>;
}
