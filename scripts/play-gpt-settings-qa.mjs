import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const root=process.cwd(),require=createRequire(path.join(root,'apps/play-studio/package.json')),ts=require('typescript');
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'moakit-settings-qa-'));
const originalFetch=global.fetch,env={...process.env};
try{
 for(const file of ['lib/play-ai-server.ts','lib/background-prompt.ts','lib/background-image-input.ts','app/api/play-settings/route.ts','app/api/film-background/route.ts']){
  const output=path.join(temp,file.replace(/\.ts$/,'.js'));await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,ts.transpileModule(await fs.readFile(path.join(root,'apps/play-studio',file),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText);
 }
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://test.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='qa-server-only-secret';process.env.PLAY_SETTINGS_PIN='3035';
 const load=createRequire(path.join(temp,'entry.js')),server=load('./lib/play-ai-server.js'),settings=load('./app/api/play-settings/route.js'),images=load('./app/api/film-background/route.js');
 const testKey='sk-not-a-real-key-only-used-for-unit-tests';let stored=null,limited=false,providerCalls=0,providerStatus=200,lastImagePrompt='',lastImageMime='',providerCode='',queued=false,rpcCalls=[];
 global.fetch=async(url,options={})=>{
  url=String(url);
  if(url.includes('/rpc/')){const args=JSON.parse(options.body);rpcCalls.push(args);assert(args.p_limit<=100,'RPC accepts at most 100 per window');return Response.json(args.p_seconds===10?!queued:!limited);}
  if(url.startsWith('https://test.invalid/')){
   if(options.method==='POST'){stored=JSON.parse(options.body);assert(!options.body.includes(testKey));return new Response(null,{status:204});}
   return Response.json(stored?[url.includes('select=updated_at')?{updated_at:stored.updated_at}:{encrypted_key:stored.encrypted_key}]:[]);
  }
  assert(url.startsWith('https://api.openai.com/v1/'));providerCalls++;assert.equal(options.headers.Authorization,`Bearer ${testKey}`);
  if(providerStatus!==200)return Response.json({error:{code:providerCode,message:'never expose provider secrets'}},{status:providerStatus});
  if(url.endsWith('/images/edits')){lastImagePrompt=options.body.get('prompt');lastImageMime=options.body.get('image[]').type;assert.equal(options.body.get('model'),'gpt-image-2.5-flare');assert.equal(options.body.get('quality'),'low');assert.equal(options.body.get('background'),'opaque');assert.equal(options.body.get('n'),'1');assert.equal(options.body.get('size'),'1024x1024');assert.equal(options.body.get('mask').type,'image/png');return Response.json({data:[{b64_json:'YWJj'}]});}
  return Response.json({id:server.IMAGE_MODEL});
 };
 const req=(body,cookie='',origin='https://play.test')=>new Request('https://play.test/api/play-settings',{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await settings.POST(req({action:'save',apiKey:testKey}))).status,401);
 assert.equal((await settings.POST(req({action:'login',pin:'0000'}))).status,401);
 const login=await settings.POST(req({action:'login',pin:'3035'}));assert.equal(login.status,200);
 const cookie=login.headers.get('set-cookie').split(';')[0];assert(login.headers.get('set-cookie').includes('HttpOnly'));
 assert.equal(server.authenticated(req({},cookie)),true);assert.equal(server.authenticated(req({},cookie+'tamper')),false);
 assert.equal((await settings.POST(req({action:'save',apiKey:testKey},cookie,'https://evil.test'))).status,403);
 const saved=await settings.POST(req({action:'save',apiKey:testKey},cookie));assert.equal(saved.status,200);assert.equal((await saved.json()).configured,true);assert.equal(server.decryptKey(stored.encrypted_key),testKey);
 assert.throws(()=>server.decryptKey(stored.encrypted_key+'tamper'));
 const otherLogin=await settings.POST(req({action:'login',pin:'3035'}));const otherCookie=otherLogin.headers.get('set-cookie').split(';')[0];assert.notEqual(cookie,otherCookie);
 const otherState=await (await settings.GET(req({},otherCookie))).json();assert.equal(otherState.configured,true);assert(!JSON.stringify(otherState).includes(testKey));assert(!JSON.stringify(otherState).includes('encrypted_key'));
 assert.equal((await (await images.GET(req({}))).json()).configured,true);
 assert.equal((await settings.POST(req({action:'test'},otherCookie))).status,200);
 const png=Buffer.alloc(32);Buffer.from('89504e470d0a1a0a','hex').copy(png);png.writeUInt32BE(1024,16);png.writeUInt32BE(1024,20);const source='data:image/png;base64,'+png.toString('base64');
 const result=await images.POST(req({image:source,mask:source,prompt:'숲 배경'},otherCookie));assert.equal(result.status,200);assert.equal((await result.json()).source,'data:image/jpeg;base64,YWJj');
 const largePng=Buffer.alloc(1_600_000);png.copy(largePng);const largeSource='data:image/png;base64,'+largePng.toString('base64');assert(largeSource.length>1_900_000);
 const largeResult=await images.POST(req({image:largeSource,mask:source,prompt:'사진 속 배경'},otherCookie));assert.equal(largeResult.status,200,'existing detailed PNG uploads above the former 1.9 MB limit are accepted');assert.equal(lastImageMime,'image/png');
 const jpg=Buffer.from('ffd8ffe000104a46494600010100000100010000ffc00011080400040003012200021101031101ffd9','hex'),jpegSource='data:image/jpeg;base64,'+jpg.toString('base64');
 assert.equal((await images.POST(req({image:jpegSource,mask:source,prompt:'사진 속 배경'},otherCookie))).status,200);assert.equal(lastImageMime,'image/jpeg');
 const beforeInvalid=providerCalls;assert.equal((await images.POST(req({image:jpegSource,mask:jpegSource,prompt:'사진 속 배경'},otherCookie))).status,400);assert.equal(providerCalls,beforeInvalid,'masks still require PNG');
 const wrongSize=Buffer.from(jpg);wrongSize.writeUInt16BE(512,27);assert.equal((await images.POST(req({image:'data:image/jpeg;base64,'+wrongSize.toString('base64'),mask:source,prompt:'배경'},otherCookie))).status,400);assert.equal(providerCalls,beforeInvalid);
 assert.match(lastImagePrompt,/clearly visible improvement in the artistic finish/);assert.match(lastImagePrompt,/Never redraw a protected character/);
 const assertRefinement=()=>{assert.match(lastImagePrompt,/Keep the existing background elements and composition/);assert.match(lastImagePrompt,/type, count, position, relative size/);assert.match(lastImagePrompt,/Do not add, remove, duplicate, replace or rearrange/);assert.match(lastImagePrompt,/more beautifully and skillfully drawn/);assert(!lastImagePrompt.includes('Do not improve the drawing skill'));assert(!lastImagePrompt.includes('scenery additions'));assert.match(lastImagePrompt,/faint pencil lines/);assert.match(lastImagePrompt,/Refine EVERY existing background element/);assert.match(lastImagePrompt,/Do not fill light areas with black/);assert.match(lastImagePrompt,/complete OPAQUE illustration/);assert.match(lastImagePrompt,/do NOT request a transparent or removed background/);};
 assertRefinement();
 const {backgroundPresets}=load('./lib/background-prompt.js');
 for(const preset of backgroundPresets)for(const strength of ['gentle','clear']){
  assert(preset.prompt.length<=600);assert.equal((await images.POST(req({image:source,mask:source,prompt:preset.prompt,strength},otherCookie))).status,200);assertRefinement();assert.match(lastImagePrompt,strength==='gentle'?/Gently refine/:/clearly visible improvement in the artistic finish/);
 }
 assert.equal((await images.POST(req({image:source,mask:source,prompt:'주인공 뒤의 숲',strength:'clear',operation:'remove-character'},otherCookie))).status,200);assert.match(lastImagePrompt,/Remove ONLY the selected character/);assert.match(lastImagePrompt,/continuing the surrounding lines, colors and textures/);assert.match(lastImagePrompt,/Do not introduce new scenery objects/);assert(!lastImagePrompt.includes('clearly visible improvement'));
 console.log('PASS: all background presets/strengths improve existing objects without scene additions; character removal only continues surrounding background.');

 const before=providerCalls;limited=true;assert.equal((await settings.POST(req({action:'login',pin:'3035'}))).status,200,'valid PIN is not blocked by other students sharing Wi-Fi');assert.equal((await settings.POST(req({action:'login',pin:'wrong'}))).status,429);assert.equal((await images.POST(req({image:source,mask:source,prompt:'숲'},otherCookie))).status,429);assert.equal(providerCalls,before);limited=false;

 const bucketA=rpcCalls.filter(c=>c.p_limit===60).at(-1).p_bucket;
 await images.POST(req({image:source,mask:source,prompt:'숲'},cookie));
 const bucketB=rpcCalls.filter(c=>c.p_limit===60).at(-1).p_bucket;
 assert.notEqual(bucketA,bucketB,'verified browsers sharing an IP have independent quotas');
 const beforeQueue=providerCalls;queued=true;
 const waiting=await images.POST(req({image:source,mask:source,prompt:'숲',code:'3035'}));
 assert.equal(waiting.status,202);assert.equal((await waiting.json()).retryable,true);assert(waiting.headers.get('set-cookie'));assert.equal(providerCalls,beforeQueue,'queued requests never reach the paid provider');queued=false;
 providerStatus=429;providerCode='rate_limit_exceeded';const busy=await images.POST(req({image:source,mask:source,prompt:'숲'},cookie));assert.equal(busy.status,429);assert.equal((await busy.json()).retryable,true);
 for(const code of ['credit_balance_exhausted','project_spend_limit_exceeded','insufficient_quota']){providerCode=code;const quota=await images.POST(req({image:source,mask:source,prompt:'숲'},cookie));assert.equal(quota.status,402);assert(!(await quota.json()).retryable,'billing errors are never retried');}
 console.log('PASS: shared-IP classrooms, valid PIN login, per-session limits, shared admission pacing, safe rate-limit retry, no quota replay.');
 providerStatus=401;const failed=await settings.POST(req({action:'test'},cookie));assert.equal(failed.status,400);assert(!(await failed.text()).includes('never expose'));
 assert.equal((await settings.POST(req({action:'logout'},cookie))).headers.get('set-cookie').includes('Max-Age=0'),true);
 console.log('PASS: PIN protection, signed sessions, CSRF, encrypted persistence, cross-device settings, no secret in responses, rate limits, model lookup and one-image low-quality OpenAI edit. All external requests mocked; no real key or paid generation.');
}finally{global.fetch=originalFetch;for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];Object.assign(process.env,env);await fs.rm(temp,{recursive:true,force:true});}
