import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
const require=createRequire(path.join(root,'package.json'));
const {chromium,webkit}=require('playwright');
const {PNG}=require('pngjs');
const out=path.join(root,'qa-results');await fs.mkdir(out,{recursive:true});
const server=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','-p','3100'],{cwd:root,stdio:'inherit'});
const summary=[];
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
const key='moakit-play-project-v1';
async function saved(page){await page.waitForFunction(k=>!!localStorage.getItem(k),key);await page.waitForTimeout(450);return page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);}
async function png(download,label){const dest=path.join(out,label);await download.saveAs(dest);const decoded=PNG.sync.read(await fs.readFile(dest));assert(decoded.width>1000);assert(decoded.height>600);const colors=new Set();for(let i=0;i<decoded.data.length;i+=400)colors.add(decoded.data.subarray(i,i+3).toString('hex'));assert(colors.size>25,`blank image ${label}`);return decoded;}
try{
  for(let n=0;n<80;n++){try{if((await fetch('http://localhost:3100')).ok)break;}catch{}await wait(500);}
  for(const [name,engine]of[['chromium',chromium],['webkit',webkit]]){
    const browser=await engine.launch();
    try{
      const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
      const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto('http://localhost:3100');await saved(page);
      await page.getByLabel('작품 제목',{exact:true}).fill('우리 반의 비밀 상자');
      await page.getByRole('tab',{name:'소품',exact:true}).click();
      assert.equal(await page.locator('.prop-card svg').count(),12);
      await page.getByRole('button',{name:'로봇 눌러서 무대에 놓기'}).click();
      assert.equal((await saved(page)).scenes[0].items.filter(i=>i.kind==='prop').length,2);
      await page.screenshot({path:path.join(out,`${name}-desktop.png`),fullPage:true});
      // Real drag, undo and redo.
      const object=page.getByRole('button',{name:'로봇 이동',exact:true});const box=await object.boundingBox();assert(box);
      await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+45,box.y+box.height/2-20,{steps:6});await page.mouse.up();
      const moved=(await saved(page)).scenes[0].items.find(i=>i.kind==='prop'&&i.data.catalogId==='robot');assert(moved.x>56);
      await page.getByTitle('실행 취소',{exact:true}).click();assert.equal((await saved(page)).scenes[0].items.find(i=>i.kind==='prop'&&i.data.catalogId==='robot').x,56);
      await page.getByTitle('다시 실행',{exact:true}).click();assert((await saved(page)).scenes[0].items.find(i=>i.kind==='prop'&&i.data.catalogId==='robot').x>56);
      await page.getByRole('button',{name:'장면 복사',exact:true}).click();let work=await saved(page);assert.equal(work.scenes.length,2);assert.notEqual(work.scenes[0].items[0].id,work.scenes[1].items[0].id);
      await page.getByRole('button',{name:'저장·출력',exact:true}).click();
      let promise=page.waitForEvent('download');await page.getByRole('button',{name:'작품 파일 보관',exact:false}).click();const backup=await promise;const backupPath=path.join(out,`${name}-work.moakit.json`);await backup.saveAs(backupPath);const data=JSON.parse(await fs.readFile(backupPath,'utf8'));assert.equal(data.scenes.length,2);
      promise=page.waitForEvent('download');await page.getByRole('button',{name:'현재 장면 PNG',exact:false}).click();const image=await png(await promise,`${name}-scene.png`);assert.equal(image.width,2560);assert.equal(image.height,1440);
      promise=page.waitForEvent('download');await page.getByRole('button',{name:'전체 장면 PNG',exact:false}).click();const sheet=await png(await promise,`${name}-storyboard.png`);assert(sheet.width>image.width);
      await page.getByRole('button',{name:'A4 연극 기획서',exact:false}).click();await page.getByRole('button',{name:'인쇄 / PDF 저장',exact:true}).waitFor();
      await page.getByLabel('이름 / 모둠',{exact:true}).fill('샘플 · 별빛 모둠');await page.getByLabel('학급 / 수업',{exact:true}).fill('초등학교 2학년');
      await page.getByLabel('이 장면에서 할 행동',{exact:true}).first().fill('상자를 조심스럽게 열어 본다.');
      assert.equal(await page.locator('.print-scene').count(),2);
      if(name==='chromium'){await page.pdf({path:path.join(out,'MOAKIT-PLAY-sample.pdf'),format:'A4',printBackground:true,preferCSSPageSize:true});}
      await page.screenshot({path:path.join(out,`${name}-outputs.png`),fullPage:true});
      await page.getByRole('button',{name:'출력창 닫기',exact:true}).click();
      // Round-trip import and malformed input must not alter the work.
      page.on('dialog',d=>d.accept());
      await page.locator('input[type=file]').setInputFiles(backupPath);await page.waitForTimeout(450);assert.equal((await saved(page)).scenes.length,2);
      const before=await saved(page);await page.locator('input[type=file]').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{"version":1,"scenes":[{}]}')});await page.getByRole('alert').last().waitFor();assert.deepEqual((await saved(page)).scenes,before.scenes);
      await page.getByRole('button',{name:'▶ 발표하기',exact:true}).click();await page.getByRole('dialog',{name:'연극 발표 화면',exact:true}).waitFor();await page.getByRole('button',{name:'편집으로 돌아가기 ×',exact:true}).click();
      await page.reload();assert.equal((await saved(page)).scenes.length,2);
      for(const viewport of[{width:1024,height:768},{width:390,height:844}]){await page.setViewportSize(viewport);await page.waitForTimeout(200);const sizes=await page.evaluate(()=>[document.documentElement.scrollWidth,innerWidth]);assert(sizes[0]<=sizes[1]+1,`${name} horizontal overflow at ${viewport.width}: ${sizes}`);await page.screenshot({path:path.join(out,`${name}-${viewport.width}.png`),fullPage:true});}
      assert.deepEqual(errors,[]);
      // Corrupt browser storage is preserved, not replaced with demo data.
      const badPage=await context.newPage();await badPage.addInitScript(k=>localStorage.setItem(k,'broken-work'),key);await badPage.goto('http://localhost:3100');await badPage.getByRole('alert').waitFor();await wait(500);assert.equal(await badPage.evaluate(k=>localStorage.getItem(k),key),'broken-work');await badPage.close();
      // Storage quota failure is explicit and the editor still renders.
      const quotaContext=await browser.newContext();await quotaContext.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('Quota','QuotaExceededError');};});const quotaPage=await quotaContext.newPage();await quotaPage.goto('http://localhost:3100');await quotaPage.getByText('저장 확인 필요',{exact:true}).waitFor();await quotaContext.close();
      summary.push({browser:name,result:'PASS',checks:['12 vector props','drag','undo/redo','scene duplication','PNG pixels','storyboard','A4 markup','file backup/import','malformed import rejection','presentation','reload','1024/390 overflow','corrupt storage protection','quota warning']});
      await context.close();
    }finally{await browser.close();}
  }
  console.log('MOAKIT_PLAY_QA_PASS',JSON.stringify(summary));
}finally{await fs.writeFile(path.join(out,'summary.json'),JSON.stringify(summary,null,2));server.kill('SIGTERM');}
