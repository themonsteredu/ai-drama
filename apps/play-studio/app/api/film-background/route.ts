import {backgroundEditPrompt} from '../../../lib/background-prompt';
import {backgroundImageInput} from '../../../lib/background-image-input';
import {authenticated,authorizeGeneration,claimBackgroundTurn,limitRequests,failure,IMAGE_MODEL,keyStatus,readBody,ready,reply,sameOrigin,savedApiKey,sessionCookie,SettingsError} from '../../../lib/play-ai-server';
export const runtime='nodejs';
export const maxDuration=300;
export async function GET(request:Request){
 if(!ready())return reply({configured:false});
 try{return reply({...await keyStatus(),authenticated:authenticated(request)});}catch{return reply({configured:false});}
}
export async function POST(request:Request){
 try{
  sameOrigin(request);const body=await readBody(request,4_000_000);
  await authorizeGeneration(request,body.code,'generate',false);
  if(typeof body.prompt!=='string'||!body.prompt.trim()||body.prompt.length>600)throw new SettingsError('배경 설명을 확인해 주세요.');
  const image=backgroundImageInput(body.image),mask=backgroundImageInput(body.mask,true);
  if(image.width!==1024||image.height!==1024||mask.width!==image.width||mask.height!==image.height)throw new SettingsError('그림과 보호 영역의 크기를 확인해 주세요.');
  const authHeaders:Record<string,string>=authenticated(request)?{}:{'Set-Cookie':sessionCookie()};
  if(!await claimBackgroundTurn())return reply({queued:true,retryable:true,retryAfter:10},202,{'Retry-After':'10',...authHeaders});
  await limitRequests(request,'generate');
  const key=await savedApiKey(),form=new FormData();
  form.set('model',IMAGE_MODEL);form.set('quality','low');form.set('size','1024x1024');form.set('n','1');form.set('background','opaque');form.set('output_format','jpeg');form.set('output_compression','85');
  form.set('image[]',new Blob([new Uint8Array(image.bytes)],{type:image.mime}),image.mime==='image/jpeg'?'scene.jpg':'scene.png');
  form.set('mask',new Blob([new Uint8Array(mask.bytes)],{type:'image/png'}),'mask.png');
  form.set('prompt',backgroundEditPrompt(body.prompt,body.operation,body.strength==='gentle'?'gentle':'clear'));
  const response=await fetch('https://api.openai.com/v1/images/edits',{method:'POST',headers:{Authorization:`Bearer ${key}`},body:form,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(270000)});
  if(!response.ok){
   const problem=await response.json().catch(()=>({})),code=problem.error?.code,type=problem.error?.type;
   const quota=type==='insufficient_quota'||['insufficient_quota','credit_balance_exhausted','organization_spend_limit_exceeded','project_spend_limit_exceeded','organization_usage_limit_exceeded'].includes(code);
   if(response.status===429&&!quota&&(code==='rate_limit_exceeded'||code==='slow_down'||type==='rate_limit_error')){
    const header=response.headers.get('retry-after'),seconds=header?(Number(header)||Math.ceil((Date.parse(header)-Date.now())/1000)):20;
    const retryAfter=Number.isFinite(seconds)?Math.max(2,seconds):20;
    return reply({retryable:true,retryAfter,error:'OpenAI 요청이 몰려 잠시 기다린 뒤 이어서 만들어요.'},429,{'Retry-After':String(retryAfter),...authHeaders});
   }
   throw new SettingsError(response.status===401?'GPT API 키 인증에 실패했어요. 설정에서 키를 확인해 주세요.':quota?'OpenAI API 잔액이나 사용 한도를 확인해 주세요. 이 요청은 자동으로 다시 보내지 않아요.':`배경 생성에 실패했어요 (${response.status}). 잠시 후 다시 확인해 주세요.`,quota?402:400);
  }
  const data=await response.json(),value=data.data?.[0]?.b64_json;
  if(typeof value!=='string'||value.length>4_000_000||!/^[A-Za-z0-9+/]+=*$/.test(value))throw new SettingsError('생성된 그림을 읽지 못했어요. 원본 그림은 그대로예요.');
  return reply({source:`data:image/jpeg;base64,${value}`},200,authHeaders);
 }catch(error){
  if(error instanceof Error&&(error.name==='TimeoutError'||error.name==='AbortError'))return reply({error:'응답 시간이 길어 연결이 끝났어요. OpenAI 사용 내역을 확인한 후 다시 눌러 주세요. 자동 재요청은 하지 않았어요.'},504);
  return failure(error);
 }
}
