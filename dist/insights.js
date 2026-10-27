import {localDate,convertWeight} from './data.js';
import {round} from './nutrition.js';
export function shiftDay(day,n){const d=new Date(`${day}T12:00:00`);d.setDate(d.getDate()+n);return localDate(d);}
const average=a=>a.length?a.reduce((n,x)=>n+x,0)/a.length:null;
const daysBetween=(a,b)=>Math.round((new Date(`${b}T12:00:00`)-new Date(`${a}T12:00:00`))/864e5);
const plural=(n,word)=>`${n} ${word}${n===1?'':'s'}`;
const signed=n=>`${n>0?'+':''}${n}`;
const list=items=>items.length<3?items.join(' and '):`${items.slice(0,-1).join(', ')}, and ${items.at(-1)}`;
const pretty=day=>new Date(`${day}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric'});
// Epley's formula turns any loaded set into a comparable one-rep max. It is dependable up to roughly 12–15 reps.
export const estimateMax=(load,reps)=>load>0?load*(1+reps/30):null;
// "Squats", "squat" and "Squat!" share a key; merges the user saved map one key onto another exercise's name.
export function exerciseKey(name,aliases={}){
 const key=String(name).toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim().split(' ').map(w=>w.length>3&&w.endsWith('s')&&!w.endsWith('ss')?w.slice(0,-1):w).join(' ');
 return Object.hasOwn(aliases,key)?exerciseKey(aliases[key]):key;
}
export function validateSettings(input){
 const goal=input?.goal??null,aliases=input?.aliases??{};
 if(goal!==null&&(!Number.isFinite(goal.weight)||goal.weight<20||goal.weight>1500||!['lb','kg'].includes(goal.unit)))throw new Error('Enter a goal weight between 20 and 1,500.');
 if(aliases===null||typeof aliases!=='object'||Array.isArray(aliases)||Object.keys(aliases).length>200)throw new Error('Too many combined exercises.');
 const clean={};
 for(const [from,to] of Object.entries(aliases)){
  if(typeof to!=='string'||!to.trim()||to.length>100||exerciseKey(from)!==from||!from)throw new Error('Choose two exercises to combine.');
  const target=exerciseKey(to);
  if(target===from)throw new Error('Choose two different exercises.');
  if(Object.hasOwn(aliases,target))throw new Error(`${to.trim()} is already combined into another exercise.`);
  clean[from]=to.trim();
 }
 return {goal:goal&&{weight:goal.weight,unit:goal.unit},aliases:clean};
}
// Loaded sets compare by estimated max; bodyweight sets (load 0) compare by reps.
const better=(a,b)=>a.max!==null||b.max!==null?(a.max??-1)>(b.max??-1):a.reps>b.reps;
function compare(now,before,unit){
 if(!before)return {signal:'new',detail:'First time in the last 8 weeks',pct:null,reps:null};
 const reps=now.reps-before.reps;
 if(now.load===before.load){
  const pct=now.max!==null?round((now.max/before.max-1)*100):null;
  return {signal:reps>0?'up':reps<0?'down':'steady',detail:reps>0?`${plural(reps,'more rep')} at the same weight`:reps<0?`${plural(-reps,'fewer rep')} at the same weight`:'Same weight and reps',pct,reps};
 }
 if(now.max===null||before.max===null)return {signal:'mixed',detail:'Loaded and bodyweight sets cannot be compared',pct:null,reps:null};
 if(Math.max(now.reps,before.reps)>15)return {signal:'mixed',detail:'Different weights above 15 reps cannot be compared reliably',pct:null,reps:null};
 const pct=round((now.max/before.max-1)*100);
 return {signal:pct>=1?'up':pct<=-2?'down':'steady',detail:`${signed(round(now.load-before.load))} ${unit}${reps?`, ${signed(reps)} rep${Math.abs(reps)===1?'':'s'}`:' at the same reps'}: estimated max ${signed(pct)}%`,pct,reps:null};
}
export function weeklySummary(journal,end=localDate(),unit='lb',settings={}){
 const aliases=settings.aliases||{};
 const start=shiftDay(end,-6),previousEnd=shiftDay(end,-7),previousStart=shiftDay(end,-13),monthStart=shiftDay(end,-27),historyStart=shiftDay(end,-55);
 const inRange=(e,a,b)=>e.date>=a&&e.date<=b;
 const current=journal.lifts.filter(e=>inRange(e,start,end)),previous=journal.lifts.filter(e=>inRange(e,previousStart,previousEnd));

 // Training: every exercise done this week, against its own last eight weeks.
 const groups=new Map();
 for(const e of journal.lifts.filter(e=>inRange(e,historyStart,end))){const key=exerciseKey(e.name,aliases);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e);}
 const targetNames=new Map(Object.values(aliases).map(name=>[exerciseKey(name),name]));
 function sessionsOf(rows){
  const map=new Map();
  for(const e of rows){
   const id=e.workoutId||e.date,load=convertWeight(e.weight,e.unit,unit),s=map.get(id)||{date:e.date,top:null,volume:0,reps:0};
   if(e.date>s.date)s.date=e.date;
   s.volume+=e.sets*e.reps*load;s.reps+=e.sets*e.reps;
   const set={load:round(load),reps:e.reps,max:estimateMax(load,e.reps)};if(!s.top||better(set,s.top))s.top=set;
   map.set(id,s);
  }
  return [...map.values()].sort((a,b)=>a.date.localeCompare(b.date));
 }
 const exercises=[...groups].filter(([,rows])=>rows.some(e=>e.date>=start)).map(([key,rows])=>{
  const sessions=sessionsOf(rows),week=sessions.filter(s=>s.date>=start),prior=sessions.filter(s=>s.date<start).at(-1)||null;
  const top=week.map(s=>s.top).reduce((t,s)=>better(s,t)?s:t);
  const loaded=top.max!==null,cmp=compare(top,prior?.top,unit);
  const lastWeek=sessions.filter(s=>inRange(s,previousStart,previousEnd)),sum=w=>round(w.reduce((n,s)=>n+(loaded?s.volume:s.reps),0));
  const volume={kind:loaded?'load':'reps',current:sum(week),previous:lastWeek.length?sum(lastWeek):null};
  volume.change=volume.previous?round((volume.current/volume.previous-1)*100):null;
  // Four-week trend: this week's best against the first session in the window, if it is at least two weeks old.
  const first=sessions.find(s=>s.date>=monthStart);let trend=null;
  if(first&&first.date<start&&daysBetween(first.date,end)>=14){const t=compare(top,first.top,unit);if(t.pct!==null||t.reps!==null)trend={pct:t.pct,reps:t.pct===null?t.reps:null,since:first.date};}
  // A stall: the best result is three or more weeks old and at least two later sessions have not beaten it.
  const points=sessions.filter(s=>(s.top.max!==null)===loaded).map(s=>({date:s.date,score:loaded?s.top.max:s.top.reps}));
  const peak=Math.max(...points.map(p=>p.score)),best=points.find(p=>p.score>=peak*0.995),after=points.filter(p=>p.date>best.date);
  const stallDays=daysBetween(best.date,points.at(-1).date);
  const stall=after.length>=2&&stallDays>=21?{weeks:Math.floor(stallDays/7),since:best.date}:null;
  const name=targetNames.get(key)||rows.reduce((a,b)=>b.date>=a.date?b:a).name;
  return {key,name,current:{load:top.load,reps:top.reps,max:loaded?round(top.max):null},previous:prior&&{load:prior.top.load,reps:prior.top.reps,max:prior.top.max===null?null:round(prior.top.max),date:prior.date},signal:cmp.signal,detail:cmp.detail,pct:cmp.pct,sets:rows.filter(e=>e.date>=start).reduce((n,e)=>n+e.sets,0),volume,trend,stall};
 }).sort((a,b)=>a.name.localeCompare(b.name));
 const names=new Map();
 for(const e of [...journal.lifts].sort((a,b)=>a.date.localeCompare(b.date))){const key=exerciseKey(e.name);names.set(key,{key,name:e.name.trim(),mergedInto:aliases[key]||null});}

 // Bodyweight: each day counts once, however many check-ins it has.
 const byDay=new Map();
 for(const e of journal.weight.filter(e=>e.date<=end)){if(!byDay.has(e.date))byDay.set(e.date,[]);byDay.get(e.date).push(convertWeight(e.weight,e.unit,unit));}
 const days=[...byDay].map(([date,v])=>({date,weight:average(v)})).sort((a,b)=>a.date.localeCompare(b.date));
 const averageIn=(a,b)=>{const d=days.filter(x=>inRange(x,a,b));return {days:d.length,average:d.length?round(average(d.map(x=>x.weight))):null};};
 const now=averageIn(start,end),before=averageIn(previousStart,previousEnd);
 const change=now.days>=2&&before.days>=2?round(now.average-before.average):null;
 const rate=change!==null?round(change/before.average*100):null;
 // Four-week trend: a least-squares line through daily averages, which a single heavy morning cannot swing.
 let weightTrend=null;const recent=days.filter(x=>x.date>=monthStart);
 if(recent.length>=4&&daysBetween(recent[0].date,recent.at(-1).date)>=14){
  const xs=recent.map(x=>daysBetween(recent[0].date,x.date)),mx=average(xs),my=average(recent.map(x=>x.weight));
  const slope=xs.reduce((n,x,i)=>n+(x-mx)*(recent[i].weight-my),0)/xs.reduce((n,x)=>n+(x-mx)**2,0);
  weightTrend={perWeek:round(slope*7),pct:round(slope*7/my*100),days:recent.length};
 }
 const startAverage=days.length&&shiftDay(days[0].date,6)<start?averageIn(days[0].date,shiftDay(days[0].date,6)):null;
 const sinceStart=startAverage&&now.average!==null?round(now.average-startAverage.average):null;
 let goal=null;
 if(settings.goal&&days.length){
  const target=round(convertWeight(settings.goal.weight,settings.goal.unit,unit)),latest=now.average??round(days.at(-1).weight);
  const direction=target<(startAverage?.average??days[0].weight)?-1:1,remaining=round(target-latest);
  const reached=direction<0?latest<=target+(unit==='lb'?0.5:0.25):latest>=target-(unit==='lb'?0.5:0.25);
  const toward=weightTrend&&weightTrend.perWeek*direction>0;
  const weeks=!reached&&toward?Math.abs(remaining/weightTrend.perWeek):null;
  goal={target,latest,remaining,reached,status:reached?'reached':!weightTrend?'unknown':toward?'toward':'away',weeks:weeks!==null&&weeks<=104?Math.ceil(weeks):null,eta:weeks!==null&&weeks<=104?shiftDay(end,Math.round(weeks*7)):null};
 }

 // Calories: only days with at least one entry that has calories count towards averages.
 const totals=new Map();
 for(const e of journal.food)if(e.date<=end&&e.date>=monthStart&&e.calories!==''&&e.calories!==null&&e.calories!==undefined)totals.set(e.date,(totals.get(e.date)||0)+Number(e.calories));
 const caloriesIn=(a,b)=>{const d=[...totals].filter(([date])=>date>=a&&date<=b).map(([,v])=>v);return {days:d.length,average:d.length?Math.round(average(d)):null,low:d.filter(v=>v<1000).length};};
 const month=caloriesIn(monthStart,end);
 // Roughly 3,500 kcal per pound of bodyweight change; needs two weeks of logged intake and a weight trend over the same weeks.
 const maintenance=month.days>=14&&weightTrend?Math.round((month.average-convertWeight(weightTrend.perWeek,unit,'lb')*3500/7)/50)*50:null;
 const nutrition={current:caloriesIn(start,end),previous:caloriesIn(previousStart,previousEnd),month,maintenance};

 const sessions=rows=>new Set(rows.map(e=>e.workoutId||`${e.date}:legacy`)).size;
 const trainingDays=new Set(current.map(e=>e.date)).size;
 const facts=[`${plural(sessions(current),'logged workout')} across ${plural(trainingDays,'training day')} in this seven-day window; ${plural(sessions(previous),'workout')} in the previous window.`];
 if(exercises.length){
  const up=exercises.filter(e=>e.signal==='up'),stalled=exercises.filter(e=>e.stall),compared=exercises.filter(e=>!['new','mixed'].includes(e.signal));
  facts.push(compared.length?`${up.length} of ${plural(compared.length,'exercise')} improved on the previous session${up.length?`: ${list(up.map(e=>e.name))}`:''}. Different weights are compared by estimated one-rep max; at the same weight, more reps count as progress.`:'None of this week\'s exercises have an earlier session to compare with yet.');
  if(stalled.length)facts.push(`No new best for 3+ weeks: ${list(stalled.map(e=>`${e.name} (${plural(e.stall.weeks,'week')})`))}. A change of rep range, an extra rep per set, or more recovery can restart progress.`);
 }
 if(change!==null)facts.push(`Average bodyweight ${change<0?'decreased':change>0?'increased':'held steady'}${change!==0?` by ${Math.abs(change)} ${unit} (${signed(rate)}% of bodyweight)`:''}, from ${before.average} to ${now.average} ${unit}. Scale weight is not a measure of fat change.`);
 else facts.push('Log bodyweight on at least two different days in each window to compare weekly averages.');
 if(weightTrend){
  facts.push(`Over the last four weeks your weight trend is ${signed(weightTrend.perWeek)} ${unit} per week (${signed(weightTrend.pct)}% of bodyweight).${weightTrend.pct<-1?' That is faster than the roughly 0.5–1% per week often suggested for keeping muscle while losing weight.':''}`);
 }
 if(goal)facts.push(goal.reached?`You have reached your goal of ${goal.target} ${unit}.`:`${Math.abs(goal.remaining)} ${unit} to your goal of ${goal.target} ${unit}. ${goal.eta?`At the current trend you would reach it around ${pretty(goal.eta)}.`:goal.status==='away'?'Your four-week trend is moving away from it.':'More weigh-ins are needed to estimate when you will reach it.'}`);
 const cal=nutrition.current;
 if(cal.days)facts.push(`You logged calories on ${plural(cal.days,'day')} this week, averaging ${cal.average.toLocaleString('en-US')} kcal.${cal.low?` ${plural(cal.low,'day')} under 1,000 kcal may be incomplete.`:''}${maintenance?` Combining four weeks of intake with your weight trend, your rough maintenance estimate is ${maintenance.toLocaleString('en-US')} kcal per day.`:''}`);
 else facts.push('No calories logged this week. Add them on the food page to see how intake lines up with your weight trend.');
 return {start,end,previousStart,previousEnd,unit,workouts:sessions(current),previousWorkouts:sessions(previous),trainingDays,sets:current.reduce((n,e)=>n+e.sets,0),weight:{current:now,previous:before,change,rate,trend:weightTrend,startAverage,sinceStart,firstDate:days[0]?.date||null,goal},nutrition,exercises,exerciseNames:[...names.values()].sort((a,b)=>a.name.localeCompare(b.name)),aliases,facts};
}
