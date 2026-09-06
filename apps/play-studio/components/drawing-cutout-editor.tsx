'use client';

import {useEffect,useRef,useState,type PointerEvent as ReactPointerEvent} from 'react';
import {drawingKinds,type DrawingKind} from '@/lib/drawing-project';
import {automaticMask,brushMask,canvasOf,finishCutout,fullCrop,maskedPixels,openCutout,paperMask,safeCrop,visibleCrop,type CropRect,type CutoutDocument,type CutoutResult} from '@/lib/drawing-cutout';
import './drawing-cutout.css';

type Tool='crop'|'erase'|'restore';
type Snapshot={mask:Uint8ClampedArray;crop:CropRect};
type Session={original:string;pixels:ImageData;mask:Uint8ClampedArray;crop:CropRect;past:Snapshot[];future:Snapshot[]};
type Props={source:string;initialName:string;initialKind:DrawingKind;edit?:CutoutDocument;existing?:boolean;onCancel:()=>void;onDone:(result:CutoutResult,name:string,kind:DrawingKind)=>boolean};
const corners=['nw','ne','sw','se'] as const;
const cornerNames={nw:'왼쪽 위 자르기 손잡이',ne:'오른쪽 위 자르기 손잡이',sw:'왼쪽 아래 자르기 손잡이',se:'오른쪽 아래 자르기 손잡이'};
const snapshot=(s:Session):Snapshot=>({mask:new Uint8ClampedArray(s.mask),crop:{...s.crop}});

