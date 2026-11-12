import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const root=process.cwd(),require=createRequire(path.join(root,'apps/play-studio/package.json')),ts=require('typescript'),temp=await fs.mkdtemp(path.join(os.tmpdir(),'play-groups-'));
try{
 async function compile(file){const to=path.join(temp,file.replace(/\.ts$/,'.js'));await fs.mkdir(path.dirname(to),{recursive:true});await fs.writeFile(to,ts.transpileModule(await fs.readFile(path.join(root,file),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText);}
 for(const file of await fs.readdir(path.join(root,'apps/play-studio/lib')))if(file.endsWith('.ts'))await compile('apps/play-studio/lib/'+file);
 await compile('packages/stage-core/src/drawing.ts');const local=createRequire(path.join(temp,'entry.js'));
 const {emptyFourSceneProject}=local('./apps/play-studio/lib/four-scene.js'),{validateDrawingProject,parseDrawingFile}=local('./apps/play-studio/lib/drawing-project.js');
 const {assembleGroupProjects,moveDrawingScene,narrationSampleRanges}=local('./apps/play-studio/lib/group-project.js'),{addNarration}=local('./apps/play-studio/lib/film-narration.js');
 const {movieSeconds,movieTimeline}=local('./apps/play-studio/lib/drawing-movie.js'),{musicPlaybackKey}=local('./apps/play-studio/lib/drawing-music.js');
 const tiny='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD1sAAAAASUVORK5CYII=';
 const p=emptyFourSceneProject();p.assets=[{id:'same-picture',name:'원본',kind:'background',source:tiny,width:1,height:1}];
 p.musicAssets=[{id:'audio-same',name:'모둠 음악',source:'data:audio/wav;base64,UklGRg==',duration:5}];p.music={trackId:'audio-same',volume:.2,loop:true};
 p.scenes=p.scenes.map((s,i)=>({...s,backgroundAssetId:'same-picture',stillOriginalAssetId:'same-picture',protectedMask:tiny,transition:i===0?'dissolve':'cut',voice:{id:'voice-same',source:'data:audio/wav;base64,UklGRg==',duration:1+i/4},items:[{id:'same-actor',assetId:'same-picture',x:20,y:70,width:12,rotation:0,flipped:false,motion:'walk',speed:'fast',speech:'모둠 대사',target:{x:80,y:70},separation:{sourceAssetId:'same-picture',mask:tiny}}]}));
 assert(validateDrawingProject(p));const before=JSON.stringify(p),works=Array.from({length:6},(_,i)=>({id:`work-${i}`,name:`${i+1}모둠`,project:p})),merged=assembleGroupProjects(works,'우리 반 이야기');
 assert.equal(merged.scenes.length,24);assert(validateDrawingProject(merged));assert.equal(movieSeconds(merged),movieSeconds(p)*6);assert.equal(new Set(merged.scenes.map(s=>s.id)).size,24);assert.equal(new Set(merged.scenes.flatMap(s=>s.items.map(i=>i.id))).size,24);
 const assetIds=new Set(merged.assets.map(a=>a.id)),musicIds=new Set(merged.musicAssets.map(a=>a.id));assert.equal(assetIds.size,6);assert.equal(musicIds.size,6);
 for(const s of merged.scenes){assert(assetIds.has(s.backgroundAssetId));assert(assetIds.has(s.stillOriginalAssetId));assert(assetIds.has(s.items[0].separation.sourceAssetId));assert(musicIds.has(s.music.trackId));assert.equal(s.items[0].motion,'walk');assert.equal(s.items[0].speech,'모둠 대사');assert.equal(s.items[0].target.x,80);}
 assert.equal(musicPlaybackKey(merged.scenes[0]),musicPlaybackKey(merged.scenes[3]));assert.notEqual(musicPlaybackKey(merged.scenes[3]),musicPlaybackKey(merged.scenes[4]));
 assert.equal(JSON.stringify(p),before);assert.deepEqual(parseDrawingFile(JSON.stringify(merged)),JSON.parse(JSON.stringify(merged)));
 assert.throws(()=>assembleGroupProjects([...works,...works],'too many'));
 const moved=moveDrawingScene(merged,merged.scenes[4].id,-1);assert.equal(moved.scenes[3].id,merged.scenes[4].id);assert.equal(movieSeconds(moved),movieSeconds(merged));assert.equal(moved.activeSceneId,merged.activeSceneId);assert.equal(moveDrawingScene(merged,merged.scenes[0].id,-1),merged);
 console.log('PASS: six independent four-scene projects merge into 24 editable scenes with colliding IDs remapped, pictures/masks/motion/dialogue/music retained, common music continuous only within each group, reorder, limits and immutable originals.');
 let full=addNarration(p,{id:'voice-full',source:'data:audio/wav;base64,UklGRg==',duration:5.125});full.narration.durations=Object.fromEntries(full.scenes.map((s,i)=>[s.id,[1.125,1,2,1][i]]));
 const ranges=narrationSampleRanges(full,5.125*16000);assert.deepEqual(ranges.map(r=>[r.from,r.to]),[[0,18000],[18000,34000],[34000,66000],[66000,82000]]);assert.equal(ranges.reduce((n,r)=>n+r.to-r.from,0),82000);assert.equal(moveDrawingScene(full,full.scenes[0].id,1),full);
 const prepared=new Map(ranges.map(r=>[r.sceneId,{id:'voice-cut',source:'data:audio/wav;base64,UklGRg==',duration:(r.to-r.from)/16000}]));
 const fullMerged=assembleGroupProjects([{id:'full',name:'전체녹음 모둠',project:full}],'전체녹음 합치기',[prepared]);assert(validateDrawingProject(fullMerged));assert.equal(fullMerged.narration,undefined);assert.equal(movieSeconds(fullMerged),5.125);assert.deepEqual(movieTimeline(fullMerged).map(s=>s.seconds),[1.125,1,2,1]);assert.throws(()=>assembleGroupProjects([{id:'full',name:'모둠',project:full}],'missing audio'));
 const silent=new Map(prepared);silent.set(full.scenes[3].id,undefined);const silentTail=assembleGroupProjects([{id:'full',name:'모둠',project:full}],'silent tail',[silent]);assert.equal(movieSeconds(silentTail),5.125,'short silent tail must keep its original duration');
 console.log('PASS: whole narration sample boundaries cover every sample once, becomes per-scene audio before reordering, retains exact timings including short silence, and missing narration cannot silently disappear.');
}finally{await fs.rm(temp,{recursive:true,force:true});}
