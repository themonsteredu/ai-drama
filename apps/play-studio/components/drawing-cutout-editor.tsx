'use client';

import {useEffect,useRef,useState,type PointerEvent as ReactPointerEvent} from 'react';
import {drawingKinds,type DrawingKind} from '@/lib/drawing-project';
import {automaticMask,brushMask,canvasOf,finishCutout,fullCrop,maskedPixels,openCutout,paperMask,safeCrop,visibleCrop,type CropRect,type CutoutDocument,type CutoutResult} from '@/lib/drawing-cutout';
import {CutoutIcon,type CutoutIconName} from './drawing-cutout-icons';
import './drawing-cutout.css';

type Tool='crop'|'erase'|'restore';
type Step=1|2|3|4|5;
type Snapshot={mask:Uint8ClampedArray;crop:CropRect};
type Session={original:string;pixels:ImageData;mask:Uint8ClampedArray;crop:CropRect;past:Snapshot[];future:Snapshot[]};
type Props={source:string;initialName:string;initialKind:DrawingKind;edit?:CutoutDocument;existing?:boolean;onCancel:()=>void;onDone:(result:CutoutResult,name:string,kind:DrawingKind)=>boolean};
const corners=['nw','ne','sw','se'] as const;
const cornerNames={nw:'왼쪽 위 자르기 손잡이',ne:'오른쪽 위 자르기 손잡이',sw:'왼쪽 아래 자르기 손잡이',se:'오른쪽 아래 자르기 손잡이'};
const snapshot=(s:Session):Snapshot=>({mask:new Uint8ClampedArray(s.mask),crop:{...s.crop}});
const steps:{id:Step;title:string;short:string;hint:string;icon:CutoutIconName;tone:string}[]=[
  {id:1,title:'사진 올리기',short:'사진',hint:'내 그림 한 장을 준비해요',icon:'photo',tone:'pink'},
  {id:2,title:'배경 지우기',short:'배경',hint:'그림만 쏙 남겨 보세요',icon:'magic',tone:'orange'},
  {id:3,title:'손으로 수정하기',short:'손수정',hint:'지우거나 다시 살려요',icon:'eraser',tone:'green'},
  {id:4,title:'자르기',short:'자르기',hint:'필요한 부분만 남겨요',icon:'crop',tone:'blue'},
  {id:5,title:'완료하고 무대에 놓기',short:'완료',hint:'내 그림의 이야기가 시작돼요',icon:'check',tone:'purple'},
];
const instructions:Record<Step,string>={1:'그림 이름과 종류를 확인해 주세요.',2:'초록 버튼으로 배경을 지워 보세요. 이미 투명한 그림이면 다음으로!',3:'분홍 지우개로 지우고, 파란 버튼으로 다시 살려요.',4:'남길 부분을 네모로 감싸 주세요. 모서리를 잡아도 돼요.',5:'내가 그린 모습 그대로, 이제 무대에 놓아 볼까요?'};

