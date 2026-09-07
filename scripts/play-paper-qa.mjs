import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const app=fileURLToPath(new URL('../apps/play-studio/',import.meta.url)),require=createRequire(path.join(app,'package.json'));
const {chromium,webkit}=require('playwright'),ts=require('typescript');
const out=path.join(app,'qa-results');await mkdir(out,{recursive:true});
const source=await readFile(path.join(app,'lib/drawing-paper.ts'),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
const mod={exports:{}};new Function('exports','require','module',compiled)(mod.exports,require,mod);
const {detectPaper,combinePaperMask}=mod.exports;
// Synthetic controls; production algorithm has no knowledge of fixture coordinates.
const w=140,h=180,body=new Uint8ClampedArray(w*h*4);
for(let y=0;y<h;y++)for(let x=0;x<w;x++){
 const k=(y*w+x)*4,inside=x>30&&x<110&&y>30&&y<150,edge=inside&&(x<34||x>106||y<34||y>146),v=edge?30:inside?245:125+Math.floor(y*.25);
 body[k]=v;body[k+1]=v;body[k+2]=v;body[k+3]=255;
}
const rect={x:0,y:0,width:w,height:h},control=detectPaper({width:w,height:h,data:body},rect);
assert(control);assert.equal(control.mask[80*w+65],255,'enclosed white detail');assert.equal(control.mask[10*w+10],0,'grey sheet');
assert.equal(detectPaper({width:w,height:h,data:new Uint8ClampedArray(w*h*4).fill(255)},rect),null,'blank sheet rejected');
const transparent=new Uint8ClampedArray(body);for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(x<31||x>109||y<31||y>149)transparent[(y*w+x)*4+3]=0;
assert.equal(detectPaper({width:w,height:h,data:transparent},rect),null,'transparent artwork protected');
const origin=process.env.PLAY_QA_ORIGIN||'http://127.0.0.1:3105';
const server=process.env.PLAY_QA_ORIGIN?null:spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','-p','3105'],{cwd:app,stdio:'inherit'});
const points=[[25,45],[190,50],[30,205],[190,210],[5,20],[50,100],[82,70],[100,150],[100,190]];
async function alphas(board){return board.evaluate((c,points)=>points.map(([x,y])=>c.getContext('2d').getImageData(x,y,1,1).data[3]),points);}
async function saved(page){await page.waitForTimeout(650);return page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('moakit-play-drawings-v1',1);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,q=db.transaction('projects').objectStore('projects').get('active');q.onsuccess=()=>{db.close();resolve(q.result);};q.onerror=()=>reject(q.error);};}));}
const reports=[];
try{
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(origin)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}assert(ready);
 for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch(),page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});page.setDefaultTimeout(20000);page.on('dialog',d=>d.accept());const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  try{
   await page.goto(origin);await page.locator('.draw-title small').filter({hasText:'이 기기에 저장됨'}).waitFor();
   await page.getByRole('button',{name:'공룡 사진으로 연습하기',exact:false}).click();
   const modal=page.getByRole('dialog',{name:'내 그림 다듬기'}),board=modal.getByLabel('사진 다듬기 작업 영역',{exact:true});
   await modal.waitFor();await page.waitForFunction(()=>document.querySelector('.cutout-dialog canvas')?.width===220);
   const pixels=await board.evaluate(c=>Array.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data));
   const original=await modal.getByAltText('원본 사진 비교').getAttribute('src');
   await modal.screenshot({path:path.join(out,`${name}-paper-before.png`)});
   for(const exposure of [1,.72,1.17]){
    const data=new Uint8ClampedArray(pixels);for(let i=0;i<data.length;i++)if(i%4!==3)data[i]=Math.min(255,Math.round(data[i]*exposure));
    const p={width:220,height:242,data},r={x:0,y:0,width:220,height:242},result=detectPaper(p,r);assert(result);
    for(const [x,y] of points.slice(0,5))assert.equal(result.mask[y*220+x],0,`paper exposure ${exposure}`);
    for(const [x,y] of points.slice(5))assert.equal(result.mask[y*220+x],255,`character exposure ${exposure}`);
    const previous=new Uint8ClampedArray(220*242).fill(255);previous[100*220+50]=0;const next=combinePaperMask(p,previous,r);assert.equal(next[100*220+50],0);assert.throws(()=>combinePaperMask(p,next,r),/더 지울/);
   }
   // One green-button click: no crop, checkbox, brush or replacement artwork.
   await modal.getByRole('button',{name:'배경 지우기',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('.cutout-dialog')?.getAttribute('aria-busy')==='false');
   assert.equal(await modal.locator('.cutout-error').count(),0);
   assert.deepEqual(await alphas(board),[0,0,0,0,0,255,255,255,255]);
   await modal.screenshot({path:path.join(out,`${name}-paper-one-click.png`)});
   const result=await board.evaluate(c=>c.toDataURL('image/png'));await writeFile(path.join(out,`${name}-paper-transparent.png`),Buffer.from(result.split(',')[1],'base64'));
   await modal.getByRole('button',{name:'다듬기 실행 취소',exact:true}).click();assert.deepEqual(await alphas(board),Array(9).fill(255));
   await modal.getByRole('button',{name:'다듬기 다시 실행',exact:true}).click();assert.deepEqual(await alphas(board),[0,0,0,0,0,255,255,255,255]);
   await modal.getByRole('button',{name:'배경 지우기',exact:true}).click();await modal.locator('.cutout-error').waitFor();assert.match(await modal.locator('.cutout-error').innerText(),/더 지울/);assert.deepEqual(await alphas(board),[0,0,0,0,0,255,255,255,255]);
   // Undo back to original, then verify checkbox restoration preserves a prior stroke.
   await modal.getByRole('button',{name:'다듬기 실행 취소',exact:true}).click();
   await modal.getByRole('button',{name:'3단계 손으로 수정하기',exact:true}).click();await modal.getByRole('button',{name:'지우기',exact:true}).click();
   await board.scrollIntoViewIfNeeded();const b=await board.boundingBox();await page.mouse.click(b.x+b.width*50/220,b.y+b.height*100/242);
   const manual=await board.evaluate(c=>c.toDataURL('image/png'));
   await modal.getByRole('button',{name:'2단계 배경 지우기',exact:true}).click();
   const checkbox=modal.getByRole('checkbox',{name:/흰 종이 지우기/});await checkbox.check();assert.equal((await alphas(board))[0],0);await checkbox.uncheck();
   assert.equal(await board.evaluate(c=>c.toDataURL('image/png')),manual,'uncheck preserves manual erase');
   await modal.getByRole('button',{name:'처음으로',exact:true}).click();await modal.getByRole('button',{name:'배경 지우기',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('.cutout-dialog')?.getAttribute('aria-busy')==='false');
   assert.deepEqual(await alphas(board),[0,0,0,0,0,255,255,255,255]);
   await modal.getByLabel('그림 이름',{exact:true}).fill('종이 없는 공룡');
   await modal.getByRole('button',{name:'다 됐어요!',exact:true}).click();await modal.getByRole('button',{name:'무대에 놓기',exact:true}).click();await modal.waitFor({state:'hidden'});
   let doc=await saved(page);const asset=doc.assets.find(a=>a.name==='종이 없는 공룡');assert.equal(asset.edit.original,original);assert(asset.source.startsWith('data:image/png;'));
   await page.getByRole('button',{name:'숲속 무대',exact:true}).click();await saved(page);await page.screenshot({path:path.join(out,`${name}-paper-on-stage.png`),fullPage:true});
   const event=page.waitForEvent('download');await page.getByRole('button',{name:'작품 보관',exact:true}).click();const file=await event;const target=path.join(out,`${name}-paper.moakit-drawing.json`);await file.saveAs(target);assert.equal(JSON.parse(await readFile(target,'utf8')).assets.find(a=>a.name==='종이 없는 공룡').edit.original,original);
   await page.reload();await saved(page);await page.getByRole('button',{name:'종이 없는 공룡 다듬기',exact:true}).click();await modal.waitFor();await page.waitForFunction(()=>document.querySelector('.cutout-dialog canvas')?.width===220);
   assert.deepEqual(await alphas(board),[0,0,0,0,0,255,255,255,255]);assert.equal(await modal.getByAltText('원본 사진 비교').getAttribute('src'),original);
   for(const width of [1024,390]){await page.setViewportSize({width,height:950});await page.waitForTimeout(100);assert(await modal.evaluate(e=>e.scrollWidth<=e.clientWidth+2));await modal.screenshot({path:path.join(out,`${name}-paper-${width}.png`)});}
   assert.equal(errors.length,0,errors.join('\n'));
   reports.push({browser:name,status:'PASS',checks:['real sample one-click removal without manual cleanup','grey paper/desk transparent and colored art retained','exposure variants','white interior protected','blank and transparent controls','undo/redo','unchanged result warning','checkbox restores only its own mask','PNG placement and original preservation','backup and reload','tablet and mobile dialog']});
  }catch(error){await page.screenshot({path:path.join(out,`${name}-paper-failure.png`),fullPage:true});await writeFile(path.join(out,`${name}-paper-failure.txt`),String(error));throw error;}finally{await browser.close();}
 }
 await writeFile(path.join(out,'paper-qa.json'),JSON.stringify(reports,null,2));console.log('PAPER_QA_PASS',JSON.stringify(reports));
}finally{server?.kill('SIGTERM');}
