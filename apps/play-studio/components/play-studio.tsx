'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { STAGE_PROJECT_VERSION, clamp, clampStageCoordinate, createStageId, duplicateStageScene, nextStageZIndex, patchStageItem, removeStageItem, reorderStageItems, type CharacterAppearance, type SavedCharacter, type SpeechVariant, type StageItem, type StageProject, type StageScene } from '@moakit/stage-core';
import { CharacterPanel } from '@/components/character-panel';
import { Inspector } from '@/components/inspector';
import { StageBackdrop, StageItemView } from '@/components/stage-view';
import { ExportPanel } from '@/components/export-panel';
import { PropArt } from '@/components/prop-art';
import { backgrounds, bottomColors, hairColors, propChoices, skinTones, speechVariants, topColors } from '@/lib/catalog';
import { STORAGE_KEY, parseProject } from '@/lib/project-files';

const MAX_SCENES=6;
type PanelTab='character'|'background'|'prop'|'speech';
type DragState={itemId:string;pointerId:number;offsetX:number;offsetY:number;startProject:StageProject;moved:boolean};
const defaultAppearance:CharacterAppearance={skinTone:skinTones[1],hairStyle:'bob',hairColor:hairColors[0],eyeStyle:'round',topColor:topColors[0],bottomColor:bottomColors[0],accessory:'none'};
const starterCharacter:SavedCharacter={id:'cast-haneul',name:'하늘',appearance:defaultAppearance,expression:'happy',pose:'standing'};
function initialProject():StageProject {
  return {version:STAGE_PROJECT_VERSION,id:'play-project-starter',title:'우리 반의 비밀 상자',activeSceneId:'scene-1',cast:[starterCharacter],updatedAt:'2026-09-03T00:00:00.000Z',scenes:[{id:'scene-1',title:'장면 1',backgroundId:'classroom',items:[
    {id:'character-haneul-1',kind:'character',x:43,y:66,scale:.95,rotation:0,zIndex:2,data:{...starterCharacter,facing:'right'}},
    {id:'speech-haneul-1',kind:'speech',x:64,y:28,scale:1,rotation:0,zIndex:3,data:{text:'이 상자는 누구의 것일까?',variant:'speech'}},
    {id:'prop-box-1',kind:'prop',x:68,y:72,scale:.85,rotation:0,zIndex:1,data:{catalogId:'box',label:'상자',symbol:'□'}}
  ]}]};
}
const touch=(p:StageProject):StageProject=>({...p,updatedAt:new Date().toISOString()});
function changeScene(project:StageProject,updater:(scene:StageScene)=>StageScene):StageProject {
  return {...project,scenes:project.scenes.map(scene=>scene.id===project.activeSceneId?updater(scene):scene)};
}
export function PlayStudio(){
  const [project,setProject]=useState<StageProject>(initialProject);
  const projectRef=useRef(project);
  const [past,setPast]=useState<StageProject[]>([]),[future,setFuture]=useState<StageProject[]>([]);
  const [selectedId,setSelectedId]=useState<string>();
  const [activeTab,setActiveTab]=useState<PanelTab>('character');
  const [hydrated,setHydrated]=useState(false),[saveBlocked,setSaveBlocked]=useState(false);
  const [saveState,setSaveState]=useState<'loading'|'saving'|'saved'|'error'>('loading');
  const [notice,setNotice]=useState('');
  const [presentationOpen,setPresentationOpen]=useState(false);
  const stageRef=useRef<HTMLDivElement>(null),dragRef=useRef<DragState|null>(null);
  const [draftCharacter,setDraftCharacter]=useState<SavedCharacter>({id:'draft-character',name:'나의 배우',appearance:{...defaultAppearance},expression:'happy',pose:'standing'});
  const activeScene=project.scenes.find(scene=>scene.id===project.activeSceneId)??project.scenes[0];
  const selectedItem=activeScene.items.find(item=>item.id===selectedId);

  useEffect(()=>{
    try {
      const raw=window.localStorage.getItem(STORAGE_KEY);
      if(raw){const loaded=parseProject(raw);projectRef.current=loaded;setProject(loaded);}
    }catch{
      // Do not delete or overwrite unreadable work; keep it recoverable in storage.
      setSaveBlocked(true);setSaveState('error');setNotice('저장된 작품을 읽지 못했어요. 기존 저장 내용은 지우지 않았습니다. 새 작품을 시작하거나 작품 파일을 불러와 주세요.');
    }finally{setHydrated(true);}
  },[]);
  useEffect(()=>{
    if(!hydrated||saveBlocked)return;
    setSaveState('saving');
    const timer=window.setTimeout(()=>{
      try{window.localStorage.setItem(STORAGE_KEY,JSON.stringify(project));setSaveState('saved');setNotice('');}
      catch{setSaveState('error');setNotice('이 기기에 자동 저장하지 못했어요. 저장·출력에서 작품 파일을 보관해 주세요.');}
    },320);
    return()=>window.clearTimeout(timer);
  },[hydrated,saveBlocked,project]);
  useEffect(()=>{
    if(!hydrated||saveBlocked)return;
    const flush=()=>{try{window.localStorage.setItem(STORAGE_KEY,JSON.stringify(projectRef.current));}catch{/* Keep current work available for file export. */}};
    const visibility=()=>{if(document.visibilityState==='hidden')flush();};
    window.addEventListener('pagehide',flush);document.addEventListener('visibilitychange',visibility);
    return()=>{window.removeEventListener('pagehide',flush);document.removeEventListener('visibilitychange',visibility);};
  },[hydrated,saveBlocked]);
  function setValue(next:StageProject){projectRef.current=next;setProject(next);}
  function commit(updater:(value:StageProject)=>StageProject){
    const previous=projectRef.current;const next=touch(updater(previous));
    setPast(h=>[...h.slice(-29),previous]);setFuture([]);setValue(next);
  }
  function updateWithoutHistory(updater:(value:StageProject)=>StageProject){setValue(touch(updater(projectRef.current)));}
  function updateActiveScene(updater:(scene:StageScene)=>StageScene,record=true){
    const action=(value:StageProject)=>changeScene(value,updater);
    if(record)commit(action);else updateWithoutHistory(action);
  }
  function undo(){
    const previous=past.at(-1);if(!previous)return;
    // Capture now: React may execute the updater after setValue changes the ref.
    const current=projectRef.current;
    setPast(h=>h.slice(0,-1));setFuture(h=>[current,...h].slice(0,30));
    setValue(touch(previous));setSelectedId(undefined);
  }
  function redo(){
    const next=future[0];if(!next)return;
    const current=projectRef.current;
    setFuture(h=>h.slice(1));setPast(h=>[...h.slice(-29),current]);
    setValue(touch(next));setSelectedId(undefined);
  }
  function roomForItem(){if(activeScene.items.length<200)return true;window.alert('한 장면에는 200개까지 놓을 수 있어요. 새 장면을 만들어 주세요.');return false;}
  function addCharacterToScene(character:SavedCharacter){
    if(!roomForItem())return;const id=createStageId('character');
    updateActiveScene(scene=>({...scene,items:[...scene.items,{id,kind:'character',x:50,y:68,scale:.9,rotation:0,zIndex:nextStageZIndex(scene.items),data:{...structuredClone(character),facing:'right'}}]}));setSelectedId(id);
  }
  function saveDraftCharacter(place:boolean){
    if(project.cast.length>=100){window.alert('배우는 100명까지 보관할 수 있어요.');return;}
    if(place&&!roomForItem())return;
    const saved:SavedCharacter={...structuredClone(draftCharacter),id:createStageId('cast'),name:draftCharacter.name.trim()||`배우 ${project.cast.length+1}`};
    const itemId=createStageId('character');
    commit(current=>{const withCast={...current,cast:[...current.cast,saved]};return place?changeScene(withCast,scene=>({...scene,items:[...scene.items,{id:itemId,kind:'character',x:50,y:68,scale:.9,rotation:0,zIndex:nextStageZIndex(scene.items),data:{...structuredClone(saved),facing:'right'}}]})):withCast;});
    if(place)setSelectedId(itemId);setDraftCharacter(current=>({...current,name:`나의 배우 ${project.cast.length+2}`}));
  }
  function addProp(catalogId:string,label:string,symbol:string){
    if(!roomForItem())return;const id=createStageId('prop');
    updateActiveScene(scene=>({...scene,items:[...scene.items,{id,kind:'prop',x:56,y:68,scale:.9,rotation:0,zIndex:nextStageZIndex(scene.items),data:{catalogId,label,symbol}}]}));setSelectedId(id);
  }
  function addSpeech(variant:SpeechVariant){
    if(!roomForItem())return;const id=createStageId('speech');
    const text=variant==='caption'?'장면에서 일어난 일을 적어 보세요.':variant==='thought'?'나는 어떻게 해야 하지?':'대사를 입력하세요.';
    updateActiveScene(scene=>({...scene,items:[...scene.items,{id,kind:'speech',x:60,y:variant==='caption'?12:28,scale:1,rotation:0,zIndex:nextStageZIndex(scene.items),data:{text,variant}}]}));setSelectedId(id);
  }
  function patchSelectedBase(patch:Partial<Pick<StageItem,'x'|'y'|'scale'|'rotation'|'zIndex'>>){if(selectedItem)updateActiveScene(scene=>({...scene,items:patchStageItem(scene.items,selectedItem.id,patch)}));}
  function patchSelectedData(patch:Record<string,unknown>,record=true){
    if(!selectedItem)return;
    if(typeof patch.text==='string')patch={...patch,text:patch.text.slice(0,1000)};
    updateActiveScene(scene=>({...scene,items:scene.items.map(item=>item.id===selectedItem.id?{...item,data:{...item.data,...patch}} as StageItem:item)}),record);
  }
  function duplicateSelected(){
    if(!selectedItem||!roomForItem())return;const id=createStageId(selectedItem.kind);
    updateActiveScene(scene=>({...scene,items:[...scene.items,{...structuredClone(selectedItem),id,x:clampStageCoordinate(selectedItem.x+5),y:clampStageCoordinate(selectedItem.y+5),zIndex:nextStageZIndex(scene.items)}]}));setSelectedId(id);
  }
  function deleteSelected(){if(!selectedItem)return;updateActiveScene(scene=>({...scene,items:removeStageItem(scene.items,selectedItem.id)}));setSelectedId(undefined);}
  function moveSelectedLayer(direction:-1|1){if(selectedItem)updateActiveScene(scene=>({...scene,items:reorderStageItems(scene.items,selectedItem.id,direction)}));}
  function addScene(copy=false){
    if(project.scenes.length>=MAX_SCENES)return;
    const scene:StageScene=copy?structuredClone(duplicateStageScene(activeScene,`장면 ${project.scenes.length+1}`)):{id:createStageId('scene'),title:`장면 ${project.scenes.length+1}`,backgroundId:activeScene.backgroundId,items:[]};
    commit(current=>({...current,activeSceneId:scene.id,scenes:[...current.scenes,scene]}));setSelectedId(undefined);
  }
  function deleteActiveScene(){
    if(project.scenes.length===1)return;const index=project.scenes.findIndex(scene=>scene.id===project.activeSceneId);
    const next=project.scenes[index-1]??project.scenes[index+1];
    commit(current=>({...current,activeSceneId:next.id,scenes:current.scenes.filter(scene=>scene.id!==current.activeSceneId)}));setSelectedId(undefined);
  }
  function switchScene(id:string){updateWithoutHistory(current=>({...current,activeSceneId:id}));setSelectedId(undefined);}
  function resetProject(){
    if(!window.confirm('현재 작품 대신 새 작품을 시작할까요? 필요한 작품은 먼저 파일로 보관해 주세요.'))return;
    const id=createStageId('scene');setSaveBlocked(false);setNotice('');
    commit(()=>({version:1,id:createStageId('project'),title:'나만의 이야기',activeSceneId:id,cast:[],scenes:[{id,title:'장면 1',backgroundId:'blank',items:[]}],updatedAt:new Date().toISOString()}));setSelectedId(undefined);
  }
  function importProject(next:StageProject){setSaveBlocked(false);setNotice('');commit(()=>structuredClone(next));setSelectedId(undefined);}
  function pointerDown(event:ReactPointerEvent<HTMLDivElement>,item:StageItem){
    const rect=stageRef.current?.getBoundingClientRect();if(!rect)return;
    event.preventDefault();event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);setSelectedId(item.id);
    dragRef.current={itemId:item.id,pointerId:event.pointerId,offsetX:event.clientX-rect.left-item.x/100*rect.width,offsetY:event.clientY-rect.top-item.y/100*rect.height,startProject:projectRef.current,moved:false};
  }
  function pointerMove(event:ReactPointerEvent<HTMLDivElement>){
    const drag=dragRef.current,rect=stageRef.current?.getBoundingClientRect();if(!drag||!rect||event.pointerId!==drag.pointerId)return;
    const x=clampStageCoordinate((event.clientX-rect.left-drag.offsetX)/rect.width*100),y=clampStageCoordinate((event.clientY-rect.top-drag.offsetY)/rect.height*100);
    drag.moved=true;updateActiveScene(scene=>({...scene,items:patchStageItem(scene.items,drag.itemId,{x,y})}),false);
  }
  function pointerUp(event:ReactPointerEvent<HTMLDivElement>){const drag=dragRef.current;if(!drag||event.pointerId!==drag.pointerId)return;dragRef.current=null;if(drag.moved){setPast(h=>[...h.slice(-29),drag.startProject]);setFuture([]);}}
  function renderPanel(){
    if(activeTab==='character')return <CharacterPanel draft={draftCharacter} cast={project.cast} onDraftChange={setDraftCharacter} onSave={()=>saveDraftCharacter(false)} onSaveAndPlace={()=>saveDraftCharacter(true)} onPlace={addCharacterToScene}/>;
    if(activeTab==='background')return <div className="asset-grid background-grid">{backgrounds.map(b=><button type="button" key={b.id} className={`asset-card ${activeScene.backgroundId===b.id?'active':''}`} onClick={()=>updateActiveScene(s=>({...s,backgroundId:b.id}))}><span className={`background-thumb background-${b.id}`}><span/></span><strong>{b.label}</strong><small>{b.description}</small></button>)}</div>;
    if(activeTab==='prop')return <div className="asset-grid prop-grid">{propChoices.map(p=><button type="button" className="asset-card prop-card" key={p.id} onClick={()=>addProp(p.id,p.label,p.symbol)}><span className="prop-symbol"><PropArt id={p.id} label={p.label}/></span><strong>{p.label}</strong><small>눌러서 무대에 놓기</small></button>)}</div>;
    return <div className="speech-picker"><p className="panel-help">말풍선을 놓은 뒤 오른쪽에서 대사를 고쳐 보세요.</p>{speechVariants.map(v=><button type="button" key={v.id} className={`speech-sample ${v.id}`} onClick={()=>addSpeech(v.id)}><span>{v.id==='caption'?'장면 설명을 적어 보세요':v.id==='thought'?'속으로 무슨 생각을 할까?':'등장인물이 무엇이라고 말할까?'}</span><strong>{v.label} 추가</strong></button>)}</div>;
  }
  return <main className="play-app" onKeyDown={event=>{
    const target=event.target as HTMLElement;if(target.matches('input,textarea,select')||target.isContentEditable||target.closest('dialog'))return;
    if(event.key==='Escape'){setPresentationOpen(false);setSelectedId(undefined);}
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();if(event.shiftKey)redo();else undo();}
    if(selectedItem&&target.closest('.stage-board')&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();patchSelectedBase({x:clampStageCoordinate(selectedItem.x+(event.key==='ArrowRight'?1:event.key==='ArrowLeft'?-1:0)),y:clampStageCoordinate(selectedItem.y+(event.key==='ArrowDown'?1:event.key==='ArrowUp'?-1:0))});}
  }}>
    <header className="app-header"><div className="brand-lockup"><span className="brand-mark" aria-hidden="true">M</span><div><strong>MOAKIT PLAY</strong><small>나만의 연극 만들기</small></div></div><div className="header-center"><input className="project-title" aria-label="작품 제목" maxLength={40} value={project.title} onChange={e=>updateWithoutHistory(p=>({...p,title:e.target.value}))}/><span className={`save-state ${saveState}`} role="status"><i/>{saveState==='saved'?'이 기기에 저장됨':saveState==='saving'?'저장 중':saveState==='error'?'저장 확인 필요':'작품 불러오는 중'}</span></div><div className="header-actions"><button type="button" className="icon-button" onClick={undo} disabled={!past.length} title="실행 취소">↶</button><button type="button" className="icon-button" onClick={redo} disabled={!future.length} title="다시 실행">↷</button><button type="button" className="secondary-button" onClick={resetProject}>새 작품</button>{hydrated?<ExportPanel project={project} onImport={importProject}/>:null}<button type="button" className="primary-button" onClick={()=>setPresentationOpen(true)}>▶ 발표하기</button></div></header>
    {notice?<p className="save-notice" role="alert">{notice}</p>:null}
    <section className="workspace-shell"><aside className="asset-panel"><div className="panel-heading"><p>무대 재료</p><span>눌러서 추가</span></div><div className="panel-tabs" role="tablist" aria-label="무대 재료 종류">{([['character','내 캐릭터','☺'],['background','배경','▣'],['prop','소품','◆'],['speech','대사','▰']] as const).map(([id,label,icon])=><button type="button" role="tab" aria-selected={activeTab===id} className={activeTab===id?'active':''} key={id} onClick={()=>setActiveTab(id)}><span>{icon}</span>{label}</button>)}</div><div className="panel-scroll">{renderPanel()}</div></aside>
    <section className="stage-column"><div className="stage-toolbar"><div><strong>{activeScene.title}</strong><span>요소를 누르고 끌어서 움직여 보세요.</span></div><div className="scene-tools"><input aria-label="장면 이름" maxLength={40} value={activeScene.title} onChange={e=>updateActiveScene(s=>({...s,title:e.target.value}),false)}/><button type="button" onClick={()=>addScene(true)} disabled={project.scenes.length>=MAX_SCENES}>장면 복사</button><button type="button" onClick={deleteActiveScene} disabled={project.scenes.length===1}>장면 삭제</button></div></div>
    <div className="stage-surround"><div ref={stageRef} className="stage-board" onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onPointerDown={e=>{if(e.currentTarget===e.target)setSelectedId(undefined);}}><StageBackdrop backgroundId={activeScene.backgroundId}/><div className="safe-frame" aria-hidden="true"/>{activeScene.items.map(item=><StageItemView key={item.id} item={item} selected={selectedId===item.id} onSelect={()=>setSelectedId(item.id)} onPointerDown={e=>pointerDown(e,item)}/>)}{!activeScene.items.length?<div className="empty-stage"><span>＋</span><strong>왼쪽에서 캐릭터와 소품을 골라 보세요.</strong><p>배경을 먼저 고르면 장면을 만들기 쉬워요.</p></div>:null}</div></div>
    <div className="scene-strip" aria-label="장면 목록">{project.scenes.map((scene,index)=><button type="button" className={`scene-card ${scene.id===project.activeSceneId?'active':''}`} key={scene.id} onClick={()=>switchScene(scene.id)}><span className={`scene-mini background-${scene.backgroundId}`}><span className="scene-thumb-stage" aria-hidden="true"><span className="stage-board read-only" style={{display:'block'}}><StageBackdrop backgroundId={scene.backgroundId}/>{scene.items.map(item=><StageItemView key={item.id} item={item}/>)}</span></span></span><span><small>SCENE {String(index+1).padStart(2,'0')}</small><strong>{scene.title}</strong></span></button>)}<button type="button" className="add-scene" onClick={()=>addScene()} disabled={project.scenes.length>=MAX_SCENES}><span>＋</span><strong>장면 추가</strong><small>{project.scenes.length}/{MAX_SCENES}</small></button></div></section>
    <Inspector item={selectedItem} onScale={delta=>selectedItem&&patchSelectedBase({scale:clamp(selectedItem.scale+delta,.45,1.8)})} onRotate={delta=>selectedItem&&patchSelectedBase({rotation:clamp(selectedItem.rotation+delta,-30,30)})} onLayer={moveSelectedLayer} onDuplicate={duplicateSelected} onDelete={deleteSelected} onCharacterChange={patch=>patchSelectedData(patch)} onSpeechChange={(patch,record)=>patchSelectedData(patch,record)}/></section>
    <footer className="app-footer"><span><b>1</b> 캐릭터 만들기</span><i>→</i><span><b>2</b> 무대 꾸미기</span><i>→</i><span><b>3</b> 대사 넣기</span><i>→</i><span><b>4</b> 발표·출력</span></footer>
    {presentationOpen?<div className="presentation-layer" role="dialog" aria-modal="true" aria-label="연극 발표 화면"><div className="presentation-topbar"><div><small>MOAKIT PLAY · 발표 모드</small><strong>{project.title}</strong></div><button type="button" autoFocus onClick={()=>setPresentationOpen(false)}>편집으로 돌아가기 ×</button></div><div className="presentation-stage"><div className="stage-board read-only"><StageBackdrop backgroundId={activeScene.backgroundId}/>{activeScene.items.map(item=><StageItemView key={item.id} item={item}/>)}</div></div><div className="presentation-scenes">{project.scenes.map((scene,index)=><button type="button" key={scene.id} className={scene.id===project.activeSceneId?'active':''} onClick={()=>switchScene(scene.id)}>{index+1}</button>)}</div></div>:null}
  </main>;
}
