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
 const {sceneSeconds,movieSeconds}=local('./apps/play-studio/lib/drawing-movie.js');
 const {emptyFourSceneProject,prepareFourScenes,putScenePicture}=local('./apps/play-studio/lib/four-scene.js');
 const {validateDrawingProject,parseDrawingFile}=local('./apps/play-studio/lib/drawing-project.js');
 const {applyVoice}=local('./apps/play-studio/lib/drawing-voice.js');
 let p=emptyFourSceneProject();assert.equal(p.scenes.length,4);assert(validateDrawingProject(p));
 const voice={id:'voice-test',source:'data:audio/wav;base64,UklGRg==',duration:32};
 p=applyVoice(p,p.scenes[0].id,voice);assert.equal(sceneSeconds(p.scenes[0]),32.95);
 p.scenes[0].durationSeconds=40;assert.equal(sceneSeconds(p.scenes[0]),40);
 p.scenes[0].durationSeconds=2;assert.equal(sceneSeconds(p.scenes[0]),32.25,'cannot truncate dialogue');
 p.scenes[0].durationSeconds=40;assert.equal(movieSeconds(p),52);assert.equal(parseDrawingFile(JSON.stringify(p)).scenes[0].voice.duration,32);
 assert(!validateDrawingProject({...p,scenes:p.scenes.map(s=>({...s,durationSeconds:-2}))}));
 console.log('PASS: four scenes, imported 32-second dialogue, manual timing, no dialogue truncation and backup round trip.');
 const raster='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jE9sAAAAASUVORK5CYII=';
 const character={id:'kept-character',name:'아이 그림',kind:'person',width:1,height:1,source:raster};
 const spare={...character,id:'unused-library-picture',name:'보관 중 그림'};
 let legacy={...p,assets:[character,spare],scenes:[{...p.scenes[0],weather:'wind',items:[{id:'actor',assetId:character.id,x:50,y:70,width:20,rotation:0,flipped:false,motion:'hop',speed:'slow',speech:'안녕'}]}]};
 const prepared=prepareFourScenes(legacy);assert.equal(prepared.scenes.length,4);assert.deepEqual(prepared.scenes[0],legacy.scenes[0]);assert.deepEqual(prepared.assets,legacy.assets);
 const extended=putScenePicture(prepared,prepared.scenes[0].id,{source:raster,width:1,height:1});
 assert(extended.assets.some(a=>a.id===spare.id),'unused library drawings survive');assert.deepEqual(extended.scenes[0].items,legacy.scenes[0].items,'character motions survive');assert.equal(extended.scenes[0].weather,'wind');assert.equal(extended.scenes[0].voice.duration,32);assert(validateDrawingProject(extended));
 const six={...extended,scenes:[...extended.scenes,{...extended.scenes[1],id:'fifth'},{...extended.scenes[1],id:'sixth'}]};assert.equal(prepareFourScenes(six).scenes.length,6,'existing scenes are never truncated');
 console.log('PASS: original characters/motion/weather, unused library drawings, dialogue, existing scenes and backups survive integrated four-scene additions.');
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



}finally{await fs.rm(temp,{recursive:true,force:true});}
