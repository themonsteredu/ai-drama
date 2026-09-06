'use client';
import {useEffect,useRef,useState,type PointerEvent as ReactPointerEvent} from 'react';
import {bounded,drawingId,emptyDrawingProject,newDrawingScene,parseDrawingFile,DRAWING_FILE_LIMIT,type DrawingProject,type DrawingAsset,type DrawingItem,type DrawingScene} from '@/lib/drawing-project';
import {loadDrawing,saveDrawing} from '@/lib/drawing-storage';
import {loadDrawingImages} from '@/lib/drawing-media';
import {drawDrawingScene,hitDrawing} from '@/lib/drawing-renderer';
import {downloadBlob,fileName} from '@/lib/project-files';
export function useDrawingEditor(){
  const [project,setProject]=useState<DrawingProject>(emptyDrawingProject),projectRef=useRef(project);
  const [selectedId,setSelectedId]=useState<string>(),[playing,setPlaying]=useState(false),[reset,setReset]=useState(0),[destination,setDestination]=useState(false);
  const [loaded,setLoaded]=useState(false),[blocked,setBlocked]=useState(false),[saveState,setSaveState]=useState('불러오는 중'),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const clock=useRef(0),past=useRef<DrawingProject[]>([]),future=useRef<DrawingProject[]>([]);
  const drag=useRef<{id:string;pointerId:number;dx:number;dy:number;start:DrawingProject;moved:boolean}|null>(null);
  const scene=project.scenes.find(s=>s.id===project.activeSceneId)??project.scenes[0],selected=scene.items.find(i=>i.id===selectedId),selectedAsset=project.assets.find(a=>a.id===selected?.assetId);
  useEffect(()=>{let gone=false;void loadDrawing().then(p=>{if(gone)return;if(p){projectRef.current=p;setProject(p);}}).catch(cause=>{if(!gone){setBlocked(true);setSaveState('저장 확인 필요');setError(cause instanceof Error?cause.message:'저장 내용을 읽지 못했어요.');}}).finally(()=>{if(!gone)setLoaded(true);});return()=>{gone=true;};},[]);
  useEffect(()=>{if(!loaded||blocked)return;let canceled=false;setSaveState('저장 중');const timer=setTimeout(()=>{void saveDrawing(project).then(()=>{if(!canceled)setSaveState('이 기기에 저장됨');}).catch(()=>{if(!canceled){setSaveState('저장 확인 필요');setError('기기 저장을 마치지 못했어요. 작품 파일로 보관해 주세요.');}});},350);return()=>{canceled=true;clearTimeout(timer);};},[project,loaded,blocked]);
  useEffect(()=>{if(!loaded||blocked)return;const flush=()=>{void saveDrawing(projectRef.current).catch(()=>{});};const hidden=()=>{if(document.visibilityState==='hidden'){setPlaying(false);flush();}};window.addEventListener('pagehide',flush);document.addEventListener('visibilitychange',hidden);return()=>{window.removeEventListener('pagehide',flush);document.removeEventListener('visibilitychange',hidden);};},[loaded,blocked]);
  function stop(){setPlaying(false);clock.current=0;setReset(n=>n+1);}
  function setValue(p:DrawingProject){projectRef.current=p;setProject(p);}
  function commit(fn:(p:DrawingProject)=>DrawingProject){if(!loaded)return;const before=projectRef.current;const next={...fn(before),updatedAt:new Date().toISOString()};past.current=[...past.current.slice(-29),before];future.current=[];stop();setValue(next);}
  function editScene(patch:Partial<DrawingScene>){commit(p=>({...p,scenes:p.scenes.map(s=>s.id===p.activeSceneId?{...s,...patch}:s)}));}
  function patchItem(patch:Partial<DrawingItem>){if(!selected)return;editScene({items:scene.items.map(i=>i.id===selected.id?{...i,...patch}:i)});}
  function undo(){const p=past.current.pop();if(!p)return;future.current.unshift(projectRef.current);stop();setValue(p);setSelectedId(undefined);setDestination(false);}
  function redo(){const p=future.current.shift();if(!p)return;past.current.push(projectRef.current);stop();setValue(p);setSelectedId(undefined);setDestination(false);}
  function place(asset:DrawingAsset,isNew=false){
    if(isNew&&(project.assets.length>=12||project.assets.reduce((sum,a)=>sum+a.source.length,0)+asset.source.length>10_000_000)){setError('한 작품에 그림은 12개, 전체 용량은 약 10MB까지 보관할 수 있어요.');return false;}
    if(asset.kind!=='background'&&scene.items.length>=40){setError('한 장면에는 40개까지 놓을 수 있어요. 장면을 하나 더 만들어 주세요.');return false;}
    const id=drawingId('drawing');const width=bounded(38*asset.width/asset.height,10,26);
    const item:DrawingItem={id,assetId:asset.id,x:50,y:78,width,rotation:0,flipped:false,motion:asset.kind==='plant'?'sway':'still',speed:'normal',speech:''};
    commit(p=>({...p,assets:isNew?[...p.assets,asset]:p.assets,scenes:p.scenes.map(s=>s.id!==p.activeSceneId?s:asset.kind==='background'?{...s,backgroundAssetId:asset.id}:{...s,items:[...s.items,item]})}));
    setError('');setSelectedId(asset.kind==='background'?undefined:id);setDestination(false);return true;
  }
  function chooseItem(id:string){stop();setSelectedId(id);setDestination(false);}
  function remove(){if(!selected)return;editScene({items:scene.items.filter(i=>i.id!==selected.id)});setSelectedId(undefined);}
  function duplicate(){if(!selected||scene.items.length>=40)return;const id=drawingId('drawing');editScene({items:[...scene.items,{...selected,id,x:bounded(selected.x+5,5,95),target:selected.target?{...selected.target}:undefined}]});setSelectedId(id);}
  function layer(delta:-1|1){if(!selected)return;const items=[...scene.items],index=items.findIndex(i=>i.id===selected.id),to=bounded(index+delta,0,items.length-1);const [item]=items.splice(index,1);items.splice(to,0,item);editScene({items});}
  function addScene(copy=false){if(project.scenes.length>=6)return;const id=drawingId('scene');const next=copy?{...structuredClone(scene),id,title:`장면 ${project.scenes.length+1}`,items:scene.items.map(i=>({...i,id:drawingId('drawing')}))}:newDrawingScene(id,`장면 ${project.scenes.length+1}`);commit(p=>({...p,activeSceneId:id,scenes:[...p.scenes,next]}));setSelectedId(undefined);setDestination(false);}
  function switchScene(id:string){stop();setDestination(false);setSelectedId(undefined);setValue({...projectRef.current,activeSceneId:id});}
  function deleteScene(){if(project.scenes.length===1||!confirm('이 장면을 지울까요? 실행 취소로 되돌릴 수 있어요.'))return;const scenes=project.scenes.filter(s=>s.id!==scene.id);commit(p=>({...p,scenes,activeSceneId:scenes[0].id}));setSelectedId(undefined);setDestination(false);}
  function newWork(){if(!confirm('새 작품을 시작할까요? 지금 작품은 먼저 작품 파일로 보관해 주세요.'))return;setBlocked(false);setError('');commit(()=>({...emptyDrawingProject(),id:drawingId('project')}));setSelectedId(undefined);setDestination(false);}
  function point(e:ReactPointerEvent<HTMLCanvasElement>){const r=e.currentTarget.getBoundingClientRect();return {x:bounded((e.clientX-r.left)/r.width*100,0,100),y:bounded((e.clientY-r.top)/r.height*100,0,100)};}
  function down(e:ReactPointerEvent<HTMLCanvasElement>){
    if(!loaded||playing)return;const pos=point(e);
    if(destination&&selected){patchItem({target:pos,motion:selected.motion==='still'?'move':selected.motion});setDestination(false);return;}
    if(clock.current>0){stop();return;}
    const item=hitDrawing(project,scene,pos.x,pos.y);setSelectedId(item?.id);if(!item)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);drag.current={id:item.id,pointerId:e.pointerId,dx:pos.x-item.x,dy:pos.y-item.y,start:projectRef.current,moved:false};
  }
  function move(e:ReactPointerEvent<HTMLCanvasElement>){const d=drag.current;if(!d||d.pointerId!==e.pointerId)return;const pos=point(e);d.moved=true;const p=projectRef.current;setValue({...p,scenes:p.scenes.map(s=>s.id===p.activeSceneId?{...s,items:s.items.map(i=>i.id===d.id?{...i,x:bounded(pos.x-d.dx,2,98),y:bounded(pos.y-d.dy,5,98)}:i)}:s)});}
  function up(e:ReactPointerEvent<HTMLCanvasElement>){const d=drag.current;if(!d||d.pointerId!==e.pointerId)return;drag.current=null;if(d.moved){past.current=[...past.current.slice(-29),d.start];future.current=[];setValue({...projectRef.current,updatedAt:new Date().toISOString()});}}
  function cancel(){if(drag.current){setValue(drag.current.start);drag.current=null;}}
  async function importWork(file:File){setBusy(true);try{if(file.size>DRAWING_FILE_LIMIT)throw new Error('작품 파일은 12MB 이하로 골라 주세요.');const next=parseDrawingFile(await file.text());await loadDrawingImages(next.assets);if(!confirm('불러온 작품으로 바꿀까요? 현재 작품은 먼저 파일로 보관해 주세요.'))return;setBlocked(false);commit(()=>next);setError('');setSelectedId(undefined);setDestination(false);}catch(cause){setError(cause instanceof Error?cause.message:'작품을 읽지 못했어요.');}finally{setBusy(false);}}
  function backup(){downloadBlob(new Blob([JSON.stringify(project)],{type:'application/json'}),`${fileName(project.title)}.moakit-drawing.json`);}
  async function png(){setBusy(true);try{const snapshot=projectRef.current,current=snapshot.scenes.find(s=>s.id===snapshot.activeSceneId)!;const images=await loadDrawingImages(snapshot.assets);await document.fonts.ready;const c=document.createElement('canvas');c.width=2560;c.height=1440;const ctx=c.getContext('2d');if(!ctx)throw new Error('이미지를 만들지 못했어요.');ctx.scale(2,2);drawDrawingScene(ctx,snapshot,current,images,clock.current);const blob=await new Promise<Blob>((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error('저장에 실패했어요.')),'image/png'));downloadBlob(blob,`${fileName(snapshot.title)}-${fileName(current.title)}.png`);}catch(cause){setError(cause instanceof Error?cause.message:'이미지를 만들지 못했어요.');}finally{setBusy(false);}}
  return {project,scene,selected,selectedAsset,selectedId,playing,setPlaying,reset,clock,destination,setDestination,loaded,blocked,saveState,error,setError,busy,commit,stop,editScene,patchItem,undo,redo,canUndo:past.current.length>0,canRedo:future.current.length>0,place,chooseItem,remove,duplicate,layer,addScene,switchScene,deleteScene,newWork,down,move,up,cancel,importWork,backup,png};
}
