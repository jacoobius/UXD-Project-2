import fs from 'node:fs';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {checkedReflection} from './reflection-quality.mjs';
const local=file=>fileURLToPath(new URL(`../.local/ai/${file}`,import.meta.url));
// Largest first. The 7B model needs ~6 GB of free memory and a reasonably quick machine; slower computers keep the 1.5B model.
const models=[
 {size:'large',label:'Qwen 2.5 · 7B',files:{'qwen2.5-7b-instruct-q4_k_m-00001-of-00002.gguf':3993201344,'qwen2.5-7b-instruct-q4_k_m-00002-of-00002.gguf':689872288},fits:()=>os.totalmem()>=15*2**30&&os.availableParallelism()>=8},
 {size:'small',label:'Qwen 2.5 · 1.5B',files:{'qwen2.5-1.5b-instruct-q4_k_m.gguf':1117320736},fits:()=>true}
];
// The Vulkan build uses any NVIDIA, AMD or Intel GPU (integrated included) and falls back to the CPU; the CPU build is the last resort.
// Vulkan lists dedicated GPUs first; using only Vulkan0 stops a laptop splitting the model onto its slower integrated GPU.
const binary=process.platform==='win32'?'llama-server.exe':'llama-server';
const runtimeDirs=process.platform==='win32'?[{name:'GPU',dir:'runtime-gpu',args:['--device','Vulkan0']},{name:'CPU',dir:'runtime',args:[]}]:[{name:'CPU',dir:'runtime',args:[]}];
const runtimes=runtimeDirs.map(r=>({...r,executable:local(`${r.dir}/${binary}`)})).filter(r=>fs.existsSync(r.executable));
export function chooseModel(preference=process.env.STEADILY_AI_MODEL){
 // A model counts as installed only when every part is present at full size, so a download in progress is skipped.
 const installed=models.filter(m=>Object.entries(m.files).every(([f,bytes])=>fs.statSync(local(f),{throwIfNoEntry:false})?.size===bytes));
 return installed.find(m=>m.size===preference)||installed.find(m=>m.fits())||null;
}
export function startLocalAI({port=4174}={}){
 const model=chooseModel();
 if(!runtimes.length||!model)return {label:null,ready:async()=>false,stop(){},generate:async()=>{throw new Error('Local AI model is not installed.');}};
 const token=randomBytes(32).toString('hex');
 let child,runtime,stopped=false;
 function launch(index){
  runtime=runtimes[index];const started=Date.now();
  // llama.cpp loads the remaining parts of a split model from the first file.
  child=spawn(runtime.executable,['-m',local(Object.keys(model.files)[0]),'--host','127.0.0.1','--port',String(port),'-c','4096','--parallel','1','--no-webui',...runtime.args],{windowsHide:true,stdio:'ignore',env:{...process.env,LLAMA_API_KEY:token,...(process.platform==='linux'?{LD_LIBRARY_PATH:local(runtime.dir)+(process.env.LD_LIBRARY_PATH?':'+process.env.LD_LIBRARY_PATH:'')}:{})}});
  let retried=false;
  const retry=()=>{if(!retried&&!stopped&&Date.now()-started<60000&&runtimes[index+1]){retried=true;launch(index+1);}};
  child.on('error',retry);
  // A GPU runtime that dies during startup (missing or broken drivers) is retried on the CPU build.
  child.on('exit',retry);
 }
 launch(0);
 const endpoint=`http://127.0.0.1:${port}`;let busy=false;
 const headers={'Content-Type':'application/json',Authorization:`Bearer ${token}`};
 return {
  get label(){return `${model.label} · runs locally${runtime.name==='GPU'?'':' (CPU)'}`;},
  async ready(){try{return (await fetch(endpoint+'/v1/models',{headers,signal:AbortSignal.timeout(2000)})).ok;}catch{return false;}},
  async generate(summary){
   if(busy)throw new Error('The local model is already writing a review. Please try again shortly.');busy=true;
   try{
    // Only calculated facts are provided: no emails, notes or raw journal text. The model runs on this machine, so exercise names stay readable.
    // A 1.5B model mixes topics and garbles numbers in one long answer, so each paragraph gets its own narrow prompt.
    const u=summary.unit,w=summary.weight,food=summary.nutrition,signed=n=>`${n>0?'+':''}${n}`;
    const set=s=>`${s.load?`${s.load} ${u}`:'bodyweight'} x ${s.reps} reps`;
    const results={up:'progressed',steady:'held steady',down:'slightly down',new:'first time logged in 8 weeks, nothing to compare yet',mixed:'cannot be compared with last time'};
    // New exercises get one line of their own; listed with the others, the model tends to call them progress.
    const fresh=summary.exercises.filter(e=>e.signal==='new').map(e=>e.name.slice(0,60));
    const exercises=[...summary.exercises.filter(e=>e.signal!=='new').slice(0,12).map(e=>`${e.name.slice(0,60)}: ${results[e.signal]}. Best set this week ${set(e.current)}${e.previous?`, last time ${set(e.previous)} (${e.detail.toLowerCase()})`:''}.${e.trend?.pct!=null?` Estimated max ${signed(e.trend.pct)}% over the last few weeks.`:''}${e.stall?` No new best in ${e.stall.weeks} weeks.`:''}${e.volume.change!==null?` Weekly volume ${signed(e.volume.change)}%.`:''}`),...fresh.length?[`New this week, with no earlier session to compare: ${fresh.join(', ')}.`]:[]].join('\n')||'No exercises were logged this week.';
    const training=`Workouts this week: ${summary.workouts} (last week: ${summary.previousWorkouts}).\n${exercises}`;
    const nextSteps={up:'keep the same approach, adding a rep or the smallest weight increment when the last set feels manageable',steady:'try adding a rep, or the smallest available weight increment, once form feels solid',down:'check sleep and recovery, then rebuild toward the previous result',new:'log it again with a similar rep range so progress can be compared',mixed:'keep a similar rep range next time so it can be compared'};
    const plan=summary.exercises.slice(0,12).map(e=>`${e.name.slice(0,60)}: ${e.stall?`no new best in ${e.stall.weeks} weeks, so change one thing, such as an extra rep per set, a different rep range, or more recovery`:nextSteps[e.signal]}.`).join('\n')||'No exercises were logged this week: log a workout so progress can be compared.';
    const bodyweight=[
     w.change===null?'Not enough weigh-ins to compare this week with last week.':`Average bodyweight changed ${signed(w.change)} ${u} this week (${signed(w.rate)}% of bodyweight), from ${w.previous.average} to ${w.current.average} ${u}.`,
     w.trend&&`Four-week trend: ${signed(w.trend.perWeek)} ${u} per week (${signed(w.trend.pct)}% of bodyweight per week).${w.trend.pct<-1?' That is faster than the roughly 0.5–1% per week often suggested for keeping muscle.':''}`,
     w.goal&&(w.goal.reached?`Goal of ${w.goal.target} ${u} reached.`:`${Math.abs(w.goal.remaining)} ${u} left to the goal of ${w.goal.target} ${u}${w.goal.eta?`, on pace for ${new Date(`${w.goal.eta}T12:00:00`).toLocaleDateString('en-US',{month:'long',day:'numeric'})}`:w.goal.status==='away'?', but the trend is moving away from it':''}.`),
     food.current.days?`Calories were logged on ${food.current.days} of 7 days, averaging ${food.current.average} kcal per logged day${food.current.low?`; ${food.current.low} of those days were under 1,000 kcal and may be incomplete`:''}.`:'No calories were logged this week.',
     food.maintenance&&`Rough maintenance estimate from four weeks of intake and weight trend: ${food.maintenance} kcal per day.`
    ].filter(Boolean).join(' ');
    const rules=' Address the user as "you"; never write as "I". Use only the facts given and copy numbers exactly. Logged calories may be incomplete; never describe intake as appropriate, adequate, healthy, safe, sufficient, or moderate. Do not judge whether the user eats enough or prescribe food restriction. Write complete sentences as one short paragraph: no headings, lists, numbering, or markdown.';
    const ask=async(task,facts,maxTokens,fallback)=>{
     const response=await fetch(endpoint+'/v1/chat/completions',{method:'POST',headers,signal:AbortSignal.timeout(90000),body:JSON.stringify({model:'local',temperature:0.2,max_tokens:maxTokens,messages:[{role:'system',content:task+rules},{role:'user',content:facts}]})});
     if(!response.ok)throw new Error('Local AI is still loading or unavailable. Try again in a moment.');
     const raw=(await response.json()).choices?.[0]?.message?.content||'';
     return checkedReflection(raw,facts,fallback);
    };
    // Small models still emit markdown occasionally; the page renders plain text.
    const paragraphs=[
     summary.exercises.length?await ask('You are a supportive strength coach. In two to four sentences, summarise this week\'s training for progressive overload: name the exercises that progressed, held steady, slipped, or have stalled, and mention multi-week trends where given. Do not mention bodyweight.',training,200,summary.facts.filter(f=>/improved|No new best|earlier session/.test(f)).join(' ')||exercises.replace(/\n/g,' ')):'No exercises were logged in this window, so training progress cannot be assessed yet.',
     food.current.low?`${bodyweight} Recorded food may be incomplete; these entries do not establish your full intake.`:await ask('You are a supportive coach. In two or three sentences, describe the bodyweight trend and recorded calorie figures in neutral terms, using the numbers given. Mention the goal only if one is given. Scale weight is not the same as fat loss. Do not mention training, and never suggest a calorie target or a new goal.',bodyweight,170,bodyweight),
     await ask('You are a supportive strength coach. Turn this plan for next week into two or three friendly sentences, keeping each exercise paired with its own step. Never add exact weights or calorie targets.',plan,130,`Next week: ${plan.replace(/\n/g,' ')}`)
    ].filter(Boolean);
    if(!paragraphs.length)throw new Error('The local model returned no feedback. Please try again.');return paragraphs.join('\n\n').slice(0,5000);
   }catch(error){throw new Error(error.name==='TimeoutError'?'The local model took too long. Your calculated review is still available.':error.message);}
   finally{busy=false;}
  },stop(){stopped=true;child.kill();}
 };
}
