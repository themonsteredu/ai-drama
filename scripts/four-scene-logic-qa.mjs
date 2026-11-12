import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const root=process.cwd(),require=createRequire(path.join(root,'apps/play-studio/package.json')),ts=require('typescript');
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'moakit-film-qa-'));
async function compile(file){const input=path.join(root,file),output=path.join(temp,file.replace(/\.ts$/,'.js'));await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,ts.transpileModule(await fs.readFile(input,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText);}
try{
 for(const file of await fs.readdir(path.join(root,'apps/play-studio/lib')))if(file.endsWith('.ts'))await compile('apps/play-studio/lib/'+file);
 await compile('packages/stage-core/src/drawing.ts');await compile('apps/play-studio/app/api/film-background/route.ts');
 const local=createRequire(path.join(temp,'entry.js'));
 const {sceneSeconds,movieSeconds,movieTimeline}=local('./apps/play-studio/lib/drawing-movie.js');
 const {emptyFourSceneProject,prepareFourScenes,putScenePicture}=local('./apps/play-studio/lib/four-scene.js');
 const {validateDrawingProject,parseDrawingFile}=local('./apps/play-studio/lib/drawing-project.js');
 const {applyVoice}=local('./apps/play-studio/lib/drawing-voice.js');
 let p=emptyFourSceneProject();assert.equal(p.scenes.length,4);assert(validateDrawingProject(p));
 const voice={id:'voice-test',source:'data:audio/wav;base64,UklGRg==',duration:32};
 p=applyVoice(p,p.scenes[0].id,voice);assert.equal(sceneSeconds(p.scenes[0]),32);
 p.scenes[0].durationSeconds=40;assert.equal(sceneSeconds(p.scenes[0]),40);
 p.scenes[0].durationSeconds=2;assert.equal(sceneSeconds(p.scenes[0]),32,'cannot truncate dialogue');
 p.scenes[0].durationSeconds=40;assert.equal(movieSeconds(p),52);assert.equal(parseDrawingFile(JSON.stringify(p)).scenes[0].voice.duration,32);
 assert(!validateDrawingProject({...p,scenes:p.scenes.map(s=>({...s,durationSeconds:-2}))}));
 console.log('PASS: four scenes, imported 32-second dialogue, manual timing, no dialogue truncation and backup round trip.');
 const durations=[2.25,3.5,1.75,4];let timed=emptyFourSceneProject();
 for(const [i,duration] of durations.entries())timed=applyVoice(timed,timed.scenes[i].id,{...voice,id:'voice-take-'+i,duration});
 assert.deepEqual(movieTimeline(timed).map(s=>s.seconds),durations);
 assert.deepEqual(movieTimeline(timed).map(s=>s.at),[0,2.25,5.75,7.5]);assert.equal(movieSeconds(timed),11.5);
 timed={...timed,narration:{id:'full',source:voice.source,duration:32,enabled:true},scenes:timed.scenes.map((s,i)=>i===0?{...s,durationSeconds:15}:s)};
 const timedBefore=JSON.stringify(timed),replacement=applyVoice(timed,timed.scenes[0].id,{...voice,id:'replacement',duration:1.25});
 assert.equal(replacement.narration.enabled,false);assert.equal(replacement.narration.source,timed.narration.source);
 assert.equal(replacement.scenes[0].durationSeconds,undefined);assert.equal(sceneSeconds(replacement.scenes[0]),1.25);
 assert.deepEqual(replacement.scenes.slice(1),timed.scenes.slice(1));assert.equal(JSON.stringify(timed),timedBefore);
 assert.equal(applyVoice(timed,'missing',voice),timed);assert.equal(sceneSeconds(emptyFourSceneProject().scenes[0]),4);
 assert.equal(sceneSeconds({...replacement.scenes[0],durationSeconds:.5}),1.25);
 console.log('PASS: fractional per-scene audio ends at exact cuts, short recordings, replacement resets automatic length, full narration retained but disabled, immutable undo data.');
 const {deleteDrawingScene}=local('./apps/play-studio/lib/drawing-removal.js');
 const {addNarration}=local('./apps/play-studio/lib/film-narration.js');
 const middle=addNarration({...timed,activeSceneId:timed.scenes[1].id,narration:undefined},voice),middleBefore=JSON.stringify(middle);
 const removedScene=deleteDrawingScene(middle,middle.activeSceneId);
 assert.equal(removedScene.scenes.length,3);assert.equal(removedScene.activeSceneId,timed.scenes[0].id);
 assert.deepEqual(removedScene.scenes,[timed.scenes[0],timed.scenes[2],timed.scenes[3]]);
 assert.deepEqual(removedScene.assets,middle.assets);assert.equal(removedScene.narration.enabled,false);assert.equal(removedScene.narration.original.source,middle.narration.original.source);
 assert.equal(JSON.stringify(middle),middleBefore,'deletion retains the entire undo snapshot');assert(validateDrawingProject(removedScene));
 assert.equal(deleteDrawingScene(middle,timed.scenes[3].id).activeSceneId,middle.activeSceneId);
 assert.equal(deleteDrawingScene(middle,'missing'),middle);
 const single={...middle,scenes:[middle.scenes[1]]},cleared=deleteDrawingScene(single,single.activeSceneId);
 assert.equal(cleared.scenes.length,1);assert.equal(cleared.scenes[0].id,single.activeSceneId);assert.equal(cleared.scenes[0].voice,undefined);assert.equal(cleared.scenes[0].items.length,0);assert(validateDrawingProject(cleared));
 console.log('PASS: active/nonactive/last scene deletion, adjacent selection, retained original audio/assets, safe empty slot and immutable undo.');

 const raster='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jE9sAAAAASUVORK5CYII=';
 const character={id:'kept-character',name:'아이 그림',kind:'person',width:1,height:1,source:raster};
 const spare={...character,id:'unused-library-picture',name:'보관 중 그림'};
 let legacy={...p,assets:[character,spare],scenes:[{...p.scenes[0],weather:'wind',items:[{id:'actor',assetId:character.id,x:50,y:70,width:20,rotation:0,flipped:false,motion:'hop',speed:'slow',speech:'안녕'}]}]};
 const prepared=prepareFourScenes(legacy);assert.equal(prepared.scenes.length,4);assert.deepEqual(prepared.scenes[0],legacy.scenes[0]);assert.deepEqual(prepared.assets,legacy.assets);
 const extended=putScenePicture(prepared,prepared.scenes[0].id,{source:raster,width:1,height:1});
 assert(extended.assets.some(a=>a.id===spare.id),'unused library drawings survive');assert.deepEqual(extended.scenes[0].items,legacy.scenes[0].items,'character motions survive');assert.equal(extended.scenes[0].weather,'wind');assert.equal(extended.scenes[0].voice.duration,32);assert(validateDrawingProject(extended));
 const six={...extended,scenes:[...extended.scenes,{...extended.scenes[1],id:'fifth'},{...extended.scenes[1],id:'sixth'}]};assert.equal(prepareFourScenes(six).scenes.length,6,'existing scenes are never truncated');
 console.log('PASS: original characters/motion/weather, unused library drawings, dialogue, existing scenes and backups survive integrated four-scene additions.');
 const {drawingFrame,drawingMotions,motionsFor}=local('./packages/stage-core/src/drawing.js');
 const {actionPose,gaitPoint}=local('./apps/play-studio/lib/drawing-actions.js');
 for(const motion of drawingMotions.map(m=>m.id)){
  const actor={...legacy.scenes[0].items[0],motion,speed:'normal',target:{x:80,y:75}};
  const project={...legacy,scenes:[{...legacy.scenes[0],items:[actor]}]};
  assert(validateDrawingProject(project));assert.equal(parseDrawingFile(JSON.stringify(project)).scenes[0].items[0].motion,motion);
  if(motion!=='still'){const end=drawingFrame(actor,30);assert.equal(end.x,80);assert.equal(end.y,75);assert.equal(end.angle,actor.rotation);assert.deepEqual(actionPose(actor,end.phase,end.progress),{gait:0,scaleX:1,scaleY:1});}
 }
 for(const motion of ['walk','run','dance'])assert(motionsFor('person').includes(motion));
 const baseActor=legacy.scenes[0].items[0];
 for(const running of [false,true])for(const gait of [-1,-.5,0,.5,1]){
  for(const u of [0,.25,.5,.75,1])assert.deepEqual(gaitPoint(u,.5,gait,running),{x:u,y:.5},'upper body stays intact at the join');
  for(let row=0;row<6;row++)for(let col=0;col<4;col++){
   const points=[[col/4,.5+row/12],[(col+1)/4,.5+row/12],[(col+1)/4,.5+(row+1)/12],[col/4,.5+(row+1)/12]].map(([u,v])=>gaitPoint(u,v,gait,running));
   for(const [a,b,c] of [[0,1,2],[0,2,3]]){const p=points[a],q=points[b],r=points[c];assert((q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x)>0,'no mesh fold or inverted drawing pieces');}
  }
 }
 assert(gaitPoint(.25,1,-1).y<gaitPoint(.75,1,-1).y);assert(gaitPoint(.75,1,1).y<gaitPoint(.25,1,1).y,'feet alternate');
 assert.deepEqual(actionPose({...baseActor,motion:'run'},0,0),{gait:0,scaleX:1,scaleY:1},'paused drawing keeps original shape');
 const walking={...baseActor,speed:'normal',motion:'walk',target:{x:80,y:75}},running={...walking,motion:'run'};
 assert(drawingFrame(running,2).progress>drawingFrame(walking,2).progress,'running also travels faster');
 assert.notEqual(actionPose({...baseActor,motion:'dance',target:undefined},.5,0).scaleY,1,'dance changes the pose in place');
 console.log('PASS: old/new motion backups, alternating feet, continuous non-folding deformation, neutral start/end poses, faster running and looping dance.');
 const {removeDrawingAsset,removeSceneBackground}=local('./apps/play-studio/lib/drawing-removal.js');
 const resultAsset={...character,id:'generated-background',kind:'background'},original={...character,id:'original-background',kind:'background'};
 const withShared={...extended,assets:[...extended.assets,resultAsset,original],scenes:extended.scenes.map((scene,i)=>({...scene,backgroundAssetId:i===0?resultAsset.id:scene.backgroundAssetId,stillOriginalAssetId:i===0?original.id:scene.stillOriginalAssetId,protectedMask:i===0?raster:scene.protectedMask,items:[...scene.items,{...legacy.scenes[0].items[0],id:'shared-'+i}]}))};
 const before=JSON.stringify(withShared),removed=removeDrawingAsset(withShared,character.id);
 assert(validateDrawingProject(removed));assert(!removed.assets.some(a=>a.id===character.id));assert(removed.scenes.every(s=>s.items.every(i=>i.assetId!==character.id)));assert.deepEqual(removed.scenes.map(s=>s.voice),withShared.scenes.map(s=>s.voice));assert.equal(JSON.stringify(withShared),before,'deletion never mutates undo snapshot');
 const deletedOriginal=removeDrawingAsset(withShared,original.id);assert(validateDrawingProject(deletedOriginal));assert.equal(deletedOriginal.scenes[0].backgroundAssetId,resultAsset.id);assert.equal(deletedOriginal.scenes[0].stillOriginalAssetId,undefined);assert.equal(deletedOriginal.scenes[0].protectedMask,undefined);
 const deletedBackground=removeDrawingAsset(withShared,resultAsset.id);assert(validateDrawingProject(deletedBackground));assert.equal(deletedBackground.scenes[0].backgroundAssetId,undefined);assert.equal(deletedBackground.scenes[0].stillOriginalAssetId,undefined);assert(deletedBackground.assets.some(a=>a.id===original.id));
 const detached=removeSceneBackground(withShared,withShared.scenes[0].id);assert(validateDrawingProject(detached));assert.deepEqual(detached.assets,withShared.assets);assert.deepEqual(detached.scenes[0].items,withShared.scenes[0].items);assert.equal(detached.scenes[0].backgroundAssetId,undefined);assert.deepEqual(detached.scenes.slice(1),withShared.scenes.slice(1));assert.equal(removeDrawingAsset(withShared,'missing'),withShared);assert.equal(JSON.stringify(parseDrawingFile(before)),before);
 console.log('PASS: shared picture deletion, AI original/result references, scene-only background removal and complete immutable undo snapshot.');
 const {quarterTurnPixels,applyRotatedBackground}=local('./apps/play-studio/lib/drawing-rotation.js');
 const pixels=new Uint8ClampedArray([1,0,0,255,2,0,0,127,3,0,0,255,4,0,0,0,5,0,0,255,6,0,0,255]);
 const clockwise=quarterTurnPixels(pixels,2,3,1);assert.equal(clockwise.width,3);assert.equal(clockwise.height,2);assert.deepEqual([...clockwise.data].filter((v,i)=>i%4===0),[5,3,1,6,4,2]);assert.deepEqual(quarterTurnPixels(clockwise.data,3,2,-1).data,pixels);
 let turn={data:pixels,width:2,height:3};for(let i=0;i<4;i++)turn=quarterTurnPixels(turn.data,turn.width,turn.height,1);assert.deepEqual(turn.data,pixels,'four rotations preserve every RGB and alpha value');
 const sharedBackground={...withShared,scenes:withShared.scenes.map((s,i)=>i===1?{...s,backgroundAssetId:resultAsset.id}:s)};
 const rotatedAsset={...resultAsset,name:'회전 결과'},rotationMap=new Map([[resultAsset.id,rotatedAsset],[original.id,original]]);
 const turned=applyRotatedBackground(sharedBackground,sharedBackground.scenes[0].id,rotationMap,raster);assert(validateDrawingProject(turned));assert.notEqual(turned.scenes[0].backgroundAssetId,resultAsset.id);assert.equal(turned.scenes[1].backgroundAssetId,resultAsset.id);assert.deepEqual(turned.assets.find(a=>a.id===resultAsset.id),resultAsset);assert.equal(turned.scenes[0].protectedMask,raster);assert.deepEqual(turned.scenes[0].items,sharedBackground.scenes[0].items);assert.deepEqual(turned.scenes[0].voice,sharedBackground.scenes[0].voice);
 assert.equal(turned.assets.length,sharedBackground.assets.length+1,'only assets shared with other scenes are copied');
 console.log('PASS: portrait rotation, inverse/four-turn RGBA equality, shared-background isolation, rotated mask references and unchanged dialogue.');
 const {PNG}=require('pngjs'),largePng=new PNG({width:1280,height:960});let seed=17;
 for(let i=0;i<largePng.data.length;i+=4){for(let c=0;c<3;c++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;largePng.data[i+c]=seed>>>24;}largePng.data[i+3]=255;}
 const largeRaster='data:image/png;base64,'+PNG.sync.write(largePng).toString('base64');assert(largeRaster.length>4_000_000,'regression fixture must exceed the old result limit');
 const largeProject=putScenePicture(emptyFourSceneProject(),'film-scene-1',{source:largeRaster,width:1280,height:960});assert(validateDrawingProject(largeProject));assert.equal(parseDrawingFile(JSON.stringify(largeProject)).assets[0].source,largeRaster);
 console.log('PASS: detailed lossless PNG above 4 MB saves and round-trips without resizing or pixel loss ('+largeRaster.length+' characters).');




}finally{await fs.rm(temp,{recursive:true,force:true});}
