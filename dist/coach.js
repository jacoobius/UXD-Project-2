// The weekly reflection, shared by the local server (llama.cpp) and the GitHub Pages edition (WebLLM in the browser).
// `chat({system,user,maxTokens})` sends one request to whichever model is available and resolves to its reply text.
export function cleanReflection(raw){
 return raw.replace(/^\s*#+\s*/gm,'').replace(/^\s*\d+[.)]\s*[^.\n]{0,40}:[ \t]*/gm,'').replace(/^\s*\d+[.)]\s+/gm,'').replace(/^\s*\*\*[^*\n]+\*\*:?[ \t]*$/gm,'').replace(/\*\*([^*\n]+)\*\*/g,'$1').replace(/^\s*[-*]\s+/gm,'').replace(/\s*\n\s*/g,' ').trim();
}
export function checkedReflection(raw,facts,fallback){
 const text=cleanReflection(raw);
 const numbers=s=>[...s.matchAll(/[+-]?\d[\d,]*(?:\.\d+)?/g)].map(m=>Math.abs(Number(m[0].replaceAll(',',''))));
 const allowed=new Set(numbers(facts));
 const supported=numbers(text).every(n=>allowed.has(n));
 const complete=text.split(/\s+/).length>=12&&/[.!]$/.test(text)&&(text.match(/:/g)||[]).length<3;
 const intakeJudgment=/\b(appropriate|adequate|healthy|safe|sufficient|moderate)\b/i.test(text);
 return complete&&supported&&!intakeJudgment&&!/\b(NaN|Infinity)\b/.test(text)?text:fallback;
}
export async function writeReflection(summary,chat){
 // Only calculated facts are provided: no emails, notes or raw journal text.
 // A small model mixes topics and garbles numbers in one long answer, so each paragraph gets its own narrow prompt.
 const u=summary.unit,w=summary.weight,food=summary.nutrition,signed=n=>`${n>0?'+':''}${n}`;
 const set=s=>`${s.load?`${s.load} ${u}`:'bodyweight'} x ${s.reps} reps`;
 const results={up:'progressed',steady:'held steady',down:'slightly down',new:'first time logged in 8 weeks, nothing to compare yet',mixed:'cannot be compared with last time'};
 // New exercises get one line of their own; listed with the others, the model tends to call them progress.
 const fresh=summary.exercises.filter(e=>e.signal==='new').map(e=>e.name.slice(0,60));
 const exercises=[...summary.exercises.filter(e=>e.signal!=='new').slice(0,12).map(e=>`${e.name.slice(0,60)}: ${results[e.signal]}. Best set this week ${set(e.current)}${e.previous?`, last time ${set(e.previous)} (${e.detail.toLowerCase()})`:''}.${e.trend?.pct!=null?` Estimated max ${signed(e.trend.pct)}% over the last few weeks.`:''}${e.stall?` No new best in ${e.stall.weeks} weeks.`:''}${e.volume.change!==null?` Weekly volume ${signed(e.volume.change)}%.`:''}`),...fresh.length?[`New this week, with no earlier session to compare: ${fresh.join(', ')}.`]:[]].join('\n')||'No exercises were logged this week.';
 const training=`Workouts this week: ${summary.workouts} (last week: ${summary.previousWorkouts}).\n${exercises}`;
 const nextSteps={up:'keep the same approach, adding a rep or the smallest weight increment when the last set feels manageable',steady:'try adding a rep, or the smallest available weight increment, once form feels solid',down:'check sleep and recovery, then rebuild toward the previous result',new:'log it again with a similar rep range so progress can be compared',mixed:'keep a similar rep range next time so it can be compared'};
 const plan=summary.exercises.slice(0,12).map(e=>`${e.name.slice(0,60)}: ${e.stall?`no new best in ${e.stall.weeks} weeks, so change one thing, such as an extra rep per set, a different rep range, or more recovery`:nextSteps[e.signal]}.`).join('\n')||'No exercises were logged this week: log a workout so progress can be compared.';
 // Bodyweight and calories are written from the numbers, not by the model: 1.5B and 3B models both confused average intake
 // with the maintenance estimate and invented goal advice, while adding nothing a template cannot say.
 const bodyweight=[
  w.change===null?'There are not enough weigh-ins yet to compare this week with last week.':w.change===0?`Your average bodyweight held steady at ${w.current.average} ${u} this week.`:`Your average bodyweight went ${w.change<0?'down':'up'} ${Math.abs(w.change)} ${u} this week (${signed(w.rate)}% of bodyweight), from ${w.previous.average} to ${w.current.average} ${u}.`,
  w.trend&&`Over four weeks you are trending ${signed(w.trend.perWeek)} ${u} per week (${signed(w.trend.pct)}% of bodyweight).${w.trend.pct<-1?' That is faster than the roughly 0.5–1% per week often suggested for keeping muscle.':''}`,
  w.goal&&(w.goal.reached?`You have reached your goal of ${w.goal.target} ${u}.`:`You are ${Math.abs(w.goal.remaining)} ${u} from your goal of ${w.goal.target} ${u}${w.goal.eta?`, on pace for around ${new Date(`${w.goal.eta}T12:00:00`).toLocaleDateString('en-US',{month:'long',day:'numeric'})}`:w.goal.status==='away'?', and the recent trend is moving away from it':''}.`),
  w.change!==null&&'Scale weight shifts with water and food, so the weekly average is the trend to watch.'
 ].filter(Boolean).join(' ');
 const kcal=n=>n.toLocaleString('en-US');
 const gap=food.maintenance&&food.current.average!==null?food.current.average-food.maintenance:null;
 const calories=food.current.days?`You logged calories on ${food.current.days} of 7 days, averaging ${kcal(food.current.average)} kcal${gap!==null?`, about ${kcal(Math.abs(Math.round(gap/10)*10))} kcal ${gap<0?'below':'above'} your rough maintenance estimate of ${kcal(food.maintenance)}`:''}.${food.current.low?' Some of those days may be incomplete, so they do not establish your full intake.':''}`:'No calories were logged this week.';
 const rules=' Address the user as "you"; never write as "I". Use only the facts given and copy numbers exactly. Logged calories may be incomplete; never describe intake as appropriate, adequate, healthy, safe, sufficient, or moderate. Do not judge whether the user eats enough or prescribe food restriction. Write complete sentences as one short paragraph: no headings, lists, numbering, or markdown.';
 const ask=async(task,facts,maxTokens,fallback)=>checkedReflection(await chat({system:task+rules,user:facts,maxTokens})||'',facts,fallback);
 const paragraphs=[
  summary.exercises.length?await ask('You are a supportive strength coach. In two to four sentences, summarise this week\'s training for progressive overload: name the exercises that progressed, held steady, slipped, or have stalled, and mention multi-week trends where given. Do not mention bodyweight.',training,200,summary.facts.filter(f=>/improved|No new best|earlier session/.test(f)).join(' ')||exercises.replace(/\n/g,' ')):'No exercises were logged in this window, so training progress cannot be assessed yet.',
  `${bodyweight} ${calories}`,
  await ask('You are a supportive strength coach. Turn this plan for next week into two or three friendly sentences, keeping each exercise paired with its own step. Never add exact weights or calorie targets.',plan,130,`Next week: ${plan.replace(/\n/g,' ')}`)
 ].filter(Boolean);
 if(!paragraphs.length)throw new Error('The model returned no feedback. Please try again.');
 return paragraphs.join('\n\n').slice(0,5000);
}
