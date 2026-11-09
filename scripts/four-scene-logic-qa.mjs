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

}finally{await fs.rm(temp,{recursive:true,force:true});}
