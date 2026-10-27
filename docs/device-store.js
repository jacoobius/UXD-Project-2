import {emptyJournal,loadJournal,dateIsValid,localDate} from './data.js';
import {validateMeal} from './nutrition.js';
import {validateSettings,weeklySummary} from './insights.js';
export const initialState=()=>({version:1,journal:emptyJournal(),revision:0,meals:[],settings:{goal:null,aliases:{}},restorePoint:null});
const clone=value=>structuredClone(value);
export function validateBackup(backup){
 if(!backup||typeof backup!=='object')throw new Error('Choose a steadily JSON backup.');
 const journal=loadJournal({getItem:()=>JSON.stringify(backup)});
 for(const kind of ['weight','food','lifts']){
  const ids=journal[kind].map(e=>e.id);
  if(new Set(ids).size!==ids.length)throw new Error('This backup contains duplicate entry IDs.');
 }
 if(backup.meals!==undefined&&!Array.isArray(backup.meals))throw new Error('The saved meal list is invalid.');
 const meals=(backup.meals||[]).map((meal,index)=>({...validateMeal(meal),id:typeof meal.id==='string'?meal.id:`imported-meal-${index}`,revision:0}));
 if(new Set(meals.map(m=>m.id)).size!==meals.length)throw new Error('This backup contains duplicate meal IDs.');
 const settings=validateSettings(backup.settings||{goal:null,aliases:{}});
 return {journal:{version:1,weight:clone(journal.weight),food:clone(journal.food),lifts:clone(journal.lifts)},meals,settings};
}
export function reflection(summary){
 const paragraphs=[summary.facts.join(' ')];
 if(!summary.exercises.length)paragraphs.push('Log a workout to start comparing your training. Missing entries cannot establish whether you made progress.');
 else{
  const steps=summary.exercises.slice(0,6).map(e=>`${e.name}: ${e.signal==='new'||e.signal==='mixed'?'record another session with similar technique and rep range so you have a comparison':e.signal==='down'?'check recovery and technique before trying to exceed your previous result':'keep technique and effort consistent when comparing your next session'}.`);
  paragraphs.push(steps.join(' '));
 }
 if(summary.nutrition.current.low)paragraphs.push('Some food logs may be incomplete. The recorded calories do not establish your full intake.');
 return paragraphs.join('\n\n');
}
// `ai` is optional: {label, available(), reflect(summary)}. Without it, or when it fails, reflections are calculated.
export function createDeviceService({read,transact,loadCatalog,uuid=()=>crypto.randomUUID(),ai=null}){
 const user={id:'device-journal',email:'This browser'};
 const checkUser=data=>{if(data?.userId!==user.id)throw new Error('This journal belongs to this browser. Reload and try again.');};
 return async function api(route,method='GET',data){
  const url=new URL(route,'https://steadily.invalid/');const p=url.pathname;
  if(p==='/session'&&method==='GET')return {user};
  if(p==='/journal'&&method==='GET'){const s=await read();return {journal:clone(s.journal),revision:s.revision,userId:user.id};}
  if(p==='/journal'&&method==='PUT'){
   checkUser(data);loadJournal({getItem:()=>JSON.stringify(data.journal)});
   return transact(s=>{if(data.revision!==s.revision)throw new Error('Your journal changed in another tab. Try saving again.');s.journal=clone(data.journal);return {revision:++s.revision};});
  }
  if(p==='/backup'&&method==='GET'){const s=await read();return {...clone(s.journal),meals:clone(s.meals),settings:clone(s.settings)};}
  if(p==='/backup/import'&&method==='POST'){
   const imported=validateBackup(data?.backup);
   return transact(s=>{s.restorePoint={journal:clone(s.journal),meals:clone(s.meals),settings:clone(s.settings)};s.journal=imported.journal;s.meals=imported.meals;s.settings=imported.settings;s.revision++;return {ok:true};});
  }
  if(p==='/backup/undo'&&method==='POST')return transact(s=>{if(!s.restorePoint)throw new Error('No previous import is available to undo.');const old=s.restorePoint;s.journal=old.journal;s.meals=old.meals;s.settings=old.settings;s.restorePoint=null;s.revision++;return {ok:true};});
  if(p==='/backup/status')return {canUndo:Boolean((await read()).restorePoint)};
  if(p==='/foods'&&method==='GET'){
   const catalog=await loadCatalog(),query=(url.searchParams.get('q')||'').trim().toLowerCase().slice(0,100),terms=query.split(/\s+/).filter(Boolean);
   const foods=terms.length?catalog.foods.filter(f=>terms.every(t=>f.name.toLowerCase().includes(t))).sort((a,b)=>(a.name.toLowerCase().startsWith(query)?-1:0)-(b.name.toLowerCase().startsWith(query)?-1:0)||a.name.length-b.name.length):[];
   return {source:catalog.source,total:foods.length,foods:foods.slice(0,30)};
  }
  if(p==='/meals'&&method==='GET')return {meals:clone((await read()).meals)};
  if(p==='/meals'&&['POST','PUT','DELETE'].includes(method)){
   checkUser(data);const meal=method==='DELETE'?null:validateMeal(data);
   return transact(s=>{
    if(method==='POST'){const added={...meal,id:uuid(),revision:0};s.meals.push(added);return clone(added);}
    const index=s.meals.findIndex(m=>m.id===data.id);
    if(index<0||s.meals[index].revision!==data.revision)throw new Error('This meal changed in another tab. Reload and try again.');
    if(method==='DELETE'){s.meals.splice(index,1);return {ok:true};}
    const updated={...meal,id:data.id,revision:data.revision+1};s.meals[index]=updated;return clone(updated);
   });
  }
  if(p==='/settings'&&method==='GET')return {settings:clone((await read()).settings)};
  if(p==='/settings'&&method==='PUT'){checkUser(data);const settings=validateSettings(data.settings);return transact(s=>{s.settings=settings;return {settings:clone(settings)};});}
  if(p==='/review'||p==='/review/ai'){
   const input=method==='POST'?data||{}:Object.fromEntries(url.searchParams),end=input.end||localDate(),unit=input.unit||'lb';
   if(!dateIsValid(end)||end>localDate()||!['lb','kg'].includes(unit))throw new Error('Choose a valid end date and unit.');
   const state=await read(),summary=weeklySummary(state.journal,end,unit,state.settings);
   if(p==='/review')return {summary,settings:clone(state.settings),aiReady:ai?await ai.available():false};
   if(ai&&await ai.available()){
    try{return {text:await ai.reflect(summary),model:ai.label,end,unit};}
    catch(error){return {text:reflection(summary),model:`Calculated reflection · AI coach unavailable: ${error.message}`,end,unit};}
   }
   return {text:reflection(summary),model:'Calculated reflection · no AI model',end,unit};
  }
  throw new Error('This feature is not available in the GitHub Pages edition.');
 };
}
