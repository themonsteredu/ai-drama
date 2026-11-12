import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const root=process.cwd(),require=createRequire(path.join(root,'apps/play-studio/package.json')),ts=require('typescript');
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'play-transition-qa-'));
const previousDocument=global.document;
try{
 async function compile(file){const out=path.join(temp,file.replace(/\.ts$/,'.js'));await fs.mkdir(path.dirname(out),{recursive:true});await fs.writeFile(out,ts.transpileModule(await fs.readFile(path.join(root,file),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText);}
 for(const name of await fs.readdir(path.join(root,'apps/play-studio/lib')))if(name.endsWith('.ts'))await compile('apps/play-studio/lib/'+name);
 await compile('packages/stage-core/src/drawing.ts');
 const local=createRequire(path.join(temp,'entry.js'));
 const {emptyFourSceneProject}=local('./apps/play-studio/lib/four-scene.js');
 const {parseDrawingFile,validateDrawingProject}=local('./apps/play-studio/lib/drawing-project.js');
 const {movieTimeline,movieSeconds}=local('./apps/play-studio/lib/drawing-movie.js');
 const {incomingTransition,transitionBlend,setSceneTransition,createTransitionPainter}=local('./apps/play-studio/lib/drawing-transition.js');
 const {addNarration}=local('./apps/play-studio/lib/film-narration.js');
 let p=emptyFourSceneProject();const times=[2.25,3.5,.2,4];
 p.scenes.forEach((s,i)=>{s.voice={id:'voice-'+i,source:'data:audio/wav;base64,UklGRg==',duration:times[i]};});
 const original=structuredClone(p),before=movieTimeline(p).map(s=>[s.at,s.seconds]);
 p=setSceneTransition(p,p.scenes[0].id,'dissolve');p=setSceneTransition(p,p.scenes[1].id,'fade');
 assert.deepEqual(movieTimeline(p).map(s=>[s.at,s.seconds]),before,'effects cannot shift dialogue or cuts');
 assert.deepEqual(p.scenes.map(s=>s.voice),original.scenes.map(s=>s.voice));assert.equal(original.scenes[0].transition,undefined,'undo snapshot remains intact');
 assert.equal(movieSeconds(p),9.95);assert.equal(setSceneTransition(p,p.scenes[3].id,'fade'),p,'no effect after final scene');
 assert.equal(setSceneTransition(p,'missing','fade'),p);assert.equal(setSceneTransition(p,p.scenes[0].id,'dissolve'),p);
 assert.deepEqual(parseDrawingFile(JSON.stringify(p)).scenes.map(s=>s.transition),['dissolve','fade',undefined,undefined]);
 assert(validateDrawingProject(original),'legacy backups remain valid');
 for(const invalid of ['slide',null,{},4]){const bad=structuredClone(p);bad.scenes[0].transition=invalid;assert(!validateDrawingProject(bad));}
 const plan=movieTimeline(p),dissolve=incomingTransition(plan,1),fade=incomingTransition(plan,2);
 assert.equal(incomingTransition(plan,0),null);assert.equal(fade.duration,.1,'short recordings still get a fully visible final frame');
 assert.deepEqual(transitionBlend(dissolve,0),{previous:1,current:0});assert.deepEqual(transitionBlend(dissolve,.3),{previous:1,current:.5});assert.equal(transitionBlend(dissolve,.6),null);
 assert.deepEqual(transitionBlend(fade,.05),{previous:0,current:0});assert.equal(transitionBlend(fade,.1),null);
 const narrated=addNarration(p,{id:'voice-full',source:'data:audio/wav;base64,UklGRg==',duration:20});assert.equal(movieSeconds(narrated),20);assert.equal(incomingTransition(movieTimeline(narrated),1).kind,'dissolve');
 console.log('PASS: transition persistence/legacy validation, immutable undo, per-boundary selection, short recordings and unchanged scene/full-narration audio timeline.');
 // Exercise actual compositor with a pixel-sized canvas adapter and distinct opaque source frames.
 const draws=[];
 local('./apps/play-studio/lib/drawing-renderer.js').drawDrawingScene=(ctx,project,scene,images,seconds)=>{draws.push([scene.id,seconds]);ctx.fillStyle=scene.id===p.scenes[0].id?'#ff0000':'#0000ff';ctx.fillRect();};
 function context(){const stack=[];return {pixel:[0,0,0],globalAlpha:1,fillStyle:'#000000',save(){stack.push([this.globalAlpha,this.fillStyle]);},restore(){[this.globalAlpha,this.fillStyle]=stack.pop();},fillRect(){this.pixel=this.fillStyle.slice(1).match(/../g).map(x=>parseInt(x,16));},drawImage(canvas){this.pixel=this.pixel.map((v,i)=>v*(1-this.globalAlpha)+canvas.ctx.pixel[i]*this.globalAlpha);}};}
 let surfaces=0;global.document={createElement(name){assert.equal(name,'canvas');surfaces++;const ctx=context();return {ctx,getContext(){return ctx;}};}};
 const paint=createTransitionPainter(),output=context(),images=new Map();
 assert(paint(output,p,p.scenes[1],images,0,dissolve));assert.deepEqual(output.pixel,[255,0,0]);
 assert(paint(output,p,p.scenes[1],images,.3,dissolve));assert.deepEqual(output.pixel,[127.5,0,127.5]);assert.equal(output.globalAlpha,1);assert.equal(surfaces,2);
 assert.equal(draws.filter(([id])=>id===p.scenes[0].id).length,1,'outgoing final frame is cached');assert.equal(draws[0][1],2.25,'freeze previous actor at its final time');
 const fadeLong={...dissolve,kind:'fade'};paint(output,p,p.scenes[1],images,.3,fadeLong);assert.deepEqual(output.pixel,[0,0,0]);
 assert.equal(paint(output,p,p.scenes[1],images,.6,dissolve),false,'normal renderer resumes after effect');
 assert.equal(paint(output,p,p.scenes[1],images,0,null),false,'editing and cut need no offscreen frame');
 console.log('PASS: shared preview/export compositor starts on outgoing final frame, blends red/blue evenly, fades through black, reuses two canvases and restores drawing state.');
}finally{global.document=previousDocument;await fs.rm(temp,{recursive:true,force:true});}
