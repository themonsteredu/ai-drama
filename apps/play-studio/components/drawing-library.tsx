'use client';
import {useEffect,useRef,useState,type ChangeEvent} from 'react';
import {drawingId,drawingKinds,type DrawingAsset} from '@/lib/drawing-project';
import {readDrawingImage} from '@/lib/drawing-media';
import {DrawingCutoutEditor} from './drawing-cutout-editor';
type Pending={asset:DrawingAsset;existing:boolean;revision:number};
type Props={assets:DrawingAsset[];disabled:boolean;onPlace:(asset:DrawingAsset,isNew?:boolean)=>boolean;onUpdate:(asset:DrawingAsset)=>boolean;onError:(text:string)=>void};
export function DrawingLibrary({assets,disabled,onPlace,onUpdate,onError}:Props){
  const picker=useRef<HTMLInputElement>(null),camera=useRef<HTMLInputElement>(null),sequence=useRef(0);
  const [pending,setPending]=useState<Pending|null>(null),[busy,setBusy]=useState(false);
  useEffect(()=>()=>{sequence.current++;},[]);
  async function open(file:File){
    const job=++sequence.current;setBusy(true);
    try{const image=await readDrawingImage(file);if(job!==sequence.current)return;setPending({asset:{...image,id:drawingId('asset'),name:file.name.replace(/\.[^.]+$/,'').slice(0,40)||'내 그림',kind:'animal'},existing:false,revision:job});}
    catch(cause){if(job===sequence.current)onError(cause instanceof Error?cause.message:'그림을 읽지 못했어요.');}
    finally{if(job===sequence.current)setBusy(false);}
  }
  async function pick(event:ChangeEvent<HTMLInputElement>){const file=event.target.files?.[0];event.target.value='';if(file)await open(file);}
  async function sample(){
    if(disabled||busy||assets.length>=12)return;setBusy(true);
    try{const response=await fetch('/play-scenes/dinosaur-photo.webp');if(!response.ok)throw new Error('공룡 사진을 열지 못했어요. 내 사진은 계속 올릴 수 있어요.');const blob=await response.blob();await open(new File([blob],'예시 공룡.webp',{type:'image/webp'}));}
    catch(cause){onError(cause instanceof Error?cause.message:'예시 사진을 열지 못했어요.');setBusy(false);}
  }
  return <aside className="draw-library" id="my-drawings"><div className="draw-section-title"><small>MY DRAWING</small><h2><span className="story-section-number pink">1</span> 내 그림을 올려요</h2></div>
    <input type="file" ref={picker} accept="image/png,image/jpeg,image/webp" aria-label="그림 파일 선택" hidden onChange={event=>void pick(event)}/><input type="file" ref={camera} accept="image/*" capture="environment" aria-label="그림 사진 촬영" hidden onChange={event=>void pick(event)}/>
    <div className="draw-upload-actions"><button type="button" className="story-upload pink" disabled={disabled||busy||assets.length>=12} onClick={()=>camera.current?.click()}><span aria-hidden="true">▣</span>사진 찍기</button><button type="button" className="story-upload blue" disabled={disabled||busy||assets.length>=12} onClick={()=>picker.current?.click()}><span aria-hidden="true">＋</span>{busy?'사진 여는 중':'그림 고르기'}</button></div>
    <p className="draw-help">종이 그림도, 태블릿 그림도 좋아요.<br/>JPG · PNG · WebP / 10MB 이하</p>
    <button type="button" className="story-sample" disabled={disabled||busy||assets.length>=12} onClick={()=>void sample()}><img src="/play-scenes/dinosaur-photo.webp" alt="공룡 예시 사진"/><span><strong>공룡 사진으로 연습하기</strong><small>내 그림이 없어도 먼저 해 봐요 →</small></span></button>
    {pending?<DrawingCutoutEditor key={pending.revision} source={pending.asset.source} initialName={pending.asset.name} initialKind={pending.asset.kind} edit={pending.asset.edit} existing={pending.existing} onCancel={()=>setPending(null)} onDone={(result,name,kind)=>{if(disabled)return false;const asset:DrawingAsset={...pending.asset,...result,name,kind};const ok=pending.existing?onUpdate(asset):onPlace(asset,true);if(ok)setPending(null);return ok;}}/>:null}
    <div className="draw-library-title"><strong>내 그림 보관함</strong><small>{assets.length}/12</small></div><div className="draw-asset-grid">{assets.map(a=><div key={a.id} className="cutout-asset-wrap"><button type="button" disabled={disabled} className="draw-asset" onClick={()=>onPlace(a)} aria-label={`${a.name} 다시 놓기`}><span className="draw-checker"><img src={a.source} alt=""/></span><strong>{a.name}</strong><small>{drawingKinds.find(k=>k.id===a.kind)?.label}</small></button><button type="button" className="cutout-reedit" disabled={disabled||busy} aria-label={`${a.name} 다듬기`} onClick={()=>setPending({asset:a,existing:true,revision:++sequence.current})}>다시 다듬기</button></div>)}</div>
    {!assets.length?<p className="draw-empty-help">내가 그린 친구들이 여기에 모여요.</p>:null}
    <p className="draw-privacy">사진은 이 기기에서만 다듬어요.<br/>자동 정리 도구만 처음에 내려받아요.</p>
  </aside>;
}
