import fs from 'node:fs';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {writeReflection} from '../dist/coach.js';
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
    return await writeReflection(summary,async({system,user,maxTokens})=>{
     const response=await fetch(endpoint+'/v1/chat/completions',{method:'POST',headers,signal:AbortSignal.timeout(90000),body:JSON.stringify({model:'local',temperature:0.2,max_tokens:maxTokens,messages:[{role:'system',content:system},{role:'user',content:user}]})});
     if(!response.ok)throw new Error('Local AI is still loading or unavailable. Try again in a moment.');
     return (await response.json()).choices?.[0]?.message?.content;
    });
   }catch(error){throw new Error(error.name==='TimeoutError'?'The local model took too long. Your calculated review is still available.':error.message);}
   finally{busy=false;}
  },stop(){stopped=true;child.kill();}
 };
}
