import type {DrawingProject,DrawingScene,DrawingTransition} from '../../../packages/stage-core/src/drawing';
import {drawDrawingScene,DRAW_WIDTH,DRAW_HEIGHT,type RasterCache} from './drawing-renderer';

export const transitionChoices:{id:DrawingTransition;label:string;description:string}[]=[
 {id:'cut',label:'바로',description:'다음 그림이 바로 나와요.'},
 {id:'dissolve',label:'살며시',description:'두 그림이 살며시 이어져요.'},
 {id:'fade',label:'어두워졌다',description:'잠깐 어두워진 뒤 다음 그림이 나와요.'},
];
export type SceneStep={scene:DrawingScene;seconds:number};
export type SceneTransition={previous:DrawingScene;previousSeconds:number;duration:number;kind:Exclude<DrawingTransition,'cut'>};

/** Effects begin after the previous dialogue ends. Audio and total duration never overlap or shift. */
export function incomingTransition(plan:SceneStep[],index:number):SceneTransition|null{
 const previous=plan[index-1],next=plan[index],kind=previous?.scene.transition;
 if(!previous||!next||!kind||kind==='cut')return null;
 return {previous:previous.scene,previousSeconds:previous.seconds,kind,duration:Math.min(.6,next.seconds/2)};
}
export function transitionBlend(transition:SceneTransition|null,seconds:number){
 if(!transition||transition.duration<=0||seconds>=transition.duration)return null;
 const t=Math.max(0,seconds)/transition.duration;
 // Smoothstep avoids a sudden start/stop while preserving exact endpoints.
 const smooth=(n:number)=>n*n*(3-2*n);
 if(transition.kind==='dissolve')return {previous:1,current:smooth(t)};
 return t<.5?{previous:1-smooth(t*2),current:0}:{previous:0,current:smooth((t-.5)*2)};
}
export function setSceneTransition(project:DrawingProject,sceneId:string,kind:DrawingTransition):DrawingProject{
 const index=project.scenes.findIndex(s=>s.id===sceneId);
 if(index<0||index===project.scenes.length-1||(project.scenes[index].transition??'cut')===kind)return project;
 return {...project,scenes:project.scenes.map(s=>s.id===sceneId?{...s,transition:kind}:s)};
}

/** Reused by live playback and movie export. Cache the outgoing final frame, never the moving incoming frame. */
export function createTransitionPainter(){
 let outgoing:HTMLCanvasElement|undefined,incoming:HTMLCanvasElement|undefined;
 let cachedProject:DrawingProject|undefined,cachedImages:RasterCache|undefined,cachedScene:DrawingScene|undefined,cachedSeconds=-1;
 const surface=()=>{const canvas=document.createElement('canvas');canvas.width=DRAW_WIDTH;canvas.height=DRAW_HEIGHT;return canvas;};
 return (ctx:CanvasRenderingContext2D,project:DrawingProject,scene:DrawingScene,images:RasterCache,seconds:number,transition:SceneTransition|null)=>{
  const blend=transitionBlend(transition,seconds);if(!blend||!transition)return false;
  outgoing??=surface();incoming??=surface();
  const before=outgoing.getContext('2d'),after=incoming.getContext('2d');if(!before||!after)return false;
  if(cachedProject!==project||cachedImages!==images||cachedScene!==transition.previous||cachedSeconds!==transition.previousSeconds){
   drawDrawingScene(before,project,transition.previous,images,transition.previousSeconds);
   cachedProject=project;cachedImages=images;cachedScene=transition.previous;cachedSeconds=transition.previousSeconds;
  }
  drawDrawingScene(after,project,scene,images,seconds);
  ctx.save();ctx.globalAlpha=1;ctx.fillStyle='#000000';ctx.fillRect(0,0,DRAW_WIDTH,DRAW_HEIGHT);
  if(blend.previous>0){ctx.globalAlpha=blend.previous;ctx.drawImage(outgoing,0,0);}
  if(blend.current>0){ctx.globalAlpha=blend.current;ctx.drawImage(incoming,0,0);}
  ctx.restore();return true;
 };
}
