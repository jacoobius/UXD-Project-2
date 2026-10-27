import {writeReflection} from './coach.js';
// WebLLM runs the model on this device's GPU through WebGPU. The library loads only when a reflection is requested,
// and the model files (~1 GB) are cached by the browser after the first download. Journal data never leaves the page.
const library='https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.85/+esm';
const label='Qwen 2.5 · 1.5B · runs in your browser';
let enginePromise,busy=false;
async function adapter(){try{return await globalThis.navigator?.gpu?.requestAdapter()||null;}catch{return null;}}
export async function webAIAvailable(){return Boolean(await adapter());}
function engine(progress){
 if(!enginePromise)enginePromise=(async()=>{
  const gpu=await adapter();
  if(!gpu)throw new Error('This browser has no WebGPU support, so the AI coach is unavailable here.');
  // GPUs without 16-bit shader support need the slightly larger 32-bit build of the same model.
  const model=gpu.features.has('shader-f16')?'Qwen2.5-1.5B-Instruct-q4f16_1-MLC':'Qwen2.5-1.5B-Instruct-q4f32_1-MLC';
  const {CreateMLCEngine}=await import(library);
  return CreateMLCEngine(model,{initProgressCallback:report=>progress(report.text)});
 })().catch(error=>{enginePromise=null;throw error;});
 return enginePromise;
}
export const browserAI={
 label,
 available:webAIAvailable,
 async reflect(summary,progress=()=>{}){
  if(busy)throw new Error('The AI coach is already writing a reflection. Please wait a moment.');
  busy=true;
  try{
   const llm=await engine(progress);progress('Writing your reflection…');
   return await writeReflection(summary,async({system,user,maxTokens})=>(await llm.chat.completions.create({messages:[{role:'system',content:system},{role:'user',content:user}],temperature:0.2,max_tokens:maxTokens})).choices?.[0]?.message?.content);
  }finally{busy=false;}
 }
};
