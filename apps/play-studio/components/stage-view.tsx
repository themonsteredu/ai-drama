'use client';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { StageItem } from '@moakit/stage-core';
import { CharacterFigure } from '@/components/character-figure';
import { PropArt } from '@/components/prop-art';

export function StageItemView({item,selected=false,onPointerDown,onSelect}:{item:StageItem;selected?:boolean;onPointerDown?:(event:ReactPointerEvent<HTMLDivElement>)=>void;onSelect?:()=>void}){
  return <div role={onPointerDown?'button':undefined} tabIndex={onPointerDown?0:undefined} className={`stage-item ${item.kind} ${selected?'selected':''} ${onPointerDown?'interactive':''}`} style={{left:`${item.x}%`,top:`${item.y}%`,zIndex:item.zIndex,transform:`translate(-50%, -50%) rotate(${item.rotation}deg) scale(${item.scale})`}} onPointerDown={onPointerDown} onFocus={onSelect} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onSelect?.();}}} aria-label={item.kind==='character'?`${item.data.name} 이동`:item.kind==='prop'?`${item.data.label} 이동`:'대사 이동'}>
    {item.kind==='character'?<CharacterFigure character={item.data} facing={item.data.facing} showName/>:null}
    {item.kind==='prop'?<div className="stage-prop" title={item.data.label}><PropArt id={item.data.catalogId} label={item.data.label}/><small>{item.data.label}</small></div>:null}
    {item.kind==='speech'?<div className={`stage-speech ${item.data.variant}`}><span>{item.data.text}</span></div>:null}
  </div>;
}
export function StageBackdrop({backgroundId}:{backgroundId:string}){
  return <div className={`stage-backdrop background-${backgroundId}`} aria-hidden="true">
    {backgroundId==='classroom'?<><i className="class-window"/><i className="class-board"/><i className="class-floor"/></>:null}
    {backgroundId==='forest'?<><i className="forest-sun"/><i className="forest-tree one"/><i className="forest-tree two"/><i className="forest-tree three"/></>:null}
    {backgroundId==='space'?<><i className="planet one"/><i className="planet two"/><i className="orbit"/><i className="stars"/></>:null}
    {backgroundId==='castle'?<><i className="castle-window one"/><i className="castle-window two"/><i className="castle-carpet"/></>:null}
    {backgroundId==='beach'?<><i className="beach-sun"/><i className="beach-water"/><i className="beach-sand"/></>:null}
    {backgroundId==='blank'?<><i className="blank-spotlight one"/><i className="blank-spotlight two"/></>:null}
  </div>;
}
