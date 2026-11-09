'use client';
import {useEffect,useRef,useState} from 'react';
import './four-scene.css';
import './gpt-settings.css';
type Status={authenticated:boolean;configured?:boolean;updatedAt?:string;available?:boolean;model?:string};
export function GptSettings(){
 const [state,setState]=useState<Status|null>(null),[pin,setPin]=useState(''),[apiKey,setApiKey]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const lock=useRef(false);
 useEffect(()=>{let active=true;void fetch('/api/play-settings',{cache:'no-store'}).then(async r=>{if(!r.ok)throw new Error();const data=await r.json();if(active)setState(data);}).catch(()=>{if(active)setError('설정 화면에 연결하지 못했어요. 새로고침해 주세요.');});return()=>{active=false;};},[]);
 async function act(action:'login'|'save'|'test'|'logout'){
  if(lock.current)return;lock.current=true;setBusy(true);setError('');setMessage('');
  try{
   const response=await fetch('/api/play-settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...(action==='login'?{pin}:{}),...(action==='save'?{apiKey}: {})})});
   const data=await response.json();
   if(!response.ok){if(response.status===401&&action!=='login'){setState({authenticated:false});setApiKey('');}throw new Error(data.error||'설정을 저장하지 못했어요.');}
   if(action==='test')setMessage(data.message);
   else {setState(data);setPin('');setApiKey('');if(action==='save')setMessage('저장했어요. 다른 패드와 노트북에서도 이 키로 배경을 만들 수 있어요.');}
  }catch(cause){setError(cause instanceof Error?cause.message:'연결을 확인해 주세요.');}
  finally{lock.current=false;setBusy(false);}
 }
 return <main className="film-app gpt-settings-app">
  <header className="film-header"><a className="film-brand" href="/film">MOAKIT <b>PLAY</b></a><a className="gpt-back" href="/film">영상 만들기로 돌아가기</a></header>
  <section className="gpt-settings-panel"><p className="film-eyebrow">선생님 설정</p><h1>GPT API 설정</h1><p className="gpt-settings-lead">한 번 저장하면 모든 패드와 노트북에서 함께 사용해요.</p>
   {state===null?<p role="status">연결 상태를 확인하고 있어요.</p>:!state.authenticated?<form onSubmit={e=>{e.preventDefault();void act('login');}}><label htmlFor="settings-pin">설정 번호</label><input id="settings-pin" type="password" inputMode="numeric" autoComplete="off" maxLength={12} value={pin} onChange={e=>setPin(e.target.value)} disabled={busy}/><button className="film-primary" disabled={busy||!pin||state.available===false}>{busy?'확인 중…':'설정 열기'}</button>{state.available===false?<p>설정 저장소를 준비 중이에요.</p>:null}</form>:<>
    <div className="gpt-status"><span>API 키</span><strong>{state.configured?'저장됨':'아직 등록하지 않았어요'}</strong>{state.updatedAt?<small>최근 저장 {new Date(state.updatedAt).toLocaleString('ko-KR')}</small>:null}</div>
    <form onSubmit={e=>{e.preventDefault();void act('save');}}><label htmlFor="openai-key">{state.configured?'새 OpenAI API 키로 변경':'OpenAI API 키'}</label><input id="openai-key" type="password" autoComplete="off" spellCheck={false} autoCapitalize="none" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder="sk-…" disabled={busy}/><p className="gpt-key-note">키는 서버에 암호화해 저장하며, 저장 후 다시 표시하지 않아요.</p><button className="film-primary" disabled={busy||!apiKey.trim()}>{busy?'처리 중…':'키 저장'}</button></form>
    <dl className="gpt-options"><div><dt>이미지 모델</dt><dd>GPT Image 2.5 Flare</dd></div><div><dt>비용 설정</dt><dd>낮은 품질 · 1,024px · 한 번에 1장</dd></div><div><dt>시간·음악 변경</dt><dd>추가 이미지 생성 없음</dd></div></dl>
    <div className="gpt-settings-actions"><button disabled={busy||!state.configured} onClick={()=>void act('test')}>연결 확인</button><button disabled={busy} onClick={()=>void act('logout')}>설정 잠그기</button></div>
    <p className="gpt-key-note">연결 확인은 키 인증과 모델 조회만 진행해요. 이미지 생성은 별도 API 사용량으로 청구돼요.</p>
   </>}
   {message?<p className="gpt-success" role="status">{message}</p>:null}{error?<p className="film-alert" role="alert">{error}</p>:null}
  </section>
 </main>;
}
