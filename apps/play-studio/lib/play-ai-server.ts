import {createCipheriv,createDecipheriv,createHash,createHmac,hkdfSync,randomBytes,timingSafeEqual} from 'node:crypto';

export const IMAGE_MODEL='gpt-image-2.5-flare';
export const SESSION_COOKIE='moakit-play-settings';
const SESSION_SECONDS=1800;
export class SettingsError extends Error {
 constructor(message:string,public status=400,public retryAfter=0){super(message);}
}
export function reply(value:unknown,status=200,headers:Record<string,string>={}){
 return Response.json(value,{status,headers:{'Cache-Control':'no-store',...headers}});
}
export function ready(){return !!process.env.NEXT_PUBLIC_SUPABASE_URL&&!!process.env.SUPABASE_SERVICE_ROLE_KEY&&!!process.env.PLAY_SETTINGS_PIN;}
function serverSecret(){const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!key)throw new SettingsError('설정 저장소에 연결하지 못했어요.',503);return key;}
function mac(value:string){return createHmac('sha256',serverSecret()).update(`moakit-play:${value}`).digest('base64url');}
function equal(a:string,b:string){return timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest());}
export function sessionCookie(clear=false){
 const data=`${Date.now()+SESSION_SECONDS*1000}.${randomBytes(16).toString('hex')}`;
 return `${SESSION_COOKIE}=${clear?'':`${data}.${mac(data)}`}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear?0:SESSION_SECONDS}${process.env.NODE_ENV==='production'?'; Secure':''}`;
}
export function authenticated(request:Request){
 if(!ready())return false;
 const value=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length+1);
 if(!value)return false;
 const [expires,nonce,signature,...extra]=value.split('.');
 return extra.length===0&&!!signature&&Number(expires)>Date.now()&&Number(expires)<=Date.now()+SESSION_SECONDS*1000&&equal(signature,mac(`${expires}.${nonce}`));
}
export function sameOrigin(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)throw new SettingsError('PLAY 화면에서 다시 요청해 주세요.',403);
}
export async function readBody(request:Request,limit=4096){
 if(Number(request.headers.get('content-length'))>limit)throw new SettingsError('요청 용량이 너무 커요.',413);
 const raw=await request.text();if(raw.length>limit)throw new SettingsError('요청 용량이 너무 커요.',413);
 try{return JSON.parse(raw) as Record<string,unknown>;}catch{throw new SettingsError('입력 내용을 확인해 주세요.');}
}
async function db(path:string,init:RequestInit={}){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 if(!url)throw new SettingsError('설정 저장소에 연결하지 못했어요.',503);
 const key=serverSecret();
 const response=await fetch(`${url}/rest/v1/${path}`,{...init,headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal',...init.headers},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new SettingsError('설정을 저장하거나 불러오지 못했어요. 잠시 후 다시 해 주세요.',503);
 return response.status===204?null:response.text().then(v=>v?JSON.parse(v):null);
}
export async function limitRequests(request:Request,kind:'login'|'generate'|'settings'|'voice'){
 const ip=(request.headers.get('x-vercel-forwarded-for')||request.headers.get('x-forwarded-for')||'local').split(',')[0].trim();
 // A classroom shares one public IP. Verified browser sessions must not use
 // up each other's allowance; unsuccessful PIN attempts still share an IP cap.
 const session=authenticated(request)?request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(`${SESSION_COOKIE}=`)):undefined;
 const bucket=mac(`${kind}:${kind!=='login'&&session?session:ip}`),limit=kind==='login'?8:kind==='generate'?60:kind==='voice'?100:20,seconds=kind==='voice'?300:600;
 const allowed=await db('rpc/play_film_rate_limit',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({p_bucket:bucket,p_limit:limit,p_seconds:seconds})});
 if(allowed!==true)throw new SettingsError(kind==='login'?'확인 번호를 여러 번 잘못 입력했어요. 번호를 확인해 주세요.':'요청이 몰려 잠시 대기하고 있어요.',429,kind==='generate'||kind==='voice'?60:0);
}
/** Shared pacing works across serverless instances, using the existing atomic RPC. */
export async function claimBackgroundTurn(){
 return await db('rpc/play_film_rate_limit',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({p_bucket:mac('background-starts-v1'),p_limit:2,p_seconds:10})})===true;
}
export async function checkPin(request:Request,pin:unknown){
 if(!ready())throw new SettingsError('설정 저장소를 준비 중이에요.',503);
 const valid=typeof pin==='string'&&pin.length<=32&&equal(pin,process.env.PLAY_SETTINGS_PIN!);
 const ip=(request.headers.get('x-vercel-forwarded-for')||request.headers.get('x-forwarded-for')||'local').split(',')[0].trim();
 const allowed=await db('rpc/play_film_pin_attempt',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({p_bucket:mac(`login:${ip}`),p_valid:valid})});
 if(allowed!==true)throw new SettingsError('확인 번호를 여러 번 잘못 입력했어요. 10분 뒤 다시 확인해 주세요.',429);
 if(!valid)throw new SettingsError('설정 번호가 맞지 않아요.',401);
}
export async function authorizeGeneration(request:Request,pin:unknown,kind:'generate'|'voice'='generate',countRequest=true){
 if(!authenticated(request))await checkPin(request,pin);
 if(countRequest)await limitRequests(request,kind);
}
function encryptionKey(){return Buffer.from(hkdfSync('sha256',serverSecret(),'moakit-play','film-api-key-v1',32));}
export function encryptKey(value:string){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',encryptionKey(),iv);
 const data=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
 return ['v1',iv.toString('base64'),cipher.getAuthTag().toString('base64'),data.toString('base64')].join('.');
}
export function decryptKey(value:string){
 try{const [version,iv,tag,data]=value.split('.');if(version!=='v1')throw new Error();const cipher=createDecipheriv('aes-256-gcm',encryptionKey(),Buffer.from(iv,'base64'));cipher.setAuthTag(Buffer.from(tag,'base64'));return Buffer.concat([cipher.update(Buffer.from(data,'base64')),cipher.final()]).toString('utf8');}
 catch{throw new SettingsError('저장된 키를 읽지 못했어요. 설정에서 API 키를 다시 저장해 주세요.',503);}
}
export async function keyStatus(){
 const rows=await db('play_film_ai_credentials?id=eq.openai&select=updated_at');
 return {configured:rows.length>0,updatedAt:rows[0]?.updated_at??null,model:IMAGE_MODEL,quality:'low'};
}
export async function saveApiKey(value:unknown){
 if(typeof value!=='string'||!/^sk-[A-Za-z0-9_-]{20,400}$/.test(value.trim()))throw new SettingsError('OpenAI API 키 형식을 확인해 주세요.');
 await db('play_film_ai_credentials',{method:'POST',body:JSON.stringify({id:'openai',encrypted_key:encryptKey(value.trim()),updated_at:new Date().toISOString()})});
}
export async function savedApiKey(){
 const rows=await db('play_film_ai_credentials?id=eq.openai&select=encrypted_key');
 if(!rows.length)throw new SettingsError('GPT API 설정에서 키를 먼저 저장해 주세요.',503);
 return decryptKey(rows[0].encrypted_key);
}
export function failure(error:unknown){return error instanceof SettingsError?reply({error:error.message,...(error.retryAfter?{retryable:true,retryAfter:error.retryAfter}:{})},error.status,error.retryAfter?{'Retry-After':String(error.retryAfter)}:{}):reply({error:'연결을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.'},503);}

// Shared only with server routes; never import this module from a client component.
export {db as playDb,mac as signPlayValue};