export function DrawingCutoutEditor({source,initialName,initialKind,edit,existing=false,onCancel,onDone}:Props){
  const dialog=useRef<HTMLDialogElement>(null),canvas=useRef<HTMLCanvasElement>(null),session=useRef<Session|null>(null);
  const alive=useRef(true),abort=useRef<AbortController|null>(null),dirty=useRef(false);
  const stroke=useRef<{pointer:number;start:{x:number;y:number};last:{x:number;y:number};before:Snapshot;tool:Tool;anchor?:{x:number;y:number}}|null>(null);
  const [name,setName]=useState(initialName),[kind,setKind]=useState<DrawingKind>(initialKind),[tool,setTool]=useState<Tool>('crop');
  const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState('');
  const [viewOriginal,setViewOriginal]=useState(false),[zoom,setZoom]=useState(1),[brush,setBrush]=useState(28),[trim,setTrim]=useState(true),[paper,setPaper]=useState(false);
  const [preview,setPreview]=useState(source),[rect,setRect]=useState<CropRect>(fullCrop(1,1)),[dimensions,setDimensions]=useState({width:1,height:1});
  const [history,setHistory]=useState({past:0,future:0});
  function paint(){const s=session.current,ctx=canvas.current?.getContext('2d');if(!s||!ctx)return;ctx.putImageData(viewOriginal?s.pixels:maskedPixels(s.pixels,s.mask),0,0);}
  function refresh(){
    const s=session.current;if(!s)return;setRect({...s.crop});setHistory({past:s.past.length,future:s.future.length});paint();
    const work=canvasOf(s.pixels.width,s.pixels.height);work.context.putImageData(maskedPixels(s.pixels,s.mask),0,0);
    // Bound BOTH preview dimensions, including very tall/narrow crop selections.
    const ratio=Math.min(240/s.crop.width,160/s.crop.height);
    const small=canvasOf(Math.max(1,Math.round(s.crop.width*ratio)),Math.max(1,Math.round(s.crop.height*ratio)));
    small.context.drawImage(work.canvas,s.crop.x,s.crop.y,s.crop.width,s.crop.height,0,0,small.canvas.width,small.canvas.height);setPreview(small.canvas.toDataURL('image/png'));
  }
  function remember(before:Snapshot){const s=session.current;if(!s)return;s.past=[...s.past.slice(-11),before];s.future=[];dirty.current=true;setPaper(false);setError('');}
  useEffect(()=>{alive.current=true;dialog.current?.showModal();let canceled=false;void openCutout(source,edit).then(value=>{if(canceled)return;session.current={...value,past:[],future:[]};setDimensions({width:value.pixels.width,height:value.pixels.height});setRect(value.crop);setReady(true);}).catch(cause=>{if(!canceled)setError(cause instanceof Error?cause.message:'사진을 열지 못했어요.');});return()=>{canceled=true;alive.current=false;abort.current?.abort();};},[source,edit]);
  useEffect(()=>{if(ready)refresh();},[ready,viewOriginal]);
  function changeTool(next:Tool){setTool(next);setViewOriginal(false);setStatus(next==='crop'?'남길 부분을 네모로 감싸 주세요. 모서리를 잡아도 돼요.':next==='erase'?'지울 곳을 손가락으로 슥슥 문질러 주세요.':'너무 많이 지웠나요? 원래 그림을 다시 살려요.');}
  function undo(redo=false){const s=session.current;if(!s||busy)return;const list=redo?s.future:s.past,next=list.pop();if(!next)return;(redo?s.past:s.future).push(snapshot(s));s.mask=next.mask;s.crop=next.crop;dirty.current=true;setPaper(false);refresh();}
  function reset(){const s=session.current;if(!s||busy)return;if(dirty.current&&!window.confirm('다듬기를 처음부터 다시 할까요? 원본 사진으로 돌아가요.'))return;remember(snapshot(s));s.mask.fill(255);s.crop=fullCrop(s.pixels.width,s.pixels.height);setViewOriginal(false);refresh();}
  function close(){if(busy){abort.current?.abort();return;}if(dirty.current&&!window.confirm('다듬은 내용을 적용하지 않고 닫을까요? 무대의 그림은 바뀌지 않아요.'))return;onCancel();}
  function pos(event:ReactPointerEvent<HTMLElement>){const r=canvas.current!.getBoundingClientRect(),s=session.current!;return {x:Math.max(0,Math.min(s.pixels.width,(event.clientX-r.left)/r.width*s.pixels.width)),y:Math.max(0,Math.min(s.pixels.height,(event.clientY-r.top)/r.height*s.pixels.height))};}
  function down(event:ReactPointerEvent<HTMLElement>,corner?:typeof corners[number]){
    const s=session.current;if(!s||busy||viewOriginal||!event.isPrimary||event.button!==0)return;event.preventDefault();event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);
    const point=pos(event),before=snapshot(s);const mode=corner?'crop':tool;
    const anchor=corner?{x:corner.includes('w')?s.crop.x+s.crop.width:s.crop.x,y:corner.includes('n')?s.crop.y+s.crop.height:s.crop.y}:undefined;
    stroke.current={pointer:event.pointerId,start:point,last:point,before,tool:mode,anchor};
    if(mode!=='crop'){const scale=s.pixels.width/canvas.current!.getBoundingClientRect().width;brushMask(s.mask,s.pixels.width,s.pixels.height,point,point,brush*scale/2,mode==='restore');paint();}
  }
  function move(event:ReactPointerEvent<HTMLElement>){
    const d=stroke.current,s=session.current;if(!d||!s||d.pointer!==event.pointerId)return;event.preventDefault();const point=pos(event);
    if(d.tool==='crop'){const a=d.anchor??d.start;s.crop=safeCrop({x:Math.min(a.x,point.x),y:Math.min(a.y,point.y),width:Math.max(4,Math.abs(point.x-a.x)),height:Math.max(4,Math.abs(point.y-a.y))},s.pixels.width,s.pixels.height);setRect({...s.crop});}
    else {const scale=s.pixels.width/canvas.current!.getBoundingClientRect().width;brushMask(s.mask,s.pixels.width,s.pixels.height,d.last,point,brush*scale/2,d.tool==='restore');paint();}
    d.last=point;
  }
  function up(event:ReactPointerEvent<HTMLElement>,cancel=false){const d=stroke.current,s=session.current;if(!d||!s||d.pointer!==event.pointerId)return;stroke.current=null;if(cancel){s.mask=d.before.mask;s.crop=d.before.crop;}else{remember(d.before);}refresh();}
  function cropToDrawing(){const s=session.current;if(!s)return;try{const crop=visibleCrop(s.pixels,s.mask,s.crop);remember(snapshot(s));s.crop=crop;refresh();}catch(cause){setError(cause instanceof Error?cause.message:'그림을 확인해 주세요.');}}
  function cleanPaper(checked:boolean){const s=session.current;if(!s||busy)return;remember(snapshot(s));s.mask=checked?paperMask(s.pixels,s.mask,s.crop):new Uint8ClampedArray(s.mask.length).fill(255);setPaper(checked);setViewOriginal(false);setStatus('흰 종이 정리를 적용했어요. 밝은 그림까지 지워지면 실행 취소해 주세요.');refresh();}
  async function cleanBackground(){const s=session.current;if(!s||busy)return;const before=snapshot(s);setBusy(true);setError('');setStatus('자동 정리 도구 준비 중 · 사진은 이 기기 안에서만 처리해요.');const controller=new AbortController();abort.current=controller;
    try{const next=await automaticMask(s.pixels,s.crop,controller.signal);if(!alive.current)return;remember(before);for(let i=0;i<next.length;i++)s.mask[i]=Math.min(s.mask[i],next[i]);setViewOriginal(false);setStatus('배경을 정리했어요. 남은 곳은 지우기·다시 살리기로 다듬어 주세요.');refresh();}
    catch(cause){if(alive.current){setError(cause instanceof Error?cause.message:'자동 정리가 안 됐어요. 손수정은 사용할 수 있어요.');setStatus('');}}
    finally{abort.current=null;if(alive.current)setBusy(false);}
  }
  async function finish(){const s=session.current;if(!s||busy)return;setBusy(true);setError('');try{const result=await finishCutout(s.original,s.pixels,s.mask,s.crop,trim&&kind!=='background');if(alive.current&&!onDone(result,name.trim()||'내 그림',kind))setError('작품에 담을 수 있는 용량을 확인해 주세요. 기존 그림과 지금 수정한 내용은 그대로예요.');}catch(cause){if(alive.current)setError(cause instanceof Error?cause.message:'그림을 저장하지 못했어요.');}finally{if(alive.current)setBusy(false);}}
  return <dialog ref={dialog} className="cutout-dialog" aria-label="내 그림 다듬기" onCancel={event=>{event.preventDefault();close();}} onKeyDown={event=>{event.stopPropagation();if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'&&!(event.target as HTMLElement).matches('input,textarea')){event.preventDefault();undo(event.shiftKey);}}}>
    <header className="cutout-heading"><div><small>MOAKIT PLAY · MY DRAWING</small><h2>내 그림 다듬기</h2></div><button type="button" aria-label="다듬기 닫기" onClick={close}>{busy?'취소':'×'}</button></header>
    <ol className="cutout-steps"><li><b>1</b>사진</li><li className={busy?'active':''}><b>2</b>배경 지우기</li><li className={tool!=='crop'?'active':''}><b>3</b>손수정</li><li className={tool==='crop'?'active':''}><b>4</b>자르기</li><li><b>5</b>완료</li></ol>
    <div className="cutout-layout"><section className="cutout-left"><div className="cutout-tools"><button type="button" className="cutout-auto" disabled={!ready||busy} onClick={()=>void cleanBackground()}>배경 지우기</button><button type="button" aria-pressed={tool==='erase'} disabled={!ready||busy} onClick={()=>changeTool('erase')}>지우기</button><button type="button" aria-pressed={tool==='restore'} disabled={!ready||busy} onClick={()=>changeTool('restore')}>다시 살리기</button><button type="button" aria-pressed={tool==='crop'} disabled={!ready||busy} onClick={()=>changeTool('crop')}>자르기</button></div>
      <div className="cutout-scroll"><div className="cutout-board" style={{width:`min(${zoom*100}%, ${44*zoom*dimensions.width/dimensions.height}dvh)`,minWidth:0,margin:'0 auto'}} onPointerMove={move} onPointerUp={e=>up(e)} onPointerCancel={e=>up(e,true)}>
        <canvas ref={canvas} width={dimensions.width} height={dimensions.height} aria-label="사진 다듬기 작업 영역" onPointerDown={down}/>
        {ready&&tool==='crop'&&!viewOriginal?<div className="cutout-crop-box" style={{left:`${rect.x/dimensions.width*100}%`,top:`${rect.y/dimensions.height*100}%`,width:`${rect.width/dimensions.width*100}%`,height:`${rect.height/dimensions.height*100}%`}}>{corners.map(corner=><button type="button" key={corner} className={`cutout-handle ${corner}`} aria-label={cornerNames[corner]} disabled={busy} onPointerDown={e=>down(e,corner)} onKeyDown={event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)||busy)return;event.preventDefault();const s=session.current!;remember(snapshot(s));const dx=event.key==='ArrowRight'?2:event.key==='ArrowLeft'?-2:0,dy=event.key==='ArrowDown'?2:event.key==='ArrowUp'?-2:0;s.crop=safeCrop({x:s.crop.x+(corner.includes('w')?dx:0),y:s.crop.y+(corner.includes('n')?dy:0),width:s.crop.width+(corner.includes('w')?-dx:dx),height:s.crop.height+(corner.includes('n')?-dy:dy)},s.pixels.width,s.pixels.height);refresh();}}/>)}</div>:null}
      </div></div>
      <div className="cutout-viewbar"><button type="button" aria-pressed={viewOriginal} disabled={!ready||busy} onClick={()=>setViewOriginal(v=>!v)}>원본 보기</button><button type="button" aria-pressed={zoom===2} disabled={!ready||busy} onClick={()=>setZoom(z=>z===1?2:1)}>{zoom===1?'크게 보기':'화면에 맞추기'}</button><button type="button" aria-label="다듬기 실행 취소" disabled={!history.past||busy} onClick={()=>undo()}>↶</button><button type="button" aria-label="다듬기 다시 실행" disabled={!history.future||busy} onClick={()=>undo(true)}>↷</button><button type="button" disabled={!ready||busy} onClick={reset}>처음으로</button></div>
      {tool!=='crop'?<label className="cutout-brush">브러시 크기<input type="range" aria-label="브러시 크기" min={8} max={72} value={brush} disabled={busy} onChange={e=>setBrush(Number(e.target.value))}/></label>:<div className="cutout-viewbar"><button type="button" disabled={!ready||busy} onClick={cropToDrawing}>그림에 맞추기</button><button type="button" disabled={!ready||busy} onClick={()=>{const s=session.current!;remember(snapshot(s));s.crop=fullCrop(s.pixels.width,s.pixels.height);refresh();}}>전체 사진</button></div>}
      <p className="cutout-status" role="status">{status||(viewOriginal?'원본을 보는 중이에요. 다시 누르면 편집으로 돌아가요.':tool==='crop'?'남길 그림을 네모로 감싸 주세요. 모서리를 잡아 크기를 바꿔도 돼요.':'그림 위를 손가락이나 마우스로 문질러 주세요.')}</p>
      {error?<p className="cutout-error" role="alert">{error}</p>:null}
      <p className="cutout-help">자동 정리는 사진에 따라 다를 수 있어요. 그림 주위를 먼저 자르면 도움이 돼요. 도구를 처음 불러올 때 인터넷이 필요하지만 사진은 전송하지 않아요.</p>
    </section><aside className="cutout-side"><label>그림 이름<input type="text" value={name} maxLength={40} onChange={e=>setName(e.target.value)} disabled={busy}/></label><div className="cutout-preview"><img src={preview} alt="등록할 내 그림 미리보기"/></div><p className="cutout-preview-label">네모 무늬는 투명한 곳이에요.</p><fieldset><legend>무엇을 그렸나요?</legend><div className="cutout-kind">{drawingKinds.map(k=><button type="button" key={k.id} aria-pressed={kind===k.id} disabled={busy||existing} onClick={()=>setKind(k.id)}>{k.label}</button>)}</div></fieldset><label className="cutout-check"><input type="checkbox" checked={paper} disabled={!ready||busy} onChange={e=>cleanPaper(e.target.checked)}/>흰 종이 지우기</label><label className="cutout-check"><input type="checkbox" checked={trim} disabled={busy||kind==='background'} onChange={e=>setTrim(e.target.checked)}/>투명한 여백 줄이기</label><p className="cutout-help">종이 그림에는 ‘흰 종이 지우기’를 써 보세요. 지운 부분은 다시 살릴 수 있어요.</p></aside></div>
    <footer className="cutout-footer"><p>원본과 수정 내용을 함께 보관해요.<br/>다음에도 다시 다듬을 수 있어요.</p><div className="cutout-footer-actions"><button type="button" onClick={close}>{busy?'작업 취소':'취소'}</button><button type="button" className="cutout-primary" disabled={!ready||busy} onClick={()=>void finish()}>{busy?'처리 중':existing?'수정 적용':kind==='background'?'배경으로 쓰기':'무대에 놓기'}</button></div></footer>
  </dialog>;
}
