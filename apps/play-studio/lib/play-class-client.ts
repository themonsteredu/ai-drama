import {parseDrawingFile,type DrawingProject} from './drawing-project';
export type Classroom={id:string;code:string;title:string;group_count:number;is_open:boolean;created_at:string};
export type ClassGroup={group_no:number;revision:number;submitted:boolean;summary:{title?:string;scenes?:number;seconds?:number;voices?:number};updated_at:string|null};
export class ClassError extends Error{constructor(message:string,public status:number){super(message);}}
export async function classApi<T=Record<string,unknown>>(body:Record<string,unknown>):Promise<T>{
 const r=await fetch('/api/play-class',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(120000)});
 const v=await r.json();if(!r.ok)throw new ClassError(v.error||'연결을 확인해 주세요.',r.status);return v;
}
export async function readClassProject(url:string):Promise<DrawingProject>{const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(120000)});if(!r.ok)throw new Error('작품을 불러오지 못했어요. 다시 눌러 주세요.');return parseDrawingFile(await r.text());}
export function classStorageKey(id:string,n:number){return `class:${id}:${n}`;}
export async function uploadClassProject(classId:string,group:number,revision:number,project:DrawingProject,submitted:boolean){
 const blob=new Blob([JSON.stringify(project)],{type:'application/json'});if(blob.size>50_000_000)throw new Error('모둠 작품은 50MB까지 저장해요. 쓰지 않는 그림을 줄이거나 작품 파일로 보관해 주세요.');
 const signed=await classApi<{url:string;ticket:string}>({action:'upload',classId,group,revision,bytes:blob.size});
 const r=await fetch(signed.url,{method:'PUT',headers:{'Content-Type':'application/json','Cache-Control':'max-age=0'},body:blob,signal:AbortSignal.timeout(120000)});if(!r.ok)throw new Error('전송을 마치지 못했어요. 다시 저장해 주세요.');
 return classApi<{revision:number;submitted:boolean}>({action:'save',classId,group,ticket:signed.ticket,submitted});
}
