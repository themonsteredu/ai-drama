import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
const app=fileURLToPath(new URL('../apps/play-studio/',import.meta.url)),require=createRequire(path.join(app,'package.json'));
const {chromium,webkit}=require('playwright'),{PNG}=require('pngjs');
const out=path.join(app,'qa-results');await mkdir(out,{recursive:true});
const origin=process.env.PLAY_QA_ORIGIN||'http://127.0.0.1:3104';
const server=process.env.PLAY_QA_ORIGIN?null:spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','-p','3104'],{cwd:app,stdio:'inherit'});
async function saved(page){await page.waitForTimeout(600);return page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('moakit-play-drawings-v1',1);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,q=db.transaction('projects').objectStore('projects').get('active');q.onsuccess=()=>{db.close();resolve(q.result);};q.onerror=()=>reject(q.error);};}));}
const reports=[];
try{
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(origin)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}assert(ready,'server start');
 for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch(),page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});page.setDefaultTimeout(20000);page.on('dialog',d=>d.accept());const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 try{
  await page.goto(origin);await page.locator('.draw-title small').filter({hasText:'이 기기에 저장됨'}).waitFor();await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.locator('.character-figure').count(),0,'legacy SVG actor must not return');assert.equal(await page.locator('.story-road-step').count(),5);
  await page.screenshot({path:path.join(out,`${name}-story-empty-desktop.png`),fullPage:true});
  await page.getByRole('button',{name:'공룡 사진으로 연습하기',exact:false}).click();
  const modal=page.getByRole('dialog',{name:'내 그림 다듬기'});await modal.waitFor();await page.waitForFunction(()=>document.querySelector('.cutout-dialog canvas')?.width>1);
  await modal.getByLabel('그림 이름',{exact:true}).fill('나의 공룡 친구');await modal.getByRole('button',{name:'4단계 자르기',exact:true}).click();
  const board=modal.getByLabel('사진 다듬기 작업 영역',{exact:true});await board.scrollIntoViewIfNeeded();const box=await board.boundingBox();await page.mouse.move(box.x+box.width*.13,box.y+box.height*.13);await page.mouse.down();await page.mouse.move(box.x+box.width*.96,box.y+box.height*.94,{steps:8});await page.mouse.up();
  await modal.getByRole('button',{name:'2단계 배경 지우기',exact:true}).click();await modal.getByRole('button',{name:'배경 지우기',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.cutout-auto').disabled,null,{timeout:55000});assert.equal(await modal.locator('.cutout-error').count(),0);
  await modal.getByRole('button',{name:'3단계 손으로 수정하기',exact:true}).click();await modal.getByRole('button',{name:'지우기',exact:true}).click();await modal.getByRole('button',{name:'브러시 작게',exact:true}).click();
  // Real pointer cleanup of sample paper; do not edit screenshot pixels.
  for(let y=.145;y<.58;y+=.02){const start=y<.218?.34:y<.27?.52:y<.34?.58:y<.41?.63:y<.48?.67:y<.535?.74:.88;await board.scrollIntoViewIfNeeded();const r=await board.boundingBox();await page.mouse.move(r.x+r.width*start,r.y+r.height*y);await page.mouse.down();await page.mouse.move(r.x+r.width*.96,r.y+r.height*y,{steps:6});await page.mouse.up();}
  await modal.getByRole('button',{name:'다 됐어요!',exact:true}).click();await modal.getByRole('button',{name:'무대에 놓기',exact:true}).click();await modal.waitFor({state:'hidden'});
  let doc=await saved(page);assert(doc.assets[0].edit,'editable original persists');const original=doc.assets[0].edit.original;
  await page.getByRole('button',{name:'숲속 무대',exact:true}).click();doc=await saved(page);assert.equal(doc.scenes[0].backgroundAssetId,'picture-forest');assert(doc.assets.find(a=>a.id==='picture-forest').source.startsWith('data:image/'),'portable embedded image, no external saved URL');
  for(const label of ['산호 동굴','한옥 정원','숲속 무대']){await page.getByRole('button',{name:label,exact:true}).click();await saved(page);}
  await page.getByRole('button',{name:'나의 공룡 친구',exact:true}).click();await page.getByRole('button',{name:'폴짝폴짝',exact:true}).click();await page.getByRole('button',{name:'바람',exact:true}).click();await page.getByLabel('이 그림의 대사',{exact:true}).fill('내가 그린 이야기가 시작돼!');
  const canvas=page.locator('.draw-canvas'),before=await canvas.screenshot();await page.getByRole('button',{name:'▶ 움직여 보기',exact:true}).click();await page.waitForTimeout(650);assert(!before.equals(await canvas.screenshot()),'motion changes real rendered pixels');await page.getByRole('button',{name:'■ 처음으로',exact:true}).click();
  await page.getByText('장면 이름과 설명',{exact:true}).click();await page.getByRole('button',{name:'장면 복사',exact:true}).click();doc=await saved(page);assert.equal(doc.scenes.length,2);assert.equal(doc.assets.find(a=>a.name==='나의 공룡 친구').edit.original,original);
  await page.getByRole('button',{name:'▶ 발표하기',exact:true}).click();assert(await page.locator('.story-presenting').count());await page.getByRole('button',{name:'편집으로 돌아가기',exact:true}).click();assert.equal(await page.locator('.story-presenting').count(),0);
  await page.getByText('작품 보관·불러오기',{exact:true}).click();let event=page.waitForEvent('download');await page.getByRole('button',{name:'작품 파일 보관',exact:true}).click();let file=await event;const filePath=path.join(out,`${name}-story.moakit-drawing.json`);await file.saveAs(filePath);const bytes=await readFile(filePath);
  event=page.waitForEvent('download');await page.getByRole('button',{name:'현재 모습 PNG',exact:true}).click();file=await event;const pngPath=path.join(out,`${name}-story-export.png`);await file.saveAs(pngPath);const png=PNG.sync.read(await readFile(pngPath));assert.equal(png.width,2560);assert.equal(png.height,1440);
  await page.getByRole('button',{name:'새 작품',exact:true}).click();await saved(page);await page.getByLabel('내 그림 작품 파일 선택',{exact:true}).setInputFiles({name:'restore.json',mimeType:'application/json',buffer:bytes});doc=await saved(page);assert.equal(doc.scenes.length,2);assert.equal(doc.scenes[1].weather,'wind');assert.equal(doc.assets.find(a=>a.name==='나의 공룡 친구').edit.original,original);
  await page.reload();await saved(page);assert.equal(await page.locator('.draw-canvas').getAttribute('data-time'),'0.00');
  for(const width of [1440,1024,390]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(150);if(width===390)await page.getByRole('button',{name:'무대',exact:true}).click();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`overflow ${width}`);await page.screenshot({path:path.join(out,`${name}-story-stage-${width}.png`),fullPage:true});}
  for(const tab of ['그림·배경','움직임·효과']){await page.getByRole('button',{name:tab,exact:true}).click();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(out,`${name}-story-mobile-${tab==='그림·배경'?'pictures':'actions'}.png`),fullPage:true});}
  await page.getByRole('button',{name:'그림·배경',exact:true}).click();await page.getByRole('button',{name:'나의 공룡 친구 다듬기',exact:true}).click();await modal.waitFor();await modal.getByRole('button',{name:'3단계 손으로 수정하기',exact:true}).click();assert.equal(await modal.getByRole('button',{name:'지우기',exact:true}).evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 227, 237)','approved pink eraser unchanged');await modal.screenshot({path:path.join(out,`${name}-story-cutout-mobile.png`)});
  assert.equal(errors.length,0,errors.join('\n'));reports.push({browser:name,status:'PASS',checks:['root has colorful story surface, no legacy SVG actor','sample photo opens real editor','real automatic cleanup and brush strokes','3 raster backgrounds load and embed in backup','wind and hop change pixels','editable original preserved','presentation opens and exits','2560x1440 PNG','portable backup and reload','1440/1024/390 layouts and mobile tabs','approved cutout colors unchanged']});
 }catch(error){await page.screenshot({path:path.join(out,`${name}-story-failure.png`),fullPage:true});await writeFile(path.join(out,`${name}-story-failure.txt`),String(error));throw error;}finally{await browser.close();}
 }
 await writeFile(path.join(out,'story-surface-qa.json'),JSON.stringify(reports,null,2));console.log('STORY_SURFACE_QA_PASS',JSON.stringify(reports));
}finally{server?.kill('SIGTERM');}
