// Focused paper-removal coverage. The broader play-paper-qa.mjs intentionally
// remains unchanged: its desktop-to-phone resize test exposed a separate
// existing hidden-library/modal issue (run 34077529181). This does NOT fix or
// mark that issue as passing. Here each width uses its normal entry tab.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {photographedPaperMask} from '../apps/play-studio/lib/drawing-paper.ts';
const app=fileURLToPath(new URL('../apps/play-studio/',import.meta.url));
const require=createRequire(path.join(app,'package.json')),{chromium,webkit}=require('playwright');
const out=path.join(app,'paper-core-results');await mkdir(out,{recursive:true});
const w=120,h=100,rgba=new Uint8ClampedArray(w*h*4);
for(let y=0;y<h;y++)for(let x=0;x<w;x++){
 const outline=y>20&&y<80&&x>35&&x<90,inside=y>30&&y<70&&x>45&&x<80;
 rgba.set(outline?(inside?[255,255,255,255]:[25,65,40,255]):[150+y*.6,156+y*.6,165+y*.6,255],(y*w+x)*4);
}
const original=Buffer.from(rgba),previous=new Uint8ClampedArray(w*h).fill(255);previous[40*w+40]=0;
const unit=photographedPaperMask({width:w,height:h,data:rgba},previous,{x:0,y:0,width:w,height:h});
assert(unit);assert.equal(unit[0],0);assert.equal(unit[50*w+60],255,'enclosed white remains');assert.equal(unit[40*w+40],0,'old erasure remains');assert.deepEqual(Buffer.from(rgba),original);
assert.equal(photographedPaperMask({width:w,height:h,data:new Uint8ClampedArray(w*h*4).fill(255)},previous,{x:0,y:0,width:w,height:h}),null);
const base='http://127.0.0.1:3104',reports=[];
const server=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','-p','3104'],{cwd:app,stdio:'inherit'});
async function stored(page){await page.waitForTimeout(650);return page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('moakit-play-drawings-v1',1);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,q=db.transaction('projects').objectStore('projects').get('active');q.onsuccess=()=>{db.close();resolve(q.result);};q.onerror=()=>reject(q.error);};}));}
async function alpha(board,x,y){return board.evaluate((c,{x,y})=>c.getContext('2d').getImageData(x,y,1,1).data[3],{x,y});}
async function check(board){
 for(const [x,y] of [[170,50],[30,210],[30,40],[5,100]])assert.equal(await alpha(board,x,y),0,`paper/frame ${x},${y}`);
 for(const [x,y] of [[80,100],[100,140],[130,175],[160,170]])assert.equal(await alpha(board,x,y),255,`ink ${x},${y}`);
}
try{
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}assert(ready);
 for(const [name,engine] of [['chromium',chromium],['webkit',webkit]])for(const width of [1440,390]){
  const browser=await engine.launch(),page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',d=>d.accept());
  const tag=`${name}-${width}`;
  try{
   await page.goto(base);await page.locator('.draw-title small').filter({hasText:'이 기기에 저장됨'}).waitFor();
   if(width<700)await page.getByRole('button',{name:'그림·배경',exact:true}).click();
   await page.getByRole('button',{name:/공룡 사진으로 연습하기/}).click();
   const modal=page.getByRole('dialog',{name:'내 그림 다듬기'}),board=modal.getByLabel('사진 다듬기 작업 영역',{exact:true});
   await modal.waitFor();await page.waitForFunction(()=>document.querySelector('.cutout-dialog canvas')?.width===220);
   assert.equal(await alpha(board,170,50),255);
   await modal.getByRole('button',{name:'배경 지우기',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('.cutout-dialog')?.getAttribute('aria-busy')==='false',null,{timeout:55000});
   assert.deepEqual(await modal.locator('.cutout-error').allTextContents(),[]);await check(board);
   assert(await modal.evaluate(e=>e.scrollWidth<=e.clientWidth+2));
   await modal.screenshot({path:path.join(out,`${tag}-paper-removed.png`)});
   const png=await board.evaluate(c=>c.toDataURL('image/png'));await writeFile(path.join(out,`${tag}-dinosaur.png`),Buffer.from(png.split(',')[1],'base64'));
   await modal.getByRole('button',{name:'배경 지우기',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.cutout-dialog')?.getAttribute('aria-busy')==='false',null,{timeout:55000});await check(board);
   await modal.getByRole('button',{name:'처음으로',exact:true}).click();assert.equal(await alpha(board,170,50),255);
   await modal.getByRole('checkbox',{name:/흰 종이 지우기/}).check();await check(board);
   await modal.getByRole('button',{name:'다듬기 실행 취소',exact:true}).click();assert.equal(await alpha(board,170,50),255);
   await modal.getByRole('button',{name:'다듬기 다시 실행',exact:true}).click();await check(board);
   await modal.getByRole('button',{name:'다 됐어요!',exact:true}).click();await modal.getByRole('button',{name:'무대에 놓기',exact:true}).click();await modal.waitFor({state:'hidden'});
   const p=await stored(page);assert.equal(p.assets.length,1);assert(p.assets[0].edit?.mask);assert(p.assets[0].source.startsWith('data:image/png;'));
   await writeFile(path.join(out,`${tag}-work.moakit-drawing.json`),JSON.stringify(p));
   await page.reload();await page.locator('.draw-title small').filter({hasText:'이 기기에 저장됨'}).waitFor();
   if(width<700)await page.getByRole('button',{name:'그림·배경',exact:true}).click();
   await page.getByRole('button',{name:'예시 공룡 다듬기',exact:true}).click();await modal.waitFor();await page.waitForFunction(()=>document.querySelector('.cutout-dialog canvas')?.width===220);await check(board);
   await modal.getByRole('button',{name:'원본 보기',exact:true}).click();assert.equal(await alpha(board,170,50),255);
   assert.equal(errors.length,0,errors.join('\n'));reports.push({browser:name,width,result:'PASS',checks:['real GrabCut plus paper cleanup','paper/frame transparent','ink retained','repeat','standalone paper cleanup','undo/redo','saved/reopened mask','original retained']});console.log('PAPER_CORE_PASS',tag);
  }catch(e){await page.screenshot({path:path.join(out,`${tag}-failure.png`),fullPage:true});throw e;}finally{await browser.close();}
 }
 await writeFile(path.join(out,'paper-core-qa.json'),JSON.stringify({unit:'PASS',reports,knownUnfixed:'Desktop-to-phone resize may hide an open editor when its parent library tab is hidden. Broader test remains failing; no responsive fix included. Physical devices not tested.'},null,2));
}finally{server.kill('SIGTERM');}
