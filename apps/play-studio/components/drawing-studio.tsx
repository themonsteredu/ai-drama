'use client';
import {useEffect,useRef,useState} from 'react';
import {useDrawingEditor} from './use-drawing-editor';
import {DrawingMusicDialog} from './drawing-music-dialog';
import {DrawingMovieDialog} from './drawing-movie-dialog';
import {DrawingVoicePanel} from './drawing-voice-panel';
import {DrawingFilmTools} from './drawing-film-tools';
import {FilmNarrationPanel} from './film-narration-panel';
import {emptyFourSceneProject,prepareFourScenes} from '@/lib/four-scene';
import {emptyDrawingProject} from '@/lib/drawing-project';
import {loadDrawing} from '@/lib/drawing-storage';
import {DrawingStoryKit} from './drawing-story-kit';
import type {StoryCharacter} from '@/lib/story-kits';
import {effectiveMusic} from '@/lib/drawing-music';
import {movieTimeline} from '@/lib/drawing-movie';
import {setSceneTransition} from '@/lib/drawing-transition';
import {DrawingCanvas} from './drawing-canvas';
import {DrawingLibrary} from './drawing-library';
import {DrawingControls} from './drawing-controls';
import {DrawingScenery} from './drawing-scenery';
import {cutoutBytes} from '@/lib/drawing-cutout';
import {loadDrawingImages} from '@/lib/drawing-media';
import {drawDrawingScene} from '@/lib/drawing-renderer';
import type {DrawingAsset,DrawingProject,DrawingScene} from '@/lib/drawing-project';
import './drawing-studio.css';
import './drawing-story-theme.css';
import './drawing-workspace.css';
function ScenePreview({project,scene}:{project:DrawingProject;scene:DrawingScene}){
 const [url,setUrl]=useState('');
 useEffect(()=>{let alive=true;void loadDrawingImages(project.assets).then(images=>{if(!alive)return;const canvas=document.createElement('canvas');canvas.width=256;canvas.height=144;const ctx=canvas.getContext('2d');if(!ctx)return;ctx.scale(.2,.2);drawDrawingScene(ctx,project,scene,images,0);setUrl(canvas.toDataURL('image/png'));}).catch(()=>{if(alive)setUrl('');});return()=>{alive=false;};},[project.assets,scene]);
 return url?<img src={url} alt="장면 미리보기"/>:<span className="story-thumb-empty"/>;
}
function NarrationDialog({e,onClose}:{e:ReturnType<typeof useDrawingEditor>;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;dialog.current?.showModal();return()=>previous?.focus();},[]);
 return <dialog ref={dialog} className="draw-narration-dialog" aria-label="전체 녹음과 AI 배역" onCancel={onClose}><header><h2>전체 녹음 · AI 배역</h2><button onClick={onClose}>닫기</button></header><FilmNarrationPanel e={e} onPreview={()=>{e.playStory();onClose();}}/></dialog>;
}
export function DrawingStudio({filmWorkspace=false}:{filmWorkspace?:boolean}){
 const e=useDrawingEditor(filmWorkspace?'four-scene-film':'active',filmWorkspace?emptyFourSceneProject:emptyDrawingProject),file=useRef<HTMLInputElement>(null),root=useRef<HTMLElement>(null);
 const [hasFilmWork,setHasFilmWork]=useState(false);
 useEffect(()=>{let active=true;if(!filmWorkspace)void loadDrawing('four-scene-film').then(value=>{if(active)setHasFilmWork(!!value);}).catch(()=>{});return()=>{active=false;};},[filmWorkspace]);
 const [musicOpen,setMusicOpen]=useState(false),[movieOpen,setMovieOpen]=useState(false),[narrationOpen,setNarrationOpen]=useState(false);
 const [presenting,setPresenting]=useState(false),[mobileTab,setMobileTab]=useState('stage'),[wideStage,setWideStage]=useState(false);
 const [hint,setHint]=useState<{name:string;kind:StoryCharacter['kind']}|null>(null);
 const disabled=!e.loaded||e.busy||e.recording,editingDisabled=disabled||e.playing,index=e.project.scenes.findIndex(s=>s.id===e.scene.id);
 function fits(assets:DrawingAsset[]){if(assets.reduce((sum,a)=>sum+cutoutBytes(a),0)>48_000_000){e.setError('원본과 수정 정보를 합친 그림 용량이 커요. 더 작은 사진을 골라 주세요. 기존 그림은 그대로예요.');return false;}return true;}
 function place(asset:DrawingAsset,isNew=false){if(isNew&&!fits([...e.project.assets,asset]))return false;const ok=e.place(asset,isNew);if(ok)setMobileTab('stage');return ok;}
 function updateAsset(asset:DrawingAsset){const next=e.project.assets.map(a=>a.id===asset.id?asset:a);if(editingDisabled||!fits(next))return false;e.commit(p=>({...p,assets:p.assets.map(a=>a.id===asset.id?asset:a)}));e.setError('');return true;}
 function finishPresentation(){setPresenting(false);e.stop();}
 const hasWork=e.scene.items.length>0||!!e.scene.backgroundAssetId||e.scene.weather!=='none'||!!effectiveMusic(e.project,e.scene)||!!e.scene.voice;
 // A voice recorded in any scene is already a story worth watching, even on an empty stage.
 const hasStory=!!e.project.narration?.enabled||hasWork||e.project.scenes.some(s=>!!s.voice),timeline=movieTimeline(e.project);
 return <main ref={root} className={`drawing-app story-studio ${presenting?'story-presenting':''} ${wideStage?'story-wide-stage':''}`} data-mobile-tab={mobileTab} onKeyDown={event=>{const target=event.target as HTMLElement;if(target.matches('input,textarea,select')||target.isContentEditable||target.closest('dialog'))return;if(event.key==='Escape'){finishPresentation();e.setDestination(false);}if(!disabled&&!e.recording&&(event.ctrlKey||event.metaKey)){const key=event.key.toLowerCase();if(key==='z'||key==='y'){event.preventDefault();key==='y'||event.shiftKey?e.redo():e.undo();}}}}>
 <header className="story-header"><a href="/" className="story-wordmark" aria-label="MOAKIT PLAY">{'MOAKIT'.split('').map((c,i)=><span key={i} className={`letter-${i}`}>{c}</span>)}<b>PLAY</b></a><p className="story-mint">내가 그린 그림이 움직여요! <span aria-hidden="true">✦</span></p><div className="story-header-actions"><button type="button" disabled={disabled||e.project.scenes.length>=4} onClick={()=>e.commit(prepareFourScenes)}>4장면 준비</button>{filmWorkspace?<a href="/draw">기존 작품 이어하기</a>:hasFilmWork?<a href="/film">4장면 작업 이어하기</a>:null}<a href="/settings">GPT API 설정</a><button type="button" disabled={disabled} onClick={e.backup}>작품 보관</button><button type="button" disabled={disabled} onClick={()=>file.current?.click()}>불러오기</button><button type="button" disabled={disabled} onClick={e.newWork}>새 작품</button><button type="button" className="story-yellow" disabled={disabled||!hasWork} onClick={()=>{e.stop();e.start();setPresenting(true);setMobileTab('stage');}}>▶ 발표하기</button></div></header>
 <div className="story-road" aria-label="이야기 만드는 순서">{[['장면 그림 올리기','pink'],['방향 맞추기','orange'],['배경·움직임','green'],['장면별 대사 올리기','blue'],['영상 저장','purple']].map(([label,tone],i)=><div key={label} className={`story-road-step ${tone}`}><b>{i+1}</b><span>{label}</span></div>)}</div>
 <div className="story-project-row"><label className="draw-title"><span className="draw-sr">작품 제목</span><input aria-label="내 그림 작품 제목" value={e.project.title} maxLength={80} disabled={disabled} onChange={event=>e.commit(p=>({...p,title:event.target.value}))}/><small role="status">{e.saveState}</small></label><div className="draw-history"><button type="button" aria-label="실행 취소" title="실행 취소 (Ctrl / ⌘ + Z)" disabled={disabled||e.recording||!e.canUndo} onClick={e.undo}><span aria-hidden="true">↶</span> 실행 취소</button><button type="button" aria-label="다시 실행" title="다시 실행 (Ctrl / ⌘ + Shift + Z)" disabled={disabled||e.recording||!e.canRedo} onClick={e.redo}><span aria-hidden="true">↷</span> 다시 실행</button><button type="button" disabled={disabled} onClick={()=>void e.png()}>PNG 저장</button></div></div>
 {e.error?<div className="draw-alert" role="alert"><span>{e.error}</span><button type="button" aria-label="안내 닫기" onClick={()=>e.setError('')}>×</button></div>:null}
 <nav className="story-mobile-tabs" aria-label="작업 화면">{[['stage','장면 만들기'],['pictures','그림 보관함'],['actions','움직임·효과']].map(([id,label])=><button type="button" key={id} aria-pressed={mobileTab===id} onClick={()=>setMobileTab(id)}>{label}</button>)}</nav>
 {presenting?<div className="story-presentation-bar"><strong>{e.project.title}</strong><span>{index+1} / {e.project.scenes.length}</span><button type="button" onClick={finishPresentation}>편집으로 돌아가기</button></div>:null}
 <div className="draw-workspace"><div className="story-library-column"><section className="draw-picture-tools" aria-label="장면 그림 도구"><h2>장면 그림</h2><DrawingFilmTools e={e} onCharacterSelected={()=>setMobileTab('actions')}/></section><DrawingStoryKit e={e} onCharacter={character=>{setHint({name:character.name,kind:character.kind});setMobileTab('pictures');root.current?.querySelector<HTMLInputElement>('input[aria-label="그림 파일 선택"]')?.click();}}/><DrawingLibrary assets={e.project.assets} disabled={editingDisabled} placedAssetIds={e.scene.items.map(i=>i.assetId)} onPlace={(asset,isNew)=>{const existing=!isNew&&e.scene.items.find(i=>i.assetId===asset.id);if(existing){e.chooseItem(existing.id);setMobileTab('actions');return true;}return place(asset,isNew);}} onUpdate={updateAsset} onRemove={e.removeAsset} onError={e.setError} hint={hint} onHintUsed={()=>setHint(null)}/><details className="story-extra-tools"><summary>기본 배경으로 시작하기</summary><DrawingScenery e={e} onPlace={place}/></details></div>
 <section className="draw-stage-column" aria-label="그림 무대 편집"> <div className="draw-scenes" aria-label="내 그림 장면 목록">{e.project.scenes.map((s,i)=><button type="button" key={s.id} aria-pressed={s.id===e.scene.id} disabled={disabled} onClick={()=>e.switchScene(s.id)}><ScenePreview project={e.project} scene={s}/><span><small>{String(i+1).padStart(2,'0')}</small>{s.title}<em>{s.voice||e.project.narration?.enabled?'녹음 · ':''}{Number(timeline[i].seconds.toFixed(2))}초</em></span></button>)}<button type="button" className="story-add-scene" disabled={disabled||e.project.scenes.length>=6} onClick={()=>e.addScene()}><b>＋</b>장면 추가</button></div><div className="draw-stage-heading"><div><small>장면 그림부터 시작해요</small><h1>{e.scene.title}</h1></div><button type="button" className="draw-wide-toggle" aria-pressed={wideStage} onClick={()=>setWideStage(v=>!v)}>{wideStage?'도구 함께 보기':'무대 크게 보기'}</button></div>
 <div className="draw-phone-picture-tools"><DrawingFilmTools e={e} onCharacterSelected={()=>setMobileTab('actions')}/></div>
 <div className={`draw-stage-frame ${e.destination?'choosing-destination':''}`}><DrawingCanvas project={e.project} scene={e.scene} playing={e.playing} storyPlaying={e.storyPlaying} reset={e.reset} selectedId={presenting?undefined:e.selectedId} clock={e.clock} onError={e.setError} onDown={presenting?()=>{}:e.down} onMove={presenting?()=>{}:e.move} onUp={presenting?()=>{}:e.up} onCancel={presenting?()=>{}:e.cancel}/>{!hasWork?<div className="draw-stage-empty"><div><small>인물과 배경이 함께 있는 그림</small><strong>이 장면의 그림을 올려요</strong><p>한 번 올리면 바로 이 장면에 들어가요.</p><button type="button" className="story-start-button" disabled={disabled} onClick={()=>{setMobileTab('stage');root.current?.querySelector<HTMLInputElement>('input[aria-label="장면 전체 그림 파일"]')?.click();}}>장면 그림 올리기</button></div></div>:null}</div>
 <div className={`draw-stage-status ${e.destination?'is-choosing':''}`}><p className={`draw-stage-hint ${e.destination?'active':''}`} aria-live="polite">{e.destination?'다른 곳을 다시 누르면 도착 위치가 바뀌어요.':e.storyPlaying?'처음부터 쭉 보는 중이에요. 장면이 저절로 넘어가요.':e.playing?'움직이는 중이에요. 잠깐 멈추거나 처음으로 돌아갈 수 있어요.':'그림을 톡 눌러 선택하고, 손가락으로 옮겨요.'}</p>{e.destination?<button className="draw-destination-done" onClick={()=>e.setDestination(false)}>선택 완료</button>:null}</div>
 <div className="draw-playbar"><button type="button" className="music-open" disabled={disabled} onClick={()=>{e.pause();setMusicOpen(true);}}>🎵 음악</button><button type="button" className="movie-open" disabled={disabled||!hasStory} onClick={()=>{e.stop();setMovieOpen(true);}}>🎬 영상</button><button type="button" className="draw-primary" disabled={disabled||!hasWork} onClick={()=>{e.storyPlaying?e.stop():e.playing?e.pause():e.start();}}>{e.storyPlaying?'■ 그만 보기':e.playing?'Ⅱ 잠깐 멈춤':'▶ 움직여 보기'}</button><button type="button" disabled={disabled} onClick={e.stop}>■ 처음으로</button>{presenting?<><button type="button" disabled={index<1} onClick={()=>e.switchScene(e.project.scenes[index-1].id)}>이전 장면</button><button type="button" disabled={index>=e.project.scenes.length-1} onClick={()=>e.switchScene(e.project.scenes[index+1].id)}>다음 장면</button></>:<span>내 그림 그대로, 이야기가 시작돼요.</span>}</div>
 <div className="draw-stage-items" aria-label="무대의 그림 목록">{e.scene.items.map(item=><button type="button" key={item.id} disabled={disabled} aria-pressed={e.selectedId===item.id} onClick={()=>{e.chooseItem(item.id);setMobileTab('actions');}}>{e.project.assets.find(a=>a.id===item.assetId)?.name??'그림'}</button>)}</div>


<details className="draw-scene-settings"><summary>장면 이름과 설명</summary><label>장면 이름<input maxLength={40} disabled={editingDisabled} value={e.scene.title} onChange={event=>e.editScene({title:event.target.value})}/></label><label>장면 설명<textarea maxLength={120} disabled={editingDisabled} placeholder="예: 숲에서 작은 친구를 만났어요." value={e.scene.caption} onChange={event=>e.editScene({caption:event.target.value})}/></label><div className="draw-pair"><button type="button" disabled={editingDisabled||e.project.scenes.length>=6} onClick={()=>e.addScene(true)}>장면 복사</button><button type="button" disabled={editingDisabled||e.project.scenes.length===1} onClick={e.deleteScene}>장면 지우기</button></div></details></section><DrawingControls e={e} onShowStage={()=>setMobileTab('stage')}/><DrawingVoicePanel e={e} onFullNarration={()=>{e.stop();setNarrationOpen(true);}}/></div>
 <footer className="draw-footer"><p className="story-ending">세상에 하나뿐인 내 그림, 움직이는 이야기가 돼요.</p><details><summary>작품 보관·불러오기</summary><div className="draw-file-actions"><button type="button" disabled={disabled} onClick={e.backup}>작품 파일 보관</button><button type="button" disabled={disabled} onClick={()=>file.current?.click()}>내 그림 작품 불러오기</button><button type="button" disabled={disabled} onClick={()=>void e.png()}>{e.busy?'처리 중':'현재 모습 PNG'}</button><button type="button" disabled={disabled} onClick={e.newWork}>새 작품</button></div><p>그림과 배경, 움직임, 음악과 다듬기 원본을 파일에 함께 보관해요. 현재 자동 저장은 이 기기에만 적용돼요. PNG는 정지 그림이에요.</p></details></footer><input type="file" ref={file} accept=".json,application/json" hidden aria-label="내 그림 작품 파일 선택" onChange={event=>{const picked=event.target.files?.[0];event.target.value='';if(picked)void e.importWork(picked);}}/>
 {narrationOpen?<NarrationDialog e={e} onClose={()=>setNarrationOpen(false)}/>:null}
 {musicOpen?<DrawingMusicDialog project={e.project} scene={e.scene} onApply={p=>e.commit(()=>p)} onClose={()=>setMusicOpen(false)}/>:null}
 {movieOpen?<DrawingMovieDialog project={e.project} onTransition={(sceneId,kind)=>e.commit(p=>setSceneTransition(p,sceneId,kind))} onPlayStory={e.playStory} onClose={()=>setMovieOpen(false)}/>:null}
 </main>;
}
