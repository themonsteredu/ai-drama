'use client';
import {useRef,useState} from 'react';
import type {useDrawingEditor} from './use-drawing-editor';
import {readDrawingImage} from '@/lib/drawing-media';
import type {DrawingAsset} from '@/lib/drawing-project';
export const scenePictures=[{id:'forest',name:'숲속 무대',file:'/play-scenes/forest.webp'},{id:'coral',name:'산호 동굴',file:'/play-scenes/coral.webp'},{id:'garden',name:'한옥 정원',file:'/play-scenes/garden.webp'}];
export function DrawingScenery({e,onPlace}:{e:ReturnType<typeof useDrawingEditor>;onPlace:(asset:DrawingAsset,isNew?:boolean)=>boolean}){
  const [busy,setBusy]=useState(false),job=useRef(false);
  const disabled=!e.loaded||e.busy||e.playing||busy;
  async function choose(picture:typeof scenePictures[number]){
    if(disabled||job.current)return;const id=`picture-${picture.id}`,known=e.project.assets.find(a=>a.id===id);
    if(known){onPlace(known,false);return;}job.current=true;setBusy(true);
    try{const response=await fetch(picture.file);if(!response.ok)throw new Error('배경을 불러오지 못했어요. 다시 눌러 주세요.');const blob=await response.blob();const image=await readDrawingImage(new File([blob],`${picture.id}.webp`,{type:'image/webp'}));onPlace({...image,id,name:picture.name,kind:'background'},true);}
    catch(cause){e.setError(cause instanceof Error?cause.message:'배경을 불러오지 못했어요.');}finally{job.current=false;setBusy(false);}
  }
  return <section className="story-scenery" id="scene-pictures"><h2><span className="story-section-number blue">2</span> 어디에서 만날까?</h2><p>그림 배경을 고르거나 직접 올려요.</p><div className="story-background-grid">{scenePictures.map(p=><button type="button" key={p.id} disabled={disabled} aria-pressed={e.scene.backgroundAssetId===`picture-${p.id}`} onClick={()=>void choose(p)}><img src={p.file} alt=""/><span>{p.name}</span></button>)}</div><div className="story-background-actions"><button type="button" disabled={disabled} onClick={()=>e.editScene({backgroundAssetId:undefined})}>빈 무대</button>{e.scene.backgroundAssetId?<><button type="button" disabled={disabled} aria-pressed={e.scene.backgroundFit==='cover'} onClick={()=>e.editScene({backgroundFit:'cover'})}>꽉 채우기</button><button type="button" disabled={disabled} aria-pressed={e.scene.backgroundFit==='contain'} onClick={()=>e.editScene({backgroundFit:'contain'})}>전체 보기</button></>:null}</div><p className="story-small-note">내 배경은 ‘그림 고르기’에서 종류를 ‘배경’으로 선택해요.</p>{busy?<p role="status">배경을 준비하고 있어요.</p>:null}</section>;
}
