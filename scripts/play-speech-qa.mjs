import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {wrapSpeech,speechTextLayout,renderDrawingSpeech,newSpeechView} from '../apps/play-studio/lib/drawing-speech.ts';
const app=fileURLToPath(new URL('../apps/play-studio/',import.meta.url));
const require=createRequire(path.join(app,'package.json')),{chromium,webkit}=require('playwright'),{PNG}=require('pngjs');
const out=path.join(app,'qa-results');await mkdir(out,{recursive:true});
const ctx={font:'',save(){},restore(){},measureText(t){return {width:[...new Intl.Segmenter('ko',{granularity:'grapheme'}).segment(t)].length*14};},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},stroke(){},roundRect(){},fillText(){}};
let unitChecks=0;
for(const width of [280,390,700,1280])for(const text of ['안녕!','긴대사는띄어쓰기가없어도끝까지보여야해'.repeat(300),'👩‍👩‍👧‍👦 안녕!\n\n가나다 '.repeat(60),'시작'+'\n'.repeat(100)+'끝','끝\n']){
 const l=speechTextLayout(ctx,text,width);assert.equal(l.lines.map(line=>text.slice(line.start,line.end)).join(''),text,'no lost characters');
 assert(l.font*width/1280>=14,'readable type size');const v=newSpeechView();v.displayWidth=width;
 const actor={id:'a',name:'공룡',text,x:20,y:40,width:240,height:300};
 for(let p=0;p<l.pages;p++){
  const [b]=renderDrawingSpeech(ctx,[actor],v);assert.equal(b.page,p);assert(b.x>=0&&b.y>=0&&b.x+b.width<=1280.01&&b.y+b.height<=720.01,'bounds');
  if(p<l.pages-1)v.cursors.set('a',{text,offset:b.next});
 }
 unitChecks++;
}
assert.equal(renderDrawingSpeech(ctx,[{id:'a',name:'a',text:'  \n',x:0,y:0,width:1,height:1}],newSpeechView()).length,0);
const base=process.env.PLAY_QA_URL||'http://127.0.0.1:3106';
const server=process.env.PLAY_QA_URL?null:spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','-p','3106'],{cwd:app,stdio:'inherit'});
const reports=[];
const longText='안녕! 나는 네가 직접 그린 공룡이야. 오늘은 숲에서 친구들을 만나고, 비가 오면 커다란 나무 아래에서 쉬고 싶어. 우리 함께 새로운 이야기를 만들어 볼까?\n\n'.repeat(40)+'마지막 문장도 사라지면 안 돼!';
async function saved(page){await page.waitForTimeout(700);return page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('moakit-play-drawings-v1',1);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,q=db.transaction('projects').objectStore('projects').get('active');q.onsuccess=()=>{db.close();resolve(q.result);};q.onerror=()=>reject(q.error);};}));}
async function inside(page){assert(await page.evaluate(()=>{const stage=document.querySelector('.draw-canvas').getBoundingClientRect();return [...document.querySelectorAll('.drawing-speech-box')].every(e=>{const r=e.getBoundingClientRect();return r.left>=stage.left-1&&r.top>=stage.top-1&&r.right<=stage.right+1&&r.bottom<=stage.bottom+1;});}),'speech stays in stage');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page has no horizontal overflow');}
try{
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}assert(ready);
 for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch(),page=await browser.newPage({viewport:{width:1440,height:1100},acceptDownloads:true});page.setDefaultTimeout(20000);page.on('dialog',d=>d.accept());const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  try{
   await page.goto(base);await page.locator('.draw-title small').filter({hasText:'이 기기에 저장됨'}).waitFor();
   await page.getByRole('button',{name:/공룡 사진으로 연습하기/}).click();const modal=page.getByRole('dialog',{name:'내 그림 다듬기'});await modal.waitFor();await page.waitForFunction(()=>document.querySelector('.cutout-dialog canvas')?.width>1);
   await modal.getByLabel('그림 이름',{exact:true}).fill('공룡');await modal.getByRole('button',{name:'배경 지우기',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.cutout-dialog')?.getAttribute('aria-busy')==='false',null,{timeout:55000});
   await modal.getByRole('button',{name:'다 됐어요!',exact:true}).click();await modal.getByRole('button',{name:'무대에 놓기',exact:true}).click();await modal.waitFor({state:'hidden'});
   const input=page.getByRole('textbox',{name:'이 그림의 대사',exact:true});assert.equal(await input.getAttribute('maxlength'),null);await input.fill('안녕!');await page.locator('.drawing-speech-box').waitFor();const small=await page.locator('.drawing-speech-box').boundingBox();
   await input.fill(longText);assert.equal(await input.inputValue(),longText);await inside(page);assert(Number(await page.locator('.drawing-speech-box').getAttribute('data-pages'))>1);assert((await page.locator('.drawing-speech-box').boundingBox()).height>small.height);
   await page.getByRole('button',{name:'공룡 다음 대사',exact:true}).click();assert.equal(await page.locator('.drawing-speech-box').getAttribute('data-page'),'2');await page.getByRole('button',{name:'공룡 이전 대사',exact:true}).click();assert.equal(await page.locator('.drawing-speech-box').getAttribute('data-page'),'1');
   let doc=await saved(page);assert.equal(doc.scenes[0].items[0].speech,longText);
   let event=page.waitForEvent('download');await page.getByRole('button',{name:'작품 보관',exact:true}).click();let dl=await event;const backup=path.join(out,`speech-${name}.json`);await dl.saveAs(backup);const bytes=await readFile(backup);assert.equal(JSON.parse(bytes.toString()).scenes[0].items[0].speech,longText);
   await page.reload();await page.locator('.draw-title small').filter({hasText:'이 기기에 저장됨'}).waitFor();await page.getByRole('button',{name:'공룡',exact:true}).click();assert.equal(await input.inputValue(),longText);
   await input.fill('띄어쓰기없이길게적는대사'.repeat(600));await inside(page);assert((await saved(page)).scenes[0].items[0].speech.length>5000);
   await page.getByLabel('내 그림 작품 파일 선택',{exact:true}).setInputFiles({name:'restore.json',mimeType:'application/json',buffer:bytes});doc=await saved(page);assert.equal(doc.scenes[0].items[0].speech,longText,'long dialogue import is valid');
   await page.getByRole('button',{name:'공룡',exact:true}).click();await page.getByRole('button',{name:'이동',exact:true}).click();await page.getByRole('button',{name:'도착할 곳 고르기',exact:false}).click();const stage=await page.locator('.draw-canvas').boundingBox();await page.locator('.draw-canvas').click({position:{x:stage.width*.93,y:stage.height*.05}});
   await page.getByRole('button',{name:'▶ 움직여 보기',exact:true}).click();await page.waitForTimeout(900);await inside(page);const t=Number(await page.locator('.draw-canvas').getAttribute('data-time'));await page.getByRole('button',{name:'공룡 다음 대사',exact:true}).click();assert(Number(await page.locator('.draw-canvas').getAttribute('data-time'))>=t,'turn page does not restart motion');await page.getByRole('button',{name:'■ 처음으로',exact:true}).click();
   await page.getByRole('button',{name:'▶ 발표하기',exact:true}).click();await inside(page);await page.getByRole('button',{name:'공룡 다음 대사',exact:true}).click();await page.getByRole('button',{name:'편집으로 돌아가기',exact:true}).click();
   event=page.waitForEvent('download');await page.getByRole('button',{name:'PNG 저장',exact:true}).click();dl=await event;const png=path.join(out,`speech-${name}-export.png`);await dl.saveAs(png);assert.equal(PNG.sync.read(await readFile(png)).width,2560);
   for(const width of [1440,1024,390]){await page.setViewportSize({width,height:1100});if(width===390)await page.getByRole('button',{name:'무대',exact:true}).click();await page.waitForTimeout(250);await inside(page);await page.screenshot({path:path.join(out,`speech-${name}-${width}.png`),fullPage:true});}
   await page.getByRole('button',{name:'공룡 다음 대사',exact:true}).click();await inside(page);const button=await page.getByRole('button',{name:'공룡 다음 대사',exact:true}).boundingBox();assert(button.width>=43&&button.height>=43);
   await page.getByRole('button',{name:'움직임·효과',exact:true}).click();await input.fill('안녕!\n\n나는 👩‍👩‍👧‍👦 친구들이랑 놀고 싶어.');assert.equal(await input.inputValue(),'안녕!\n\n나는 👩‍👩‍👧‍👦 친구들이랑 놀고 싶어.');await page.getByRole('button',{name:'무대',exact:true}).click();await inside(page);
   assert.deepEqual(errors,[]);reports.push({browser:name,status:'PASS',checks:['no maxlength','long speech remains intact','5000+ no-space characters','pages and keyboard-accessible buttons','IndexedDB reload','JSON backup/import','motion does not restart on next page','presentation paging','PNG export','1440/1024/390 stage bounds','44px touch targets','newlines and emoji']});
  }catch(error){await page.screenshot({path:path.join(out,`speech-${name}-failure.png`),fullPage:true});await writeFile(path.join(out,`speech-${name}-failure.txt`),String(error));throw error;}finally{await browser.close();}
 }
 await writeFile(path.join(out,'speech-report.json'),JSON.stringify({unitChecks,browsers:reports,scope:'Dialogue only; does not supersede the existing cutout resize issue.'},null,2));console.log('SPEECH_QA_PASS',JSON.stringify(reports));
}finally{server?.kill('SIGTERM');}
