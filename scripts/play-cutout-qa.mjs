import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
const app=fileURLToPath(new URL('../apps/play-studio/',import.meta.url)),require=createRequire(path.join(app,'package.json'));
const {chromium,webkit}=require('playwright'),{PNG}=require('pngjs');
const out=path.join(app,'qa-results');await mkdir(out,{recursive:true});
const server=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','-p','3102'],{cwd:app,stdio:'inherit'});
function fixture(){const p=new PNG({width:360,height:300});for(let y=0;y<300;y++)for(let x=0;x<360;x++){const i=(y*360+x)*4,body=(x-180)**2/6400+(y-150)**2/8100<1,stem=x>165&&x<195&&y>180&&y<262;const shade=(x*7+y*11)%12;p.data[i]=body?49:stem?140:243+shade;p.data[i+1]=body?145:stem?95:243+shade;p.data[i+2]=body?94:stem?55:243+shade;p.data[i+3]=255;}return PNG.sync.write(p);}
async function saved(page){await page.waitForTimeout(600);return page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('moakit-play-drawings-v1',1);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,q=db.transaction('projects').objectStore('projects').get('active');q.onsuccess=()=>{db.close();resolve(q.result);};q.onerror=()=>reject(q.error);};}));}
async function pixels(page,source,x,y){return page.evaluate(async({source,x,y})=>{const image=new Image();image.src=source;await image.decode();const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);return [...ctx.getImageData(x,y,1,1).data];},{source,x,y});}
async function point(page,locator,x,y){await locator.scrollIntoViewIfNeeded();const r=await locator.boundingBox();await page.mouse.click(r.x+r.width*x,r.y+r.height*y);}
async function drag(page,locator,x1,y1,x2,y2){await locator.scrollIntoViewIfNeeded();const r=await locator.boundingBox();await page.mouse.move(r.x+r.width*x1,r.y+r.height*y1);await page.mouse.down();await page.mouse.move(r.x+r.width*x2,r.y+r.height*y2,{steps:12});await page.mouse.up();}
const names=['사진 올리기','배경 지우기','손으로 수정하기','자르기','완료하고 무대에 놓기'];
async function step(modal,n){await modal.getByRole('button',{name:`${n}단계 ${names[n-1]}`,exact:true}).click();assert.equal(await modal.getAttribute('data-step'),String(n));assert.equal(await modal.locator('[aria-current="step"]').count(),1);}
async function finish(modal,label){if(await modal.getAttribute('data-step')!=='5')await modal.getByRole('button',{name:'다 됐어요!',exact:true}).click();await modal.getByRole('button',{name:label,exact:true}).click();await modal.waitFor({state:'hidden'});}
const reports=[];
try{
  let ready=false;for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:3102/draw')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}assert(ready);
  for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
    const browser=await engine.launch();const context=await browser.newContext({viewport:{width:1440,height:1050},acceptDownloads:true});const page=await context.newPage();page.setDefaultTimeout(20000);const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',d=>d.accept());
    try{
      await page.goto('http://127.0.0.1:3102/draw');await page.locator('.draw-title small').filter({hasText:'이 기기에 저장됨'}).waitFor();
      await page.getByLabel('그림 파일 선택',{exact:true}).setInputFiles({name:'나의 초록 친구.png',mimeType:'image/png',buffer:fixture()});
      const modal=page.getByRole('dialog',{name:'내 그림 다듬기'}),board=modal.getByLabel('사진 다듬기 작업 영역',{exact:true});
      await modal.waitFor();await page.waitForFunction(()=>document.querySelector('.cutout-dialog canvas')?.width===360);
      assert.equal(await modal.getAttribute('data-step'),'2');assert.equal(await modal.getByRole('button',{name:'지우기',exact:true}).count(),0,'brush tools hidden before step 3');
      assert.equal(await modal.locator('.cutout-crop-box').count(),0,'no crop handles in background step');
      assert.equal(await modal.getByRole('button',{name:'무대에 놓기',exact:true}).count(),0,'explicit finish preview before placement');
      await modal.getByLabel('그림 이름',{exact:true}).fill('초록친구');await modal.getByLabel('투명한 여백 줄이기',{exact:true}).uncheck();
      await modal.getByRole('checkbox',{name:/흰 종이 지우기/}).check();
      await step(modal,3);await modal.getByRole('button',{name:'지우기',exact:true}).click();await point(page,board,.5,.5);
      const comparison=await modal.getByAltText('등록할 내 그림 미리보기').getAttribute('src');await step(modal,4);await step(modal,3);assert.equal(await modal.getByAltText('등록할 내 그림 미리보기').getAttribute('src'),comparison,'step changes preserve mask');
      await finish(modal,'무대에 놓기');
      let doc=await saved(page),asset=doc.assets[0];assert(asset.edit,'original and mask must persist');assert(asset.source.startsWith('data:image/png;'));assert.equal((await pixels(page,asset.source,180,150))[3],0,'erase modifies alpha');assert.equal((await pixels(page,asset.source,0,0))[3],0,'paper alpha');
      const original=asset.edit.original;
      await page.getByRole('button',{name:'초록친구 다듬기',exact:true}).click();await modal.waitFor();await page.waitForFunction(()=>document.querySelector('.cutout-dialog canvas')?.width===360);
      await step(modal,3);await modal.getByRole('button',{name:'다시 살리기',exact:true}).click();await point(page,board,.5,.5);
      await modal.getByRole('button',{name:'브러시 작게',exact:true}).click();assert.equal(await modal.getByRole('button',{name:'브러시 작게',exact:true}).getAttribute('aria-pressed'),'true');await modal.getByRole('button',{name:'브러시 보통',exact:true}).click();
      await modal.getByRole('button',{name:'원본 보기',exact:true}).click();assert.equal(await modal.getByRole('button',{name:'원본 보기',exact:true}).getAttribute('aria-pressed'),'true');await modal.getByRole('button',{name:'원본 보기',exact:true}).click();
      await step(modal,4);await modal.getByRole('button',{name:'자르기',exact:true}).click();await drag(page,board,.20,.10,.80,.92);
      const cropBefore=await modal.locator('.cutout-crop-box').getAttribute('style');await modal.getByRole('button',{name:'다듬기 실행 취소',exact:true}).click();assert.notEqual(await modal.locator('.cutout-crop-box').getAttribute('style'),cropBefore);await modal.getByRole('button',{name:'다듬기 다시 실행',exact:true}).click();assert.equal(await modal.locator('.cutout-crop-box').getAttribute('style'),cropBefore);
      await modal.getByRole('button',{name:'크게 보기',exact:true}).click();await modal.getByRole('button',{name:'화면에 맞추기',exact:true}).click();
      await modal.screenshot({path:path.join(out,`${name}-cutout-editor.png`)});
      await finish(modal,'수정 적용');doc=await saved(page);asset=doc.assets[0];assert.equal(doc.assets.length,1,'re-edit updates same asset');assert.equal(doc.scenes[0].items.length,1,'re-edit does not add placements');assert.equal(asset.edit.original,original);assert(asset.edit.crop.width<300&&asset.edit.crop.width>150);const cx=Math.floor(180-asset.edit.crop.x),cy=Math.floor(150-asset.edit.crop.y);assert.equal((await pixels(page,asset.source,cx,cy))[3],255,'restore survives crop');
      await page.getByRole('button',{name:'초록친구 다듬기',exact:true}).click();await modal.waitFor();await page.waitForFunction(()=>document.querySelector('.cutout-dialog canvas')?.width===360);
      const unchanged=JSON.stringify(await saved(page));await step(modal,4);await modal.getByRole('button',{name:'전체 사진',exact:true}).click();await modal.getByRole('button',{name:'취소',exact:true}).click();await modal.waitFor({state:'hidden'});assert.equal(JSON.stringify(await saved(page)),unchanged,'cancel must not change project');
      await page.getByText('작품 보관·불러오기',{exact:true}).click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'작품 파일 보관',exact:true}).click();const d=await download;const backupPath=path.join(out,`${name}-cutout.moakit-drawing.json`);await d.saveAs(backupPath);const bytes=await readFile(backupPath);
      await page.getByRole('button',{name:'새 작품',exact:true}).click();await saved(page);await page.getByLabel('내 그림 작품 파일 선택',{exact:true}).setInputFiles({name:'backup.json',mimeType:'application/json',buffer:bytes});doc=await saved(page);assert.equal(doc.assets[0].edit.original,original);assert(doc.assets[0].edit.mask.startsWith('data:image/png;'));
      const bad=structuredClone(doc);bad.assets[0].edit.original='https://example.com/tracker.png';await page.getByLabel('내 그림 작품 파일 선택',{exact:true}).setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))});await page.locator('.draw-alert').waitFor();assert.equal((await saved(page)).assets[0].edit.original,original);await page.getByRole('button',{name:'안내 닫기',exact:true}).click();
      await page.reload();await page.locator('.draw-title small').filter({hasText:'이 기기에 저장됨'}).waitFor();await page.getByRole('button',{name:'초록친구 다듬기',exact:true}).click();await modal.waitFor();await page.waitForFunction(()=>document.querySelector('.cutout-dialog canvas')?.width===360);
      for(const width of [1024,390]){await page.setViewportSize({width,height:950});for(const n of [1,2,3,4,5]){await step(modal,n);assert(await modal.evaluate(e=>e.scrollWidth<=e.clientWidth+2),`modal overflow ${name} ${width} step ${n}`);}await modal.evaluate(e=>e.scrollTop=0);await modal.screenshot({path:path.join(out,`${name}-cutout-${width}.png`)});}
      await page.setViewportSize({width:1440,height:1050});await step(modal,2);await modal.getByRole('button',{name:'처음으로',exact:true}).click();await modal.getByRole('button',{name:'배경 지우기',exact:true}).click();
      await page.waitForFunction(()=>!document.querySelector('.cutout-auto').disabled,null,{timeout:55000});
      const message=await modal.locator('.cutout-error').allTextContents();assert.equal(message.length,0,`real OpenCV automatic extraction failed: ${message}`);
      await finish(modal,'수정 적용');asset=(await saved(page)).assets[0];assert.equal((await pixels(page,asset.edit.mask,0,0))[0],0);assert.equal((await pixels(page,asset.edit.mask,180,150))[0],255,'GrabCut keeps foreground');
      // Capture the actual UI with the user's approved concept artwork, not a mock screen.
      await page.getByLabel('그림 파일 선택',{exact:true}).setInputFiles(fileURLToPath(new URL('./fixtures/approved-dinosaur-photo.webp',import.meta.url)));await modal.waitFor();await page.waitForFunction(()=>document.querySelector('.cutout-dialog canvas')?.width===220);
      await modal.getByLabel('그림 이름',{exact:true}).fill('나의 공룡 친구');await modal.getByRole('button',{name:'동물',exact:true}).click();
      await step(modal,4);await drag(page,board,.12,.12,.96,.94);await step(modal,2);await modal.getByRole('button',{name:'배경 지우기',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.cutout-auto').disabled,null,{timeout:55000});
      for(const width of [1440,1024,390]){await page.setViewportSize({width,height:1050});for(const n of [2,3,4,5]){await step(modal,n);await page.evaluate(()=>document.fonts.ready);await modal.evaluate(e=>e.scrollTop=0);assert(await modal.evaluate(e=>e.scrollWidth<=e.clientWidth+2));await modal.screenshot({path:path.join(out,`${name}-guided-step${n}-${width}.png`)});}}
      reports.push({browser:name,result:'PASS',checks:['five-step navigation','stage-specific controls','mask unchanged on step switch','discrete brush sizes','real rectangle crop','erase alpha','restore after reopening','immutable original','live before/after comparison','undo/redo','cancel unchanged','backup and reload','edit URL validation','all steps at mobile/tablet widths','real OpenCV GrabCut','actual UI captures using approved concept test image']});
      assert.equal(errors.length,0,errors.join('\n'));
    }catch(error){await page.screenshot({path:path.join(out,`${name}-cutout-failure.png`),fullPage:true});await writeFile(path.join(out,`${name}-cutout-failure.txt`),String(error));throw error;}finally{await browser.close();}
  }
  await writeFile(path.join(out,'cutout-qa.json'),JSON.stringify(reports,null,2));console.log('CUTOUT_QA_PASS',JSON.stringify(reports));
}finally{server.kill('SIGTERM');}
