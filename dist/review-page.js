import {api,setupAccount} from './account.js';
import {localDate} from './data.js';
import {exerciseKey} from './insights.js';
const $=id=>document.getElementById(id);
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const signed=n=>`${n>0?'+':''}${n}`;
const pretty=day=>new Date(`${day}T12:00:00`).toLocaleDateString(undefined,{month:'short',day:'numeric'});
const user=await setupAccount();
$('today').textContent=new Date().toLocaleDateString(undefined,{month:'short',day:'numeric'});$('review-end').value=localDate();$('review-end').max=localDate();
let summary=null,settings={goal:null,aliases:{}},requestId=0;
function stats(){
 const u=summary.unit,w=summary.weight,cal=summary.nutrition.current,goal=w.goal;
 const cards=[
  ['Workouts this week',summary.workouts,`${summary.trainingDays} training day${summary.trainingDays===1?'':'s'} · ${summary.sets} sets`],
  ['Weekly weight change',w.change===null?'—':`${signed(w.change)} ${u}`,w.change===null?'Weigh in on 2+ days each week':`${signed(w.rate)}% of bodyweight`],
  ['Four-week trend',w.trend?`${signed(w.trend.perWeek)} ${u}/wk`:'—',w.trend?`${signed(w.trend.pct)}% of bodyweight per week`:'Weigh in on 4+ days across 2 weeks'],
  ['Since you started',w.sinceStart===null?'—':`${signed(w.sinceStart)} ${u}`,w.firstDate?`First week from ${pretty(w.firstDate)}`:'Add bodyweight check-ins'],
  ['Goal',!goal?'—':goal.reached?'Reached':`${Math.abs(goal.remaining)} ${u} to go`,!goal?'Set a goal weight below':goal.reached?`Goal: ${goal.target} ${u}`:goal.eta?`On pace for ${pretty(goal.eta)}`:goal.status==='away'?'Trend is moving away from it':'More weigh-ins needed for a date'],
  ['Calories per day',cal.average===null?'—':`${cal.average.toLocaleString()} kcal`,cal.days?`${cal.days} of 7 days logged${summary.nutrition.maintenance?` · maintenance ≈ ${summary.nutrition.maintenance.toLocaleString()}`:''}`:'Log calories on the food page']
 ];
 $('review-stats').replaceChildren(...cards.map(([label,value,detail])=>{const card=el('div','stat');card.append(el('span','stat-label',label),el('strong','stat-value',String(value)),el('span','stat-detail',detail));return card;}));
}
function exerciseTable(){
 const comparisons=$('exercise-comparisons'),u=summary.unit;comparisons.replaceChildren();
 if(!summary.exercises.length){comparisons.append(el('p','meal-empty','No lifts logged in this window. Save a workout to start your review.'));return;}
 const set=s=>s?`${s.load?`${s.load} ${u}`:'Bodyweight'} × ${s.reps}`:'—';
 const region=el('div','sheet-scroll');region.tabIndex=0;region.setAttribute('role','region');region.setAttribute('aria-label','Exercise comparisons, scroll on small screens');
 const table=el('table','comparison-table');table.append(el('caption','sr-only','Best set this week compared with your last session, four-week trend, and weekly volume'));
 const head=el('thead'),tr=el('tr');for(const label of ['Exercise','Last time','This week','What changed','4-week trend','Volume vs last week']){const th=el('th','',label);th.scope='col';tr.append(th);}head.append(tr);table.append(head);
 const body=el('tbody');
 for(const e of summary.exercises){
  const row=el('tr'),name=el('th','',e.name);name.scope='row';row.append(name);
  row.append(el('td','',e.previous?`${set(e.previous)} (${pretty(e.previous.date)})`:'—'),el('td','',set(e.current)));
  const changed=el('td','',e.detail);if(e.stall)changed.append(el('span','stall-note',`No new best in ${e.stall.weeks} weeks`));row.append(changed);
  row.append(el('td','',e.trend?(e.trend.pct!==null?`${signed(e.trend.pct)}% since ${pretty(e.trend.since)}`:`${signed(e.trend.reps)} reps since ${pretty(e.trend.since)}`):'Needs 2+ weeks'));
  const v=e.volume,amount=v.kind==='load'?`${Math.round(v.current).toLocaleString()} ${u}`:`${v.current} reps`;
  row.append(el('td','',v.change===null?amount:`${amount} (${signed(v.change)}%)`));
  body.append(row);
 }
 table.append(body);region.append(table);comparisons.append(region);
}
function settingsForms(){
 const goal=settings.goal;$('goal-weight').value=goal?.weight??'';$('goal-unit').value=goal?.unit||summary.unit;$('clear-goal').hidden=!goal;
 const names=summary.exerciseNames.filter(n=>!n.mergedInto);
 const options=(select,placeholder)=>{const value=select.value;select.replaceChildren(el('option','',placeholder),...names.map(n=>{const o=el('option','',n.name);o.value=n.key;return o;}));select.firstChild.value='';select.value=names.some(n=>n.key===value)?value:'';};
 options($('merge-from'),'Choose an exercise');options($('merge-into'),'Choose an exercise');
 $('merge-form').hidden=names.length<2;
 const merged=summary.exerciseNames.filter(n=>n.mergedInto);
 $('merge-list').replaceChildren(...merged.map(n=>{const li=el('li');li.append(el('span','',`${n.name} → ${n.mergedInto}`));const undo=el('button','text-button','Separate');undo.type='button';undo.setAttribute('aria-label',`Separate ${n.name} from ${n.mergedInto}`);undo.onclick=()=>{const aliases={...settings.aliases};delete aliases[n.key];save({...settings,aliases},`${n.name} is a separate exercise again.`);};li.append(undo);return li;}));
}
async function save(next,message){
 $('settings-status').textContent='Saving…';
 try{settings=(await api('settings','PUT',{userId:user.id,settings:next})).settings;await update();$('settings-status').textContent=message;}
 catch(error){$('settings-status').textContent=error.message;}
}
async function update(){
 const id=++requestId;$('review-status').textContent='Reading your journal…';$('generate-review').disabled=true;$('ai-feedback').replaceChildren();$('ai-status').textContent='';
 try{
  const result=await api(`review?end=${$('review-end').value}&unit=${$('review-unit').value}`);if(id!==requestId)return;summary=result.summary;settings=result.settings;
  $('review-period').textContent=`${summary.start} – ${summary.end}, compared with ${summary.previousStart} – ${summary.previousEnd}.`;
  stats();$('review-facts').replaceChildren(...summary.facts.map(f=>el('li','',f)));exerciseTable();settingsForms();
  $('review-status').textContent='Review updated.';$('generate-review').disabled=false;$('ai-status').textContent=result.aiReady?'Local model ready.':'Local model is starting or unavailable. You can retry shortly.';
 }catch(error){if(id===requestId)$('review-status').textContent=error.message;}
}
// The GitHub Pages edition reports model download and loading progress here.
document.addEventListener('steadily-ai-progress',event=>{$('ai-status').textContent=event.detail;});
$('review-filter').onsubmit=event=>{event.preventDefault();update();};
$('goal-form').onsubmit=event=>{event.preventDefault();const weight=Number($('goal-weight').value);if(!$('goal-weight').value||!Number.isFinite(weight)){$('settings-status').textContent='Enter a goal weight.';$('goal-weight').focus();return;}save({...settings,goal:{weight,unit:$('goal-unit').value}},'Goal saved.');};
$('clear-goal').onclick=()=>save({...settings,goal:null},'Goal removed.');
$('merge-form').onsubmit=event=>{
 event.preventDefault();const from=$('merge-from').value,into=$('merge-into').value;
 if(!from||!into||from===into){$('settings-status').textContent='Choose two different exercises.';return;}
 const target=summary.exerciseNames.find(n=>n.key===into).name,source=summary.exerciseNames.find(n=>n.key===from).name;
 // Anything already combined into the name being merged follows it to the new target.
 const aliases=Object.fromEntries(Object.entries(settings.aliases).map(([k,v])=>[k,exerciseKey(v)===from?target:v]));
 save({...settings,aliases:{...aliases,[from]:target}},`${source} now counts as ${target}.`);
};
$('generate-review').onclick=async()=>{
 if(!summary)return;const id=requestId;$('generate-review').disabled=true;$('ai-status').textContent='Writing on your computer… this may take a moment.';$('ai-feedback').replaceChildren();
 try{const result=await api('review/ai','POST',{end:summary.end,unit:summary.unit});if(id!==requestId)return;$('ai-feedback').replaceChildren(...result.text.split(/\n\s*\n/).map(p=>el('p','',p.trim())).filter(p=>p.textContent));$('ai-status').textContent=result.model;}
 catch(error){if(id===requestId)$('ai-status').textContent=error.message;}finally{if(id===requestId)$('generate-review').disabled=false;}
};
$('export-data').onclick=async()=>{try{const data=await api('backup');const url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));const link=el('a');link.href=url;link.download=`steadily-journal-${localDate()}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(error){$('review-status').textContent=error.message;}};
if(user)await update();
