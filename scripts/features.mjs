import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {validateMeal,mealTotals} from '../dist/nutrition.js';
import {weeklySummary,validateSettings} from '../dist/insights.js';
import {dateIsValid,localDate} from '../dist/data.js';
const catalog=JSON.parse(fs.readFileSync(new URL('../data/foods.json',import.meta.url),'utf8'));
const normalized=catalog.foods.map(f=>({...f,search:f.name.toLowerCase()}));
const error=(status,message)=>Object.assign(new Error(message),{status});
export function featureRoutes(db,ai){
 db.exec('CREATE TABLE IF NOT EXISTS meals(user_id TEXT NOT NULL REFERENCES users(id),id TEXT NOT NULL,data TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(user_id,id))');
 // Goal weight and combined exercise names live beside the journal, so the journal format stays unchanged.
 db.exec('CREATE TABLE IF NOT EXISTS settings(user_id TEXT PRIMARY KEY REFERENCES users(id),data TEXT NOT NULL)');
 const settingsOf=id=>JSON.parse(db.prepare('SELECT data FROM settings WHERE user_id=?').get(id)?.data||'{"goal":null,"aliases":{}}');
 const cache=new Map();
 return async(req,res,user,url,body,send)=>{
  const p=url.pathname;
  if(p==='/api/backup'&&req.method==='GET'){
   const journal=JSON.parse(db.prepare('SELECT data FROM journals WHERE user_id=?').get(user.id).data);
   const meals=db.prepare('SELECT id,data,revision FROM meals WHERE user_id=?').all(user.id).map(r=>({id:r.id,revision:r.revision,...JSON.parse(r.data)}));
   send(res,200,{...journal,meals,settings:settingsOf(user.id)});return true;
  }
  if(p==='/api/foods'&&req.method==='GET'){
   const query=(url.searchParams.get('q')||'').trim().toLowerCase().slice(0,100);const terms=query.split(/\s+/).filter(Boolean);
   const matches=terms.length?normalized.filter(f=>terms.every(t=>f.search.includes(t))).sort((a,b)=>(a.search.startsWith(query)?-1:0)-(b.search.startsWith(query)?-1:0)||a.name.length-b.name.length):[];
   send(res,200,{source:catalog.source,total:matches.length,foods:matches.slice(0,30).map(({search,...f})=>f)});return true;
  }
  if(p==='/api/meals'&&req.method==='GET'){
   send(res,200,{meals:db.prepare('SELECT id,data,revision FROM meals WHERE user_id=?').all(user.id).map(r=>({id:r.id,revision:r.revision,...JSON.parse(r.data)}))});return true;
  }
  if(p==='/api/meals'&&['POST','PUT','DELETE'].includes(req.method)){
   const input=await body(req);if(input.userId!==user.id)throw error(409,'Your account changed. Reload to continue.');
   const id=req.method==='POST'?randomUUID():input.id;
   let meal;
   if(req.method!=='DELETE'){try{meal=validateMeal(input);}catch(e){throw error(400,e.message);}}
   if(req.method==='POST')db.prepare('INSERT INTO meals(user_id,id,data) VALUES(?,?,?)').run(user.id,id,JSON.stringify(meal));
   else{
    if(!Number.isSafeInteger(input.revision)||typeof id!=='string')throw error(400,'Invalid meal.');
    const result=req.method==='DELETE'?db.prepare('DELETE FROM meals WHERE user_id=? AND id=? AND revision=?').run(user.id,id,input.revision):db.prepare('UPDATE meals SET data=?,revision=revision+1 WHERE user_id=? AND id=? AND revision=?').run(JSON.stringify(meal),user.id,id,input.revision);
    if(!result.changes)throw error(409,'This meal changed in another tab. Reload your meals and try again.');
   }
   send(res,200,{id,revision:req.method==='POST'?0:input.revision+1,...meal});return true;
  }
  if(p==='/api/settings'&&req.method==='GET'){send(res,200,{settings:settingsOf(user.id)});return true;}
  if(p==='/api/settings'&&req.method==='PUT'){
   const input=await body(req);if(input.userId!==user.id)throw error(409,'Your account changed. Reload to continue.');
   let settings;try{settings=validateSettings(input.settings);}catch(e){throw error(400,e.message);}
   db.prepare('INSERT INTO settings(user_id,data) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data').run(user.id,JSON.stringify(settings));
   send(res,200,{settings});return true;
  }
  if(p==='/api/review'&&req.method==='GET'||p==='/api/review/ai'&&req.method==='POST'){
   const input=req.method==='POST'?await body(req):Object.fromEntries(url.searchParams);
   const end=input.end||localDate(),unit=input.unit||'lb';
   if(!dateIsValid(end)||end>localDate()||!['lb','kg'].includes(unit))throw error(400,'Choose a valid end date and unit.');
   const row=db.prepare('SELECT data,revision FROM journals WHERE user_id=?').get(user.id);
   const settings=settingsOf(user.id),summary=weeklySummary(JSON.parse(row.data),end,unit,settings);
   if(req.method==='GET'){send(res,200,{summary,settings,aiReady:ai?await ai.ready():false});return true;}
   if(!ai||!await ai.ready())throw error(503,'The local AI is starting or unavailable. Your calculated review still works.');
   const key=`${user.id}:${row.revision}:${end}:${unit}:${JSON.stringify(settings)}`;
   let text=cache.get(key);
   if(!text){try{text=await ai.generate(summary);}catch(e){throw error(503,e.message);}if(cache.size>100)cache.clear();cache.set(key,text);}
   send(res,200,{text,model:ai.label,end,unit});return true;
  }
  return false;
 };
}
