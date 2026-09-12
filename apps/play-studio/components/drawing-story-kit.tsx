'use client';
import {useState} from 'react';
import {applyMusic,musicPresets} from '@/lib/drawing-music';
import {storyKits,type StoryCharacter,type StoryMood,type StoryPlace} from '@/lib/story-kits';
import type {useDrawingEditor} from './use-drawing-editor';
import './drawing-story-kit.css';

type Props={
 e:ReturnType<typeof useDrawingEditor>;
 /** Opens the picture picker with this character's name already filled in. */
 onCharacter:(character:StoryCharacter)=>void;
};

export function DrawingStoryKit({e,onCharacter}:Props){
 const [open,setOpen]=useState(false);
 const kit=storyKits[0];
 const disabled=!e.loaded||e.busy||e.playing;
 function choosePlace(place:StoryPlace){e.editScene({title:place.name});}
 function chooseMood(mood:StoryMood){
  try{e.commit(p=>applyMusic(p,{trackId:mood.trackId,volume:.3,loop:true},false));}
  catch(cause){e.setError(cause instanceof Error?cause.message:'음악을 넣지 못했어요.');}
 }
 const track=musicPresets.find(t=>t.id===e.scene.music?.trackId);
 return <section className="story-kit" aria-label="이야기 상자">
  <button type="button" className="story-kit-toggle" aria-expanded={open} onClick={()=>setOpen(!open)}>
   <span aria-hidden="true">📖</span>
   <span className="story-kit-name"><strong>이야기 상자</strong><small>{kit.title}</small></span>
   <span aria-hidden="true" className="story-kit-caret">{open?'▾':'▸'}</span>
  </button>
  {open?<div className="story-kit-body">
   <p className="story-kit-intro">{kit.intro}</p>

   <h3>누가 나올까요?</h3>
   <div className="story-kit-chips">
    {kit.characters.map(character=><button type="button" key={character.name} disabled={disabled} onClick={()=>onCharacter(character)}>
     {character.name}<small>{character.hint}</small>
    </button>)}
   </div>
   <p className="story-kit-help">고르면 그림 올리기가 열려요. 이름은 미리 적혀 있어요.</p>

   <h3>어디에서 일어날까요?</h3>
   <div className="story-kit-chips">
    {kit.places.map(place=><button type="button" key={place.name} disabled={disabled} aria-pressed={e.scene.title===place.name} onClick={()=>choosePlace(place)}>
     {place.name}<small>{place.hint}</small>
    </button>)}
   </div>
   <p className="story-kit-help">고르면 이 장면의 이름이 바뀌어요.</p>

   <h3>어떤 마음일까요?</h3>
   <div className="story-kit-chips">
    {kit.moods.map(mood=><button type="button" key={mood.name} disabled={disabled} aria-pressed={e.scene.music?.trackId===mood.trackId} onClick={()=>chooseMood(mood)}>
     {mood.name}
    </button>)}
   </div>
   <p className="story-kit-help">고르면 이 장면에 어울리는 음악이 깔려요.{track?<> 지금은 「{track.label}」이에요.</>:null}</p>

   <p className="story-kit-credit">
    {kit.title} · {kit.credit}<br/>
    {kit.lesson}<br/>
    <b>그림은 들어 있지 않아요.</b> 인물과 곳은 내가 그려서 올려요.
   </p>
  </div>:null}
 </section>;
}
