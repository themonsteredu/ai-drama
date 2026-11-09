import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
export const runtime='nodejs';
export const maxDuration=60;
const MODEL='fal-ai/z-image/turbo/inpaint';
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
const secret=()=>process.env.FAL_KEY||process.env.FAL_API_KEY;
function authorized(code:unknown){
 const expected=process.env.TEACHER_ADMIN_CODE;
 return !!expected&&typeof code==='string'&&timingSafeEqual(createHash('sha256').update(code).digest(),createHash('sha256').update(expected).digest());
}
function sign(data:string){return createHmac('sha256',`${secret()}|${process.env.TEACHER_ADMIN_CODE}`).update(data).digest('base64url');}
function makeToken(status:string,result:string){const value=Buffer.from(JSON.stringify({status,result,expires:Date.now()+3600000})).toString('base64url');return `${value}.${sign(value)}`;}
function readToken(token:unknown){
 if(typeof token!=='string'||token.length>3000)throw new Error('생성 정보를 다시 확인해 주세요.');
 const [value,signature]=token.split('.');const expected=sign(value||'');
 if(!signature||signature.length!==expected.length||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))throw new Error('생성 정보를 다시 확인해 주세요.');
 const data=JSON.parse(Buffer.from(value,'base64url').toString()) as {status:string;result:string;expires:number};
 if(data.expires<Date.now()||!queueUrl(data.status)||!queueUrl(data.result))throw new Error('생성 확인 시간이 지났어요.');return data;
}
function queueUrl(value:unknown):value is string{
 if(typeof value!=='string')return false;
 try{const u=new URL(value);return u.origin==='https://queue.fal.run'&&u.pathname.startsWith('/fal-ai/z-image/requests/');}catch{return false;}
}
async function fal(url:string,init?:RequestInit){
 const response=await fetch(url,{...init,headers:{Authorization:`Key ${secret()}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(45000),cache:'no-store',redirect:'error'});
 if(!response.ok)throw new Error(response.status===429?'요청이 많아요. 잠시 뒤 다시 해 주세요.':`AI 서비스를 사용할 수 없어요 (${response.status}). 선생님이 연결 상태를 확인해 주세요.`);
 return response.json();
}
export async function GET(){return reply({configured:!!secret()&&!!process.env.TEACHER_ADMIN_CODE,model:'Z-Image Turbo Inpaint',pricePerMegapixelUsd:.01});}
export async function POST(request:Request){
 if(!secret()||!process.env.TEACHER_ADMIN_CODE)return reply({error:'AI 배경 연결을 준비 중이에요. 선생님이 AI 설정을 마친 뒤 사용할 수 있어요.'},503);
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'이 화면에서 다시 요청해 주세요.'},403);
 try{
  if(Number(request.headers.get('content-length'))>3_500_000)return reply({error:'그림 용량을 줄여 주세요.'},413);
  const raw=await request.text();if(raw.length>3_500_000)return reply({error:'그림 용량을 줄여 주세요.'},413);
  const body=JSON.parse(raw);
  if(!authorized(body.code))return reply({error:'교사 확인 번호가 맞지 않아요.'},401);
  if(body.action==='start'){
   const image=(v:unknown)=>typeof v==='string'&&v.length<=1_600_000&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(v);
   if(!image(body.image)||!image(body.mask)||typeof body.prompt!=='string'||!body.prompt.trim()||body.prompt.length>600)return reply({error:'그림·보호 영역·배경 설명을 확인해 주세요.'},400);
   const width=Number(body.width),height=Number(body.height);
   if(!Number.isInteger(width)||!Number.isInteger(height)||width<32||height<32||width>960||height>960)return reply({error:'그림 크기를 확인해 주세요.'},400);
   const result=await fal(`https://queue.fal.run/${MODEL}`,{method:'POST',body:JSON.stringify({image_url:body.image,mask_image_url:body.mask,prompt:`Gently refine ONLY the background of this child's illustration. Preserve its handmade drawing style, original composition and perspective. Keep masked characters unchanged. Do not add any new people, animals, letters, or logos. Background: ${body.prompt.trim()}`,image_size:{width,height},num_images:1,num_inference_steps:8,strength:.7,enable_prompt_expansion:false,enable_safety_checker:true,output_format:'jpeg',sync_mode:true})});
   if(!queueUrl(result.status_url)||!queueUrl(result.response_url))throw new Error('AI 생성 정보를 확인하지 못했어요. 다시 누르기 전에 선생님께 알려 주세요.');
   return reply({token:makeToken(result.status_url,result.response_url),status:result.status});
  }
  if(body.action==='check'){
   const token=readToken(body.token),status=await fal(token.status);
   if(status.error)throw new Error('AI가 배경을 만들지 못했어요. 다른 설명으로 다시 시도해 주세요.');
   if(status.status!=='COMPLETED')return reply({status:status.status});
   const result=await fal(token.result);if(result.has_nsfw_concepts?.some(Boolean))throw new Error('이 설명으로 배경을 만들 수 없어요. 다른 설명을 넣어 주세요.');
   let source=result.images?.[0]?.url;
   if(typeof source!=='string')throw new Error('완성된 배경을 찾지 못했어요.');
   if(source.startsWith('https://')){
    const url=new URL(source);if(!(url.hostname==='fal.media'||url.hostname.endsWith('.fal.media')))throw new Error('배경 파일 주소를 확인하지 못했어요.');
    const response=await fetch(source,{signal:AbortSignal.timeout(15000),redirect:'error'});
    if(!response.ok)throw new Error('완성된 배경을 불러오지 못했어요.');
    const bytes=await response.arrayBuffer();if(bytes.byteLength>3_000_000)throw new Error('결과 그림 용량이 너무 커요.');
    const mime=response.headers.get('content-type')?.split(';')[0];if(!mime||!['image/jpeg','image/png','image/webp'].includes(mime))throw new Error('결과 그림 형식이 맞지 않아요.');
    source=`data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
   }
   if(source.length>4_000_000||!/^data:image\/(jpeg|png|webp);base64,/.test(source))throw new Error('배경 파일을 읽지 못했어요.');
   return reply({status:'COMPLETED',source});
  }
  return reply({error:'지원하지 않는 요청이에요.'},400);
 }catch(cause){return reply({error:cause instanceof Error?cause.message:'AI 배경을 만들지 못했어요. 원본 그림은 그대로예요.'},400);}
}
