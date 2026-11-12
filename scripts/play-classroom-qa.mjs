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
 let uploaded=JSON.stringify(emptyDrawingProject()),race=false,cleanup=0;
 global.fetch=async(url,options={})=>{
  url=String(url);const b=options.body?JSON.parse(options.body):{};
  if(url.includes('/rpc/play_film_pin_attempt')||url.includes('/rpc/play_film_rate_limit'))return Response.json(true);
  if(url.includes('/rpc/play_create_class')){assert.match(b.p_code,/^\d{6}$/);return Response.json([room]);}
  if(url.includes('/rpc/play_save_group')){const g=groups[b.p_group-1];if(race||g.revision!==b.p_revision||!room.is_open)return Response.json([]);Object.assign(g,{revision:g.revision+1,object_path:b.p_path,summary:b.p_summary,submitted:b.p_submitted});return Response.json([g]);}
  if(url.includes('/rest/v1/play_classrooms')){if(url.includes('code=eq.')&&!url.includes('code=eq.123456'))return Response.json([]);if(options.method==='PATCH')Object.assign(room,b);return Response.json([room]);}
  if(url.includes('/rest/v1/play_class_groups')){const n=Number(/group_no=eq.(\d+)/.exec(url)?.[1]);return Response.json(n?[groups[n-1]]:groups);}
  if(url.includes('/rest/v1/play_class_uploads')){if(options.method==='DELETE')cleanup++;return Response.json([]);}
  if(url.includes('/object/upload/sign/'))return Response.json({url:'/object/upload/sign/opaque?token=short-lived'});
  if(url.includes('/object/sign/'))return Response.json({signedURL:'/object/sign/opaque?token=short-lived'});
  if(url.includes('/storage/v1/object/'))return new Response(uploaded, {headers:{'Content-Type':'application/json'}});
  throw new Error('Unexpected mocked URL: '+url);
 };
 const req=(body,cookie='',origin='https://play.test')=>new Request('https://play.test/api/play-class',{method:'POST',headers:{origin,cookie,'Content-Type':'application/json'},body:JSON.stringify(body)});
 const call=(body,cookie)=>route.POST(req(body,cookie));
 for(const action of ['list','create','roster','toggle'])assert.equal((await call({action,classId:id,groups:2,title:'수업',open:false})).status,401);
 assert.equal((await route.POST(req({action:'lookup',code:'123456'},'','https://evil.test'))).status,403);
 assert.equal((await call({action:'lookup',code:'12ab56'})).status,404);
 assert.equal((await call({action:'teacher-login',pin:'wrong'})).status,401);
 const teacher=await call({action:'teacher-login',pin:'3035'}),tc=teacher.headers.get('set-cookie').split(';')[0];assert.equal(teacher.status,200);
 assert.equal((await call({action:'create',title:'반',groups:2},tc)).status,200);
 assert.equal((await call({action:'create',title:'반',groups:13},tc)).status,400);
 const join=await call({action:'join',code:'123456',group:1}),sc=join.headers.get('set-cookie').split(';')[0];assert.equal(join.status,200);assert(join.headers.get('set-cookie').includes('HttpOnly'));
 assert.equal((await call({action:'roster',classId:id},sc)).status,401);
 assert.equal((await call({action:'work',classId:id,group:2},sc)).status,401);
 assert.equal((await call({action:'work',classId:id,group:1},sc+'tamper')).status,401);
 assert.equal((await call({action:'work',classId:id,group:1},sc)).status,200);
 assert.equal((await call({action:'work',classId:id,group:2},tc)).status,200);
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
 assert.equal(server.verify(server.token({kind:'group',classId:id,group:1,expires:Date.now()-1000}),'group'),null);
 assert.equal(server.verify(sign.ticket,'group'),null,'upload ticket never grants classroom access');
 console.log('PASS: numeric class creation, teacher-only roster and collection, scoped group sessions, CSRF, invalid/expired tokens, size/format validation, idempotent saves, stale-pad conflicts, concurrent commit failure and closed-class protection. No external requests.');
}finally{global.fetch=original;for(const k of Object.keys(process.env))if(!(k in env))delete process.env[k];Object.assign(process.env,env);await fs.rm(temp,{recursive:true,force:true});}
