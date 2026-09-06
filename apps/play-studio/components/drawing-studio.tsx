'use client';
import Link from 'next/link';
import {useRef} from 'react';
import {useDrawingEditor} from './use-drawing-editor';
import {DrawingCanvas} from './drawing-canvas';
import {DrawingLibrary} from './drawing-library';
import {DrawingControls} from './drawing-controls';
import {cutoutBytes} from '@/lib/drawing-cutout';
import type {DrawingAsset} from '@/lib/drawing-project';
import './drawing-studio.css';
export function DrawingStudio(){
  const e=useDrawingEditor(),file=useRef<HTMLInputElement>(null),disabled=!e.loaded||e.busy,editingDisabled=disabled||e.playing;
  function fits(assets:DrawingAsset[]){if(assets.reduce((sum,a)=>sum+cutoutBytes(a),0)>10_000_000){e.setError('원본과 수정 정보를 합친 그림 용량이 커요. 더 작은 사진을 골라 주세요. 기존 그림은 그대로예요.');return false;}return true;}
  function place(asset:DrawingAsset,isNew=false){if(isNew&&!fits([...e.project.assets,asset]))return false;return e.place(asset,isNew);}
  function updateAsset(asset:DrawingAsset){const next=e.project.assets.map(a=>a.id===asset.id?asset:a);if(editingDisabled||!fits(next))return false;e.commit(p=>({...p,assets:p.assets.map(a=>a.id===asset.id?asset:a)}));e.setError('');return true;}
  return <main className="drawing-app" onKeyDown={event=>{const target=event.target as HTMLElement;if(target.matches('input,textarea,select')||target.isContentEditable||target.closest('dialog'))return;if(event.key==='Escape'){e.stop();e.setDestination(false);}if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();event.shiftKey?e.redo():e.undo();}}}>
    <header className="draw-header"><Link href="/" className="draw-brand">MOAKIT <b>PLAY</b><small>내 그림 움직이기</small></Link><label className="draw-title"><span className="draw-sr">작품 제목</span><input aria-label="내 그림 작품 제목" value={e.project.title} maxLength={80} disabled={disabled} onChange={event=>e.commit(p=>({...p,title:event.target.value}))}/><small role="status">{e.saveState}</small></label><div className="draw-history"><button type="button" aria-label="실행 취소" disabled={disabled||!e.canUndo} onClick={e.undo}>↶</button><button type="button" aria-label="다시 실행" disabled={disabled||!e.canRedo} onClick={e.redo}>↷</button></div></header>
    {e.error?<div className="draw-alert" role="alert"><span>{e.error}</span><button type="button" aria-label="안내 닫기" onClick={()=>e.setError('')}>×</button></div>:null}
    <div className="draw-workspace"><DrawingLibrary assets={e.project.assets} disabled={editingDisabled} onPlace={place} onUpdate={updateAsset} onError={e.setError}/>
      <section className="draw-stage-column" aria-label="그림 무대 편집">
        <div className="draw-stage-heading"><div><small>02 / MAKE IT MOVE</small><h1>내 그림이 살아 움직여요</h1></div><span>{e.project.scenes.findIndex(s=>s.id===e.scene.id)+1} / {e.project.scenes.length} 장면</span></div>
        <div className={`draw-stage-frame ${e.destination?'choosing-destination':''}`}><DrawingCanvas project={e.project} scene={e.scene} playing={e.playing} reset={e.reset} selectedId={e.selectedId} clock={e.clock} onError={e.setError} onDown={e.down} onMove={e.move} onUp={e.up} onCancel={e.cancel}/>{!e.scene.items.length&&!e.scene.backgroundAssetId?<div className="draw-stage-empty"><span>＋</span><strong>여기가 내 그림의 무대예요</strong><p>그림을 고르고, 무엇을 그렸는지 알려 주세요.</p></div>:null}</div>
        <p className={`draw-stage-hint ${e.destination?'active':''}`} aria-live="polite">{e.destination?'무대에서 도착할 곳을 톡 눌러 주세요.':e.playing?'움직이는 중 · 멈추고 처음으로 돌아가면 다시 편집할 수 있어요.':'그림을 눌러 선택하고, 끌어서 놓으세요.'}</p>
        <div className="draw-playbar"><button type="button" className="draw-primary" disabled={disabled||(!e.scene.items.length&&!e.scene.backgroundAssetId&&e.scene.weather==='none')} onClick={()=>{e.setDestination(false);e.setPlaying(!e.playing);}}>{e.playing?'Ⅱ 잠깐 멈춤':'▶ 움직여 보기'}</button><button type="button" disabled={disabled} onClick={e.stop}>■ 처음으로</button><span>움직임은 재생할 때만 보여요.</span></div>
        <div className="draw-stage-items" aria-label="무대의 그림 목록">{e.scene.items.map(item=><button type="button" key={item.id} disabled={disabled} aria-pressed={e.selectedId===item.id} onClick={()=>e.chooseItem(item.id)}>{e.project.assets.find(a=>a.id===item.assetId)?.name??'그림'}</button>)}</div>
        <div className="draw-scenes" aria-label="내 그림 장면 목록">{e.project.scenes.map((s,i)=><button type="button" key={s.id} aria-pressed={s.id===e.scene.id} disabled={disabled} onClick={()=>e.switchScene(s.id)}><small>{String(i+1).padStart(2,'0')}</small>{s.title}</button>)}<button type="button" disabled={disabled||e.project.scenes.length>=6} onClick={()=>e.addScene()}>＋ 장면</button></div>
        <details className="draw-scene-settings"><summary>장면 이름과 설명</summary><label>장면 이름<input maxLength={40} disabled={editingDisabled} value={e.scene.title} onChange={event=>e.editScene({title:event.target.value})}/></label><label>장면 설명<textarea maxLength={120} disabled={editingDisabled} placeholder="예: 숲에 바람이 불기 시작했어요." value={e.scene.caption} onChange={event=>e.editScene({caption:event.target.value})}/></label><div className="draw-pair"><button type="button" disabled={editingDisabled} onClick={()=>e.addScene(true)}>장면 복사</button><button type="button" disabled={editingDisabled||e.project.scenes.length===1} onClick={e.deleteScene}>장면 지우기</button></div></details>
      </section><DrawingControls e={e}/></div>
    <footer className="draw-footer"><p><b>내 그림 그대로.</b> 그림 선택 → 동작 선택 → 움직여 보기</p><details><summary>작품 보관·불러오기</summary><div className="draw-file-actions"><button type="button" disabled={disabled} onClick={e.backup}>작품 파일 보관</button><button type="button" disabled={disabled} onClick={()=>file.current?.click()}>내 그림 작품 불러오기</button><button type="button" disabled={disabled} onClick={()=>void e.png()}>{e.busy?'처리 중':'현재 모습 PNG'}</button><button type="button" disabled={disabled} onClick={e.newWork}>새 작품</button></div><p>그림·움직임·날씨와 사진 다듬기 원본을 함께 보관해요. 다른 기기에서는 파일을 불러오세요. PNG는 정지 그림이며 영상 파일은 아니에요.</p></details><input type="file" ref={file} accept=".json,application/json" hidden aria-label="내 그림 작품 파일 선택" onChange={event=>{const picked=event.target.files?.[0];event.target.value='';if(picked)void e.importWork(picked);}}/></footer>
  </main>;
}
