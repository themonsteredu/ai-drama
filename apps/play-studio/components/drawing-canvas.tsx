'use client';
import {useEffect,useRef,useState,type MutableRefObject,type PointerEvent as ReactPointerEvent} from 'react';
import type {DrawingProject,DrawingScene} from '@/lib/drawing-project';
import {loadDrawingImages} from '@/lib/drawing-media';
import {drawDrawingScene,DRAW_WIDTH,DRAW_HEIGHT,type RasterCache} from '@/lib/drawing-renderer';
import {newSpeechView,rememberSpeechView,clearSpeechLayoutCache,type SpeechBubble} from '@/lib/drawing-speech';
import './drawing-speech.css';
type Props={project:DrawingProject;scene:DrawingScene;playing:boolean;reset:number;selectedId?:string;clock:MutableRefObject<number>;onError:(text:string)=>void;onDown:(e:ReactPointerEvent<HTMLCanvasElement>)=>void;onMove:(e:ReactPointerEvent<HTMLCanvasElement>)=>void;onUp:(e:ReactPointerEvent<HTMLCanvasElement>)=>void;onCancel:()=>void};
export function DrawingCanvas({project,scene,playing,reset,selectedId,clock,onError,onDown,onMove,onUp,onCancel}:Props){
 const canvas=useRef<HTMLCanvasElement>(null),view=useRef(newSpeechView());
 const [images,setImages]=useState<RasterCache>(new Map()),[bubbles,setBubbles]=useState<SpeechBubble[]>([]),[revision,setRevision]=useState(0);
 useEffect(()=>{let canceled=false;void loadDrawingImages(project.assets).then(result=>{if(!canceled)setImages(result);}).catch(error=>{if(!canceled)onError(error instanceof Error?error.message:'그림을 읽지 못했어요.');});return()=>{canceled=true;};},[project.assets,onError]);
 useEffect(()=>{clock.current=0;},[reset,clock]);
 useEffect(()=>{
  const element=canvas.current;if(!element)return;
  const measure=()=>{const width=element.getBoundingClientRect().width;if(width>0&&Math.abs(width-view.current.displayWidth)>.5){view.current.displayWidth=width;setRevision(n=>n+1);}};
  measure();const observer=new ResizeObserver(measure);observer.observe(element);return()=>observer.disconnect();
 },[]);
 useEffect(()=>{
  let gone=false;const refresh=()=>{if(!gone){clearSpeechLayoutCache();setRevision(n=>n+1);}};
  void document.fonts.ready.then(refresh);document.fonts.addEventListener('loadingdone',refresh);
  return()=>{gone=true;document.fonts.removeEventListener('loadingdone',refresh);};
 },[]);
 useEffect(()=>{
  const ids=new Set(scene.items.map(i=>i.id));for(const id of view.current.cursors.keys())if(!ids.has(id))view.current.cursors.delete(id);
  const element=canvas.current,ctx=element?.getContext('2d');if(!element||!ctx)return;
  let raf=0,last=performance.now(),lastPaint=0,canceled=false,signature='';
  const paint=(now:number)=>{
   if(canceled)return;if(playing)clock.current+=(now-last)/1000;last=now;
   if(!playing||now-lastPaint>=30){
    rememberSpeechView(scene,view.current);
    const next=drawDrawingScene(ctx,project,scene,images,clock.current,playing?undefined:selectedId,!playing,view.current,true);
    const key=JSON.stringify(next.map(b=>[b.id,b.x,b.y,b.width,b.height,b.page,b.pages,b.displayText]));
    if(key!==signature){signature=key;setBubbles(next);}
    element.dataset.time=clock.current.toFixed(2);lastPaint=now;
   }
   if(playing)raf=requestAnimationFrame(paint);
  };
  paint(performance.now());return()=>{canceled=true;cancelAnimationFrame(raf);};
 },[project,scene,images,playing,reset,selectedId,clock,revision]);
 function turn(bubble:SpeechBubble,offset:number){view.current.cursors.set(bubble.id,{text:bubble.text,offset});setRevision(n=>n+1);}
 return <div className="draw-canvas-wrap"><canvas ref={canvas} width={DRAW_WIDTH} height={DRAW_HEIGHT} className="draw-canvas" aria-label="내 그림 무대. 아래 그림 목록에서 선택한 뒤 위치를 바꿀 수 있어요." onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onCancel}>그림을 움직이는 무대입니다.</canvas>
 <div className="drawing-speech-layer">{bubbles.map(b=><div key={b.id} className="drawing-speech-box" data-speaker={b.id} data-page={b.page+1} data-pages={b.pages} style={{left:`${b.x/DRAW_WIDTH*100}%`,top:`${b.y/DRAW_HEIGHT*100}%`,width:`${b.width/DRAW_WIDTH*100}%`,height:`${b.height/DRAW_HEIGHT*100}%`}}>
  <p className="drawing-speech-readable">{b.name}: {b.displayText}</p>
  {b.pages>1?<div className="drawing-speech-pager" role="group" aria-label={`${b.name} 말풍선 넘기기`} style={{height:`${b.footer/b.height*100}%`}}>
   <button type="button" aria-label={`${b.name} 이전 대사`} disabled={b.page===0} onClick={()=>turn(b,b.previous)}>‹</button><span aria-live="polite">{b.page+1} / {b.pages}</span><button type="button" aria-label={`${b.name} 다음 대사`} disabled={b.page===b.pages-1} onClick={()=>turn(b,b.next)}>›</button>
  </div>:null}
 </div>)}</div></div>;
}
