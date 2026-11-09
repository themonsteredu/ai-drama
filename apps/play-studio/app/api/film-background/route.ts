import {backgroundEditPrompt} from '../../../lib/background-prompt';
import {authenticated,authorizeGeneration,failure,IMAGE_MODEL,keyStatus,readBody,ready,reply,sameOrigin,savedApiKey,sessionCookie,SettingsError} from '../../../lib/play-ai-server';
export const runtime='nodejs';
export const maxDuration=300;
export async function GET(request:Request){
 if(!ready())return reply({configured:false});
 try{return reply({...await keyStatus(),authenticated:authenticated(request)});}catch{return reply({configured:false});}
}
function png(value:unknown){
 if(typeof value!=='string'||value.length>1_900_000||!/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(value))throw new SettingsError('그림 파일을 확인해 주세요.');
 const bytes=Buffer.from(value.split(',')[1],'base64');
 if(bytes.length<24||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw new SettingsError('PNG 그림을 확인해 주세요.');
 return {bytes,width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
}
export async function POST(request:Request){
 try{
  sameOrigin(request);const body=await readBody(request,4_000_000);
  await authorizeGeneration(request,body.code);
  if(typeof body.prompt!=='string'||!body.prompt.trim()||body.prompt.length>600)throw new SettingsError('배경 설명을 확인해 주세요.');
  const image=png(body.image),mask=png(body.mask);
  if(image.width!==1024||image.height!==1024||mask.width!==image.width||mask.height!==image.height)throw new SettingsError('그림과 보호 영역의 크기를 확인해 주세요.');
  const key=await savedApiKey(),form=new FormData();
  form.set('model',IMAGE_MODEL);form.set('quality','low');form.set('size','1024x1024');form.set('n','1');form.set('output_format','jpeg');form.set('output_compression','85');
  form.set('image[]',new Blob([new Uint8Array(image.bytes)],{type:'image/png'}),'scene.png');
  form.set('mask',new Blob([new Uint8Array(mask.bytes)],{type:'image/png'}),'mask.png');
  form.set('prompt',backgroundEditPrompt(body.prompt,body.operation,body.strength==='gentle'?'gentle':'clear'));
  const response=await fetch('https://api.openai.com/v1/images/edits',{method:'POST',headers:{Authorization:`Bearer ${key}`},body:form,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(270000)});
  if(!response.ok)throw new SettingsError(response.status===401?'GPT API 키 인증에 실패했어요. 설정에서 키를 확인해 주세요.':response.status===429?'API 잔액 또는 요청 한도를 확인해 주세요. 자동으로 다시 생성하지 않았어요.':`배경 생성에 실패했어요 (${response.status}). 키의 이미지 생성 권한과 입력 내용을 확인해 주세요.`,400);
  const data=await response.json(),value=data.data?.[0]?.b64_json;
  if(typeof value!=='string'||value.length>4_000_000||!/^[A-Za-z0-9+/]+=*$/.test(value))throw new SettingsError('생성된 그림을 읽지 못했어요. 원본 그림은 그대로예요.');
  return reply({source:`data:image/jpeg;base64,${value}`},200,authenticated(request)?{}:{'Set-Cookie':sessionCookie()});
 }catch(error){
  if(error instanceof Error&&(error.name==='TimeoutError'||error.name==='AbortError'))return reply({error:'응답 시간이 길어 연결이 끝났어요. OpenAI 사용 내역을 확인한 후 다시 눌러 주세요. 자동 재요청은 하지 않았어요.'},504);
  return failure(error);
 }
}
