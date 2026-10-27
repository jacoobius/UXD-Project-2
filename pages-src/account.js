import {createDeviceService} from './device-store.js';
import {read,transact} from './persistence.js';
import {browserAI} from './web-coach.js';
let catalogPromise;
async function loadCatalog(){
 if(!catalogPromise)catalogPromise=fetch(new URL('./data/foods.json',import.meta.url)).then(response=>{if(!response.ok)throw new Error('Food catalog unavailable. Reload or use a manual food entry.');return response.json();}).catch(error=>{catalogPromise=null;throw error;});
 return catalogPromise;
}
const progress=text=>document.dispatchEvent(new CustomEvent('steadily-ai-progress',{detail:text}));
export const api=createDeviceService({read,transact,loadCatalog,ai:{...browserAI,reflect:summary=>browserAI.reflect(summary,progress)}});
function element(tag,text){const el=document.createElement(tag);if(text)el.textContent=text;return el;}
export async function setupAccount(){
 const identity=document.getElementById('account-email');if(identity)identity.textContent='Saved in this browser';
 const button=document.getElementById('sign-out');button.textContent='Backups';
 const dialog=element('dialog');dialog.className='backup-dialog';dialog.setAttribute('aria-labelledby','backup-title');
 const heading=element('h2','Your journal, safely kept.');heading.id='backup-title';
 const description=element('p','This edition saves entries on this device. Export a backup before clearing browser data. Import a backup to move your journal from another browser or the server edition.');
 const file=element('input');file.type='file';file.accept='.json,application/json';file.id='backup-file';
 const label=element('label','Choose a steadily JSON backup');label.htmlFor=file.id;
 const status=element('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const exportButton=element('button','Export full backup');exportButton.type='button';exportButton.className='button primary';
 const importButton=element('button','Import chosen backup');importButton.type='button';importButton.className='button secondary';
 const undo=element('button','Undo last import');undo.type='button';undo.className='text-button';undo.hidden=true;
 const close=element('button','Close');close.type='button';close.className='text-button';close.onclick=()=>dialog.close();
 dialog.append(heading,description,exportButton,label,file,importButton,undo,status,close);document.body.append(dialog);
 button.onclick=async()=>{dialog.showModal();try{undo.hidden=!(await api('backup/status')).canUndo;}catch(error){status.textContent=error.message;}};
 exportButton.onclick=async()=>{
  try{const data=await api('backup');const url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));const link=element('a');link.href=url;link.download=`steadily-backup-${new Date().toISOString().slice(0,10)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='Backup exported with your entries, meals, and settings.';}
  catch(error){status.textContent=error.message;}
 };
 importButton.onclick=async()=>{
  const selected=file.files[0];if(!selected){status.textContent='Choose a JSON backup first.';return;}
  if(selected.size>10*1024*1024){status.textContent='Choose a backup smaller than 10 MB.';return;}
  let backup;try{backup=JSON.parse(await selected.text());}catch{status.textContent='This file is not valid JSON. Nothing has been changed.';return;}
  if(!confirm('Replace this browser’s journal with the chosen backup? Your current journal will be kept for Undo import.'))return;
  importButton.disabled=true;
  try{await api('backup/import','POST',{backup});location.reload();}catch(error){status.textContent=error.message;}finally{importButton.disabled=false;}
 };
 undo.onclick=async()=>{if(!confirm('Restore the journal from before your last import? Entries added since that import will be replaced.'))return;try{await api('backup/undo','POST',{});location.reload();}catch(error){status.textContent=error.message;}};
 try{await read();}catch(error){const box=document.getElementById('storage-error');box.hidden=false;box.textContent=error.message;}
 return {id:'device-journal',email:'This browser'};
}
