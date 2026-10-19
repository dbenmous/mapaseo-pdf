import type { Annotation } from '../types';
type Recovery = {name:string;data:Uint8Array;annotations:Annotation[];savedAt:number};
function db():Promise<IDBDatabase> { return new Promise((resolve,reject)=>{ const r=indexedDB.open('mapaseo-pdf',1);r.onupgradeneeded=()=>r.result.createObjectStore('workspace');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error); }); }
export async function saveRecovery(value:Recovery) { const d=await db();try {await new Promise<void>((resolve,reject)=>{const t=d.transaction('workspace','readwrite');t.objectStore('workspace').put(value,'recovery');t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);});}finally{d.close();} }
export async function getRecovery():Promise<Recovery|undefined>{const d=await db();try{return await new Promise((resolve,reject)=>{const r=d.transaction('workspace').objectStore('workspace').get('recovery');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}finally{d.close();}}
