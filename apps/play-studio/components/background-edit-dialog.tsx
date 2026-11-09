'use client';
import {useEffect,useRef,useState,type PointerEvent} from 'react';
import {drawingId,validateDrawingProject,type DrawingProject,type DrawingScene} from '@/lib/drawing-project';
import {rasterImage} from '@/lib/drawing-media';
import {preserveCharacters} from '@/lib/four-scene';
import './four-scene.css';
type Props={project:DrawingProject;scene:DrawingScene;onApply:(p:DrawingProject)=>void;onClose:()=>void};
export function BackgroundEditDialog({project,scene,onApply,onClose}:Props){
 const original=project.assets.find(a=>a.id===(scene.stillOriginalAssetId??scene.backgroundAssetId))!;
 const dialog=useRef<HTMLDialogElement>(null),view=useRef<HTMLCanvasElement>(null),mask=useRef<HTMLCanvasElement|null>(null),image=useRef<HTMLImageElement|null>(null),last=useRef<{x:number;y:number}|null>(null),alive=useRef(true);
 const [brush,setBrush]=useState(50),[erase,setErase]=useState(false),[marked,setMarked]=useState(false),[ready,setReady]=useState(false),[configured,setConfigured]=useState<boolean|null>(null),[authorized,setAuthorized]=useState(false);
 const [prompt,setPrompt]=useState('원래 그림의 분위기를 유지하면서 배경의 색감과 풍경을 조금 더 자연스럽게 다듬어 주세요.'),[code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState('');
 const requestLock=useRef(false);
 function paint(){
  const c=view.current,m=mask.current,a=image.current;if(!c||!m||!a)return;
  const ctx=c.getContext('2d'),mc=m.getContext('2d');if(!ctx||!mc)return;
  ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(a,0,0,c.width,c.height);
  const layer=mc.getImageData(0,0,m.width,m.height);let protectedCount=0;
  for(let i=0;i<layer.data.length;i+=4){const keep=layer.data[i]<128;layer.data[i]=217;layer.data[i+1]=69;layer.data[i+2]=81;layer.data[i+3]=keep?95:0;if(keep)protectedCount++;}
  const overlay=document.createElement('canvas');overlay.width=c.width;overlay.height=c.height;overlay.getContext('2d')?.putImageData(layer,0,0);ctx.drawImage(overlay,0,0);setMarked(protectedCount>0&&protectedCount<m.width*m.height);
 }
 useEffect(()=>{
  alive.current=true;const previous=document.activeElement as HTMLElement|null;dialog.current?.showModal();
  void fetch('/api/film-background').then(r=>r.json()).then(r=>{if(alive.current){setConfigured(r.configured===true);setAuthorized(r.authenticated===true);}}).catch(()=>{if(alive.current)setConfigured(false);});
  void (async()=>{const a=await rasterImage(original.source);if(!alive.current)return;image.current=a;const m=document.createElement('canvas');m.width=a.naturalWidth;m.height=a.naturalHeight;mask.current=m;const ctx=m.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,m.width,m.height);if(scene.protectedMask){const saved=await rasterImage(scene.protectedMask);if(!alive.current)return;ctx.drawImage(saved,0,0,m.width,m.height);}const c=view.current;if(c){c.width=m.width;c.height=m.height;}paint();setReady(true);})().catch(()=>setError('그림을 읽지 못했어요.'));
  return()=>{alive.current=false;previous?.focus();};
 },[]);
 function point(event:PointerEvent<HTMLCanvasElement>){const rect=event.currentTarget.getBoundingClientRect();return {x:(event.clientX-rect.left)*event.currentTarget.width/rect.width,y:(event.clientY-rect.top)*event.currentTarget.height/rect.height};}
 function stroke(event:PointerEvent<HTMLCanvasElement>,start=false){
  if(!ready||busy||(!start&&!last.current))return;event.preventDefault();const p=point(event),ctx=mask.current!.getContext('2d')!;
  if(start){event.currentTarget.setPointerCapture(event.pointerId);last.current=p;}
  ctx.strokeStyle=erase?'#fff':'#000';ctx.fillStyle=ctx.strokeStyle;ctx.lineWidth=brush;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(last.current!.x,last.current!.y);ctx.lineTo(p.x,p.y);ctx.stroke();ctx.beginPath();ctx.arc(p.x,p.y,brush/2,0,Math.PI*2);ctx.fill();last.current=p;setResult('');paint();
 }
 function clear(){const m=mask.current;if(!m)return;const c=m.getContext('2d')!;c.fillStyle='#fff';c.fillRect(0,0,m.width,m.height);setResult('');paint();}
 async function post(body:Record<string,unknown>){const response=await fetch('/api/film-background',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,code})});const data=await response.json();if(!response.ok)throw new Error(data.error??'배경을 만들지 못했어요.');return data;}
 async function generate(){
  if(!ready||!marked||requestLock.current||!configured)return;requestLock.current=true;setBusy(true);setError('');setResult('');
  try{
   const m=mask.current!,ratio=1024/Math.max(m.width,m.height);
   const width=Math.round(m.width*ratio),height=Math.round(m.height*ratio),x=Math.floor((1024-width)/2),y=Math.floor((1024-height)/2);
   const c=document.createElement('canvas');c.width=1024;c.height=1024;const ctx=c.getContext('2d')!;
   ctx.fillStyle='#fff';ctx.fillRect(0,0,1024,1024);ctx.drawImage(image.current!,x,y,width,height);const source=c.toDataURL('image/png');
   ctx.fillStyle='#000';ctx.fillRect(0,0,1024,1024);ctx.imageSmoothingEnabled=false;ctx.drawImage(m,x,y,width,height);
   const pixels=ctx.getImageData(0,0,1024,1024);for(let i=0;i<pixels.data.length;i+=4)pixels.data[i+3]=pixels.data[i]<128?255:0;
   ctx.putImageData(pixels,0,0);const scaledMask=c.toDataURL('image/png');
   const completed=await post({image:source,mask:scaledMask,prompt});
   const generated=await rasterImage(completed.source),crop=document.createElement('canvas');crop.width=m.width;crop.height=m.height;
   crop.getContext('2d')!.drawImage(generated,x*generated.naturalWidth/1024,y*generated.naturalHeight/1024,width*generated.naturalWidth/1024,height*generated.naturalHeight/1024,0,0,m.width,m.height);
   const value=await preserveCharacters(original.source,crop.toDataURL('image/png'),m.toDataURL('image/png'));if(alive.current)setResult(value.source);
  }catch(cause){if(alive.current)setError(cause instanceof Error?cause.message:'배경을 만들지 못했어요.');}
  finally{requestLock.current=false;if(alive.current)setBusy(false);}
 }
 function apply(){
  const id=result?drawingId('still-result'):scene.backgroundAssetId;
  const scenes=project.scenes.map(s=>s.id===scene.id?{...s,stillOriginalAssetId:original.id,protectedMask:mask.current!.toDataURL('image/png'),backgroundAssetId:id}:s);
  const used=new Set(scenes.flatMap(s=>[s.stillOriginalAssetId,s.backgroundAssetId,...s.items.map(i=>i.assetId)]));
  const assets=project.assets.filter(a=>!(result&&a.id===scene.backgroundAssetId&&a.id!==original.id&&a.id.startsWith('still-result-')&&!used.has(a.id)));if(result)assets.push({...original,id:id!,name:`${scene.title} 배경 수정`.slice(0,40),source:result,edit:undefined});
  const next={...project,assets,scenes};if(!validateDrawingProject(next)){setError('그림 보관함의 개수 또는 용량 한도에 도달했어요. 기존 그림은 그대로 보관했어요.');return;}
  onApply(next);onClose();
 }
 function restore(){onApply({...project,scenes:project.scenes.map(s=>s.id===scene.id?{...s,backgroundAssetId:original.id}:s)});onClose();}
 return <dialog ref={dialog} className="film-background-dialog" aria-labelledby="background-title" onCancel={e=>{if(busy)e.preventDefault();else onClose();}}><header><div><h2 id="background-title">등장인물은 그대로, 배경만 다듬어요</h2><p>바뀌면 안 되는 인물을 손가락으로 꼼꼼히 칠해 주세요. 빨간 부분은 원본으로 유지돼요.</p></div><button disabled={busy} onClick={onClose}>닫기</button></header>
  <div className="film-background-grid"><section><div className="film-brush-tools"><button aria-pressed={!erase} disabled={busy} onClick={()=>setErase(false)}>인물 보호</button><button aria-pressed={erase} disabled={busy} onClick={()=>setErase(true)}>표시 지우기</button><label>붓 크기<input aria-label="보호 영역 붓 크기" type="range" min="8" max="160" value={brush} disabled={busy} onChange={e=>setBrush(Number(e.target.value))}/></label><button disabled={busy} onClick={clear}>표시 초기화</button></div><canvas ref={view} aria-label="등장인물 보호 영역" onPointerDown={e=>stroke(e,true)} onPointerMove={e=>stroke(e)} onPointerUp={()=>{last.current=null;}} onPointerCancel={()=>{last.current=null;}}/>{result?<div className="film-background-result"><h3>완성 미리보기</h3><img src={result} alt="배경만 수정한 결과"/></div>:null}</section>
  <aside><label>배경을 어떻게 바꿀까요?<textarea rows={4} maxLength={600} disabled={busy} value={prompt} onChange={e=>setPrompt(e.target.value)}/></label>{!authorized?<label>교사 확인 번호<input type="password" inputMode="numeric" autoComplete="off" value={code} disabled={busy} onChange={e=>setCode(e.target.value)}/></label>:null}<p>생성 버튼을 누르면 이 장면 그림을 OpenAI로 보내요. 녹음 파일은 보내지 않아요.</p><p>배경 1장만 생성하며, 마음에 들면 저장해서 계속 사용해요.</p>{configured===false?<p className="film-alert">GPT API 설정에서 키를 먼저 저장해 주세요. 보호 영역은 먼저 저장할 수 있어요.</p>:null}<button className="film-primary" disabled={!ready||!marked||(!code&&!authorized)||!configured||busy||!prompt.trim()} onClick={()=>void generate()}>{busy?'배경을 만들고 있어요…':'배경 1장 생성'}</button>{!marked?<p>보호할 인물을 먼저 칠해 주세요.</p>:null}{error?<p className="film-alert" role="alert">{error}</p>:null}</aside></div>
  <footer><button disabled={busy} onClick={restore}>원본 그림으로 되돌리기</button><button className="film-primary" disabled={!ready||busy} onClick={apply}>{result?'이 그림 적용':'보호 영역 저장'}</button></footer>
 </dialog>;
}
