'use client';
import {useEffect,useRef,useState,type MutableRefObject,type PointerEvent as ReactPointerEvent} from 'react';
import type {DrawingProject,DrawingScene} from '@/lib/drawing-project';
import {loadDrawingImages} from '@/lib/drawing-media';
import {drawDrawingScene,DRAW_WIDTH,DRAW_HEIGHT,type RasterCache} from '@/lib/drawing-renderer';
type Props={project:DrawingProject;scene:DrawingScene;playing:boolean;reset:number;selectedId?:string;clock:MutableRefObject<number>;onError:(text:string)=>void;onDown:(e:ReactPointerEvent<HTMLCanvasElement>)=>void;onMove:(e:ReactPointerEvent<HTMLCanvasElement>)=>void;onUp:(e:ReactPointerEvent<HTMLCanvasElement>)=>void;onCancel:()=>void};
export function DrawingCanvas({project,scene,playing,reset,selectedId,clock,onError,onDown,onMove,onUp,onCancel}:Props){
  const canvas=useRef<HTMLCanvasElement>(null);const [images,setImages]=useState<RasterCache>(new Map());
  useEffect(()=>{let canceled=false;void loadDrawingImages(project.assets).then(result=>{if(!canceled)setImages(result);}).catch(error=>{if(!canceled)onError(error instanceof Error?error.message:'그림을 읽지 못했어요.');});return()=>{canceled=true;};},[project.assets,onError]);
  useEffect(()=>{clock.current=0;},[reset,clock]);
  useEffect(()=>{
    const element=canvas.current,ctx=element?.getContext('2d');if(!element||!ctx)return;
    let raf=0,last=performance.now(),lastPaint=0;
    const paint=(now:number)=>{
      if(playing)clock.current+=(now-last)/1000;last=now;
      if(!playing||now-lastPaint>=30){drawDrawingScene(ctx,project,scene,images,clock.current,playing?undefined:selectedId,!playing);element.dataset.time=clock.current.toFixed(2);lastPaint=now;}
      if(playing)raf=requestAnimationFrame(paint);
    };
    paint(performance.now());void document.fonts.ready.then(()=>{if(!playing&&canvas.current===element)drawDrawingScene(ctx,project,scene,images,clock.current,selectedId,true);});
    return()=>cancelAnimationFrame(raf);
  },[project,scene,images,playing,reset,selectedId,clock]);
  return <canvas ref={canvas} width={DRAW_WIDTH} height={DRAW_HEIGHT} className="draw-canvas" aria-label="내 그림 무대. 아래 그림 목록에서 선택한 뒤 위치를 바꿀 수 있어요." onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onCancel}>그림을 움직이는 무대입니다.</canvas>;
}
