import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {EventEmitter} from 'node:events';
const root=process.cwd(),require=createRequire(path.join(root,'apps/play-studio/package.json')),ts=require('typescript');
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'moakit-narration-qa-')),originalFetch=global.fetch,env={...process.env};
const wsPath=require.resolve('ws');require('ws');const originalWs=require.cache[wsPath].exports;
try{
 async function compile(file){const output=path.join(temp,file.replace(/\.ts$/,'.js'));await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,ts.transpileModule(await fs.readFile(path.join(root,file),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText);}
 for(const file of await fs.readdir(path.join(root,'apps/play-studio/lib')))if(file.endsWith('.ts'))await compile('apps/play-studio/lib/'+file);
 await compile('packages/stage-core/src/drawing.ts');await compile('apps/play-studio/app/api/film-dialogue/route.ts');
 await fs.symlink(path.join(root,'apps/play-studio/node_modules'),path.join(temp,'node_modules'),'dir');
 const local=createRequire(path.join(temp,'entry.js'));
 const {emptyFourSceneProject}=local('./apps/play-studio/lib/four-scene.js');
 const {validateDrawingProject,parseDrawingFile}=local('./apps/play-studio/lib/drawing-project.js');
 const {addNarration,narrationDurations,setNarrationBoundary,activeNarration,dialogueKey,wavBytes,addDialogueSpeaker,removeDialogueSpeaker}=local('./apps/play-studio/lib/film-narration.js');
 const {movieSeconds,movieTimeline}=local('./apps/play-studio/lib/drawing-movie.js');
 const {selectedCharacterPixels,actorPlacement}=local('./apps/play-studio/lib/scene-character.js');
 const originalPixels=new Uint8ClampedArray([1,2,3,255,40,50,60,255,70,80,90,128,4,5,6,255]);
 const marks=new Uint8ClampedArray([255,255,255,255,0,0,0,255,0,0,0,255,255,255,255,255]);
 const cut=selectedCharacterPixels(originalPixels,marks,4,1);assert.equal(cut.left,1);assert.equal(cut.width,2);assert.deepEqual([...cut.data.slice(4,12)],[40,50,60,255,70,80,90,128]);assert.equal(cut.data[3],0);assert.equal(cut.data[15],0);assert.equal(originalPixels[3],255,'original pixels untouched');
 const placement=actorPlacement({backgroundFit:'contain'},{left:100,top:100,width:200,height:300,fullWidth:800,fullHeight:600});assert.equal(placement.x,31.25);assert.equal(placement.width,18.75);assert(Math.abs(placement.y-100*480/720)<1e-10);
 let p=emptyFourSceneProject();p.scenes[0].voice={id:'voice-old',source:'data:audio/wav;base64,UklGRg==',duration:100};
 p=addNarration(p,{id:'voice-full',source:'data:audio/wav;base64,UklGRg==',duration:120});
 assert.equal(movieSeconds(p),120,'full narration overrides per-scene timing without deleting it');assert.deepEqual(narrationDurations(p),[30,30,30,30]);
 p=setNarrationBoundary(p,1,20);assert.deepEqual(movieTimeline(p).map(s=>[s.at,s.seconds]),[[0,20],[20,40],[60,30],[90,30]]);
 assert.throws(()=>setNarrationBoundary(p,1,0));assert.throws(()=>setNarrationBoundary(p,2,121));
 p.narration.durations[p.scenes[3].id]=1;assert.equal(movieSeconds(p),120,'last dialogue cannot be clipped');
 assert(validateDrawingProject(p));assert.equal(parseDrawingFile(JSON.stringify(p)).narration.original.duration,120);
 p.narration.enabled=false;assert.equal(activeNarration(p),null);assert.equal(p.scenes[0].voice.duration,100);
 assert(!validateDrawingProject({...p,narration:{...p.narration,durations:{a:NaN}}}));
 p.narration.lines=[{id:'a',sceneId:p.scenes[0].id,speaker:0,text:'안녕.'}];const key1=dialogueKey(p.narration);p.narration.lines[0].text='반가워.';assert.notEqual(key1,dialogueKey(p.narration));
 let roles=[...p.narration.speakers];while(roles.length<30)roles=addDialogueSpeaker(roles);assert.equal(roles.length,30);assert.throws(()=>addDialogueSpeaker(roles));
 const assignedLines=[{id:'kept',sceneId:p.scenes[0].id,speaker:3,text:'대사 유지',clip:{id:'voice-cached',source:'data:audio/wav;base64,UklGRg==',duration:1},clipKey:'cached'}];
 const removed=removeDialogueSpeaker(roles,assignedLines,1);assert.equal(removed.lines[0].speaker,2);assert.equal(removed.speakers[2].voice,roles[3].voice);assert.deepEqual(removed.lines[0].clip,assignedLines[0].clip);assert.throws(()=>removeDialogueSpeaker(roles,assignedLines,3));
 assert(validateDrawingProject({...p,narration:{...p.narration,speakers:roles,lines:assignedLines}}));
 console.log('PASS: roles grow to 30, unused-role removal preserves speaker identity and cached speech, referenced roles cannot be removed accidentally.');
 const wav=wavBytes(new Float32Array(1600));assert.equal(new DataView(wav.buffer).getUint32(24,true),16000);assert.equal(wav.length,3244);
 console.log('PASS: original character RGBA preserved, letterbox placement, continuous narration timeline, boundary edits, no speech truncation, legacy audio and backup round trip.');

 let speechCalls=0,socketFailure=false,requestedVoices=[];
 class FakeSocket extends EventEmitter{
  constructor(url,options){super();speechCalls++;assert(url.includes('gpt-realtime-2.1-mini'));assert(options.headers.Authorization.startsWith('Bearer sk-'));queueMicrotask(()=>this.emit('message',Buffer.from(JSON.stringify({type:'session.created'}))));}
  send(raw){const data=JSON.parse(raw);if(data.type==='session.update'){requestedVoices.push(data.session.audio.output.voice);assert.equal(data.session.audio.output.format.rate,24000);queueMicrotask(()=>this.emit('message',Buffer.from(JSON.stringify({type:'session.updated'}))));}else if(data.type==='response.create'){assert.equal(data.response.conversation,'none');assert(data.response.input[0].content[0].text.includes('<dialogue>'));queueMicrotask(()=>{this.emit('message',Buffer.from(JSON.stringify({type:'response.output_audio.delta',delta:Buffer.alloc(4800).toString('base64')})));this.emit('message',Buffer.from(JSON.stringify({type:'response.done',response:{status:socketFailure?'incomplete':'completed'}})));});}}
  close(){this.emit('close');}
 }
 require.cache[wsPath].exports=FakeSocket;
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://test.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='qa-narration-server-secret';process.env.PLAY_SETTINGS_PIN='3035';
 const server=local('./apps/play-studio/lib/play-ai-server.js'),route=local('./apps/play-studio/app/api/film-dialogue/route.js');
 const key='sk-not-a-real-key-only-for-qa',encrypted=server.encryptKey(key);let limited=false,providerCalls=0,invalidAssignment=false;
 global.fetch=async(url,options={})=>{
  url=String(url);if(url.includes('/rpc/'))return Response.json(!limited);if(url.startsWith('https://test.invalid/'))return Response.json([{encrypted_key:encrypted}]);
  providerCalls++;
  if(url.endsWith('/audio/transcriptions')){assert(options.body instanceof FormData);assert.equal(options.body.get('model'),'gpt-transcribe');assert(options.body.get('file').size>44);return Response.json({text:'안녕. 반가워.'});}
  if(url.endsWith('/responses')){const body=JSON.parse(options.body);assert.equal(body.store,false);assert.equal(body.model,'gpt-6-luna');assert.equal(body.text.format.strict,true);return Response.json({output:[{content:[{type:'output_text',text:JSON.stringify({lines:[{scene:0,speaker:invalidAssignment?9:0,text:'안녕.'},{scene:1,speaker:1,text:'반가워.'}]})}]}]});}
  throw new Error(`Unexpected network request ${url}`);
 };
 const cookie=server.sessionCookie().split(';')[0];
 const req=(body,c=cookie,origin='https://play.test')=>new Request('https://play.test/api/film-dialogue',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...(c?{Cookie:c}:{})},body:JSON.stringify(body)});
 assert.equal((await route.POST(req({action:'speak',text:'안녕',voice:'coral'},'', 'https://bad.test'))).status,403);
 assert.equal((await route.POST(req({action:'speak',text:'안녕',voice:'coral'},''))).status,401);assert.equal(speechCalls,0);
 const transcribed=await route.POST(req({action:'transcribe',audio:'data:audio/wav;base64,'+Buffer.from(wav).toString('base64')}));assert.equal(transcribed.status,200);assert.equal((await transcribed.json()).text,'안녕. 반가워.');
 const assign={action:'assign',text:'안녕. 반가워.',speakers:['토끼','곰'],scenes:[{id:'a',title:'숲'},{id:'b',title:'집'}]};
 const assigned=await route.POST(req(assign));assert.equal(assigned.status,200);assert.deepEqual((await assigned.json()).lines.map(l=>l.sceneId),['a','b']);
 assert.equal((await route.POST(req({...assign,speakers:Array.from({length:30},(_,i)=>`배역 ${i+1}`)}))).status,200);assert.equal((await route.POST(req({...assign,speakers:Array.from({length:31},(_,i)=>`배역 ${i+1}`)}))).status,400);
 invalidAssignment=true;assert.equal((await route.POST(req(assign))).status,400);invalidAssignment=false;
 for(const voice of ['coral','cedar','marin']){const response=await route.POST(req({action:'speak',text:'안녕.',voice}));assert.equal(response.status,200);const value=await response.json();assert.equal(value.voice.duration,.1);assert(!JSON.stringify(value).includes(key));}
 assert.deepEqual(requestedVoices,['coral','cedar','marin']);
 socketFailure=true;assert.equal((await route.POST(req({action:'speak',text:'안녕.',voice:'coral'}))).status,400);socketFailure=false;
 const before=speechCalls;limited=true;assert.equal((await route.POST(req({action:'speak',text:'안녕.',voice:'coral'}))).status,429);assert.equal(speechCalls,before);
 console.log('PASS: mocked transcription and role assignment, 3 distinct server-side speech sessions, PCM/WAV, invalid roles, incomplete audio, authentication, CSRF, rate limits, no key exposure. No paid API calls.');
}finally{
 global.fetch=originalFetch;require.cache[wsPath].exports=originalWs;for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];Object.assign(process.env,env);await fs.rm(temp,{recursive:true,force:true});
}
