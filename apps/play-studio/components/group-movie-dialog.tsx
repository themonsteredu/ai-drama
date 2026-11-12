'use client';
import {useEffect,useRef,useState} from 'react';
import {GROUP_MOVIE_LIMIT,joinGroupMovies,moveGroupMovie,readGroupMovie,type GroupMovie} from '@/lib/group-movie';
import {clockLabel,movieSupported} from '@/lib/drawing-movie';
import {downloadBlob,fileName} from '@/lib/project-files';
import './group-movie.css';

export function GroupMovieDialog({onClose}:{onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),input=useRef<HTMLInputElement>(null),clipsRef=useRef<GroupMovie[]>([]),controller=useRef<AbortController|null>(null),lock=useRef(false),alive=useRef(true);
 const [clips,setClips]=useState<GroupMovie[]>([]),[title,setTitle]=useState('우리 반 이야기'),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[ratio,setRatio]=useState(0),[status,setStatus]=useState(''),[error,setError]=useState(''),[supported,setSupported]=useState(true),[preview,setPreview]=useState<string>();
 const disabled=busy||loading,total=clips.reduce((n,c)=>n+c.seconds,0);
 const change=(next:GroupMovie[])=>{clipsRef.current=next;setClips(next);setStatus('');};
 useEffect(()=>{alive.current=true;const previous=document.activeElement as HTMLElement|null;dialog.current?.showModal();setSupported(movieSupported());return()=>{alive.current=false;controller.current?.abort();clipsRef.current.forEach(c=>URL.revokeObjectURL(c.url));previous?.focus();};},[]);
 async function add(files:File[]){
  if(lock.current)return;lock.current=true;setLoading(true);setError('');
  const added:GroupMovie[]=[];
  try{
   if(files.length+clipsRef.current.length>GROUP_MOVIE_LIMIT)throw new Error(`영상은 ${GROUP_MOVIE_LIMIT}개까지 모을 수 있어요.`);
   if([...clipsRef.current.map(c=>c.file),...files].reduce((n,f)=>n+f.size,0)>600_000_000)throw new Error('한 번에 모을 영상은 전체 600MB 이하로 골라 주세요.');
   for(const file of files){const clip=await readGroupMovie(file);added.push(clip);if(!alive.current)throw new Error('closed');}
   if(total+added.reduce((n,c)=>n+c.seconds,0)>3600)throw new Error('모든 영상을 합해 60분 이하로 골라 주세요.');
   change([...clipsRef.current,...added]);
  }catch(cause){added.forEach(c=>URL.revokeObjectURL(c.url));if(alive.current)setError(cause instanceof Error?cause.message:'영상을 읽지 못했어요.');}
  finally{lock.current=false;if(alive.current)setLoading(false);}
 }
 function remove(id:string){const clip=clips.find(c=>c.id===id);if(!clip)return;if(preview===id)setPreview(undefined);change(clips.filter(c=>c.id!==id));URL.revokeObjectURL(clip.url);}
 async function save(){
  if(lock.current)return;lock.current=true;setBusy(true);setPreview(undefined);setError('');setStatus('');setRatio(0);controller.current=new AbortController();
  try{const movie=await joinGroupMovies(clips,(value,message)=>{if(alive.current){setRatio(value);setStatus(message);}},controller.current.signal);if(alive.current){downloadBlob(movie.blob,`${fileName(title)}.${movie.extension}`);setStatus('하나로 합친 영상을 저장했어요. 다운로드에서 확인해 주세요.');}}
  catch(cause){if(alive.current)setError(cause instanceof Error?cause.message:'영상을 합치지 못했어요.');}
  finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 const selected=clips.find(c=>c.id===preview);
 return <dialog ref={dialog} className="group-movie-dialog" aria-labelledby="group-movie-title" onCancel={e=>{if(disabled)e.preventDefault();else onClose();}}>
  <header><div><h2 id="group-movie-title">모둠 영상 합치기</h2><p>각 패드에서 저장한 영상을 이 기기에 모아 주세요.</p></div><button disabled={disabled} onClick={onClose} aria-label="모둠 영상 창 닫기">닫기</button></header>
  <ol className="group-movie-steps"><li>영상 넣기</li><li>순서 정하기</li><li>하나로 저장</li></ol>
  <label className="group-movie-title">영상 제목<input aria-label="합친 영상 제목" maxLength={80} value={title} disabled={disabled} onChange={e=>setTitle(e.target.value)}/></label>
  <button className="group-movie-add" disabled={disabled} onClick={()=>input.current?.click()}>{loading?'영상을 읽고 있어요…':'+ 모둠 영상 넣기'}</button>
  <input ref={input} hidden type="file" multiple accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v" onChange={e=>{const files=Array.from(e.target.files??[]);e.target.value='';if(files.length)void add(files);}}/>
  {!clips.length?<p className="group-movie-empty">모둠마다 ‘영상 저장하기’로 저장한 파일을 넣어요.<br/>MP4·WebM · 최대 30개</p>:<ol className="group-movie-list" aria-label="모둠 영상 순서">{clips.map((clip,index)=><li key={clip.id}><b>{index+1}</b><div><strong>{clip.name}</strong><small>{clockLabel(clip.seconds)}</small></div><div className="group-movie-order"><button aria-label={`${clip.name} 위로`} disabled={disabled||index===0} onClick={()=>change(moveGroupMovie(clips,index,-1))}>위로</button><button aria-label={`${clip.name} 아래로`} disabled={disabled||index===clips.length-1} onClick={()=>change(moveGroupMovie(clips,index,1))}>아래로</button></div><button disabled={disabled} aria-label={`${clip.name} 보기`} onClick={()=>setPreview(preview===clip.id?undefined:clip.id)}>보기</button><button disabled={disabled} aria-label={`${clip.name} 빼기`} onClick={()=>remove(clip.id)}>빼기</button></li>)}</ol>}
  {selected?<video key={selected.id} className="group-movie-preview" src={selected.url} controls playsInline aria-label={`${selected.name} 영상 미리보기`}/>:null}
  <p className="group-movie-summary">영상 <strong>{clips.length}개</strong> · 모두 <strong>{clockLabel(total)}</strong><span>대사와 음악을 그대로 이어 붙여요. 파일은 이 기기에서만 처리해요.</span></p>
  {!supported?<p role="alert">이 기기에서는 합쳐 저장할 수 없어요. 컴퓨터의 Chrome에서 열어 주세요.</p>:null}
  <button className="group-movie-save" disabled={disabled||!supported||clips.length<2} onClick={()=>void save()}>{busy?'영상을 합치고 있어요…':'하나의 영상으로 저장'}</button>
  <p className="group-movie-note">영상 길이만큼 시간이 걸려요. 저장하는 동안 화면을 켜 두세요.</p>
  {busy?<><progress max={1} value={ratio}/><button onClick={()=>controller.current?.abort()}>합치기 그만하기</button></>:null}
  {status?<p role="status">{status}</p>:null}{error?<p className="group-movie-error" role="alert">{error}</p>:null}
 </dialog>;
}
