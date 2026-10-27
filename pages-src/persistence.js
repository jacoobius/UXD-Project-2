import {initialState} from './device-store.js';
// Each project path gets its own database, even when GitHub Pages sites share an origin.
const databaseName=`steadily-pages:${new URL('.',import.meta.url).pathname}`;
let pending;
function open(){
 if(!pending)pending=new Promise((resolve,reject)=>{
  if(!globalThis.indexedDB){reject(new Error('Browser storage is unavailable. Enable site storage and reload.'));return;}
  const request=indexedDB.open(databaseName,1);
  request.onupgradeneeded=()=>{request.result.createObjectStore('journal');};
  request.onerror=()=>reject(new Error('Could not open your journal. Check browser storage permissions.'));
  request.onblocked=()=>reject(new Error('Close other steadily tabs, then reload to update storage.'));
  request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>db.close();resolve(db);};
 });
 return pending;
}
async function run(mode,change){
 const db=await open();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('journal',mode),store=tx.objectStore('journal'),request=store.get('state');let result,error;
  request.onsuccess=()=>{
   try{
    const state=request.result||initialState();
    if(state.version!==1||!state.journal||!Array.isArray(state.meals))throw new Error('This saved journal could not be read. Export or restore a backup; existing data has been kept.');
    result=change(state);if(mode==='readwrite')store.put(state,'state');
   }catch(e){error=e;tx.abort();}
  };
  tx.oncomplete=()=>resolve(result);
  tx.onabort=()=>reject(error||new Error('Your journal could not be saved. Check storage space and permissions. Your form has been kept.'));
  tx.onerror=()=>{};
 });
}
export const read=()=>run('readonly',state=>structuredClone(state));
export const transact=change=>run('readwrite',change);
