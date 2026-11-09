import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const root=process.cwd(),require=createRequire(path.join(root,'apps/play-studio/package.json')),ts=require('typescript');
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'moakit-film-qa-'));
async function compile(file){const input=path.join(root,file),output=path.join(temp,file.replace(/\.ts$/,'.js'));await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,ts.transpileModule(await fs.readFile(input,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText);}
try{
 for(const file of await fs.readdir(path.join(root,'apps/play-studio/lib')))if(file.endsWith('.ts'))await compile('apps/play-studio/lib/'+file);
 await compile('packages/stage-core/src/drawing.ts');await compile('apps/play-studio/app/api/film-background/route.ts');
 const local=createRequire(path.join(temp,'entry.js'));
 const {sceneSeconds,movieSeconds}=local('./apps/play-studio/lib/drawing-movie.js');
 const {emptyFourSceneProject}=local('./apps/play-studio/lib/four-scene.js');
 const {validateDrawingProject,parseDrawingFile}=local('./apps/play-studio/lib/drawing-project.js');
 const {applyVoice}=local('./apps/play-studio/lib/drawing-voice.js');
 let p=emptyFourSceneProject();assert.equal(p.scenes.length,4);assert(validateDrawingProject(p));
 const voice={id:'voice-test',source:'data:audio/wav;base64,UklGRg==',duration:32};
 p=applyVoice(p,p.scenes[0].id,voice);assert.equal(sceneSeconds(p.scenes[0]),32.95);
 p.scenes[0].durationSeconds=40;assert.equal(sceneSeconds(p.scenes[0]),40);
 p.scenes[0].durationSeconds=2;assert.equal(sceneSeconds(p.scenes[0]),32.25,'cannot truncate dialogue');
 p.scenes[0].durationSeconds=40;assert.equal(movieSeconds(p),52);assert.equal(parseDrawingFile(JSON.stringify(p)).scenes[0].voice.duration,32);
 assert(!validateDrawingProject({...p,scenes:p.scenes.map(s=>({...s,durationSeconds:-2}))}));
 const {GET,POST}=local('./apps/play-studio/app/api/film-background/route.js');
 const existingKey=process.env.FAL_KEY,existingTeacher=process.env.TEACHER_ADMIN_CODE;
 delete process.env.FAL_KEY;delete process.env.FAL_API_KEY;delete process.env.TEACHER_ADMIN_CODE;
 assert.equal((await (await GET()).json()).configured,false);
 assert.equal((await POST(new Request('http://localhost/api/film-background',{method:'POST',body:'{}'}))).status,503);
 process.env.FAL_KEY='qa-not-a-real-key';process.env.TEACHER_ADMIN_CODE='qa-code';
 let calls=0;const previousFetch=global.fetch;
 global.fetch=async(url,options)=>{calls++;if(options?.method==='POST'){const input=JSON.parse(options.body);assert.equal(input.num_images,1);assert.equal(input.enable_prompt_expansion,false);assert.equal(input.width,undefined);assert(input.image_size.width<=960);return Response.json({status:'IN_QUEUE',status_url:'https://queue.fal.run/fal-ai/z-image/requests/test/status',response_url:'https://queue.fal.run/fal-ai/z-image/requests/test'});}if(String(url).endsWith('/status'))return Response.json({status:'COMPLETED'});return Response.json({images:[{url:'data:image/jpeg;base64,YWJj'}],has_nsfw_concepts:[false]});};
 const req=body=>new Request('http://localhost/api/film-background',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await POST(req({action:'start',code:'wrong'}))).status,401);assert.equal(calls,0);
 const started=await (await POST(req({action:'start',code:'qa-code',image:'data:image/jpeg;base64,YWJj',mask:'data:image/png;base64,YWJj',prompt:'handmade forest',width:960,height:540}))).json();assert(started.token);
 const completed=await (await POST(req({action:'check',code:'qa-code',token:started.token}))).json();assert.equal(completed.source,'data:image/jpeg;base64,YWJj');assert.equal(calls,3);
 assert.equal((await POST(req({action:'check',code:'qa-code',token:started.token+'tampered'}))).status,400);
 global.fetch=previousFetch;if(existingKey)process.env.FAL_KEY=existingKey;else delete process.env.FAL_KEY;if(existingTeacher)process.env.TEACHER_ADMIN_CODE=existingTeacher;else delete process.env.TEACHER_ADMIN_CODE;
 console.log('PASS: four scenes, imported 32-second dialogue, manual timing, no dialogue truncation, backup round trip, AI configuration/auth, one-image low-cost payload, signed polling, tamper rejection. Provider calls mocked; no paid generation.');
}finally{await fs.rm(temp,{recursive:true,force:true});}
