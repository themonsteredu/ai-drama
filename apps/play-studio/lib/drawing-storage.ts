import {validateDrawingProject,type DrawingProject} from './drawing-project';
let database:Promise<IDBDatabase>|undefined;
function openDatabase(){
  if(!database)database=new Promise<IDBDatabase>((resolve,reject)=>{
    if(!globalThis.indexedDB){reject(new Error('기기 저장을 사용할 수 없어요. 작품 파일로 보관해 주세요.'));return;}
    const request=indexedDB.open('moakit-play-drawings-v1',1);
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('projects'))request.result.createObjectStore('projects');};
    request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(new Error('다른 창을 닫고 다시 열어 주세요.'));
    request.onsuccess=()=>{request.result.onversionchange=()=>{request.result.close();database=undefined;};resolve(request.result);};
  }).catch(error=>{database=undefined;throw error;});
  return database;
}
export async function loadDrawing(key='active'):Promise<DrawingProject|null>{
  const db=await openDatabase();return new Promise((resolve,reject)=>{
    const tx=db.transaction('projects','readonly');const request=tx.objectStore('projects').get(key);
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{if(request.result===undefined)resolve(null);else if(validateDrawingProject(request.result))resolve(request.result);else reject(new Error('저장된 그림을 읽지 못했어요. 원래 저장 내용은 지우지 않았어요.'));};
  });
}

export type SavedDeviceProject = {key: string; title: string; scenes: number; updatedAt: string};

/** Read just enough of each record to display its name without retaining its media. */
export async function listSavedDrawings(): Promise<SavedDeviceProject[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const projects: SavedDeviceProject[] = [];
    const tx = db.transaction('projects', 'readonly');
    const request = tx.objectStore('projects').openCursor();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('이 기기의 작품 목록을 읽지 못했어요.'));
    tx.oncomplete = () => resolve(projects);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      const value = cursor.value as Partial<DrawingProject> | null;
      if (typeof cursor.key === 'string' && value?.format === 'moakit-drawing' &&
          typeof value.title === 'string' && typeof value.updatedAt === 'string' && Array.isArray(value.scenes)) {
        projects.push({key: cursor.key, title: value.title, scenes: value.scenes.length, updatedAt: value.updatedAt});
      }
      cursor.continue();
    };
  });
}

let writes=Promise.resolve();
/** Serialize transactions so a slower older save never replaces a newer work. */
export function saveDrawing(project:DrawingProject,key='active'):Promise<void>{
  const task=writes.catch(()=>{}).then(async()=>{
    const db=await openDatabase();return new Promise<void>((resolve,reject)=>{
      const tx=db.transaction('projects','readwrite');tx.objectStore('projects').put(project,key);
      tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error??new Error('저장을 마치지 못했어요.'));
    });
  });writes=task;return task;
}
