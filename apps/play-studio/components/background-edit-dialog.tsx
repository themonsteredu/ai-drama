'use client';
import {useEffect,useRef,useState,type PointerEvent} from 'react';
import {drawingId,validateDrawingProject,type DrawingProject,type DrawingScene} from '@/lib/drawing-project';
import {rasterImage} from '@/lib/drawing-media';
import {preserveCharacters} from '@/lib/four-scene';
import {separateSceneCharacter} from '@/lib/scene-character';
import {backgroundPresets,type BackgroundStrength} from '@/lib/background-prompt';
import './four-scene.css';
type Props={project:DrawingProject;scene:DrawingScene;onApply:(p:DrawingProject)=>void;onClose:()=>void;mode?:'background'|'separate';onSelect?:(id:string)=>void};
type MaskSnapshot={pixels:Uint8ClampedArray;result:string};
export function BackgroundEditDialog({project,scene,onApply,onClose,mode='background',onSelect}:Props){
 const separating=mode==='separate';
 const [name,setName]=useState('주인공');
 const original=project.assets.find(a=>a.id===(separating?scene.backgroundAssetId:(scene.stillOriginalAssetId??scene.backgroundAssetId)))!;
 const dialog=useRef<HTMLDialogElement>(null),view=useRef<HTMLCanvasElement>(null),mask=useRef<HTMLCanvasElement|null>(null),image=useRef<HTMLImageElement|null>(null),last=useRef<{x:number;y:number}|null>(null),alive=useRef(true);
 const [brush,setBrush]=useState(50),[eraser,setEraser]=useState(50),[erase,setErase]=useState(false),[cursor,setCursor]=useState<{x:number;y:number}|null>(null),[marked,setMarked]=useState(false),[ready,setReady]=useState(false),[configured,setConfigured]=useState<boolean|null>(null),[authorized,setAuthorized]=useState(false);
 const [prompt,setPrompt]=useState(separating?'주인공 뒤에 이어질 배경을 주변 그림과 자연스럽게 연결해 주세요.':backgroundPresets[0].prompt as string),[code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState('');
 const [strength,setStrength]=useState<BackgroundStrength>('clear'),[split,setSplit]=useState(50),[comparing,setComparing]=useState(false),[protectedPercent,setProtectedPercent]=useState(0);
 const past=useRef<MaskSnapshot[]>([]),future=useRef<MaskSnapshot[]>([]),[history,setHistory]=useState({past:0,future:0});
 const current=project.assets.find(a=>a.id===scene.backgroundAssetId),comparison=result||(!separating&&current?.id!==original.id?current?.source:'');
 const requestLock=useRef(false),toolSize=erase?eraser:brush;
 function snapshot():MaskSnapshot{
  const m=mask.current!,data=m.getContext('2d')!.getImageData(0,0,m.width,m.height).data,pixels=new Uint8ClampedArray(m.width*m.height);
  for(let i=0;i<pixels.length;i++)pixels[i]=data[i*4];
  return {pixels,result};
 }
 function remember(){past.current=[...past.current.slice(-11),snapshot()];future.current=[];setHistory({past:past.current.length,future:0});}
 function undo(redo=false){
  if(!ready||busy||last.current)return;
  const from=redo?future.current:past.current,next=from.pop();if(!next)return;
  (redo?past.current:future.current).push(snapshot());const m=mask.current!,ctx=m.getContext('2d')!,data=ctx.createImageData(m.width,m.height);
  for(let i=0;i<next.pixels.length;i++){data.data[i*4]=data.data[i*4+1]=data.data[i*4+2]=next.pixels[i];data.data[i*4+3]=255;}
  ctx.putImageData(data,0,0);setResult(next.result);setHistory({past:past.current.length,future:future.current.length});paint();
 }
 function paint(){
  const c=view.current,m=mask.current,a=image.current;if(!c||!m||!a)return;
  const ctx=c.getContext('2d'),mc=m.getContext('2d');if(!ctx||!mc)return;
  ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(a,0,0,c.width,c.height);
  const layer=mc.getImageData(0,0,m.width,m.height);let protectedCount=0;
  for(let i=0;i<layer.data.length;i+=4){const keep=layer.data[i]<128;layer.data[i]=217;layer.data[i+1]=69;layer.data[i+2]=81;layer.data[i+3]=keep?95:0;if(keep)protectedCount++;}
  const overlay=document.createElement('canvas');overlay.width=c.width;overlay.height=c.height;overlay.getContext('2d')?.putImageData(layer,0,0);ctx.drawImage(overlay,0,0);setMarked(protectedCount>0&&protectedCount<m.width*m.height);setProtectedPercent(Math.round(protectedCount/(m.width*m.height)*100));
 }
 useEffect(()=>{
  alive.current=true;const previous=document.activeElement as HTMLElement|null;dialog.current?.showModal();
  void fetch('/api/film-background').then(r=>r.json()).then(r=>{if(alive.current){setConfigured(r.configured===true);setAuthorized(r.authenticated===true);}}).catch(()=>{if(alive.current)setConfigured(false);});
  void (async()=>{const a=await rasterImage(original.source);if(!alive.current)return;image.current=a;const m=document.createElement('canvas');m.width=a.naturalWidth;m.height=a.naturalHeight;mask.current=m;const ctx=m.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,m.width,m.height);if(scene.protectedMask&&!separating){const saved=await rasterImage(scene.protectedMask);if(!alive.current)return;ctx.drawImage(saved,0,0,m.width,m.height);}const c=view.current;if(c){c.width=m.width;c.height=m.height;}paint();setReady(true);})().catch(()=>setError('그림을 읽지 못했어요.'));
  return()=>{alive.current=false;previous?.focus();};
 },[]);
 function point(event:PointerEvent<HTMLCanvasElement>){const rect=event.currentTarget.getBoundingClientRect();return {x:(event.clientX-rect.left)*event.currentTarget.width/rect.width,y:(event.clientY-rect.top)*event.currentTarget.height/rect.height};}
 function stroke(event:PointerEvent<HTMLCanvasElement>,start=false){
  if(!ready||busy||!event.isPrimary||(start&&event.button!==0)||(!start&&!last.current))return;event.preventDefault();const p=point(event),ctx=mask.current!.getContext('2d')!;
  if(start){remember();event.currentTarget.setPointerCapture(event.pointerId);last.current=p;}
  ctx.strokeStyle=erase?'#fff':'#000';ctx.fillStyle=ctx.strokeStyle;ctx.lineWidth=toolSize;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(last.current!.x,last.current!.y);ctx.lineTo(p.x,p.y);ctx.stroke();ctx.beginPath();ctx.arc(p.x,p.y,toolSize/2,0,Math.PI*2);ctx.fill();last.current=p;setResult('');paint();
 }
 function clear(){const m=mask.current;if(!m||!ready||busy)return;remember();const c=m.getContext('2d')!;c.fillStyle='#fff';c.fillRect(0,0,m.width,m.height);setResult('');paint();}
 async function post(body:Record<string,unknown>){const response=await fetch('/api/film-background',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,code})});const data=await response.json();if(!response.ok)throw new Error(data.error??'배경을 만들지 못했어요.');return data;}
 async function generate(){
  if(!ready||!marked||requestLock.current||!configured)return;requestLock.current=true;setBusy(true);setError('');
  try{
   const m=mask.current!,ratio=1024/Math.max(m.width,m.height);
   const width=Math.round(m.width*ratio),height=Math.round(m.height*ratio),x=Math.floor((1024-width)/2),y=Math.floor((1024-height)/2);
   const c=document.createElement('canvas');c.width=1024;c.height=1024;const ctx=c.getContext('2d')!;
   // Only the provider copy is compressed. Protected pixels still come from the stored original.
   ctx.fillStyle='#fff';ctx.fillRect(0,0,1024,1024);ctx.drawImage(image.current!,x,y,width,height);const source=c.toDataURL('image/jpeg',.9);
   ctx.fillStyle='#000';ctx.fillRect(0,0,1024,1024);ctx.imageSmoothingEnabled=false;ctx.drawImage(m,x,y,width,height);
   const pixels=ctx.getImageData(0,0,1024,1024);for(let i=0;i<pixels.data.length;i+=4)pixels.data[i+3]=separating?(pixels.data[i]<128?0:255):(pixels.data[i]<128?255:0);
   ctx.putImageData(pixels,0,0);const scaledMask=c.toDataURL('image/png');
   const completed=await post({image:source,mask:scaledMask,prompt,strength,operation:separating?'remove-character':'background'});
   const generated=await rasterImage(completed.source),crop=document.createElement('canvas');crop.width=m.width;crop.height=m.height;
   crop.getContext('2d')!.drawImage(generated,x*generated.naturalWidth/1024,y*generated.naturalHeight/1024,width*generated.naturalWidth/1024,height*generated.naturalHeight/1024,0,0,m.width,m.height);
   const protection=document.createElement('canvas');protection.width=m.width;protection.height=m.height;const pc=protection.getContext('2d')!;pc.drawImage(m,0,0);if(separating){const data=pc.getImageData(0,0,m.width,m.height);for(let i=0;i<data.data.length;i+=4)data.data[i]=data.data[i+1]=data.data[i+2]=255-data.data[i];pc.putImageData(data,0,0);}
   const value=await preserveCharacters(original.source,crop.toDataURL('image/png'),protection.toDataURL('image/png'));if(alive.current){setResult(value.source);setComparing(true);}
  }catch(cause){if(alive.current)setError(cause instanceof Error?cause.message:'배경을 만들지 못했어요.');}
  finally{requestLock.current=false;if(alive.current)setBusy(false);}
 }
 async function apply(){
  if(separating){
   if(!result||requestLock.current)return;requestLock.current=true;setBusy(true);
   try{const next=await separateSceneCharacter(project,scene.id,mask.current!.toDataURL('image/png'),result,name);onApply(next.project);onSelect?.(next.itemId);onClose();}
   catch(cause){setError(cause instanceof Error?cause.message:'주인공을 분리하지 못했어요.');}
   finally{requestLock.current=false;setBusy(false);}return;
  }
  const id=result?drawingId('still-result'):scene.backgroundAssetId;
  const scenes=project.scenes.map(s=>s.id===scene.id?{...s,stillOriginalAssetId:original.id,protectedMask:mask.current!.toDataURL('image/png'),backgroundAssetId:id}:s);
  const used=new Set(scenes.flatMap(s=>[s.stillOriginalAssetId,s.backgroundAssetId,...s.items.map(i=>i.assetId)]));
  const assets=project.assets.filter(a=>!(result&&a.id===scene.backgroundAssetId&&a.id!==original.id&&a.id.startsWith('still-result-')&&!used.has(a.id)));if(result)assets.push({...original,id:id!,name:`${scene.title} 배경 수정`.slice(0,40),source:result,edit:undefined});
  const next={...project,assets,scenes};if(!validateDrawingProject(next)){setError('그림 보관함의 개수 또는 용량 한도에 도달했어요. 기존 그림은 그대로 보관했어요.');return;}
  onApply(next);onClose();
 }
 function restore(){onApply({...project,scenes:project.scenes.map(s=>s.id===scene.id?{...s,backgroundAssetId:original.id}:s)});onClose();}
 return <dialog ref={dialog} className="film-background-dialog" aria-labelledby="background-title" onKeyDown={event=>{if((event.target as HTMLElement).matches('input,textarea,select'))return;if((event.ctrlKey||event.metaKey)&&['z','y'].includes(event.key.toLowerCase())){event.preventDefault();event.stopPropagation();undo(event.shiftKey||event.key.toLowerCase()==='y');}}} onCancel={e=>{if(busy)e.preventDefault();else onClose();}}><header><div><h2 id="background-title">{separating?'주인공만 따로 움직이기':'등장인물은 그대로, 배경만 다듬어요'}</h2><p>{separating?'움직일 주인공 한 명을 가장자리까지 칠해 주세요. 원본 주인공을 오려내고, 그 자리의 배경만 AI로 채워요.':'바뀌면 안 되는 인물을 손가락으로 꼼꼼히 칠해 주세요. 빨간 부분은 원본으로 유지돼요.'}</p></div><button disabled={busy} onClick={onClose}>닫기</button></header>
  <div className="film-background-grid"><section>
   {comparison?<div className="film-comparison-tabs"><button aria-pressed={!comparing} onClick={()=>setComparing(false)}>인물 표시 수정</button><button aria-pressed={comparing} onClick={()=>setComparing(true)}>변경 전후 비교</button></div>:null}
   <div hidden={comparing&&!!comparison}><div className="film-brush-tools"><button aria-pressed={!erase} disabled={busy} onClick={()=>setErase(false)}>{separating?'주인공 선택':'인물 보호'}</button><button aria-pressed={erase} disabled={busy} onClick={()=>setErase(true)}>지우개</button><label>{erase?'지우개':'붓'} 크기 <output>{toolSize}</output><input aria-label={erase?'지우개 크기':'선택 붓 크기'} type="range" min="8" max="160" value={toolSize} disabled={busy} onChange={e=>(erase?setEraser:setBrush)(Number(e.target.value))}/></label><button disabled={!ready||busy||!history.past} onClick={()=>undo()}>표시 실행 취소</button><button disabled={!ready||busy||!history.future} onClick={()=>undo(true)}>표시 다시 실행</button><button disabled={!ready||busy} onClick={clear}>선택 모두 지우기</button></div><p className="film-tool-help" role="status">{erase?'지우개로 빨간 선택 표시만 지워요. 원본 그림은 지워지지 않아요.':'움직이거나 보호할 인물을 칠해요. 잘못 칠한 곳은 지우개로 고쳐요.'}</p><div className={`film-mask-canvas ${erase?'is-erasing':''}`}><canvas ref={view} aria-label={separating?'주인공 선택 영역':'등장인물 보호 영역'} onPointerDown={e=>{setCursor(point(e));stroke(e,true);}} onPointerMove={e=>{setCursor(point(e));stroke(e);}} onPointerLeave={()=>setCursor(null)} onPointerUp={()=>{last.current=null;setCursor(null);}} onPointerCancel={()=>{last.current=null;setCursor(null);}}/>{cursor&&ready&&!busy&&mask.current?<i aria-hidden="true" className="film-brush-cursor" style={{left:`${cursor.x/mask.current.width*100}%`,top:`${cursor.y/mask.current.height*100}%`,width:`${toolSize/mask.current.width*100}%`,height:`${toolSize/mask.current.height*100}%`}}/>:null}</div><p className="film-mask-help">{separating?'움직일 주인공만 빨갛게 칠해 주세요.':`인물만 빨갛게 칠해 주세요. 나머지 ${100-protectedPercent}% 영역의 기존 배경을 다듬어요.`}</p>{!separating&&protectedPercent>=75?<p className="film-alert">보호 표시가 넓어서 배경 변화가 작을 수 있어요. 배경에 칠한 부분은 ‘지우개’로 지워 주세요.</p>:null}</div>
   {comparison&&comparing?<div className="film-background-result"><h3>{separating?'주인공을 지운 배경 확인':result?'새 배경 미리보기':'현재 적용한 배경 비교'}</h3>
    <div className="film-compare" style={{aspectRatio:`${original.width} / ${original.height}`}}><img src={original.source} alt="수정 전 원본 그림"/><img src={comparison} alt={separating?'선택한 주인공을 지운 배경':'배경만 수정한 결과'} style={{clipPath:`inset(0 0 0 ${split}%)`}}/><span className="film-compare-original">원본</span><span className="film-compare-edited">{result?'생성 결과':'적용된 배경'}</span><i style={{left:`${split}%`}}/></div>
    <label className="film-compare-slider">손잡이를 움직여 비교해 보세요<input type="range" min="0" max="100" value={split} aria-label="원본과 결과 비교" onChange={event=>setSplit(Number(event.target.value))}/></label>
    <p>{separating?'인물의 잔상이 남았다면 표시 범위를 고쳐 다시 생성해 주세요. 적용하면 원본 주인공이 제자리에 놓여요.':result?'빨갛게 보호한 인물은 원본 그대로예요. ‘이 그림 적용’을 눌러야 무대에 반영돼요.':'원본과 현재 무대의 배경을 비교하고 있어요.'}</p>
   </div>:null}</section>
  <aside>{!separating?<><p className="film-style-note"><strong>배경 구성은 그대로, 그림은 더 멋지게</strong><span>원래 있는 나무·꽃 등을 더 잘 그려요. 새 요소는 추가하지 않아요.</span></p><fieldset className="film-background-strength"><legend>얼마나 다듬을까요?</legend><button aria-pressed={strength==='clear'} disabled={busy} onClick={()=>setStrength('clear')}>더 정교하게</button><button aria-pressed={strength==='gentle'} disabled={busy} onClick={()=>setStrength('gentle')}>살짝 다듬기</button></fieldset><fieldset className="film-background-presets"><legend>다듬는 방법</legend>{backgroundPresets.map(preset=><button key={preset.name} disabled={busy} aria-pressed={prompt===preset.prompt} onClick={()=>setPrompt(preset.prompt)}>{preset.name}</button>)}</fieldset></>:null}{separating?<label>주인공 이름<input maxLength={40} value={name} disabled={busy} onChange={e=>setName(e.target.value)}/></label>:null}<label>{separating?'주인공 뒤의 배경 설명':'배경을 어떻게 다듬을까요?'}<textarea rows={4} maxLength={600} disabled={busy} value={prompt} onChange={e=>setPrompt(e.target.value)}/></label>{!authorized?<label>교사 확인 번호<input type="password" inputMode="numeric" autoComplete="off" value={code} disabled={busy} onChange={e=>setCode(e.target.value)}/></label>:null}<p>생성 버튼을 누르면 이 장면 그림을 OpenAI로 보내요. 녹음 파일은 보내지 않아요.</p><p>배경 1장만 생성하며, 마음에 들면 저장해서 계속 사용해요.</p>{configured===false?<p className="film-alert">{separating?'GPT API 설정에서 키를 저장하면 주인공 뒤의 배경을 채울 수 있어요.':'GPT API 설정에서 키를 먼저 저장해 주세요. 보호 영역은 먼저 저장할 수 있어요.'}</p>:null}<button className="film-primary" disabled={!ready||!marked||(!code&&!authorized)||!configured||busy||!prompt.trim()} onClick={()=>void generate()}>{busy?'배경을 만들고 있어요…':separating?'주인공 자리 채우기':'배경 1장 생성'}</button>{!marked?<p>보호할 인물을 먼저 칠해 주세요.</p>:null}{error?<p className="film-alert" role="alert">{error}</p>:null}</aside></div>
  <footer>{!separating?<button disabled={busy} onClick={restore}>원본 그림으로 되돌리기</button>:null}<button className="film-primary" disabled={!ready||busy||(separating&&!result)} onClick={()=>void apply()}>{separating?'주인공 분리 적용':result?'이 그림 적용':'보호 영역 저장'}</button></footer>
 </dialog>;
}
