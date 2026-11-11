/** Black pixels select the actor. Build a small safety margin for its outline. */
export function characterRemovalMask(marks:Uint8ClampedArray,width:number,height:number,padding=2){
 const selected=new Uint8Array(width*height),horizontal=new Uint8Array(width*height),expanded=new Uint8Array(width*height);
 for(let i=0;i<selected.length;i++)selected[i]=marks[i*4]<128?1:0;
 for(let y=0;y<height;y++){
  let count=0;
  for(let x=0;x<width+padding;x++){
   if(x<width)count+=selected[y*width+x];
   if(x>padding*2)count-=selected[y*width+x-padding*2-1];
   if(x>=padding)horizontal[y*width+x-padding]=count>0?1:0;
  }
 }
 for(let x=0;x<width;x++){
  let count=0;
  for(let y=0;y<height+padding;y++){
   if(y<height)count+=horizontal[y*width+x];
   if(y>padding*2)count-=horizontal[(y-padding*2-1)*width+x];
   if(y>=padding)expanded[(y-padding)*width+x]=count>0?1:0;
  }
 }
 return expanded;
}

/**
 * Remove the actor BEFORE asking the image model to continue the background.
 * Only unselected boundary colors seed the fill; no selected RGB is reused.
 * This is an intermediate fill, not the final AI background.
 */
export function seedCharacterBackground(original:Uint8ClampedArray,selected:Uint8Array,width:number,height:number){
 const output=new Uint8ClampedArray(original),count=width*height;
 if(!selected.some(v=>v))throw new Error('지울 주인공을 먼저 칠해 주세요.');
 if(selected.every(v=>v))throw new Error('그림 전체가 아닌 주인공만 칠해 주세요.');
 const nearest=[new Int32Array(count).fill(-1),new Int32Array(count).fill(-1),new Int32Array(count).fill(-1),new Int32Array(count).fill(-1)];
 for(let y=0;y<height;y++){
  let left=-1,right=-1;
  for(let x=0;x<width;x++){
   const a=y*width+x,b=y*width+width-1-x;
   if(!selected[a])left=a;if(!selected[b])right=b;
   nearest[0][a]=left;nearest[1][b]=right;
  }
 }
 for(let x=0;x<width;x++){
  let top=-1,bottom=-1;
  for(let y=0;y<height;y++){
   const a=y*width+x,b=(height-1-y)*width+x;
   if(!selected[a])top=a;if(!selected[b])bottom=b;
   nearest[2][a]=top;nearest[3][b]=bottom;
  }
 }
 // An edge-to-edge selection can have no horizontal/vertical boundary. Use
 // an unselected pixel as a fallback, never the character's original color.
 const fallback=selected.findIndex(v=>!v);
 for(let i=0;i<count;i++)if(selected[i]){
  const rgb=[0,0,0];let total=0;
  for(let direction=0;direction<4;direction++){
   const neighbor=nearest[direction][i];if(neighbor<0)continue;
   const distance=direction<2?Math.abs(neighbor-i):Math.abs(neighbor-i)/width,weight=1/Math.max(1,distance);
   total+=weight;for(let c=0;c<3;c++)rgb[c]+=original[neighbor*4+c]*weight;
  }
  for(let c=0;c<3;c++)output[i*4+c]=total?rgb[c]/total:original[fallback*4+c];
  output[i*4+3]=255;
 }
 return output;
}

export function characterRemovalChanged(original:Uint8ClampedArray,result:Uint8ClampedArray,marks:Uint8ClampedArray){
 let selected=0,changed=0;
 for(let i=0;i<original.length;i+=4)if(marks[i]<128){
  selected++;
  if(Math.max(Math.abs(original[i]-result[i]),Math.abs(original[i+1]-result[i+1]),Math.abs(original[i+2]-result[i+2]))>24)changed++;
 }
 return selected>0&&changed/selected>=.01;
}
