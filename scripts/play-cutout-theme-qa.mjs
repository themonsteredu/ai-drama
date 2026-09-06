import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const app=fileURLToPath(new URL('../apps/play-studio/',import.meta.url)),require=createRequire(path.join(app,'package.json'));
const {chromium,webkit}=require('playwright');
const out=path.join(app,'qa-results');await mkdir(out,{recursive:true});
const server=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','-p','3103'],{cwd:app,stdio:'inherit'});
const titles=['사진 올리기','배경 지우기','손으로 수정하기','자르기','완료하고 무대에 놓기'];
const reports=[];
try{
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:3103/draw')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}assert(ready);
 for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch(),page=await browser.newPage({viewport:{width:1440,height:1050}});page.setDefaultTimeout(20000);page.on('dialog',d=>d.accept());
  try{
   await page.goto('http://127.0.0.1:3103/draw');await page.locator('.draw-title small').filter({hasText:'이 기기에 저장됨'}).waitFor();
   await page.getByLabel('그림 파일 선택',{exact:true}).setInputFiles(fileURLToPath(new URL('./fixtures/approved-dinosaur-photo.webp',import.meta.url)));
   const modal=page.getByRole('dialog',{name:'내 그림 다듬기'}),board=modal.getByLabel('사진 다듬기 작업 영역',{exact:true});
   await page.waitForFunction(()=>document.querySelector('.cutout-dialog canvas')?.width===220);
   const step=async n=>modal.getByRole('button',{name:`${n}단계 ${titles[n-1]}`,exact:true}).click();
   const drag=async(x1,y1,x2,y2)=>{await board.scrollIntoViewIfNeeded();const r=await board.boundingBox();await page.mouse.move(r.x+r.width*x1,r.y+r.height*y1);await page.mouse.down();await page.mouse.move(r.x+r.width*x2,r.y+r.height*y2,{steps:8});await page.mouse.up();};
   await modal.getByLabel('그림 이름',{exact:true}).fill('나의 공룡 친구');await modal.getByRole('button',{name:'동물',exact:true}).click();
   await step(4);await drag(.12,.12,.96,.94);await step(2);await modal.getByRole('button',{name:'배경 지우기',exact:true}).click();
   await page.waitForFunction(()=>!document.querySelector('.cutout-auto').disabled,null,{timeout:55000});
   assert.equal(await modal.locator('.cutout-error').count(),0,'real background cleanup must complete');
   await step(3);
   const erase=modal.getByRole('button',{name:'지우기',exact:true}),restore=modal.getByRole('button',{name:'다시 살리기',exact:true});
   assert.equal(await erase.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 227, 237)','selected eraser must remain PINK, never inherit green from the studio');
   assert.equal(await restore.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(224, 241, 255)','restore must remain BLUE');
   await restore.click();assert.equal(await restore.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(224, 241, 255)','selected restore must remain blue');await erase.click();
   // Genuine pointer strokes clean the remaining gray paper in this known test photo.
   // This is hand-edit interaction, not a claim that GrabCut automatically removes it.
   await modal.getByRole('button',{name:'브러시 작게',exact:true}).click();
   for(let y=.145;y<.58;y+=.015){const start=y<.218?.34:y<.27?.52:y<.34?.58:y<.41?.63:y<.48?.67:y<.535?.74:.88;await drag(start,y,.96,y);}
   await modal.getByRole('button',{name:'브러시 보통',exact:true}).click();
   for(const width of [1440,1024,390]){
    await page.setViewportSize({width,height:1050});
    for(const n of [2,3,4,5]){
     await step(n);await page.evaluate(()=>document.fonts.ready);await modal.evaluate(e=>e.scrollTop=0);
     assert(await modal.evaluate(e=>e.scrollWidth<=e.clientWidth+2),`overflow ${width} step ${n}`);
     if(n===3)assert.equal(await modal.getByRole('button',{name:'지우기',exact:true}).evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 227, 237)');
     await modal.screenshot({path:path.join(out,`${name}-approved-cutout-step${n}-${width}.png`)});
    }
   }
   reports.push({browser:name,status:'PASS',checks:['pink eraser in selected state','blue restore in selected state','colors preserved at phone/tablet widths','real background extraction followed by actual hand editing','actual browser screenshots, no screenshot retouching']});
  }catch(error){await page.screenshot({path:path.join(out,`${name}-theme-failure.png`),fullPage:true});await writeFile(path.join(out,`${name}-theme-failure.txt`),String(error));throw error;}finally{await browser.close();}
 }
 await writeFile(path.join(out,'cutout-theme-qa.json'),JSON.stringify(reports,null,2));console.log('CUTOUT_THEME_QA_PASS',JSON.stringify(reports));
}finally{server.kill('SIGTERM');}
