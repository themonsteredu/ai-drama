'use client';
import {useEffect,useRef,useState} from 'react';
import type {DrawingProject,DialogueLine,DialogueSpeaker,DrawingNarration} from '@/lib/drawing-project';
import {validateDrawingProject} from '@/lib/drawing-project';
import {AI_VOICES,MAX_DIALOGUE_SPEAKERS,addDialogueSpeaker,removeDialogueSpeaker,audioDataUrl,combineDialogue,dialogueClipKey,dialogueKey,fitNarration,transcriptionChunks} from '@/lib/film-narration';
type Props={project:DrawingProject;onUpdate:(change:(p:DrawingProject)=>DrawingProject)=>void;onClose:()=>void};
export function FilmDialogueDialog({project,onUpdate,onClose}:Props){
 const dialog=useRef<HTMLDialogElement>(null),controller=useRef<AbortController|null>(null),working=useRef(false),alive=useRef(true);
 const original=project.narration!;
 const [speakers,setSpeakers]=useState<DialogueSpeaker[]>(original.speakers),[lines,setLines]=useState<DialogueLine[]>(original.lines),[transcript,setTranscript]=useState(original.transcript??'');
 const [busy,setBusy]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState(''),[code,setCode]=useState(''),[configured,setConfigured]=useState<boolean|null>(null),[authorized,setAuthorized]=useState(false);
 useEffect(()=>{alive.current=true;const previous=document.activeElement as HTMLElement|null;dialog.current?.showModal();void fetch('/api/film-background').then(r=>r.json()).then(r=>{if(alive.current){setConfigured(r.configured===true);setAuthorized(r.authenticated===true);}}).catch(()=>setConfigured(false));return()=>{alive.current=false;controller.current?.abort();previous?.focus();};},[]);
 function persist(nextLines=lines,nextSpeakers=speakers,extra:Partial<DrawingNarration>={}){
  onUpdate(p=>{const narration={...p.narration!,lines:nextLines,speakers:nextSpeakers,transcript,...extra};if(narration.generatedKey!==dialogueKey(narration))narration.useGenerated=false;const next={...p,narration};if(!validateDrawingProject(next))throw new Error('대사 또는 녹음 보관 용량을 확인해 주세요.');return next;});
 }
 async function post(body:Record<string,unknown>){
  const response=await fetch('/api/film-dialogue',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,code}),signal:controller.current!.signal});
  const value=await response.json();if(response.status===401)setAuthorized(false);if(!response.ok)throw new Error(value.error??'AI 음성 작업을 마치지 못했어요.');setAuthorized(true);return value;
 }
 async function work(task:()=>Promise<void>){
  if(working.current)return;working.current=true;controller.current=new AbortController();setBusy(true);setError('');
  try{await task();}catch(cause){if(alive.current)setError(cause instanceof Error&&cause.name==='AbortError'?'중단했어요. 완료된 대사는 보관되어 있어요.':cause instanceof Error?cause.message:'AI 음성 작업을 마치지 못했어요.');}
  finally{working.current=false;if(alive.current)setBusy(false);}
 }
 async function transcribe(){
  const chunks=await transcriptionChunks(original.original),texts:string[]=[...(original.transcribedParts??[])];
  for(let i=texts.length;i<chunks.length;i++){setStatus(`녹음을 글자로 바꾸는 중 ${i+1} / ${chunks.length}`);const result=await post({action:'transcribe',audio:await audioDataUrl(chunks[i])});texts.push(result.text);setTranscript(texts.join('\n'));persist(lines,speakers,{transcript:texts.join('\n'),transcribedParts:[...texts]});}
  setStatus('글자로 옮겼어요. 내용을 확인한 다음 배역 나누기를 눌러 주세요.');
 }
 async function assign(){
  setStatus('대사별 배역 초안을 만들고 있어요…');const result=await post({action:'assign',text:transcript,speakers:speakers.map(s=>s.name),scenes:project.scenes.map(s=>({id:s.id,title:s.title}))});setLines(result.lines);persist(result.lines);setStatus('배역과 장면을 확인해 주세요. 잘못 나뉜 곳은 직접 바꿀 수 있어요.');
 }
 function validOrder(rows:DialogueLine[]){let previous=-1;for(const line of rows){const index=project.scenes.findIndex(s=>s.id===line.sceneId);if(index<previous||index<0)throw new Error('대사를 장면 순서대로 배치해 주세요. 장면 번호가 앞뒤로 섞여 있어요.');previous=index;}}
 async function generate(){
  if(!lines.length||lines.some(l=>!l.text.trim()))throw new Error('비어 있는 대사를 입력하거나 삭제해 주세요.');validOrder(lines);
  let next=[...lines];persist(next,speakers);
  for(let i=0;i<next.length;i++){
   if(controller.current?.signal.aborted)throw new DOMException('Aborted','AbortError');
   const line=next[i],key=dialogueClipKey(line,speakers);if(line.clip&&line.clipKey===key)continue;
   setStatus(`${i+1} / ${next.length} 대사 · ${speakers[line.speaker].name} 목소리 만드는 중…`);
   const result=await post({action:'speak',text:line.text,voice:speakers[line.speaker].voice});next=next.map((l,j)=>j===i?{...l,clip:result.voice,clipKey:key}:l);setLines(next);persist(next,speakers);
   if(next.reduce((n,l)=>n+(l.clip?.duration??0)+.2,0)>600)throw new Error('생성한 대사가 10분을 넘었어요. 추가 생성을 멈췄어요. 대사를 줄여 주세요.');
  }
  setStatus('대사를 순서대로 이어 붙이고 있어요…');const combined=await combineDialogue(next);
  onUpdate(p=>{
   const narration={...p.narration!,speakers,lines:next,generated:combined.voice,useGenerated:true,enabled:true};narration.generatedKey=dialogueKey(narration);
   let updated=fitNarration({...p,narration});
   const starts=project.scenes.map(s=>combined.sceneStarts[s.id]);
   if(starts.every(t=>typeof t==='number')&&starts.every((t,i)=>i===0||t>starts[i-1]))updated={...updated,narration:{...updated.narration!,durations:Object.fromEntries(project.scenes.map((s,i)=>[s.id,Math.max(1,(starts[i+1]??combined.voice.duration)-starts[i])]))}};
   if(!validateDrawingProject(updated))throw new Error('AI 녹음 용량이 너무 커요. 대사를 줄여 주세요.');return updated;
  });setStatus('AI 대화를 저장했어요. 닫은 뒤 전체 미리보기에서 장면 시간을 확인해 주세요.');
 }
 function changeLine(index:number,patch:Partial<DialogueLine>){setLines(rows=>rows.map((line,i)=>i===index?{...line,...patch}:line));}
 const aiDisabled=busy||!configured||(!authorized&&!code),complete=lines.filter(l=>l.clip&&l.clipKey===dialogueClipKey(l,speakers)).length;
 return <dialog ref={dialog} className="film-dialogue-dialog" aria-labelledby="dialogue-title" onCancel={event=>{event.preventDefault();if(!busy){persist();onClose();}}}>
  <header><div><h2 id="dialogue-title">역할별 AI 목소리</h2><p>녹음을 글자로 옮긴 뒤, 대사마다 말할 인물을 정해요.</p></div><button disabled={busy} onClick={()=>{persist();onClose();}}>저장하고 닫기</button></header>
  <div className="film-dialogue-body">
   <div className="film-speaker-count"><strong>등장인물 {speakers.length}명</strong><button disabled={busy||speakers.length>=MAX_DIALOGUE_SPEAKERS} onClick={()=>{const actors=addDialogueSpeaker(speakers);setSpeakers(actors);persist(lines,actors);}}>배역 추가</button><span>최대 {MAX_DIALOGUE_SPEAKERS}명</span></div>
   <div className="film-speakers">{speakers.map((speaker,index)=><div key={index}><label>{index+1}번 이름<input aria-label={`${index+1}번 등장인물 이름`} value={speaker.name} maxLength={40} disabled={busy} onChange={event=>setSpeakers(rows=>rows.map((s,i)=>i===index?{...s,name:event.target.value}:s))} onBlur={()=>persist()}/></label><label>목소리<select aria-label={`${index+1}번 목소리`} disabled={busy} value={speaker.voice} onChange={event=>{const actors=speakers.map((s,i)=>i===index?{...s,voice:event.target.value}:s);setSpeakers(actors);persist(lines,actors);}}>{AI_VOICES.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}</select></label><button aria-label={`${index+1}번 배역 삭제`} disabled={busy||speakers.length<=1||lines.some(l=>l.speaker===index)} onClick={()=>{const next=removeDialogueSpeaker(speakers,lines,index);setSpeakers(next.speakers);setLines(next.lines);persist(next.lines,next.speakers);}}>배역 삭제</button></div>)}</div>
   <p>목소리 10종을 배역마다 선택해요. 같은 목소리를 여러 배역에 사용할 수도 있어요. 대사가 있는 배역은 대사를 다른 인물로 옮긴 뒤 삭제할 수 있어요.</p>
   {!authorized?<label>교사 확인 번호<input aria-label="AI 음성 교사 확인 번호" type="password" inputMode="numeric" autoComplete="off" value={code} disabled={busy} onChange={e=>setCode(e.target.value)}/></label>:null}
   {configured===false?<p role="status">GPT API 설정에서 키를 먼저 저장해 주세요. 대사와 배역은 미리 작성할 수 있어요.</p>:null}
   <section className="film-transcript"><h3>1. 녹음을 대사로 옮기기</h3><button disabled={aiDisabled} onClick={()=>void work(transcribe)}>녹음을 글자로 바꾸기</button><label>전체 대사<textarea aria-label="전체 대사 글" rows={5} maxLength={16000} disabled={busy} value={transcript} placeholder="녹음을 글자로 바꾸거나, 가지고 있는 대본을 붙여 넣으세요." onChange={e=>setTranscript(e.target.value)} onBlur={()=>persist()}/></label><button disabled={aiDisabled||!transcript.trim()} onClick={()=>void work(assign)}>대사 배역 초안 나누기</button></section>
   <section><h3>2. 대사와 배역 확인</h3><p>인원수만으로 배역이 정확히 나뉘지는 않아요. 말할 인물과 장면을 확인하세요.</p>
    <div className="film-dialogue-lines">{lines.map((line,index)=><div className="film-dialogue-line" key={line.id}><b>{index+1}</b><label><span className="draw-sr">장면</span><select aria-label={`${index+1}번 대사 장면`} value={line.sceneId} disabled={busy} onChange={e=>{const rows=lines.map((l,i)=>i===index?{...l,sceneId:e.target.value}:l);setLines(rows);persist(rows);}}>{project.scenes.map((s,i)=><option key={s.id} value={s.id}>{i+1}. {s.title}</option>)}</select></label><label><span className="draw-sr">말할 인물</span><select aria-label={`${index+1}번 대사 인물`} value={line.speaker} disabled={busy} onChange={e=>{const rows=lines.map((l,i)=>i===index?{...l,speaker:Number(e.target.value)}:l);setLines(rows);persist(rows);}}>{speakers.map((s,i)=><option key={i} value={i}>{s.name||`주인공 ${i+1}`}</option>)}</select></label><textarea aria-label={`${index+1}번 대사`} rows={2} maxLength={500} disabled={busy} value={line.text} onChange={e=>changeLine(index,{text:e.target.value})} onBlur={()=>persist()}/><button aria-label={`${index+1}번 대사 삭제`} disabled={busy} onClick={()=>{const rows=lines.filter((_,i)=>i!==index);setLines(rows);persist(rows);}}>삭제</button>{line.clip&&line.clipKey===dialogueClipKey(line,speakers)?<audio controls src={line.clip.source} aria-label={`${index+1}번 AI 대사 듣기`}/>:null}</div>)}</div>
    <button disabled={busy||lines.length>=80} onClick={()=>{const rows=[...lines,{id:`line-${crypto.randomUUID()}`,sceneId:lines.at(-1)?.sceneId??project.scenes[0].id,speaker:0,text:''}];setLines(rows);persist(rows);}}>대사 한 줄 추가</button>
   </section>
   <section><h3>3. AI 목소리 만들기</h3><p>배역별로 선택한 AI 목소리로 읽어요. 원본 녹음은 따로 보관됩니다. 생성된 목소리는 AI 음성입니다.</p><p>완료된 대사 {complete} / {lines.length}개. 변경한 대사만 새로 생성해요.</p><button className="film-primary" disabled={aiDisabled||!lines.length} onClick={()=>void work(generate)}>역할별 목소리 생성</button>{busy?<button onClick={()=>controller.current?.abort()}>작업 중단</button>:null}<p>‘녹음을 글자로 바꾸기’는 녹음 파일을, 배역 나누기와 목소리 생성은 대사 글을 OpenAI로 보내며 API 이용 요금이 발생해요.</p></section>
   {status?<p role="status">{status}</p>:null}{error?<p className="film-alert" role="alert">{error}</p>:null}
  </div>
 </dialog>;
}
