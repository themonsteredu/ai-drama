import {randomInt,randomUUID,timingSafeEqual} from 'node:crypto';
import {authenticated,checkPin,sessionCookie,SettingsError,playDb as db,signPlayValue as sign,reply} from './play-ai-server';
import {parseDrawingFile} from './drawing-project';
import {movieSeconds} from './drawing-movie';
import type {ClassGroup, SavedClassPage} from './play-class-client';
import {isClassSceneNumber, type ClassSceneNumber, type SavedScenePage} from './play-class-scenes';
const COOKIE='moakit-play-group',BUCKET='play-class-work',LIMIT=50_000_000;
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const groupNo=(v:unknown):v is number=>Number.isInteger(v)&&Number(v)>=1&&Number(v)<=12;
type Claim={kind:string;classId:string;group:number;expires:number;path?:string;revision?:number;submissionId?:string;scene?:ClassSceneNumber};
type AfterResponse = (task: () => Promise<void>) => void;
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
function teacherRooms(){return db('play_classrooms?select=*&order=created_at.desc&limit=100');}
async function group(classId:string,n:number){const r=await db(`play_class_groups?class_id=eq.${classId}&group_no=eq.${n}&select=*`);if(!r[0])throw new SettingsError('모둠을 다시 골라 주세요.',404);return r[0];}

type SavedGroupRow = Pick<ClassGroup, 'group_no' | 'summary' | 'updated_at'> & {
 class_id: string;
 play_classrooms: {title: string};
};

async function savedProjects(afterClassId: unknown, afterGroup: unknown): Promise<SavedClassPage> {
 let cursor = '';
 if (afterClassId !== undefined || afterGroup !== undefined) {
  if (!uuid(afterClassId) || !groupNo(afterGroup)) throw new SettingsError('작품 목록을 다시 열어 주세요.');
  cursor = `&or=(class_id.gt.${afterClassId},and(class_id.eq.${afterClassId},group_no.gt.${afterGroup}))`;
 }
 const pageSize = 100;
 const rows: SavedGroupRow[] = await db(
  `play_class_groups?select=class_id,group_no,summary,updated_at,play_classrooms!inner(title)` +
  `&object_path=not.is.null&order=class_id.asc,group_no.asc&limit=${pageSize + 1}${cursor}`,
 );
 const projects = rows.slice(0, pageSize).map(row => ({
  classId: row.class_id,
  group: row.group_no,
  classTitle: row.play_classrooms.title,
  title: row.summary?.title || `${row.group_no}모둠 이야기`,
  scenes: row.summary?.scenes ?? null,
  updatedAt: row.updated_at ?? null,
 }));
 const last = projects.at(-1);
 return {projects, next: last && rows.length > pageSize ? {afterClassId: last.classId, afterGroup: last.group} : null};
}

