import {parseDrawingFile,type DrawingProject} from './drawing-project';
import type {ClassSceneNumber, SavedScenePage, SavedSceneProject} from './play-class-scenes';
export type Classroom={id:string;code:string;title:string;group_count:number;is_open:boolean;created_at:string};
export type ClassGroup={group_no:number;revision:number;submitted:boolean;summary:{title?:string;scenes?:number;seconds?:number;voices?:number};updated_at:string|null};
export type SavedClassProject = {
 classId: string;
 group: number;
 classTitle: string;
 title: string;
 scenes: number | null;
 updatedAt: string | null;
};
export type SavedClassPage = {
 projects: SavedClassProject[];
 next: {afterClassId: string; afterGroup: number} | null;
};
export class ClassError extends Error{constructor(message:string,public status:number){super(message);}}
export async function classApi<T=Record<string,unknown>>(body:Record<string,unknown>):Promise<T>{
 const r=await fetch('/api/play-class',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(120000)});
 const v=await r.json();if(!r.ok)throw new ClassError(v.error||'연결을 확인해 주세요.',r.status);return v;
}
export async function fetchClassProject(url: string) {
 const response = await fetch(url, {cache:'no-store', signal:AbortSignal.timeout(120000)});
 if (!response.ok) throw new Error('작품을 불러오지 못했어요. 다시 눌러 주세요.');
 return response;
}
export async function readClassProject(url:string):Promise<DrawingProject>{return parseDrawingFile(await (await fetchClassProject(url)).text());}
export function classStorageKey(id:string,n:number){return `class:${id}:${n}`;}
export async function classProjectUrl(classId: string, group: number) {
 const {url} = await classApi<{url: string | null}>({action: 'work', classId, group});
 if (!url) throw new Error(`${group}모둠의 저장된 작품을 찾지 못했어요.`);
 return url;
}

export async function sceneProjectUrl(submissionId: string) {
 const {url} = await classApi<{url: string}>({action: 'scene-work', submissionId});
 return url;
}

export async function listSceneProjects(classId?: string, group?: number) {
 const projects: SavedSceneProject[] = [];
 let next: string | null = null;
 do {
  const page: SavedScenePage = await classApi({action: 'saved-scenes', classId, group, afterId: next ?? undefined});
  projects.push(...page.projects);
  next = page.next;
 } while (next);
 return projects;
}

async function uploadProjectFile(project: DrawingProject, request: Record<string, unknown>) {
 const blob = new Blob([JSON.stringify(project)], {type: 'application/json'});
 if (blob.size > 50_000_000) throw new Error('작품은 50MB까지 보낼 수 있어요. 쓰지 않는 그림을 줄이거나 작품 파일로 보관해 주세요.');
 const {url, ticket} = await classApi<{url: string; ticket: string}>({...request, bytes: blob.size});
 const result = await fetch(url, {
  method: 'PUT', headers: {'Content-Type': 'application/json', 'Cache-Control': 'max-age=0'},
  body: blob, signal: AbortSignal.timeout(120000),
 });
 if (!result.ok) throw new Error('작품 전송을 마치지 못했어요. 다시 눌러 주세요.');
 return ticket;
}

export async function uploadClassProject(classId:string,group:number,revision:number,project:DrawingProject,submitted:boolean){
 const ticket = await uploadProjectFile(project, {action: 'upload', classId, group, revision});
 return classApi<{revision:number;submitted:boolean}>({action:'save',classId,group,ticket,submitted});
}

export async function submitSceneProject(
 project: DrawingProject, destination: {classId: string; group: number} | {code: string; group: number}, scene: ClassSceneNumber,
) {
 const ticket = await uploadProjectFile(project, {action: 'scene-upload', ...destination, scene});
 const finish = () => classApi<{id: string; submittedAt: string; isLatest?: boolean}>({action: 'scene-submit', ticket});
 try {
  return await finish();
 } catch (cause) {
  if (cause instanceof ClassError && cause.status < 500) throw cause;
  return finish();
 }
}
