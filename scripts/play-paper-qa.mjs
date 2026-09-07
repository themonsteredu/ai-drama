import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {photographedPaperMask} from '../apps/play-studio/lib/drawing-paper.ts';
const app=fileURLToPath(new URL('../apps/play-studio/',import.meta.url));
const require=createRequire(path.join(app,'package.json')),{chromium,webkit}=require('playwright');
const out=path.join(app,'qa-results');await mkdir(out,{recursive:true});
// A shaded neutral sheet with a dark outline and WHITE drawing interior.
const w=120,h=100,rgba=new Uint8ClampedArray(w*h*4);
for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const border=y>20&&y<80&&x>35&&x<90,inside=y>30&&y<70&&x>45&&x<80;
  rgba.set(border?(inside?[255,255,255,255]:[25,65,40,255]):[150+y*.6,156+y*.6,165+y*.6,255],(y*w+x)*4);
}
const original=Buffer.from(rgba),previous=new Uint8ClampedArray(w*h).fill(255);previous[40*w+40]=0;
const unit=photographedPaperMask({width:w,height:h,data:rgba},previous,{x:0,y:0,width:w,height:h});
assert(unit);assert.equal(unit[0],0);assert.equal(unit[50*w+60],255,'enclosed white paint must remain');assert.equal(unit[40*w+40],0,'prior eraser must remain');assert.deepEqual(Buffer.from(rgba),original,'original RGB never changes');
assert.equal(photographedPaperMask({width:w,height:h,data:new Uint8ClampedArray(w*h*4).fill(255)},previous,{x:0,y:0,width:w,height:h}),null,'blank page must not produce a false cutout');
const blue=new Uint8ClampedArray(w*h*4);for(let i=0;i<w*h;i++)blue.set([25,140,235,255],i*4);
assert.equal(photographedPaperMask({width:w,height:h,data:blue},previous,{x:0,y:0,width:w,height:h}),null,'non-paper fallback remains available');
const base=process.env.PLAY_QA_URL||'http://127.0.0.1:3103';
const server=process.env.PLAY_QA_URL?null:spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','-p','3103'],{cwd:app,stdio:'inherit'});
const reports=[];
async function saved(page){await page.waitForTimeout(600);return page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('moakit-play-drawings-v1',1);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,q=db.transaction('projects').objectStore('projects').get('active');q.onsuccess=()=>{db.close();resolve(q.result);};q.onerror=()=>reject(q.error);};}));}
async function alpha(board,x,y){return board.evaluate((c,{x,y})=>c.getContext('2d').getImageData(x,y,1,1).data[3],{x,y});}
async function assertDinosaur(board,label){
  for(const [x,y] of [[170,50],[30,210],[30,40],[5,100]])assert.equal(await alpha(board,x,y),0,`${label}: paper/frame transparent ${x},${y}`);
  for(const [x,y] of [[80,100],[100,140],[130,175],[160,170]])assert.equal(await alpha(board,x,y),255,`${label}: dinosaur preserved ${x},${y}`);
}
try{
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}assert(ready,'server ready');
 for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch(),page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});page.setDefaultTimeout(20000);const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',d=>d.accept());
  try{
   await page.goto(base);await page.locator('.draw-title small').filter({hasText:'이 기기에 저장됨'}).waitFor();
   await page.getByRole('button',{name:/공룡 사진으로 연습하기/}).click();
   const modal=page.getByRole('dialog',{name:'내 그림 다듬기'}),board=modal.getByLabel('사진 다듬기 작업 영역',{exact:true});await modal.waitFor();await page.waitForFunction(()=>document.querySelector('.cutout-dialog canvas')?.width===220);
   assert.equal(await alpha(board,170,50),255,'reproduction: original photographed grey paper is opaque');
   await modal.getByRole('button',{name:'배경 지우기',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('.cutout-dialog')?.getAttribute('aria-busy')==='false',null,{timeout:55000});
   assert.deepEqual(await modal.locator('.cutout-error').allTextContents(),[],'real OpenCV worker must succeed');
   await assertDinosaur(board,'automatic button');
   await modal.screenshot({path:path.join(out,`${name}-paper-removed-1440.png`)});
   const dataURL=await board.evaluate(c=>c.toDataURL('image/png'));await writeFile(path.join(out,`${name}-dinosaur-cutout.png`),Buffer.from(dataURL.split(',')[1],'base64'));
   // Repeating automatic cleanup must not gradually eat the drawing.
   await modal.getByRole('button',{name:'배경 지우기',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.cutout-dialog')?.getAttribute('aria-busy')==='false',null,{timeout:55000});await assertDinosaur(board,'repeat');
   await modal.getByRole('button',{name:'처음으로',exact:true}).click();assert.equal(await alpha(board,170,50),255);
   await modal.getByRole('checkbox',{name:/흰 종이 지우기/}).check();await assertDinosaur(board,'paper checkbox alone');
   await modal.getByRole('button',{name:'다듬기 실행 취소',exact:true}).click();assert.equal(await alpha(board,170,50),255);
   await modal.getByRole('button',{name:'다듬기 다시 실행',exact:true}).click();await assertDinosaur(board,'redo');
   for(const width of [1024,390]){await page.setViewportSize({width,height:950});assert(await modal.evaluate(e=>e.scrollWidth<=e.clientWidth+2));await modal.screenshot({path:path.join(out,`${name}-paper-removed-${width}.png`)});}
   await page.setViewportSize({width:1440,height:1000});await modal.getByRole('button',{name:'다 됐어요!',exact:true}).click();await modal.getByRole('button',{name:'무대에 놓기',exact:true}).click();await modal.waitFor({state:'hidden'});
   const project=await saved(page);assert.equal(project.assets.length,1);assert(project.assets[0].edit?.mask);assert(project.assets[0].source.startsWith('data:image/png;'));
   await writeFile(path.join(out,`${name}-paper-fixed.moakit-drawing.json`),JSON.stringify(project));
   await page.reload();await page.locator('.draw-title small').filter({hasText:'이 기기에 저장됨'}).waitFor();await page.getByRole('button',{name:'예시 공룡 다듬기',exact:true}).click();await modal.waitFor();await page.waitForFunction(()=>document.querySelector('.cutout-dialog canvas')?.width===220);await assertDinosaur(board,'reopen saved mask');
   await modal.getByRole('button',{name:'원본 보기',exact:true}).click();assert.equal(await alpha(board,170,50),255,'original paper is retained for future restoration');
   assert.equal(errors.length,0,errors.join('\n'));reports.push({browser:name,result:'PASS',checks:['actual sample photo','real automatic worker','grey paper/frame alpha','dinosaur kept','repeat cleanup','paper checkbox without cropping','undo/redo','PNG/IndexedDB re-edit','original preserved','1440/1024/390']});
   console.log('PAPER_QA_PASS',name);
  }catch(e){await page.screenshot({path:path.join(out,`${name}-paper-failure.png`),fullPage:true});throw e;}finally{await browser.close();}
 }
 await writeFile(path.join(out,'paper-qa.json'),JSON.stringify({unit:'PASS: shaded sheet, enclosed white, prior edits, blank and non-paper guards',browsers:reports},null,2));
}finally{server?.kill('SIGTERM');}
