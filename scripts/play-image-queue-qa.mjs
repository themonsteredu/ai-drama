import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const root=process.cwd(),require=createRequire(path.join(root,'apps/play-studio/package.json')),ts=require('typescript');
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'play-image-qa-'));
try{
 for(const name of ['scene-character-fill','play-image-request'])await fs.writeFile(path.join(temp,name+'.cjs'),ts.transpileModule(await fs.readFile(path.join(root,'apps/play-studio/lib',name+'.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText);
 const {characterRemovalMask,seedCharacterBackground,characterRemovalChanged}=require(path.join(temp,'scene-character-fill.cjs'));
 const width=9,height=7,marks=new Uint8ClampedArray(width*height*4).fill(255),original=new Uint8ClampedArray(width*height*4);
 for(let i=0;i<width*height;i++)original.set([120,180,230,255],i*4);
 for(let y=2;y<=4;y++)for(let x=3;x<=5;x++){marks.set([0,0,0,255],(y*width+x)*4);original.set([250,10,20,255],(y*width+x)*4);}
 const before=original.slice(),mask=characterRemovalMask(marks,width,height,1),filled=seedCharacterBackground(original,mask,width,height);
 assert.equal(mask.reduce((a,b)=>a+b,0),25,'outline margin is exactly one pixel');
 for(let i=0;i<width*height;i++)assert.deepEqual([...filled.slice(i*4,i*4+4)],[120,180,230,255],'selected character color cannot leak into the fill');
 assert.deepEqual(before,original,'original character is not modified');
 const differentActor=original.slice();for(let i=0;i<mask.length;i++)if(mask[i])differentActor.set([5,40,10,255],i*4);
 assert.deepEqual(seedCharacterBackground(differentActor,mask,width,height),filled,'seed depends only on surrounding pixels');
 assert(!characterRemovalChanged(original,original,marks),'unchanged generated image cannot be applied');assert(characterRemovalChanged(original,filled,marks));
 assert.throws(()=>seedCharacterBackground(original,new Uint8Array(width*height).fill(1),width,height));
 const edgeMarks=new Uint8ClampedArray(3*3*4).fill(255);edgeMarks.set([0,0,0,255],0);
 assert.equal(characterRemovalMask(edgeMarks,3,3,1).reduce((a,b)=>a+b,0),4,'edge margin is clipped, not wrapped');
 console.log('PASS: original character pixels retained, input character erased, outline padding, edge bounds and unchanged-result rejection.');
 const {requestBackground}=require(path.join(temp,'play-image-request.cjs'));
 let calls=0;const delays=[],states=[];
 const source='data:image/jpeg;base64,YWJj',body={image:'test-image',mask:'test-mask'};
 const result=await requestBackground(body,{onStatus:s=>states.push(s),wait:async ms=>delays.push(ms),fetcher:async(url,init)=>{
  assert.deepEqual(JSON.parse(init.body),body);calls++;
  if(calls===1)return Response.json({queued:true,retryable:true,retryAfter:10},{status:202});
  if(calls===2)return Response.json({retryable:true,retryAfter:25},{status:429});
  return Response.json({source});
 }});
 assert.equal(result.source,source);assert.equal(calls,3);assert(delays[0]>=10000&&delays[1]>=25000);assert(states.some(s=>s.includes('대기')));
 for(const status of [400,401,402,503,504]){
  let count=0;await assert.rejects(requestBackground(body,{onStatus:()=>{},wait:async()=>assert.fail('unexpected retry'),fetcher:async()=>{count++;return Response.json({error:'stop'},{status});}}));assert.equal(count,1);
 }
 let ambiguous=0;await assert.rejects(requestBackground(body,{onStatus:()=>{},fetcher:async()=>{ambiguous++;throw new Error('connection lost');}}));assert.equal(ambiguous,1,'unknown paid outcome never retries');
 const abort=new AbortController();await assert.rejects(requestBackground(body,{signal:abort.signal,onStatus:()=>{},wait:async()=>{abort.abort();throw new DOMException('Aborted','AbortError');},fetcher:async()=>Response.json({queued:true,retryable:true,retryAfter:10},{status:202})}),{name:'AbortError'});
 let refused=0;await assert.rejects(requestBackground(body,{onStatus:()=>{},wait:async()=>{},fetcher:async()=>{refused++;return Response.json({retryable:true,retryAfter:2},{status:429});}}));assert.equal(refused,9,'provider retries are bounded');
 console.log('PASS: queue-to-success, Retry-After respected, progress, bounded rate retries, cancellation, no billing/server/network replay.');
}finally{await fs.rm(temp,{recursive:true,force:true});}
