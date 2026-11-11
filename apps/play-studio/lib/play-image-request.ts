type Options={signal?:AbortSignal;onStatus:(message:string)=>void;fetcher?:typeof fetch;wait?:(ms:number,signal?:AbortSignal)=>Promise<void>};
function pause(ms:number,signal?:AbortSignal){
 return new Promise<void>((resolve,reject)=>{
  if(signal?.aborted){reject(new DOMException('Aborted','AbortError'));return;}
  const abort=()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));};
  const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);
  signal?.addEventListener('abort',abort,{once:true});
 });
}
/** Retry only explicit pre-generation rejection. Network errors/timeouts are never replayed. */
export async function requestBackground(body:Record<string,unknown>,options:Options){
 const fetcher=options.fetcher??fetch,wait=options.wait??pause;let waited=0,providerRetries=0;
 for(let attempt=0;attempt<90;attempt++){
  options.onStatus(attempt?'차례를 확인하고 배경을 만들고 있어요…':'배경을 만들고 있어요…');
  const response=await fetcher('/api/film-background',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:options.signal});
  const data=await response.json();
  if(response.status===200&&typeof data.source==='string')return data as {source:string};
  if((response.status===202||response.status===429)&&data.retryable===true){
   if(response.status===429&&++providerRetries>8)throw new Error('요청 한도가 계속 유지되고 있어요. 그림은 그대로예요. 잠시 후 다시 눌러 주세요.');
   const base=Number(data.retryAfter),delay=Math.max(2,Number.isFinite(base)?base:20)+Math.random()*3;
   waited+=delay;if(waited>900)throw new Error('대기가 길어졌어요. 그림은 그대로예요. 잠시 후 다시 눌러 주세요.');
   options.onStatus(`요청이 몰려 대기 중이에요 · 약 ${Math.ceil(delay)}초 뒤 다시 확인해요.`);
   await wait(delay*1000,options.signal);continue;
  }
  throw new Error(data.error??'배경을 만들지 못했어요.');
 }
 throw new Error('대기가 길어졌어요. 잠시 후 다시 눌러 주세요.');
}
