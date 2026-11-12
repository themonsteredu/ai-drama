import {randomInt,randomUUID,timingSafeEqual} from 'node:crypto';
import {authenticated,checkPin,sessionCookie,SettingsError,playDb as db,signPlayValue as sign,reply} from './play-ai-server';
import {parseDrawingFile} from './drawing-project';
import {movieSeconds} from './drawing-movie';
const COOKIE='moakit-play-group',BUCKET='play-class-work',LIMIT=50_000_000;
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const groupNo=(v:unknown):v is number=>Number.isInteger(v)&&Number(v)>=1&&Number(v)<=12;
type Claim={kind:string;classId:string;group:number;expires:number;path?:string;revision?:number};
export function token(claim:Claim){const body=Buffer.from(JSON.stringify(claim)).toString('base64url');return `${body}.${sign('class:'+body)}`;}
export function verify(value:string,kind:string):Claim|null{
 try{const [body,sig,...extra]=value.split('.'),expected=sign('class:'+body);if(extra.length||!sig||sig.length!==expected.length||!timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return null;const c=JSON.parse(Buffer.from(body,'base64url').toString());return c.kind===kind&&uuid(c.classId)&&groupNo(c.group)&&c.expires>Date.now()&&c.expires<=Date.now()+86400000?c:null;}catch{return null;}
}
function student(request:Request){const value=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);return value?verify(value,'group'):null;}
function cookie(value=''){return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${value?28800:0}${process.env.NODE_ENV==='production'?'; Secure':''}`;}
function teacher(request:Request){if(!authenticated(request))throw new SettingsError('교사 확인 번호로 먼저 들어가 주세요.',401);}
function scope(request:Request,body:Record<string,unknown>,allowTeacher=false){
 if(!uuid(body.classId)||!groupNo(body.group))throw new SettingsError('모둠을 다시 골라 주세요.');
 const c=student(request);if(!(allowTeacher&&authenticated(request))&&(!c||c.classId!==body.classId||c.group!==body.group))throw new SettingsError('우리 모둠으로 다시 들어가 주세요.',401);
 return {classId:body.classId,group:body.group};
}
async function room(id:string){const r=await db(`play_classrooms?id=eq.${id}&select=*`);if(!r[0])throw new SettingsError('수업을 찾지 못했어요.',404);return r[0];}
async function group(classId:string,n:number){const r=await db(`play_class_groups?class_id=eq.${classId}&group_no=eq.${n}&select=*`);if(!r[0])throw new SettingsError('모둠을 다시 골라 주세요.',404);return r[0];}
async function storage(path:string,init:RequestInit={}){
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY!,base=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const r=await fetch(`${base}/storage/v1/${path}`,{...init,headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',...init.headers},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(60000)});
 if(!r.ok)throw new SettingsError('작품 저장소에 연결하지 못했어요. 다시 저장해 주세요.',503);return r;
}
function storageUrl(relative:string){return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1${relative}`;}
async function download(path:string|null){if(!path)return null;const r=await (await storage(`object/sign/${BUCKET}/${path}`,{method:'POST',body:JSON.stringify({expiresIn:600})})).json();return storageUrl(r.signedURL);}
async function lookup(request:Request,code:unknown){
 const valid=typeof code==='string'&&/^\d{6}$/.test(code);const rows=valid?await db(`play_classrooms?code=eq.${code}&is_open=eq.true&select=*`):[];
 const ip=(request.headers.get('x-vercel-forwarded-for')||request.headers.get('x-forwarded-for')||'local').split(',')[0];
 const ok=await db('rpc/play_film_pin_attempt',{method:'POST',body:JSON.stringify({p_bucket:sign('class-join:'+ip),p_valid:!!rows.length})});
 if(!ok)throw new SettingsError('수업코드를 여러 번 잘못 입력했어요. 선생님에게 확인하고 10분 뒤 다시 해 주세요.',429);
 if(!rows[0])throw new SettingsError('열린 수업이 없어요. 숫자 6자리를 확인해 주세요.',404);return rows[0];
}
async function cleanup(classId:string,n:number,currentPath:string){
 // Keep recent versions for in-flight teacher downloads and interrupted saves.
 const old=await db(`play_class_uploads?class_id=eq.${classId}&group_no=eq.${n}&created_at=lt.${encodeURIComponent(new Date(Date.now()-86400000).toISOString())}&path=neq.${encodeURIComponent(currentPath)}&limit=50&select=path`);
 if(!old.length)return;await storage(`object/${BUCKET}`,{method:'DELETE',body:JSON.stringify({prefixes:old.map((r:{path:string})=>r.path)})});
 for(const r of old)await db(`play_class_uploads?path=eq.${encodeURIComponent(r.path)}`,{method:'DELETE'});
}
export async function classAction(request:Request,b:Record<string,unknown>):Promise<Response>{
 const action=b.action;
 if(action==='session')return reply({teacher:authenticated(request),student:student(request)});
 if(action==='teacher-login'){await checkPin(request,b.pin);return reply({teacher:true},200,{'Set-Cookie':sessionCookie()});}
 if(action==='teacher-logout')return reply({teacher:false},200,{'Set-Cookie':sessionCookie(true)});
 if(action==='leave')return reply({ok:true},200,{'Set-Cookie':cookie()});
 if(action==='lookup'){const r=await lookup(request,b.code);return reply({room:r});}
 if(action==='join'){
  const r=await lookup(request,b.code);if(!groupNo(b.group)||b.group>r.group_count)throw new SettingsError('모둠을 골라 주세요.');
  return reply({room:r,group:b.group},200,{'Set-Cookie':cookie(token({kind:'group',classId:r.id,group:b.group,expires:Date.now()+28800000}))});
 }
 if(action==='list'){teacher(request);return reply({rooms:await db('play_classrooms?select=*&order=created_at.desc&limit=100')});}
 if(action==='create'){
  teacher(request);const title=typeof b.title==='string'?b.title.trim():'';if(!title||title.length>80||!groupNo(b.groups))throw new SettingsError('수업 이름과 모둠 수를 확인해 주세요.');
  for(let i=0;i<5;i++){const rows=await db('rpc/play_create_class',{method:'POST',body:JSON.stringify({p_code:String(randomInt(100000,1000000)),p_title:title,p_groups:b.groups})});if(rows[0])return reply({room:rows[0]});}
  throw new SettingsError('수업코드를 다시 만들어 주세요.',503);
 }
 if(action==='roster'||action==='toggle'){
  teacher(request);if(!uuid(b.classId))throw new SettingsError('수업을 골라 주세요.');
  if(action==='toggle'){if(typeof b.open!=='boolean')throw new SettingsError('수업 상태를 확인해 주세요.');await db(`play_classrooms?id=eq.${b.classId}`,{method:'PATCH',body:JSON.stringify({is_open:b.open})});}
  return reply({room:await room(b.classId),groups:await db(`play_class_groups?class_id=eq.${b.classId}&select=group_no,revision,submitted,summary,updated_at&order=group_no`)});
 }
 if(action==='work'){
  const s=scope(request,b,true),r=await room(s.classId);if(!authenticated(request)&&!r.is_open)throw new SettingsError('선생님이 수업을 마쳤어요. 기기에 있는 작품은 그대로예요.',423);
  const g=await group(s.classId,s.group);return reply({room:r,group:s.group,revision:g.revision,submitted:g.submitted,url:await download(g.object_path)});
 }
 if(action==='upload'){
  const s=scope(request,b),r=await room(s.classId);if(!r.is_open)throw new SettingsError('선생님이 수업을 마쳤어요.',423);
  const g=await group(s.classId,s.group);if(b.revision!==g.revision)throw new SettingsError('다른 패드에서 저장한 새 작품이 있어요. 새 작품을 불러와 주세요. 현재 작업은 기기에 남아 있어요.',409);
  if(!Number.isInteger(b.bytes)||Number(b.bytes)<1||Number(b.bytes)>LIMIT)throw new SettingsError('모둠 작품은 50MB까지 저장할 수 있어요. 쓰지 않는 그림을 줄여 주세요.',413);
  const allowed=await db('rpc/play_film_rate_limit',{method:'POST',body:JSON.stringify({p_bucket:sign(`upload:${s.classId}:${s.group}`),p_limit:30,p_seconds:60})});if(!allowed)throw new SettingsError('저장 중이에요. 잠시 뒤 다시 눌러 주세요.',429);
  const path=`${s.classId}/${s.group}/${randomUUID()}.json`;
  const result=await (await storage(`object/upload/sign/${BUCKET}/${path}`,{method:'POST',body:'{}'})).json();
  await db('play_class_uploads',{method:'POST',body:JSON.stringify({path,class_id:s.classId,group_no:s.group})});
  return reply({url:storageUrl(result.url),ticket:token({kind:'upload',...s,path,revision:g.revision,expires:Date.now()+3600000})});
 }
 if(action==='save'){
  const s=scope(request,b),claim=typeof b.ticket==='string'?verify(b.ticket,'upload'):null;
  if(!claim||claim.classId!==s.classId||claim.group!==s.group||!claim.path)throw new SettingsError('저장 시간이 지났어요. 다시 저장해 주세요.',401);
  const existing=await group(s.classId,s.group);if(existing.object_path===claim.path)return reply({revision:existing.revision,submitted:existing.submitted}); // idempotent network retry
  if(existing.revision!==claim.revision)throw new SettingsError('다른 패드의 새 작품이 있어요. 새 작품을 불러와 주세요.',409);
  if(!(await room(s.classId)).is_open)throw new SettingsError('선생님이 수업을 마쳤어요.',423);
  const response=await storage(`object/${BUCKET}/${claim.path}`);
  if(Number(response.headers.get('content-length'))>LIMIT)throw new SettingsError('작품 용량이 커요.',413);
  const raw=await response.text();if(Buffer.byteLength(raw)>LIMIT)throw new SettingsError('작품 용량이 커요.',413);
  let project;try{project=parseDrawingFile(raw);}catch{throw new SettingsError('작품 파일을 확인해 주세요. 이전 저장은 그대로예요.');}
  const rows=await db('rpc/play_save_group',{method:'POST',body:JSON.stringify({p_class:s.classId,p_group:s.group,p_revision:claim.revision,p_path:claim.path,p_summary:{title:project.title,scenes:project.scenes.length,seconds:movieSeconds(project),voices:project.scenes.filter(sc=>!!sc.voice).length},p_submitted:b.submitted===true})});
  if(!rows[0])throw new SettingsError('다른 패드의 새 저장 또는 수업 종료가 확인됐어요. 새 작품을 불러와 주세요.',409);
  await cleanup(s.classId,s.group,claim.path).catch(()=>{});
  return reply({revision:rows[0].revision,submitted:rows[0].submitted});
 }
 throw new SettingsError('할 일을 다시 선택해 주세요.');
}
