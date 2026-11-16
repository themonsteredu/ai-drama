import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const root=process.cwd(),require=createRequire(path.join(root,'apps/play-studio/package.json')),ts=require('typescript'),temp=await fs.mkdtemp(path.join(os.tmpdir(),'play-class-'));
const original=global.fetch,env={...process.env};
try{
 async function compile(file){const to=path.join(temp,file.replace(/\.ts$/,'.js'));await fs.mkdir(path.dirname(to),{recursive:true});await fs.writeFile(to,ts.transpileModule(await fs.readFile(path.join(root,file),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText);}
 for(const f of await fs.readdir(path.join(root,'apps/play-studio/lib')))if(f.endsWith('.ts'))await compile('apps/play-studio/lib/'+f);
 await compile('packages/stage-core/src/drawing.ts');await compile('apps/play-studio/app/api/play-class/route.ts');
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://class.test';process.env.SUPABASE_SERVICE_ROLE_KEY='qa-private-secret';process.env.PLAY_SETTINGS_PIN='3035';
 const load=createRequire(path.join(temp,'entry.js')),server=load('./apps/play-studio/lib/play-class-server.js'),route=load('./apps/play-studio/app/api/play-class/route.js'),{emptyDrawingProject}=load('./apps/play-studio/lib/drawing-project.js');
 const id='10000000-0000-4000-8000-000000000001',room={id,code:'123456',title:'교실',group_count:2,is_open:true},groups=[1,2].map(n=>({class_id:id,group_no:n,revision:0,object_path:null,submitted:false}));
 let uploaded=JSON.stringify(emptyDrawingProject()),race=false,cleanup=0,otherSavedGroups=[];
 const sceneWorks=new Map();
 global.fetch=async(url,options={})=>{
  url=String(url);const b=options.body?JSON.parse(options.body):{};
  if(url.includes('/rpc/play_film_pin_attempt')||url.includes('/rpc/play_film_rate_limit'))return Response.json(true);
  if(url.includes('/rpc/play_create_class')){assert.match(b.p_code,/^\d{6}$/);return Response.json([room]);}
  if(url.includes('/rpc/play_save_group')){const g=groups[b.p_group-1];if(race||g.revision!==b.p_revision||!room.is_open)return Response.json([]);Object.assign(g,{revision:g.revision+1,object_path:b.p_path,summary:b.p_summary,submitted:b.p_submitted});return Response.json([g]);}
  if(url.includes('/rpc/play_finish_scene_submission')){
   const work=sceneWorks.get(b.p_id);
   if(!work||work.class_id!==b.p_class||work.group_no!==b.p_group)return Response.json([]);
   if(work.submitted_at)return Response.json([work]);
   if(!room.is_open)return Response.json([]);
   Object.assign(work,{title:b.p_title,scene_count:b.p_count,submitted_at:new Date().toISOString()});
   return Response.json([work]);
  }
  if(url.includes('/rest/v1/play_scene_submissions')){
   if(options.method==='POST'){
    assert(!sceneWorks.has(b.id));
    sceneWorks.set(b.id,{...b,submitted_at:null,play_classrooms:{title:room.title}});
    return new Response(null,{status:204});
   }
   const p=new URL(url).searchParams;
   if(p.has('created_at'))return Response.json([]);
   const filter=(column,value)=>!p.has(column)||p.get(column)===`eq.${value}`;
   return Response.json([...sceneWorks.values()].filter(work=>filter('id',work.id)&&filter('class_id',work.class_id)&&
     filter('group_no',work.group_no)&&(p.get('submitted_at')!=='not.is.null'||work.submitted_at)));
  }
  if(url.includes('/rest/v1/play_classrooms')){if(url.includes('code=eq.')&&!url.includes('code=eq.123456'))return Response.json([]);if(options.method==='PATCH')Object.assign(room,b);return Response.json([room]);}
  if(url.includes('/rest/v1/play_class_groups')){
   const params=new URL(url).searchParams;
   if(params.get('select')?.includes('play_classrooms!inner(title)')){
    assert.equal(params.get('object_path'),'not.is.null');
    assert.equal(params.get('order'),'class_id.asc,group_no.asc');
    const rows=[...groups.filter(g=>g.object_path).map(g=>({...g,play_classrooms:{title:room.title}})),...otherSavedGroups];
    const [,afterClassId,afterGroup]=/class_id\.gt\.([^,]+),and\(class_id\.eq\.[^,]+,group_no\.gt\.(\d+)\)\)/.exec(params.get('or')??'')??[];
    return Response.json(rows.filter(row=>!afterClassId||row.class_id>afterClassId||row.class_id===afterClassId&&row.group_no>Number(afterGroup)).slice(0,Number(params.get('limit'))));
   }
   const n=Number(/group_no=eq.(\d+)/.exec(url)?.[1]);return Response.json(n?[groups[n-1]]:groups);
  }
  if(url.includes('/rest/v1/play_class_uploads')){if(options.method==='DELETE')cleanup++;return Response.json([]);}
  if(url.includes('/object/upload/sign/'))return Response.json({url:'/object/upload/sign/opaque?token=short-lived'});
  if(url.includes('/object/sign/'))return Response.json({signedURL:'/object/sign/opaque?token=short-lived'});
  if(url.includes('/storage/v1/object/'))return new Response(uploaded, {headers:{'Content-Type':'application/json'}});
  throw new Error('Unexpected mocked URL: '+url);
 };
 const req=(body,cookie='',origin='https://play.test')=>new Request('https://play.test/api/play-class',{method:'POST',headers:{origin,cookie,'Content-Type':'application/json'},body:JSON.stringify(body)});
 const call=(body,cookie)=>route.POST(req(body,cookie));
 for(const action of ['list','create','roster','toggle','saved-projects','saved-scenes','scene-work'])assert.equal((await call({action,classId:id,groups:2,title:'수업',open:false})).status,401);
 assert.equal((await route.POST(req({action:'lookup',code:'123456'},'','https://evil.test'))).status,403);
 assert.equal((await call({action:'lookup',code:'12ab56'})).status,404);
 assert.equal((await call({action:'teacher-login',pin:'wrong'})).status,401);
 const teacher=await call({action:'teacher-login',pin:'3035'}),tc=teacher.headers.get('set-cookie').split(';')[0];assert.equal(teacher.status,200);
 assert.equal((await call({action:'create',title:'반',groups:2},tc)).status,200);
 assert.equal((await call({action:'create',title:'반',groups:13},tc)).status,400);
 const join=await call({action:'join',code:'123456',group:1}),sc=join.headers.get('set-cookie').split(';')[0];assert.equal(join.status,200);assert(join.headers.get('set-cookie').includes('HttpOnly'));
 assert.equal((await call({action:'roster',classId:id},sc)).status,401);
 assert.equal((await call({action:'saved-projects'},sc)).status,401);
 assert.equal((await call({action:'saved-projects',afterClassId:id,afterGroup:13},tc)).status,400);
 assert.deepEqual(await (await call({action:'saved-projects'},tc)).json(),{projects:[],next:null});
 assert.equal((await call({action:'work',classId:id,group:2},sc)).status,401);
 assert.equal((await call({action:'work',classId:id,group:1},sc+'tamper')).status,401);
 assert.equal((await call({action:'work',classId:id,group:1},sc)).status,200);
 assert.equal((await call({action:'work',classId:id,group:2},tc)).status,200);
 const prepareScene=(scene,fromCode=false)=>call({action:'scene-upload',...(fromCode?{code:room.code}:{classId:id}),group:1,scene,bytes:uploaded.length},fromCode?undefined:sc);
 assert.equal((await prepareScene(undefined)).status,400,'scene is required before upload');
 assert.equal((await prepareScene(6)).status,400);
 assert.equal((await call({action:'scene-upload',classId:id,group:2,scene:1,bytes:10},sc)).status,401);
 const receipts=await Promise.all([1,2,3,4,5,1].map(async (scene,index)=>{
  const prepared=await prepareScene(scene,index===0);
  assert.equal(prepared.status,200);
  return prepared.json();
 }));
 assert.equal(new Set(receipts.map(receipt=>receipt.ticket)).size,6);
 assert.equal((await call({action:'scene-submit',ticket:receipts[0].ticket+'x'})).status,401);
 const [pendingId]=sceneWorks.keys();
 assert.equal((await call({action:'scene-work',submissionId:pendingId},tc)).status,404);
 assert.deepEqual(await (await call({action:'saved-scenes',classId:id,group:1},tc)).json(),{projects:[],next:null});
 const finished=await Promise.all(receipts.map(async ({ticket})=>{
  const result=await call({action:'scene-submit',ticket});
  assert.equal(result.status,200);
  return result.json();
 }));
 assert.deepEqual(await (await call({action:'scene-submit',ticket:receipts[0].ticket})).json(),finished[0],'receipt retry does not create another scene');
 assert.equal((await call({action:'scene-work',submissionId:finished[0].id},sc)).status,401);
 assert.equal((await call({action:'saved-scenes',classId:id,group:1},sc)).status,401);
 const submittedScenes=await (await call({action:'saved-scenes',classId:id,group:1},tc)).json();
 assert.deepEqual(submittedScenes.projects.map(work=>work.scene).sort(),[1,1,2,3,4,5]);
 assert.equal((await call({action:'scene-work',submissionId:finished[0].id},tc)).status,200);
 assert.equal(groups[0].revision,0,'scene submissions do not write to the shared group');
 const pending=await (await prepareScene(2)).json();
 assert.equal((await call({action:'upload',classId:id,group:1,revision:0,bytes:50_000_001},sc)).status,413);
 const sign=await (await call({action:'upload',classId:id,group:1,revision:0,bytes:uploaded.length},sc)).json();assert(sign.url.includes('token='));assert(!JSON.stringify(sign).includes(process.env.SUPABASE_SERVICE_ROLE_KEY));
 assert.equal((await call({action:'save',classId:id,group:1,ticket:sign.ticket+'x'},sc)).status,401);
 const saved=await call({action:'save',classId:id,group:1,ticket:sign.ticket,submitted:true},sc);assert.equal(saved.status,200);assert.equal((await saved.json()).revision,1);assert.equal(groups[0].submitted,true);
 assert.equal((await call({action:'save',classId:id,group:1,ticket:sign.ticket,submitted:true},sc)).status,200,'same ticket retries are idempotent');assert.equal(groups[0].revision,1);
 assert.equal((await call({action:'upload',classId:id,group:1,revision:0,bytes:10},sc)).status,409,'stale pad cannot replace newer work');
 const next=await (await call({action:'upload',classId:id,group:1,revision:1,bytes:uploaded.length},sc)).json();
 uploaded='not a drawing';assert.equal((await call({action:'save',classId:id,group:1,ticket:next.ticket},sc)).status,400);assert.equal(groups[0].revision,1);
 uploaded=JSON.stringify(emptyDrawingProject());race=true;assert.equal((await call({action:'save',classId:id,group:1,ticket:next.ticket},sc)).status,409);race=false;
 await call({action:'toggle',classId:id,open:false},tc);assert.equal((await call({action:'save',classId:id,group:1,ticket:next.ticket},sc)).status,423);assert.equal((await call({action:'work',classId:id,group:1},sc)).status,423);assert.equal((await call({action:'work',classId:id,group:1},tc)).status,200);
 assert.equal((await call({action:'scene-submit',ticket:pending.ticket})).status,423);
 assert.deepEqual(await (await call({action:'scene-submit',ticket:receipts[0].ticket})).json(),finished[0]);
 const archiveList=await (await call({action:'saved-projects'},tc)).json();
 assert.equal(archiveList.projects.length,1,'saved works remain listed in a closed class');
 assert.deepEqual(archiveList.projects[0],{classId:id,group:1,classTitle:room.title,title:emptyDrawingProject().title,scenes:1,updatedAt:null});
 assert.equal(archiveList.next,null);
 otherSavedGroups=Array.from({length:100},(_,i)=>({
  class_id:`${id.slice(0,-3)}${String(i+2).padStart(3,'0')}`,group_no:1,
  play_classrooms:{title:'다른 수업'},summary:{},updated_at:null,
 }));
 const firstPage=await (await call({action:'saved-projects'},tc)).json();
 assert.equal(firstPage.projects.length,100);
 const lastPage=await (await call({action:'saved-projects',...firstPage.next},tc)).json();
 assert.equal(lastPage.projects.length,1);
 assert.equal(lastPage.projects[0].classId,otherSavedGroups.at(-1).class_id);
 assert.equal(lastPage.next,null);
 assert.equal(server.verify(server.token({kind:'group',classId:id,group:1,expires:Date.now()-1000}),'group'),null);
 assert.equal(server.verify(sign.ticket,'group'),null,'upload ticket never grants classroom access');
 console.log('PASS: shared group saves, five numbered scenes plus duplicate scene submissions, independent files, code and student entry, teacher-only reads, idempotent receipts, and closed-class protection.');
}finally{global.fetch=original;for(const k of Object.keys(process.env))if(!(k in env))delete process.env[k];Object.assign(process.env,env);await fs.rm(temp,{recursive:true,force:true});}
