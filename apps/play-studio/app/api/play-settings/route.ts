import {authenticated,checkPin,failure,IMAGE_MODEL,keyStatus,limitRequests,readBody,ready,reply,sameOrigin,saveApiKey,savedApiKey,sessionCookie,SettingsError} from '../../../lib/play-ai-server';
export const runtime='nodejs';
export const maxDuration=30;
export async function GET(request:Request){
 if(!authenticated(request))return reply({authenticated:false,available:ready()});
 try{return reply({authenticated:true,...await keyStatus()});}catch(error){return failure(error);}
}
export async function POST(request:Request){
 try{
  sameOrigin(request);const body=await readBody(request);
  if(body.action==='logout')return reply({authenticated:false},200,{'Set-Cookie':sessionCookie(true)});
  if(body.action==='login'){
   await checkPin(request,body.pin);
   return reply({authenticated:true,...await keyStatus()},200,{'Set-Cookie':sessionCookie()});
  }
  if(!authenticated(request))throw new SettingsError('설정 번호를 다시 입력해 주세요.',401);
  await limitRequests(request,'settings');
  if(body.action==='save'){await saveApiKey(body.apiKey);return reply({authenticated:true,...await keyStatus()});}
  if(body.action==='test'){
   const key=await savedApiKey();
   const response=await fetch(`https://api.openai.com/v1/models/${IMAGE_MODEL}`,{headers:{Authorization:`Bearer ${key}`},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw new SettingsError(response.status===401?'키 인증에 실패했어요. 입력한 키를 확인해 주세요.':response.status===404||response.status===403?'이 키에서 이미지 모델을 사용할 수 있는지 OpenAI 계정 설정을 확인해 주세요.':'OpenAI 연결 상태를 확인하지 못했어요. 잠시 후 다시 해 주세요.',400);
   return reply({connected:true,message:'키 인증과 이미지 모델 조회를 확인했어요. 실제 생성에는 API 사용 요금이 발생해요.'});
  }
  throw new SettingsError('지원하지 않는 요청이에요.');
 }catch(error){return failure(error);}
}