async function storage(path:string,init:RequestInit={}){
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY!,base=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const r=await fetch(`${base}/storage/v1/${path}`,{...init,headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',...init.headers},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(60000)});
 if(!r.ok)throw new SettingsError('작품 저장소에 연결하지 못했어요. 다시 저장해 주세요.',503);return r;
}
function storageUrl(relative:string){return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1${relative}`;}
async function download(path:string|null){if(!path)return null;const r=await (await storage(`object/sign/${BUCKET}/${path}`,{method:'POST',body:JSON.stringify({expiresIn:600})})).json();return storageUrl(r.signedURL);}

async function uploadUrl(path: string) {
 const result = await (await storage(`object/upload/sign/${BUCKET}/${path}`, {method: 'POST', body: '{}'})).json();
 return storageUrl(result.url);
}

async function readStoredProject(path: string) {
 const response = await storage(`object/${BUCKET}/${path}`);
 if (Number(response.headers.get('content-length')) > LIMIT) throw new SettingsError('작품 용량이 커요.', 413);
 const raw = await response.text();
 if (Buffer.byteLength(raw) > LIMIT) throw new SettingsError('작품 용량이 커요.', 413);
 try {
  return parseDrawingFile(raw);
 } catch {
  throw new SettingsError('작품 파일을 읽지 못했어요. 작품을 다시 확인해 주세요.');
 }
}

async function lookup(request:Request,code:unknown){
 const valid=typeof code==='string'&&/^\d{6}$/.test(code);const rows=valid?await db(`play_classrooms?code=eq.${code}&is_open=eq.true&select=*`):[];
 const ip=(request.headers.get('x-vercel-forwarded-for')||request.headers.get('x-forwarded-for')||'local').split(',')[0];
 const ok=await db('rpc/play_film_pin_attempt',{method:'POST',body:JSON.stringify({p_bucket:sign('class-join:'+ip),p_valid:!!rows.length})});
 if(!ok)throw new SettingsError('수업코드를 여러 번 잘못 입력했어요. 선생님에게 확인하고 10분 뒤 다시 해 주세요.',429);
 if(!rows[0])throw new SettingsError('열린 수업이 없어요. 숫자 6자리를 확인해 주세요.',404);return rows[0];
}

type SceneRow = {
 id: string; class_id: string; group_no: number; scene_no: ClassSceneNumber;
 title: string; scene_count: number; submitted_at: string;
 play_classrooms: {title: string};
};

const scenePath = (classId: string, group: number, id: string) => `scenes/${classId}/${group}/${id}.json`;

async function savedScenes(b: Record<string, unknown>): Promise<SavedScenePage> {
 const {classId, group, afterId} = b;
 if ((classId !== undefined && !uuid(classId)) || (group !== undefined && (!groupNo(group) || !uuid(classId))) ||
     (afterId !== undefined && !uuid(afterId))) throw new SettingsError('수업이나 모둠을 다시 골라 주세요.');
 const filters = `${classId === undefined ? '' : `&class_id=eq.${classId}`}` +
  `${group === undefined ? '' : `&group_no=eq.${group}`}${afterId === undefined ? '' : `&id=gt.${afterId}`}`;
 const pageSize = 100;
 const rows: SceneRow[] = await db(
  'play_scene_submissions?select=id,class_id,group_no,scene_no,title,scene_count,submitted_at,play_classrooms!inner(title)' +
  `&submitted_at=not.is.null&superseded_at=is.null&order=id.asc&limit=${pageSize + 1}${filters}`,
 );
 const projects = rows.slice(0, pageSize).map(row => ({
  id: row.id, classId: row.class_id, classTitle: row.play_classrooms.title, group: row.group_no,
  scene: row.scene_no, title: row.title, scenes: row.scene_count, updatedAt: row.submitted_at,
 }));
 return {projects, next: rows.length > pageSize ? projects[pageSize - 1].id : null};
}

async function sceneUploadScope(request: Request, body: Record<string, unknown>) {
 if (body.code !== undefined) {
  const target = await lookup(request, body.code);
  if (!groupNo(body.group) || body.group > target.group_count) throw new SettingsError('모둠을 다시 골라 주세요.');
  return {classId: target.id as string, group: body.group};
 }
 return scope(request, body);
}

async function cleanupSceneUploads(classId: string, group: number) {
 // Both the signed upload link and the submission ticket have expired by this point.
 const before = encodeURIComponent(new Date(Date.now() - 86_400_000).toISOString());
 const expired = `play_scene_submissions?class_id=eq.${classId}&group_no=eq.${group}` +
  `&or=(and(submitted_at.is.null,created_at.lt.${before}),superseded_at.lt.${before})`;
 const rows: {id: string}[] = await db(`${expired}&select=id&limit=20`);
 if (!rows.length) return;
 await storage(`object/${BUCKET}`, {method: 'DELETE', body: JSON.stringify({prefixes: rows.map(row => scenePath(classId, group, row.id))})});
 await db(`${expired}&id=in.(${rows.map(row => row.id).join(',')})`, {method: 'DELETE'});
}

async function startSceneUpload(request: Request, body: Record<string, unknown>, afterResponse?: AfterResponse) {
 const scene = body.scene;
 if (!isClassSceneNumber(scene)) throw new SettingsError('보낼 장면 번호를 골라 주세요.');
 if (!Number.isInteger(body.bytes) || Number(body.bytes) < 1 || Number(body.bytes) > LIMIT) {
  throw new SettingsError('작품은 50MB까지 보낼 수 있어요.', 413);
 }
 const s = await sceneUploadScope(request, body);
 const submissionId = randomUUID();
 const [status, url] = await Promise.all([
  db('rpc/play_reserve_scene_submission', {method: 'POST', headers: {Prefer: 'return=representation'}, body: JSON.stringify({
   p_id: submissionId, p_class: s.classId, p_group: s.group, p_scene: scene,
   p_bucket: sign(`scene-upload:${s.classId}:${s.group}`),
  })}),
  uploadUrl(scenePath(s.classId, s.group, submissionId)),
 ]);
 if (status === 'closed') throw new SettingsError('선생님이 수업을 마쳤어요.', 423);
 if (status === 'missing-group') throw new SettingsError('모둠을 다시 골라 주세요.', 404);
 if (status === 'rate-limited') throw new SettingsError('보내는 작품이 많아요. 잠시 뒤 다시 눌러 주세요.', 429);
 if (status !== 'ok') throw new SettingsError('작품을 보낼 준비를 마치지 못했어요. 다시 눌러 주세요.', 503);
 afterResponse?.(() => cleanupSceneUploads(s.classId, s.group).catch(() => {}));
 return reply({url, ticket: token({kind: 'scene-upload', ...s, submissionId, scene, expires: Date.now() + 3_600_000})});
}

async function submitScene(ticket: unknown) {
 const claim = typeof ticket === 'string' ? verify(ticket, 'scene-upload') : null;
 if (!claim || !uuid(claim.submissionId)) throw new SettingsError('보내는 시간이 지났어요. 다시 보내 주세요.', 401);
 const {classId, group, submissionId} = claim;
 let scene = claim.scene;
 // Receipts issued before the rollout are still valid for their original lifetime.
 if (!isClassSceneNumber(scene)) {
  const [existing]: {id: string; submitted_at: string | null; superseded_at: string | null; scene_no: ClassSceneNumber}[] = await db(
   `play_scene_submissions?id=eq.${submissionId}&class_id=eq.${classId}&group_no=eq.${group}&select=id,submitted_at,superseded_at,scene_no`,
  );
  if (!existing) throw new SettingsError('보낼 작품을 다시 골라 주세요.', 404);
  if (existing.submitted_at) return reply({id: existing.id, submittedAt: existing.submitted_at, isLatest: !existing.superseded_at});
  scene = existing.scene_no;
 }
 const project = await readStoredProject(scenePath(classId, group, submissionId));
 const [saved]: {id: string; submitted_at: string; superseded_at: string | null}[] = await db('rpc/play_finish_scene_submission', {
  method: 'POST', headers: {Prefer: 'return=representation'}, body: JSON.stringify({
   p_id: submissionId, p_class: classId, p_group: group,
   p_title: project.title.trim() || `장면${scene}`, p_count: project.scenes.length,
  }),
 });
 if (!saved) throw new SettingsError('선생님이 수업을 마쳤어요. 기기에 보관된 작품에서 다시 보낼 수 있어요.', 423);
 return reply({id: saved.id, submittedAt: saved.submitted_at, isLatest: !saved.superseded_at});
}

async function cleanup(classId:string,n:number,currentPath:string){
 // Keep recent versions for in-flight teacher downloads and interrupted saves.
 const old=await db(`play_class_uploads?class_id=eq.${classId}&group_no=eq.${n}&created_at=lt.${encodeURIComponent(new Date(Date.now()-86400000).toISOString())}&path=neq.${encodeURIComponent(currentPath)}&limit=50&select=path`);
 if(!old.length)return;await storage(`object/${BUCKET}`,{method:'DELETE',body:JSON.stringify({prefixes:old.map((r:{path:string})=>r.path)})});
 for(const r of old)await db(`play_class_uploads?path=eq.${encodeURIComponent(r.path)}`,{method:'DELETE'});
}
export async function classAction(request:Request,b:Record<string,unknown>,afterResponse?:AfterResponse):Promise<Response>{
 const action=b.action;
 if(action==='session'){
  const current=student(request);
  const isTeacher=authenticated(request);
  const [currentRoom,rooms]=await Promise.all([
   b.includeRoom===true&&current?room(current.classId):undefined,
   b.includeRooms===true&&isTeacher?teacherRooms():undefined,
  ]);
  return reply({teacher:isTeacher,student:current,room:currentRoom,rooms});
 }
 if(action==='teacher-login'){
  await checkPin(request,b.pin);
  const rooms=b.includeRooms===true?await teacherRooms():undefined;
  return reply({teacher:true,rooms},200,{'Set-Cookie':sessionCookie()});
 }
 if(action==='teacher-logout')return reply({teacher:false},200,{'Set-Cookie':sessionCookie(true)});
 if(action==='leave')return reply({ok:true},200,{'Set-Cookie':cookie()});
 if(action==='lookup'){const r=await lookup(request,b.code);return reply({room:r});}
 if(action==='join'){
  const r=await lookup(request,b.code);if(!groupNo(b.group)||b.group>r.group_count)throw new SettingsError('모둠을 골라 주세요.');
  return reply({room:r,group:b.group},200,{'Set-Cookie':cookie(token({kind:'group',classId:r.id,group:b.group,expires:Date.now()+28800000}))});
 }
 if (action === 'student-room') {
  const s = scope(request, b);
  return reply({room: await room(s.classId)});
 }
 if (action === 'scene-upload') return startSceneUpload(request, b, afterResponse);
 if (action === 'scene-submit') return submitScene(b.ticket);
 if (action === 'saved-scenes') {
  teacher(request);
  return reply(await savedScenes(b));
 }
 if (action === 'scene-work') {
  teacher(request);
  if (!uuid(b.submissionId)) throw new SettingsError('장면을 다시 골라 주세요.');
  const [work]: {id: string; class_id: string; group_no: number}[] = await db(
   `play_scene_submissions?id=eq.${b.submissionId}&submitted_at=not.is.null&superseded_at=is.null&select=id,class_id,group_no`,
  );
  if (!work) throw new SettingsError('제출된 장면을 찾지 못했어요.', 404);
  return reply({url: await download(scenePath(work.class_id, work.group_no, work.id))});
 }
 if(action==='list'){teacher(request);return reply({rooms:await teacherRooms()});}
 if (action === 'saved-projects') {
  teacher(request);
  return reply(await savedProjects(b.afterClassId, b.afterGroup));
 }
 if(action==='create'){
  teacher(request);const title=typeof b.title==='string'?b.title.trim():'';if(!title||title.length>80||!groupNo(b.groups))throw new SettingsError('수업 이름과 모둠 수를 확인해 주세요.');
  for(let i=0;i<5;i++){const rows=await db('rpc/play_create_class',{method:'POST',body:JSON.stringify({p_code:String(randomInt(100000,1000000)),p_title:title,p_groups:b.groups})});if(rows[0])return reply({room:rows[0]});}
  throw new SettingsError('수업코드를 다시 만들어 주세요.',503);
 }
 if(action==='roster'||action==='toggle'){
  teacher(request);if(!uuid(b.classId))throw new SettingsError('수업을 골라 주세요.');
  if(action==='toggle'){if(typeof b.open!=='boolean')throw new SettingsError('수업 상태를 확인해 주세요.');await db(`play_classrooms?id=eq.${b.classId}`,{method:'PATCH',body:JSON.stringify({is_open:b.open})});}
  const [classroom,groups]=await Promise.all([room(b.classId),db(`play_class_groups?class_id=eq.${b.classId}&select=group_no,revision,submitted,summary,updated_at&order=group_no`)]);
  return reply({room:classroom,groups});
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
  const url=await uploadUrl(path);
  await db('play_class_uploads',{method:'POST',body:JSON.stringify({path,class_id:s.classId,group_no:s.group})});
  return reply({url,ticket:token({kind:'upload',...s,path,revision:g.revision,expires:Date.now()+3600000})});
 }
 if(action==='save'){
  const s=scope(request,b),claim=typeof b.ticket==='string'?verify(b.ticket,'upload'):null;
  if(!claim||claim.classId!==s.classId||claim.group!==s.group||!claim.path)throw new SettingsError('저장 시간이 지났어요. 다시 저장해 주세요.',401);
  const existing=await group(s.classId,s.group);if(existing.object_path===claim.path)return reply({revision:existing.revision,submitted:existing.submitted}); // idempotent network retry
  if(existing.revision!==claim.revision)throw new SettingsError('다른 패드의 새 작품이 있어요. 새 작품을 불러와 주세요.',409);
  if(!(await room(s.classId)).is_open)throw new SettingsError('선생님이 수업을 마쳤어요.',423);
  const project=await readStoredProject(claim.path);
  const rows=await db('rpc/play_save_group',{method:'POST',body:JSON.stringify({p_class:s.classId,p_group:s.group,p_revision:claim.revision,p_path:claim.path,p_summary:{title:project.title,scenes:project.scenes.length,seconds:movieSeconds(project),voices:project.scenes.filter(sc=>!!sc.voice).length},p_submitted:b.submitted===true})});
  if(!rows[0])throw new SettingsError('다른 패드의 새 저장 또는 수업 종료가 확인됐어요. 새 작품을 불러와 주세요.',409);
  await cleanup(s.classId,s.group,claim.path).catch(()=>{});
  return reply({revision:rows[0].revision,submitted:rows[0].submitted});
 }
 throw new SettingsError('할 일을 다시 선택해 주세요.');
}
