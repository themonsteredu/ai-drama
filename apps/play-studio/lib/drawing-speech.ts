/** Screen-sized dialogue; the stored speech is never shortened or overwritten. */
export type SpeechLine = {text:string;start:number;end:number};
export type SpeechCursor = {text:string;offset:number};
export type SpeechView = {displayWidth:number;cursors:Map<string,SpeechCursor>};
export type SpeechActor = {id:string;name:string;text:string;x:number;y:number;width:number;height:number};
type Rect = {x:number;y:number;width:number;height:number};
export type SpeechBubble = Rect & {id:string;name:string;text:string;page:number;pages:number;previous:number;next:number;footer:number;displayText:string};
export const newSpeechView=():SpeechView=>({displayWidth:1280,cursors:new Map()});
// Weak keys cannot leak closed projects. PNG export uses the same visible dialogue page.
const views=new WeakMap<object,SpeechView>();
export function rememberSpeechView(scene:object,view:SpeechView){views.set(scene,view);}
export function speechViewFor(scene:object):SpeechView{return views.get(scene)??newSpeechView();}
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
const segmenter=typeof Intl.Segmenter==='function'?new Intl.Segmenter('ko',{granularity:'grapheme'}):null;
function* glyphs(text:string):Generator<{segment:string;index:number}>{
 if(segmenter){for(const part of segmenter.segment(text))yield part;return;}
 let index=0;for(const segment of text){yield {segment,index};index+=segment.length;}
}
/** Line offsets partition the entire original string, including explicit blank lines. */
export function wrapSpeech(ctx:Pick<CanvasRenderingContext2D,'measureText'>,text:string,width:number):SpeechLine[]{
 const result:SpeechLine[]=[];let start=0,line='',lastBreak=0;
 for(const {segment,index} of glyphs(text)){
  if(segment==='\n'||segment==='\r\n'||segment==='\r'){
   result.push({text:line,start,end:index+segment.length});start=index+segment.length;line='';lastBreak=start;continue;
  }
  if(line&&ctx.measureText(line+segment).width>width){
   const end=lastBreak>start?lastBreak:index;
   result.push({text:text.slice(start,end),start,end});start=end;line=text.slice(start,index);lastBreak=start;
   if(line&&ctx.measureText(line+segment).width>width){result.push({text:line,start,end:index});start=index;line='';}
  }
  line+=segment;
  if(/^[\t ]+$/.test(segment))lastBreak=index+segment.length;
 }
 result.push({text:line,start,end:text.length});return result;
}
type TextLayout={lines:SpeechLine[];font:number;lineHeight:number;padding:number;footer:number;width:number;pageSize:number;pages:number};
const cache=new Map<string,TextLayout>();
export function clearSpeechLayoutCache(){cache.clear();}
export function speechTextLayout(ctx:CanvasRenderingContext2D,text:string,displayWidth:number,stageWidth=1280,stageHeight=720):TextLayout{
 const scale=Math.max(.1,displayWidth/stageWidth),font=Math.max(26,Math.ceil(14/scale));
 const padding=Math.max(14,8/scale),margin=Math.max(12,6/scale),footer=44/scale;
 const maxWidth=Math.min(stageWidth-2*margin,Math.max(520,300/scale));
 const key=`${displayWidth}|${stageWidth}|${stageHeight}|${text}`;
 const cached=cache.get(key);if(cached){cache.delete(key);cache.set(key,cached);return cached;}
 ctx.save();ctx.font=`500 ${font}px "S-Core Dream",sans-serif`;
 const lines=wrapSpeech(ctx,text,maxWidth-2*padding),lineHeight=Math.ceil(font*1.45);
 const maxHeight=Math.max(lineHeight+2*padding+footer,stageHeight*.6);
 const singleCapacity=Math.max(1,Math.floor((maxHeight-2*padding)/lineHeight));
 const pageSize=lines.length<=singleCapacity?singleCapacity:Math.max(1,Math.floor((maxHeight-2*padding-footer)/lineHeight));
 const pages=Math.ceil(lines.length/pageSize);
 let longest=0;for(const line of lines)longest=Math.max(longest,ctx.measureText(line.text).width);
 const minWidth=pages>1?Math.min(maxWidth,180/scale):font*2+2*padding;
 const width=clamp(longest+2*padding,minWidth,maxWidth);
 ctx.restore();
 const value={lines,font,lineHeight,padding,footer:pages>1?footer:0,width,pageSize,pages};
 if(cache.size>=48)cache.delete(cache.keys().next().value!);cache.set(key,value);return value;
}
const overlap=(a:Rect,b:Rect)=>Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
/** Above first, then below/alongside. Every candidate and tail remain inside the stage. */
function positionBubble(actor:SpeechActor,width:number,height:number,placed:Rect[],w:number,h:number,margin:number,top:number):Rect{
 const head=clamp(actor.y-actor.height,margin,h-margin),gap=18;
 const candidates=[
  {x:actor.x-width/2,y:head-height-gap},
  {x:actor.x+actor.width/2+gap,y:head},
  {x:actor.x-actor.width/2-width-gap,y:head},
  {x:actor.x-width/2,y:actor.y+gap},
  {x:margin,y:top},{x:w-width-margin,y:top},
 ].map(p=>({...p,x:clamp(p.x,margin,w-width-margin),y:clamp(p.y,top,h-height-margin),width,height}));
 const body={x:actor.x-actor.width/2,y:head,width:actor.width,height:Math.max(0,actor.y-head)};
 let best=candidates[0],score=Infinity;
 for(const [index,c] of candidates.entries()){
  const cost=placed.reduce((sum,r)=>sum+overlap(c,r)*8,0)+overlap(c,body)*2+index*10;
  if(cost<score){score=cost;best=c;}
 }
 return best;
}
export function renderDrawingSpeech(ctx:CanvasRenderingContext2D,actors:SpeechActor[],view:SpeechView,w=1280,h=720,topInset=0,interactive=false):SpeechBubble[]{
 const result:SpeechBubble[]=[],scale=Math.max(.1,view.displayWidth/w),margin=Math.max(12,6/scale);
 for(const actor of actors){
  if(!actor.text.trim())continue;
  const l=speechTextLayout(ctx,actor.text,view.displayWidth,w,h),cursor=view.cursors.get(actor.id);
  const offset=cursor?.text===actor.text?cursor.offset:0;
  let lineIndex=l.lines.findIndex(line=>line.end>offset);if(lineIndex<0)lineIndex=l.lines.length-1;
  const page=clamp(Math.floor(lineIndex/l.pageSize),0,l.pages-1),start=page*l.pageSize;
  const lines=l.lines.slice(start,start+l.pageSize);
  const height=lines.length*l.lineHeight+2*l.padding+l.footer;
  const top=Math.min(Math.max(margin,topInset+margin),h-height-margin);
  const rect=positionBubble(actor,l.width,height,result,w,h,margin,top);
  const bubble:SpeechBubble={...rect,id:actor.id,name:actor.name,text:actor.text,page,pages:l.pages,
   previous:l.lines[Math.max(0,start-l.pageSize)].start,next:l.lines[Math.min(l.lines.length-1,start+l.pageSize)].start,
   footer:l.footer,displayText:lines.map(line=>line.text).join('\n')};
  ctx.save();ctx.fillStyle='#ffffff';ctx.strokeStyle='#31445d';ctx.lineWidth=Math.max(2,1/scale);ctx.lineJoin='round';
  // Tail joins the nearest edge and points toward this actor, not an unrelated bubble.
  const tip={x:clamp(actor.x,margin,w-margin),y:clamp(actor.y-actor.height*.78,margin,h-margin)};
  const base={x:clamp(tip.x,rect.x+18,rect.x+rect.width-18),y:clamp(tip.y,rect.y+18,rect.y+rect.height-18)};
  if(tip.y<rect.y)base.y=rect.y;else if(tip.y>rect.y+rect.height)base.y=rect.y+rect.height;
  else base.x=tip.x<rect.x?rect.x:rect.x+rect.width;
  const vertical=base.y===rect.y||base.y===rect.y+rect.height;
  ctx.beginPath();ctx.moveTo(base.x-(vertical?10:0),base.y-(vertical?0:10));ctx.lineTo(tip.x,tip.y);ctx.lineTo(base.x+(vertical?10:0),base.y+(vertical?0:10));ctx.closePath();ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.roundRect(rect.x,rect.y,rect.width,rect.height,Math.min(22,rect.height/4));ctx.fill();ctx.stroke();
  ctx.font=`500 ${l.font}px "S-Core Dream",sans-serif`;ctx.textBaseline='top';ctx.fillStyle='#20364f';
  // Pagination keeps every line inside; no ellipsis, clipping or per-dialogue length cap.
  lines.forEach((line,i)=>ctx.fillText(line.text,rect.x+l.padding,rect.y+l.padding+i*l.lineHeight));
  if(l.footer&&!interactive){ctx.font=`500 ${Math.max(22,12/scale)}px "S-Core Dream",sans-serif`;ctx.textAlign='center';ctx.fillStyle='#536d88';ctx.fillText(`‹  ${page+1} / ${l.pages}  ›`,rect.x+rect.width/2,rect.y+rect.height-l.footer*.65);}
  ctx.restore();result.push(bubble);
 }
 return result;
}
