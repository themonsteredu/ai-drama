'use client';
import {bounded,drawingMotions,motionsFor,type DrawingMotion} from '@/lib/drawing-project';
import type {useDrawingEditor} from './use-drawing-editor';

export function DrawingControls({e}:{e:ReturnType<typeof useDrawingEditor>}){
  const disabled=!e.loaded||e.busy||e.playing;
  function motion(id:DrawingMotion){e.patchItem({motion:id});e.setDestination(false);}

  return <aside className="draw-controls">
    <div className="draw-section-title"><small>03 / ACTION</small><h2>{e.selectedAsset?.name??'어떻게 움직일까?'}</h2></div>
    {e.selected&&e.selectedAsset?<>
      <div className="draw-motion-grid">{drawingMotions.filter(m=>motionsFor(e.selectedAsset!.kind).includes(m.id)).map(m=><button type="button" key={m.id} disabled={disabled} aria-pressed={e.selected!.motion===m.id} onClick={()=>motion(m.id)}>{m.label}</button>)}</div>
      <p className="draw-help">{drawingMotions.find(m=>m.id===e.selected!.motion)?.description}</p>
      <button type="button" className="draw-destination" aria-pressed={e.destination} disabled={disabled} onClick={()=>{e.stop();e.setDestination(!e.destination);}}>◎ 도착할 곳 고르기</button>
      <div className="draw-pair"><button type="button" disabled={disabled} onClick={()=>e.patchItem({motion:e.selected!.motion==='still'?'move':e.selected!.motion,target:{x:20,y:e.selected!.y}})}>← 왼쪽으로</button><button type="button" disabled={disabled} onClick={()=>e.patchItem({motion:e.selected!.motion==='still'?'move':e.selected!.motion,target:{x:80,y:e.selected!.y}})}>오른쪽으로 →</button></div>
      {e.selected.target?<button type="button" className="draw-text-button" disabled={disabled} onClick={()=>{e.patchItem({target:undefined});e.setDestination(false);}}>이동 경로 지우기</button>:null}
      <fieldset><legend>빠르기</legend><div className="draw-trio">{([['slow','천천히'],['normal','보통'],['fast','빠르게']] as const).map(([id,label])=><button type="button" key={id} disabled={disabled} aria-pressed={e.selected!.speed===id} onClick={()=>e.patchItem({speed:id})}>{label}</button>)}</div></fieldset>
      <fieldset><legend>크기와 방향</legend><div className="draw-trio"><button type="button" disabled={disabled} onClick={()=>e.patchItem({width:bounded(e.selected!.width-3,5,65)})}>작게</button><button type="button" disabled={disabled} onClick={()=>e.patchItem({width:bounded(e.selected!.width+3,5,65)})}>크게</button><button type="button" disabled={disabled} onClick={()=>e.patchItem({flipped:!e.selected!.flipped})}>뒤집기</button></div></fieldset>
      <label>이 그림의 대사<textarea disabled={disabled} maxLength={80} value={e.selected.speech} onChange={event=>e.patchItem({speech:event.target.value})} placeholder="무엇이라고 말할까요?"/></label>
      <details><summary>위치·겹침·복사</summary><div className="draw-pair"><button type="button" disabled={disabled} onClick={()=>e.patchItem({x:bounded(e.selected!.x-3,2,98)})}>위치 ←</button><button type="button" disabled={disabled} onClick={()=>e.patchItem({x:bounded(e.selected!.x+3,2,98)})}>위치 →</button><button type="button" disabled={disabled} onClick={()=>e.patchItem({y:bounded(e.selected!.y-3,5,98)})}>위치 ↑</button><button type="button" disabled={disabled} onClick={()=>e.patchItem({y:bounded(e.selected!.y+3,5,98)})}>위치 ↓</button><button type="button" disabled={disabled} onClick={()=>e.layer(-1)}>뒤로</button><button type="button" disabled={disabled} onClick={()=>e.layer(1)}>앞으로</button><button type="button" disabled={disabled} onClick={e.duplicate}>그림 복사</button><button type="button" disabled={disabled} onClick={e.remove}>무대에서 지우기</button></div></details>
    </>:<p className="draw-empty-help">무대의 그림을 누르면 움직임 버튼이 보여요.</p>}
    <p className="draw-privacy"><b>기본 배경·장식 효과·SVG 그림은 사용하지 않아요.</b><br/>배경도 왼쪽에서 직접 올린 JPG·PNG·WebP만 사용할 수 있어요.</p>
  </aside>;
}
