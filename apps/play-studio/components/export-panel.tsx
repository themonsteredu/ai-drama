'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import type { StageProject, StageScene } from '@moakit/stage-core';
import { StageBackdrop, StageItemView } from '@/components/stage-view';
import { backgrounds, poses, expressions } from '@/lib/catalog';
import { downloadBlob, fileName, MAX_FILE_BYTES, parseProject } from '@/lib/project-files';
import './outputs.css';

type Shot = { scene: StageScene; url: string };
type Props = { project: StageProject; onImport: (project: StageProject) => void };

export function ExportPanel({ project, onImport }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const frames = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const job = useRef(false);
  const [snapshot, setSnapshot] = useState<StageProject | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [studentName, setStudentName] = useState('');
  const [groupName, setGroupName] = useState('');
  const [notes, setNotes] = useState<Record<string,string>>({});
  const [readyToPrint, setReadyToPrint] = useState(false);

  function open() {
    setSnapshot(structuredClone(project)); setShots([]); setError(''); setMessage(''); setReadyToPrint(false); setNotes({});
    dialog.current?.showModal();
  }
  function backup() {
    downloadBlob(new Blob([JSON.stringify(project,null,2)],{type:'application/json;charset=utf-8'}), `${fileName(project.title)}.moakit.json`);
  }
  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0]; event.target.value = '';
    if (!picked) return;
    try {
      if (picked.size > MAX_FILE_BYTES) throw new Error('작품 파일은 2MB 이하만 불러올 수 있어요.');
      const next = parseProject(await picked.text());
      if (!window.confirm('현재 화면을 불러온 작품으로 바꿀까요? 현재 작품은 먼저 파일로 보관해 주세요.')) return;
      onImport(next); setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '작품을 불러오지 못했어요.'); }
  }
  async function captureAll(): Promise<Shot[]> {
    if (!snapshot || !frames.current) throw new Error('작품을 다시 열어 주세요.');
    if (shots.length === snapshot.scenes.length) return shots;
    await document.fonts.ready;
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const { toPng, getFontEmbedCSS } = await import('html-to-image');
    const nodes = Array.from(frames.current.querySelectorAll<HTMLElement>('[data-export-scene]'));
    if (nodes.length !== snapshot.scenes.length) throw new Error('장면을 준비하지 못했어요. 다시 시도해 주세요.');
    const fontEmbedCSS = await getFontEmbedCSS(nodes[0]);
    const result: Shot[] = [];
    for (let index=0; index<nodes.length; index++) {
      setMessage(`${index+1}/${nodes.length} 장면을 그림으로 만드는 중`);
      const url = await toPng(nodes[index], {pixelRatio:2, backgroundColor:'#ffffff', fontEmbedCSS, cacheBust:false});
      const image = new Image(); image.src=url; await image.decode();
      if (image.naturalWidth < 2 || image.naturalHeight < 2) throw new Error('빈 이미지가 만들어졌어요. 다시 시도해 주세요.');
      result.push({scene:snapshot.scenes[index],url});
    }
    setShots(result); return result;
  }
  async function run(mode:'scene'|'storyboard'|'print') {
    if (job.current || !snapshot) return;
    job.current=true; setBusy(true); setError(''); setReadyToPrint(false);
    try {
      const result = await captureAll();
      if (mode === 'print') {
        setReadyToPrint(true); setMessage('기획서가 준비됐어요. 아래 인쇄 / PDF 저장을 눌러 주세요.');
      } else if (mode === 'scene') {
        const index = Math.max(0,result.findIndex(shot => shot.scene.id === snapshot.activeSceneId));
        const blob=await (await fetch(result[index].url)).blob();
        downloadBlob(blob,`${fileName(snapshot.title)}-장면${index+1}.png`); setMessage('현재 장면 PNG를 만들었어요.');
      } else {
        const columns = result.length === 1 ? 1 : 2;
        const rows = Math.ceil(result.length / columns);
        const cellWidth=1280, cellHeight=780, gap=24;
        const canvas=document.createElement('canvas'); canvas.width=columns*cellWidth+(columns+1)*gap; canvas.height=rows*cellHeight+(rows+1)*gap;
        const ctx=canvas.getContext('2d'); if (!ctx) throw new Error('이미지 도구를 시작하지 못했어요.');
        ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height);
        for (let index=0; index<result.length; index++) {
          const img=new Image(); img.src=result[index].url; await img.decode();
          const x=gap+(index%columns)*(cellWidth+gap),y=gap+Math.floor(index/columns)*(cellHeight+gap);
          ctx.drawImage(img,x,y,1280,720); ctx.fillStyle='#192238'; ctx.font='24px "S-Core Dream", sans-serif';
          ctx.fillText(`${index+1}. ${result[index].scene.title}`,x+12,y+758,1240);
        }
        const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('이미지 저장에 실패했어요.')),'image/png'));
        downloadBlob(blob,`${fileName(snapshot.title)}-전체장면.png`); setMessage('전체 장면 모음 PNG를 만들었어요.');
      }
    } catch(cause) { setError(cause instanceof Error?cause.message:'출력에 실패했어요. 작품은 그대로 보관돼 있어요.'); setMessage(''); }
    finally { job.current=false; setBusy(false); }
  }
  return <>
    <button type="button" className="secondary-button" onClick={open}>저장·출력</button>
    <button type="button" className="secondary-button" onClick={()=>file.current?.click()}>작품 불러오기</button>
    <input ref={file} type="file" accept=".json,application/json" hidden onChange={event=>void importFile(event)}/>
    {error && !dialog.current?.open ? <span className="export-error" role="alert">{error}</span>:null}
    <dialog ref={dialog} className="export-dialog" onCancel={event=>{if(busy)event.preventDefault();}}>
      <div className="export-heading"><div><small>MOAKIT PLAY / MY WORK</small><h2>작품 보관과 출력</h2></div><button type="button" aria-label="출력창 닫기" disabled={busy} onClick={()=>dialog.current?.close()}>×</button></div>
      <p className="export-intro">이미지와 기획서는 이 기기에서 만들어요. 작품 파일은 다른 기기에서 이어 만들 때 사용하세요.</p>
      <div className="export-actions">
        <button type="button" onClick={backup} disabled={busy}><strong>작품 파일 보관</strong><span>다시 편집할 수 있는 .moakit.json</span></button>
        <button type="button" onClick={()=>void run('scene')} disabled={busy}><strong>현재 장면 PNG</strong><span>배경·캐릭터·대사를 함께 저장</span></button>
        <button type="button" onClick={()=>void run('storyboard')} disabled={busy}><strong>전체 장면 PNG</strong><span>최대 6장면을 한 그림으로</span></button>
        <button type="button" onClick={()=>void run('print')} disabled={busy}><strong>A4 연극 기획서</strong><span>장면 그림·등장인물·대사·행동</span></button>
      </div>
      <div className="export-identity"><label>이름 / 모둠<input maxLength={60} value={studentName} onChange={e=>setStudentName(e.target.value)} placeholder="예: 하늘 / 별빛 모둠"/></label><label>학급 / 수업<input maxLength={60} value={groupName} onChange={e=>setGroupName(e.target.value)} placeholder="예: 2학년 1반"/></label></div>
      <p className="export-status" role="status" aria-live="polite">{message}</p>
      {error?<p className="export-error" role="alert">{error}</p>:null}
      {shots.length>0?<div className="export-previews">{shots.map((shot,index)=><section key={shot.scene.id}><strong>{index+1}. {shot.scene.title}</strong><img src={shot.url} alt={`${shot.scene.title} 출력 미리보기`}/><label>이 장면에서 할 행동<textarea maxLength={500} value={notes[shot.scene.id]??''} placeholder="예: 상자를 조심스럽게 열어 본다." onChange={e=>setNotes(n=>({...n,[shot.scene.id]:e.target.value}))}/></label></section>)}</div>:null}
      {readyToPrint?<button type="button" className="primary-button print-button" onClick={()=>window.print()}>인쇄 / PDF 저장</button>:null}
      <p className="export-footnote">기획서는 장면별로 구성됩니다. 대사가 많으면 다음 쪽으로 이어져 내용이 잘리지 않습니다. 위 이름·행동 메모는 이번 출력에만 적용됩니다.</p>
      {snapshot?<div className="export-render-host" ref={frames} aria-hidden="true">{snapshot.scenes.map(scene=><div className="export-render-frame" key={scene.id}><div className="stage-board read-only" data-export-scene={scene.id}><StageBackdrop backgroundId={scene.backgroundId}/>{scene.items.map(item=><StageItemView key={item.id} item={item}/>)}</div></div>)}</div>:null}
    </dialog>
    {snapshot && shots.length>0 && typeof document!=='undefined'?createPortal(<div className="play-print-root">
      {shots.map((shot,index)=>{
        const actors=shot.scene.items.filter(item=>item.kind==='character');
        const dialogue=shot.scene.items.filter(item=>item.kind==='speech').sort((a,b)=>a.y-b.y || a.x-b.x);
        return <article className="print-scene" key={shot.scene.id}><header><span>MOAKIT PLAY · 연극 기획서</span><span>장면 {index+1} / {shots.length}</span></header><h1>{snapshot.title || '제목 없는 작품'}</h1><p className="print-identity">이름 / 모둠: {studentName||'________________'}　 학급 / 수업: {groupName||'________________'}</p><h2>{shot.scene.title} <small>장소: {backgrounds.find(b=>b.id===shot.scene.backgroundId)?.label??shot.scene.backgroundId}</small></h2><img className="print-image" src={shot.url} alt={shot.scene.title}/><h3>등장인물과 연기</h3><p>{actors.length?actors.map(actor=>actor.kind==='character'?`${actor.data.name} (${expressions.find(e=>e.id===actor.data.expression)?.label??''} / ${poses.find(p=>p.id===actor.data.pose)?.label??''})`:'').join(' · '):'등장인물을 정해 보세요.'}</p><h3>대사와 장면 설명 <small>화면 위쪽부터 읽는 순서</small></h3>{dialogue.length?dialogue.map((item,i)=>item.kind==='speech'?<p className="print-line" key={item.id}><b>{i+1}. {item.data.variant==='thought'?'생각':item.data.variant==='caption'?'장면 설명':'대사'}</b><span>{item.data.text}</span></p>:null):<p className="print-empty">우리 장면에 어울리는 대사를 써 보세요.</p>}<h3>행동 / 무대 지시</h3><p className="print-notes">{notes[shot.scene.id]||'_______________________________________________\n_______________________________________________'}</p><footer>학생이 직접 만든 이야기 · 배경과 인물의 위치, 표정과 행동을 보며 연습해 보세요.</footer></article>;
      })}
    </div>,document.body):null}
  </>;
}
