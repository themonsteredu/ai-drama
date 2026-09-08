import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {synthMusic,musicPresets,applyMusic,validateMusic} from '../apps/play-studio/lib/drawing-music.ts';
import {emptyDrawingProject,drawingFrame} from '../packages/stage-core/src/drawing.ts';
const app=fileURLToPath(new URL('../apps/play-studio/',import.meta.url)),require=createRequire(path.join(app,'package.json')),{chromium,webkit}=require('playwright');
const out=process.env.PLAY_QA_OUT||path.join(app,'qa-results');await mkdir(out,{recursive:true});
const wav=Buffer.from(await synthMusic('music-cute').arrayBuffer());
let p=emptyDrawingProject();assert(validateMusic(p));p=applyMusic(p,{trackId:'music-calm',volume:.3,loop:true},true);assert(validateMusic(p));assert(!validateMusic({...p,music:{trackId:'missing',volume:.3,loop:true}}));assert(!validateMusic({...p,music:{trackId:'music-calm',volume:2,loop:true}}));assert(!validateMusic({...p,musicAssets:[{id:'audio-x',name:'x',duration:1,source:'https://bad.example/audio.mp3'}]}));
for(const motion of ['float','hop']){const item={x:20,y:60,target:{x:70,y:80},motion,speed:'fast',rotation:0};assert.deepEqual(drawingFrame(item,4),{x:70,y:80,angle:0,phase:6,progress:1});assert.equal(drawingFrame(item,20).y,80);}
const base=process.env.PLAY_QA_URL||'http://127.0.0.1:3107';
const server=process.env.PLAY_QA_URL?null:spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','-p','3107'],{cwd:app,stdio:'inherit'});
const reports=[];
async function saved(page){await page.locator('.draw-title small').filter({hasText:'이 기기에 저장됨'}).waitFor();await page.waitForTimeout(500);return page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('moakit-play-drawings-v1',1);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,q=db.transaction('projects').objectStore('projects').get('active');q.onsuccess=()=>{db.close();resolve(q.result);};};}));}
const playing=page=>page.evaluate(()=>window.__audio.filter(a=>a.dataset.moakitMusic&&!a.paused).map(a=>({time:a.currentTime,src:a.src,loop:a.loop,volume:a.volume})));
async function waitAudio(page){await page.waitForFunction(()=>window.__audio.some(a=>a.dataset.moakitMusic&&!a.paused&&a.currentTime>.15));assert.equal((await playing(page)).length,1,'exactly one actual player');}
async function open(page){await page.getByRole('button',{name:'🎵 음악',exact:true}).click();await page.getByRole('dialog',{name:'🎵 음악',exact:true}).waitFor();}
async function choose(page,name,all=false){await open(page);const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:new RegExp(name+'$')}).click();await dialog.getByLabel(all?'모든 장면':'이 장면만',{exact:true}).check();await dialog.getByRole('button',{name:'적용하기',exact:true}).click();await saved(page);}
async function responsive(page,dialog,name){for(const [width,height]of [[1440,1000],[1024,768],[768,1024],[390,844],[360,640]]){await page.setViewportSize({width,height});await page.waitForTimeout(120);const r=await dialog.boundingBox();assert(r.x>=0&&r.y>=0&&r.x+r.width<=width+1&&r.y+r.height<=height+1,'dialog inside viewport');assert(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'dialog no horizontal overflow');await dialog.getByRole('button',{name:'적용하기',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,`music-${name}-${width}.png`)});}}
try{
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}assert(ready);
 for(const [name,engine]of [['chromium',chromium],['webkit',webkit]]){
  if(process.env.PLAY_QA_BROWSER&&process.env.PLAY_QA_BROWSER!==name)continue;
  const browser=await engine.launch(),page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});page.setDefaultTimeout(25000);page.on('dialog',d=>d.accept());const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(()=>{window.__audio=[];window.__audioErrors=[];const Native=window.Audio;window.Audio=function(...args){const a=new Native(...args);window.__audio.push(a);const play=a.play.bind(a);a.play=()=>play().catch(e=>{window.__audioErrors.push({name:e.name,message:e.message});throw e;});return a;};window.Audio.prototype=Native.prototype;});
  try{
   await page.goto(base);await saved(page);assert.equal((await playing(page)).length,0,'no autoplay');
   await open(page);const dialog=page.getByRole('dialog',{name:'🎵 음악',exact:true});
   for(const preset of musicPresets){await dialog.getByRole('button',{name:preset.label,exact:true}).click();await dialog.getByRole('button',{name:'미리 듣기',exact:true}).click();await waitAudio(page);await dialog.getByRole('button',{name:'미리 듣기 멈춤',exact:true}).click();assert.equal((await playing(page)).length,0);}
   await dialog.getByRole('button',{name:'신나는',exact:true}).click();await dialog.getByRole('button',{name:'미리 듣기',exact:true}).click();await waitAudio(page);await page.keyboard.press('Escape');assert.equal((await playing(page)).length,0,'Escape stops preview');
   await choose(page,'잔잔한',true);await page.locator('.story-add-scene').click();await saved(page);
   await page.getByRole('button',{name:'▶ 움직여 보기',exact:true}).click();await waitAudio(page);let before=(await playing(page))[0];
   await page.locator('.draw-scenes > button').first().click();await page.waitForTimeout(300);let after=(await playing(page))[0];assert.equal(after.src,before.src);assert(after.time>before.time,'common track continues');
   await page.getByRole('button',{name:'Ⅱ 잠깐 멈춤',exact:true}).click();assert.equal((await playing(page)).length,0);let t=Number(await page.locator('canvas.draw-canvas').getAttribute('data-time'));await page.waitForTimeout(300);assert.equal(Number(await page.locator('canvas.draw-canvas').getAttribute('data-time')),t);
   await page.getByRole('button',{name:'▶ 움직여 보기',exact:true}).click();await waitAudio(page);assert((await playing(page))[0].time>=after.time);await page.getByRole('button',{name:'■ 처음으로',exact:true}).click();assert.equal((await playing(page)).length,0);await page.waitForFunction(()=>Number(document.querySelector('.draw-canvas').dataset.time)===0);
   await choose(page,'모험');await page.getByRole('button',{name:'▶ 발표하기',exact:true}).click();await waitAudio(page);before=(await playing(page))[0];await page.getByRole('button',{name:'다음 장면',exact:true}).click();await waitAudio(page);assert.notEqual((await playing(page))[0].src,before.src,'scene-specific track changes');await page.getByRole('button',{name:'편집으로 돌아가기',exact:true}).click();assert.equal((await playing(page)).length,0);
   await choose(page,'음악 없음');assert.equal((await saved(page)).scenes[1].music,null);
   if(name==='webkit'&&process.platform==='win32'){
    // Windows Playwright WebKit plays HTTP WAV, but not data/blob audio URLs.
    // Do not fake media support or count upload playback as passed in this engine.
    await open(page);await dialog.getByLabel('내 음악 파일 선택',{exact:true}).setInputFiles({name:'my-music.wav',mimeType:'audio/wav',buffer:wav});await dialog.getByRole('alert').waitFor();assert.match(await dialog.getByRole('alert').innerText(),/음악을 읽는 시간|재생할 수 없는/);await dialog.getByRole('button',{name:'음악 창 닫기',exact:true}).click();
    const asset={id:'audio-fixture',name:'my-music.wav',source:`data:audio/wav;base64,${wav.toString('base64')}`,duration:32*60/132};const doc=applyMusic(await saved(page),{trackId:asset.id,volume:.24,loop:false},true,asset),bytes=Buffer.from(JSON.stringify(doc));
    await page.getByLabel('내 그림 작품 파일 선택',{exact:true}).setInputFiles({name:'restore.json',mimeType:'application/json',buffer:bytes});await saved(page);await page.reload();assert.equal((await saved(page)).musicAssets[0].source,asset.source);assert.equal((await playing(page)).length,0);await open(page);assert.equal(await dialog.getByLabel('음악 소리 크기').inputValue(),'24');assert.equal(await dialog.getByLabel('반복해서 듣기').isChecked(),false);await responsive(page,dialog,name);await dialog.getByRole('button',{name:'음악 창 닫기',exact:true}).click();assert.deepEqual(errors,[]);
    reports.push({browser:name,status:'PASS_WITH_MEDIA_LIMITATION',checks:['six actual HTTP WAV presets','preview stop and Escape','common track continuity','scene transition','pause/resume/reset','presentation auto-start and exit','silence override','inline audio unsupported error shown','uploaded asset JSON import and IndexedDB restore','1440/1024/768/390/360 modal bounds','no runtime errors'],limitation:'Windows Playwright WebKit cannot play data/blob audio URLs. Uploaded audio playback requires Safari/macOS/iOS verification; not counted as passed here.'});continue;
   }
   await open(page);await dialog.getByLabel('내 음악 파일 선택',{exact:true}).setInputFiles({name:'my-music.wav',mimeType:'audio/wav',buffer:wav});await dialog.getByRole('option',{name:'my-music.wav'}).waitFor({state:'attached'});await dialog.getByLabel('모든 장면',{exact:true}).check();await dialog.getByLabel('음악 소리 크기').fill('24');await dialog.getByLabel('반복해서 듣기').uncheck();await dialog.getByRole('button',{name:'적용하기',exact:true}).click();let doc=await saved(page);assert.equal(doc.musicAssets.length,1);assert.equal(doc.music.volume,.24);assert.equal(doc.music.loop,false);assert(doc.scenes.every(s=>s.music===undefined));
   await page.getByRole('button',{name:'▶ 움직여 보기',exact:true}).click();await waitAudio(page);assert.equal((await playing(page))[0].loop,false);assert(Math.abs((await playing(page))[0].volume-.24)<.001);
   const download=page.waitForEvent('download');await page.getByRole('button',{name:'작품 보관',exact:true}).click();const backup=path.join(out,`music-${name}.json`);await(await download).saveAs(backup);const bytes=await readFile(backup);assert.equal(JSON.parse(bytes).musicAssets[0].source,doc.musicAssets[0].source);
   await page.reload();await saved(page);assert.equal((await playing(page)).length,0);assert.equal((await saved(page)).musicAssets[0].source,doc.musicAssets[0].source);
   await choose(page,'긴장',true);await page.getByLabel('내 그림 작품 파일 선택',{exact:true}).setInputFiles({name:'restore.json',mimeType:'application/json',buffer:bytes});await saved(page);assert.equal((await saved(page)).musicAssets[0].source,doc.musicAssets[0].source);
   await page.getByRole('button',{name:'▶ 움직여 보기',exact:true}).click();await waitAudio(page);await open(page);assert.equal((await playing(page)).length,0,'dialog pauses stage');
   await dialog.getByLabel('내 음악 파일 선택',{exact:true}).setInputFiles({name:'bad.mp3',mimeType:'audio/mpeg',buffer:Buffer.from('not audio')});await dialog.getByRole('alert').waitFor();assert.match(await dialog.getByRole('alert').innerText(),/재생할 수 없는/);
   await dialog.getByLabel('내 음악 파일 선택',{exact:true}).setInputFiles({name:'big.wav',mimeType:'audio/wav',buffer:Buffer.alloc(3_000_001)});await page.waitForTimeout(100);assert.match(await dialog.getByRole('alert').innerText(),/3MB/);
   await responsive(page,dialog,name);
   await dialog.getByRole('button',{name:'음악 창 닫기',exact:true}).click();assert.equal((await playing(page)).length,0);
   assert.deepEqual(errors,[]);reports.push({browser:name,status:'PASS',checks:['six audible PCM presets','preview stop and Escape','common track continuity','scene track transition','pause/resume/reset','presentation auto-start and exit','silence override','upload volume/loop','single-copy JSON export/import','IndexedDB refresh, no autoplay','invalid/oversized upload rejection','1440/1024/768/390/360 modal bounds','no runtime errors']});
  }catch(error){console.log(name,await page.evaluate(()=>({errors:window.__audioErrors,audio:window.__audio.map(a=>({paused:a.paused,ready:a.readyState,error:a.error?.message,time:a.currentTime,src:a.src.slice(0,90)}))})));await page.screenshot({path:path.join(out,`music-${name}-failure.png`)});throw error;}finally{await browser.close();}
 }
 await writeFile(path.join(out,'music-report.json'),JSON.stringify({url:base,browsers:reports,unit:['old project compatible','invalid settings/references rejected','hop/float settle after arrival']},null,2));console.log('MUSIC_QA_PASS',JSON.stringify(reports));
}finally{server?.kill('SIGTERM');}