export function DrawingCutoutEditor({source,initialName,initialKind,edit,existing=false,onCancel,onDone}:Props){
  const dialog=useRef<HTMLDialogElement>(null),canvas=useRef<HTMLCanvasElement>(null),session=useRef<Session|null>(null);
  const alive=useRef(true),abort=useRef<AbortController|null>(null),dirty=useRef(false),operation=useRef(false);
  const stroke=useRef<{pointer:number;start:{x:number;y:number};last:{x:number;y:number};before:Snapshot;tool:Tool;anchor?:{x:number;y:number}}|null>(null);
  const [name,setName]=useState(initialName),[kind,setKind]=useState<DrawingKind>(initialKind),[tool,setTool]=useState<Tool>('erase');
  const [step,setStep]=useState<Step>(2),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState('');
  const [viewOriginal,setViewOriginal]=useState(false),[zoom,setZoom]=useState(1),[brush,setBrush]=useState(28),[trim,setTrim]=useState(true),[paper,setPaper]=useState(false);
  const [preview,setPreview]=useState(source),[rect,setRect]=useState<CropRect>(fullCrop(1,1)),[dimensions,setDimensions]=useState({width:1,height:1});
  const [history,setHistory]=useState({past:0,future:0});
  const current=steps[step-1],placeLabel=existing?'수정 적용':kind==='background'?'배경으로 쓰기':'무대에 놓기';
  function paint(){const s=session.current,ctx=canvas.current?.getContext('2d');if(!s||!ctx)return;ctx.putImageData(viewOriginal?s.pixels:maskedPixels(s.pixels,s.mask),0,0);}
  function refresh(){
    const s=session.current;if(!s)return;setRect({...s.crop});setHistory({past:s.past.length,future:s.future.length});paint();
    const work=canvasOf(s.pixels.width,s.pixels.height);work.context.putImageData(maskedPixels(s.pixels,s.mask),0,0);
    const ratio=Math.min(420/s.crop.width,320/s.crop.height);
    const small=canvasOf(Math.max(1,Math.round(s.crop.width*ratio)),Math.max(1,Math.round(s.crop.height*ratio)));
    small.context.drawImage(work.canvas,s.crop.x,s.crop.y,s.crop.width,s.crop.height,0,0,small.canvas.width,small.canvas.height);setPreview(small.canvas.toDataURL('image/png'));
  }
  function remember(before:Snapshot){const s=session.current;if(!s)return;s.past=[...s.past.slice(-11),before];s.future=[];dirty.current=true;setPaper(false);setError('');}
  useEffect(()=>{alive.current=true;dialog.current?.showModal();let canceled=false;void openCutout(source,edit).then(value=>{if(canceled)return;session.current={...value,past:[],future:[]};setDimensions({width:value.pixels.width,height:value.pixels.height});setRect(value.crop);setReady(true);}).catch(cause=>{if(!canceled)setError(cause instanceof Error?cause.message:'사진을 열지 못했어요.');});return()=>{canceled=true;alive.current=false;abort.current?.abort();};},[source,edit]);
  useEffect(()=>{if(ready)refresh();},[ready,viewOriginal,step]);
  function go(next:Step){if(!ready||busy||stroke.current)return;setStep(next);setViewOriginal(false);setZoom(1);setStatus('');if(next===4)setTool('crop');if(next===3)setTool('erase');}
  function changeTool(next:Tool){setTool(next);setViewOriginal(false);setStatus(next==='crop'?instructions[4]:next==='erase'?'지울 곳을 손가락으로 슥슥 문질러 주세요.':'너무 많이 지웠나요? 원래 그림을 다시 살려요.');}
  function undo(redo=false){const s=session.current;if(!s||busy)return;const list=redo?s.future:s.past,next=list.pop();if(!next)return;(redo?s.past:s.future).push(snapshot(s));s.mask=next.mask;s.crop=next.crop;dirty.current=true;setPaper(false);refresh();}
  function reset(){const s=session.current;if(!s||busy)return;if(dirty.current&&!window.confirm('다듬기를 처음부터 다시 할까요? 원본 사진으로 돌아가요.'))return;remember(snapshot(s));s.mask.fill(255);s.crop=fullCrop(s.pixels.width,s.pixels.height);setViewOriginal(false);setStatus('원본 사진으로 돌아왔어요.');refresh();}
  function close(){if(busy){abort.current?.abort();return;}if(dirty.current&&!window.confirm('다듬은 내용을 적용하지 않고 닫을까요? 무대의 그림은 바뀌지 않아요.'))return;onCancel();}
  function pos(event:ReactPointerEvent<HTMLElement>){const r=canvas.current!.getBoundingClientRect(),s=session.current!;return {x:Math.max(0,Math.min(s.pixels.width,(event.clientX-r.left)/r.width*s.pixels.width)),y:Math.max(0,Math.min(s.pixels.height,(event.clientY-r.top)/r.height*s.pixels.height))};}
  function down(event:ReactPointerEvent<HTMLElement>,corner?:typeof corners[number]){
    const s=session.current;if(!s||busy||viewOriginal||(step!==3&&step!==4)||!event.isPrimary||event.button!==0)return;event.preventDefault();event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);
    const point=pos(event),before=snapshot(s),mode=corner?'crop':tool;
    const anchor=corner?{x:corner.includes('w')?s.crop.x+s.crop.width:s.crop.x,y:corner.includes('n')?s.crop.y+s.crop.height:s.crop.y}:undefined;
    stroke.current={pointer:event.pointerId,start:point,last:point,before,tool:mode,anchor};
    if(mode!=='crop'){const scale=s.pixels.width/canvas.current!.getBoundingClientRect().width;brushMask(s.mask,s.pixels.width,s.pixels.height,point,point,brush*scale/2,mode==='restore');paint();}
  }
  function move(event:ReactPointerEvent<HTMLElement>){
    const d=stroke.current,s=session.current;if(!d||!s||d.pointer!==event.pointerId)return;event.preventDefault();const point=pos(event);
    if(d.tool==='crop'){const a=d.anchor??d.start;s.crop=safeCrop({x:Math.min(a.x,point.x),y:Math.min(a.y,point.y),width:Math.max(4,Math.abs(point.x-a.x)),height:Math.max(4,Math.abs(point.y-a.y))},s.pixels.width,s.pixels.height);setRect({...s.crop});}
    else {const scale=s.pixels.width/canvas.current!.getBoundingClientRect().width;brushMask(s.mask,s.pixels.width,s.pixels.height,d.last,point,brush*scale/2,d.tool==='restore');paint();}d.last=point;
  }
  function up(event:ReactPointerEvent<HTMLElement>,cancel=false){const d=stroke.current,s=session.current;if(!d||!s||d.pointer!==event.pointerId)return;stroke.current=null;if(cancel){s.mask=d.before.mask;s.crop=d.before.crop;}else remember(d.before);refresh();}
  function cropToDrawing(){const s=session.current;if(!s||busy)return;try{const crop=visibleCrop(s.pixels,s.mask,s.crop);remember(snapshot(s));s.crop=crop;refresh();}catch(cause){setError(cause instanceof Error?cause.message:'그림을 확인해 주세요.');}}
  function cleanPaper(checked:boolean){const s=session.current;if(!s||busy)return;remember(snapshot(s));s.mask=checked?paperMask(s.pixels,s.mask,s.crop):new Uint8ClampedArray(s.mask.length).fill(255);setPaper(checked);setViewOriginal(false);setStatus('흰 종이를 정리했어요. 그림도 지워졌다면 되돌리기를 눌러 주세요.');refresh();}
  async function cleanBackground(){const s=session.current;if(!s||operation.current)return;operation.current=true;const before=snapshot(s);setBusy(true);setError('');setStatus('배경을 정리하고 있어요. 사진은 이 기기 안에서만 처리해요.');const controller=new AbortController();abort.current=controller;
    try{const next=await automaticMask(s.pixels,s.crop,controller.signal);if(!alive.current)return;remember(before);for(let i=0;i<next.length;i++)s.mask[i]=Math.min(s.mask[i],next[i]);setViewOriginal(false);setStatus('배경을 정리했어요! 남은 곳은 다음 단계에서 다듬어요.');refresh();}
    catch(cause){if(alive.current){setError(cause instanceof Error?cause.message:'자동 정리가 안 됐어요. 손수정은 사용할 수 있어요.');setStatus('');}}
    finally{operation.current=false;abort.current=null;if(alive.current)setBusy(false);}
  }
  async function finish(){const s=session.current;if(!s||operation.current)return;operation.current=true;setBusy(true);setError('');try{const result=await finishCutout(s.original,s.pixels,s.mask,s.crop,trim&&kind!=='background');if(alive.current&&!onDone(result,name.trim()||'내 그림',kind))setError('작품에 담을 수 있는 용량을 확인해 주세요. 기존 그림과 지금 수정한 내용은 그대로예요.');}catch(cause){if(alive.current)setError(cause instanceof Error?cause.message:'그림을 저장하지 못했어요.');}finally{operation.current=false;if(alive.current)setBusy(false);}}
  const disabled=!ready||busy;
  return <dialog ref={dialog} className="cutout-dialog" aria-label="내 그림 다듬기" data-step={step} aria-busy={busy} onCancel={event=>{event.preventDefault();close();}} onKeyDown={event=>{event.stopPropagation();if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'&&!(event.target as HTMLElement).matches('input,textarea')){event.preventDefault();undo(event.shiftKey);}}}>
    <header className="cutout-heading">
      <div><div className="cutout-logo" aria-label="MOAKIT PLAY"><span>M</span><span>O</span><span>A</span><span>K</span><span>I</span><span>T</span><b>PLAY</b></div><h2>내 그림 다듬기</h2></div>
      <p className="cutout-tagline">내가 그린 그림이 움직여요! <CutoutIcon name="sparkles"/></p>
      <button type="button" className="cutout-close" aria-label="다듬기 닫기" onClick={close}><CutoutIcon name="close"/></button>
    </header>
    <nav aria-label="사진 다듬기 단계"><ol className="cutout-steps">{steps.map(s=><li key={s.id} className={`tone-${s.tone} ${step===s.id?'active':''}`}><button type="button" aria-label={`${s.id}단계 ${s.title}`} aria-current={step===s.id?'step':undefined} disabled={disabled} onClick={()=>go(s.id)}><span className="cutout-step-title"><b>{s.id}</b><strong>{s.title}</strong><em>{s.short}</em></span><span className="cutout-step-body"><span className={`cutout-step-picture ${s.id===1?'is-original':'is-checker'}`}><img src={s.id===1?(edit?.original??source):preview} alt=""/></span><span><small>{s.hint}</small><i><CutoutIcon name={s.icon}/>{step===s.id?'지금 여기':s.id===1?'사진 확인':'이 단계로'}</i></span></span></button></li>)}</ol></nav>
    <div className="cutout-layout">
      <section className="cutout-workspace" aria-labelledby="cutout-work-title">
        <div className="cutout-work-heading"><div><span className={`cutout-step-dot tone-${current.tone}`}>{step}</span><h3 id="cutout-work-title">{step===5?'다 됐어요!':current.title}</h3></div><small>한 단계씩, 천천히 해 봐요</small></div>
        <div className="cutout-work-body">
          <div className="cutout-tools" aria-label="현재 단계 도구">
            {step===1?<><div className="cutout-tool-note"><CutoutIcon name="photo"/><strong>내 그림을 골랐어요!</strong><p>오른쪽에서 이름과 종류를 확인해 주세요.</p></div><button type="button" className="cutout-blue" disabled={disabled} onClick={()=>go(2)}>배경 다듬으러 가기<CutoutIcon name="arrow"/></button></>:null}
            {step===2?<><button type="button" className="cutout-auto cutout-green cutout-tool-main" disabled={disabled} onClick={()=>void cleanBackground()}><CutoutIcon name="magic"/><span>{busy?'정리하는 중…':'배경 지우기'}</span></button><label className="cutout-paper"><input type="checkbox" checked={paper} disabled={disabled} onChange={e=>cleanPaper(e.target.checked)}/><span>흰 종이 지우기<small>종이에 그린 그림에 좋아요</small></span></label><p className="cutout-tool-note">배경이 이미 투명하면 지우지 않아도 돼요.</p><button type="button" className="cutout-text-button" disabled={disabled} onClick={()=>go(4)}><CutoutIcon name="crop"/>그림 주위 먼저 자르기</button></>:null}
            {step===3?<><div className="cutout-brush-tools"><button type="button" className="cutout-pink cutout-tool-main" aria-pressed={tool==='erase'} disabled={disabled} onClick={()=>changeTool('erase')}><CutoutIcon name="eraser"/><span>지우기</span></button><button type="button" className="cutout-blue cutout-tool-main" aria-pressed={tool==='restore'} disabled={disabled} onClick={()=>changeTool('restore')}><CutoutIcon name="restore"/><span>다시 살리기</span></button></div><fieldset className="cutout-brush"><legend>도구 크기</legend><div>{([{size:12,label:'작게'},{size:28,label:'보통'},{size:56,label:'크게'}]).map(b=><button type="button" key={b.size} aria-label={`브러시 ${b.label}`} aria-pressed={brush===b.size} disabled={disabled} onClick={()=>setBrush(b.size)}><i style={{width:b.size/3+5,height:b.size/3+5}}/>{b.label}</button>)}</div></fieldset><p className="cutout-tool-note">그림 위를 손가락으로 슥슥! 잘못 지운 곳은 파란 버튼으로 살려요.</p></>:null}
            {step===4?<><button type="button" className="cutout-blue cutout-tool-main" aria-pressed={tool==='crop'} disabled={disabled} onClick={()=>changeTool('crop')}><CutoutIcon name="crop"/><span>자르기</span></button><button type="button" disabled={disabled} onClick={cropToDrawing}>그림에 맞추기</button><button type="button" disabled={disabled} onClick={()=>{const s=session.current!;remember(snapshot(s));s.crop=fullCrop(s.pixels.width,s.pixels.height);refresh();}}>전체 사진</button><p className="cutout-tool-note">파란 모서리를 잡아 필요한 부분만 남겨요.</p></>:null}
            {step===5?<><div className="cutout-finished-badge"><CutoutIcon name="check"/><strong>다 됐어요!</strong><p>세상에 하나뿐인<br/>나의 그림이에요.</p></div><button type="button" disabled={disabled} onClick={()=>go(3)}>조금 더 다듬기</button></>:null}
          </div>
          <div className="cutout-canvas-column">
            <div className="cutout-scroll" data-editable={step===3||step===4} hidden={step===5}><div className="cutout-board" style={{width:`min(${zoom*100}%, ${38*zoom*dimensions.width/dimensions.height}dvh)`,margin:'0 auto'}} onPointerMove={move} onPointerUp={e=>up(e)} onPointerCancel={e=>up(e,true)}>
              <canvas ref={canvas} width={dimensions.width} height={dimensions.height} aria-label="사진 다듬기 작업 영역" onPointerDown={down}/>
              {ready&&step===4&&!viewOriginal?<div className="cutout-crop-box" style={{left:`${rect.x/dimensions.width*100}%`,top:`${rect.y/dimensions.height*100}%`,width:`${rect.width/dimensions.width*100}%`,height:`${rect.height/dimensions.height*100}%`}}>{corners.map(corner=><button type="button" key={corner} className={`cutout-handle ${corner}`} aria-label={cornerNames[corner]} disabled={busy} onPointerDown={e=>down(e,corner)} onKeyDown={event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)||busy)return;event.preventDefault();const s=session.current!;remember(snapshot(s));const dx=event.key==='ArrowRight'?2:event.key==='ArrowLeft'?-2:0,dy=event.key==='ArrowDown'?2:event.key==='ArrowUp'?-2:0;s.crop=safeCrop({x:s.crop.x+(corner.includes('w')?dx:0),y:s.crop.y+(corner.includes('n')?dy:0),width:s.crop.width+(corner.includes('w')?-dx:dx),height:s.crop.height+(corner.includes('n')?-dy:dy)},s.pixels.width,s.pixels.height);refresh();}}/>)}</div>:null}
            </div></div>
            {step===5?<div className="cutout-final-preview is-checker"><img src={preview} alt="완성한 그림"/><span>내 그림 준비 완료</span></div>:null}
            <div className="cutout-viewbar"><button type="button" aria-pressed={viewOriginal} disabled={disabled||step===5} onClick={()=>setViewOriginal(v=>!v)}><CutoutIcon name="compare"/>원본 보기</button><button type="button" aria-pressed={zoom===2} disabled={disabled||step===5} onClick={()=>setZoom(z=>z===1?2:1)}><CutoutIcon name="zoom"/>{zoom===1?'크게 보기':'화면에 맞추기'}</button><button type="button" aria-label="다듬기 실행 취소" title="되돌리기" disabled={!history.past||busy} onClick={()=>undo()}><CutoutIcon name="undo"/></button><button type="button" aria-label="다듬기 다시 실행" title="다시 실행" disabled={!history.future||busy} onClick={()=>undo(true)}><CutoutIcon name="redo"/></button><button type="button" disabled={disabled} onClick={reset}>처음으로</button></div>
          </div>
        </div>
        <p className={`cutout-status ${busy?'is-busy':''}`} role="status" aria-live="polite">{busy?<span className="cutout-loading" aria-hidden="true"/>:<CutoutIcon name="sparkles"/>}{status||(viewOriginal?'원본을 보는 중이에요. 다시 누르면 다듬기로 돌아가요.':instructions[step])}</p>
        {error?<p className="cutout-error" role="alert">{error}</p>:null}
      </section>
      <aside className="cutout-side">
        <section className="cutout-comparison" aria-label="원본과 수정 결과 비교"><h3><CutoutIcon name="compare"/>전 / 후 비교</h3><div className="cutout-compare-pair"><figure><figcaption>원본 사진</figcaption><div><img src={edit?.original??source} alt="원본 사진 비교"/></div></figure><span aria-hidden="true">→</span><figure><figcaption>다듬은 그림</figcaption><div className="is-checker"><img src={preview} alt="등록할 내 그림 미리보기"/></div></figure></div><p>네모 무늬는 배경이 없는 투명한 곳이에요.</p></section>
        <section className="cutout-identity"><label>그림 이름<input type="text" value={name} maxLength={40} onChange={e=>setName(e.target.value)} disabled={busy}/></label><fieldset><legend>무엇을 그렸나요?</legend><div className="cutout-kind">{drawingKinds.map(k=><button type="button" key={k.id} aria-pressed={kind===k.id} disabled={busy||existing} onClick={()=>{setKind(k.id);dirty.current=true;}}>{k.label}</button>)}</div></fieldset><label className="cutout-check"><input type="checkbox" checked={trim} disabled={busy||kind==='background'} onChange={e=>setTrim(e.target.checked)}/>투명한 여백 줄이기</label></section>
        <section className="cutout-tip"><strong><CutoutIcon name="bulb"/>도움말 팁</strong><p>{step===2?'그림 주위를 먼저 자르면 배경을 지우기 쉬워요.':step===3?'크게 보기를 누르면 작은 부분도 편하게 다듬을 수 있어요.':step===4?'자르기는 파란 네모 안쪽만 남겨요. 원본은 그대로 보관해요.':step===5?'무대에 놓은 다음, 이동이나 흔들림을 골라 보세요.':'그림 종류를 고르면 어울리는 움직임을 선택할 수 있어요.'}</p><details><summary>선생님 도움말</summary><p>자동 결과는 사진에 따라 달라요. 첫 자동 정리에는 도구를 불러올 인터넷이 필요해요. 사진은 외부 서버에 보내지 않아요. 실패하면 손수정으로 계속할 수 있어요.</p></details></section>
      </aside>
    </div>
    <footer className="cutout-footer"><p><CutoutIcon name="heart"/><span>내 그림 그대로, 나만의 이야기!<small>원본을 보관해서 다음에도 다시 다듬을 수 있어요.</small></span></p><div className="cutout-footer-actions"><button type="button" onClick={close}>{busy?'작업 취소':'취소'}</button>{step>1?<button type="button" disabled={disabled} onClick={()=>go((step-1) as Step)}>이전</button>:null}{step<4?<button type="button" className="cutout-blue" disabled={disabled} onClick={()=>go((step+1) as Step)}>다음 단계<CutoutIcon name="arrow"/></button>:null}{step<5?<button type="button" className="cutout-yellow" disabled={disabled} onClick={()=>go(5)}><CutoutIcon name="check"/>다 됐어요!</button>:<button type="button" className="cutout-primary" disabled={disabled} onClick={()=>void finish()}><CutoutIcon name="plus"/><span>{busy?'처리 중':placeLabel}</span></button>}</div></footer>
  </dialog>;
}
