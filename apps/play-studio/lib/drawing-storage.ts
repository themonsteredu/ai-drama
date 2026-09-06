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
export async function loadDrawing():Promise<DrawingProject|null>{
  const db=await openDatabase();return new Promise((resolve,reject)=>{
    const tx=db.transaction('projects','readonly');const request=tx.objectStore('projects').get('active');
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{if(request.result===undefined)resolve(null);else if(validateDrawingProject(request.result))resolve(request.result);else reject(new Error('저장된 그림을 읽지 못했어요. 원래 저장 내용은 지우지 않았어요.'));};
  });
}
let writes=Promise.resolve();
/** Serialize transactions so a slower older save never replaces a newer work. */
export function saveDrawing(project:DrawingProject):Promise<void>{
  const task=writes.catch(()=>{}).then(async()=>{
    const db=await openDatabase();return new Promise<void>((resolve,reject)=>{
      const tx=db.transaction('projects','readwrite');tx.objectStore('projects').put(project,'active');
      tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error??new Error('저장을 마치지 못했어요.'));
    });
  });writes=task;return task;
}
