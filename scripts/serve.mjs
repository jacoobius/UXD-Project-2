import { fileURLToPath } from 'node:url';
import { createApp } from './auth-server.mjs';
import {startLocalAI} from './local-ai.mjs';
import path from 'node:path';
const port = Number(process.env.PORT || 4173);
const origin = process.env.PUBLIC_ORIGIN||process.env.RENDER_EXTERNAL_URL||`http://127.0.0.1:${port}`;
const hosted=process.env.NODE_ENV==='production';
if(hosted&&!origin.startsWith('https://'))throw new Error('Set PUBLIC_ORIGIN to your HTTPS website URL.');
const ai=process.env.STEADILY_AI_ENABLED==='0'?null:startLocalAI({port:Number(process.env.AI_PORT||4174)});
const server = createApp({
  root:fileURLToPath(new URL('../dist/',import.meta.url)),
  databasePath:process.env.DATABASE_PATH?path.resolve(process.env.DATABASE_PATH):fileURLToPath(new URL('../.local/steadily.sqlite',import.meta.url)),
  origin,ai,trustProxy:process.env.TRUST_PROXY==='1'
});
server.listen(port,hosted?'0.0.0.0':'127.0.0.1',()=>console.log(`Steadily: ${origin}`));
process.on('exit',()=>ai?.stop());
process.on('SIGINT',()=>{ai?.stop();process.exit(0);});
process.on('SIGTERM',()=>{ai?.stop();server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),10000).unref();});
