import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {spawnSync} from 'node:child_process';
if(process.arch!=='x64'||!['win32','linux'].includes(process.platform))throw new Error('This setup helper supports Windows x64 and Linux x64.');
const base=fileURLToPath(new URL('../.local/ai/',import.meta.url));fs.mkdirSync(base,{recursive:true});
const windows=process.platform==='win32';
const asset=windows?'llama-b11912-bin-win-cpu-x64.zip':'llama-b11912-bin-ubuntu-x64.tar.gz';
const runtimeHash=windows?'6563daba5a0680eac0d701292984a729ae62708bda0c65a7d32f7badcd403f4d':'344ea88c09666c1fb3eb5f7a649ada48ff753daaa660c7d7bc0b614cda49a078';
async function sha(file){const hash=createHash('sha256');for await(const chunk of fs.createReadStream(file))hash.update(chunk);return hash.digest('hex');}
async function download(url,destination,expected){
 if(fs.existsSync(destination)&&await sha(destination)===expected){console.log(`Verified ${path.basename(destination)}`);return;}
 console.log(`Downloading ${path.basename(destination)}…`);
 const response=await fetch(url,{signal:AbortSignal.timeout(20*60*1000)});if(!response.ok)throw new Error(`Download failed: ${response.status}`);
 const partial=destination+'.partial',hash=createHash('sha256');
 await pipeline(Readable.fromWeb(response.body),new Transform({transform(chunk,encoding,callback){hash.update(chunk);callback(null,chunk);}}),fs.createWriteStream(partial));
 if(hash.digest('hex')!==expected)throw new Error('Download checksum mismatch; the file was not installed.');
 fs.renameSync(partial,destination);console.log(`Verified ${path.basename(destination)}`);
}
const archive=path.join(base,asset);
await download(`https://github.com/ggml-org/llama.cpp/releases/download/b11912/${asset}`,archive,runtimeHash);
const extracted=path.join(base,'cpu-extracted');fs.mkdirSync(extracted,{recursive:true});
const literal=s=>`'${s.replaceAll("'","''")}'`;
const result=windows?spawnSync('powershell.exe',['-NoProfile','-Command',`Expand-Archive -LiteralPath ${literal(archive)} -DestinationPath ${literal(extracted)} -Force`],{stdio:'inherit',windowsHide:true}):spawnSync('tar',['-xzf',archive,'-C',extracted],{stdio:'inherit'});
if(result.status!==0)throw new Error('Runtime extraction failed.');
function find(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.name===(windows?'llama-server.exe':'llama-server'))return full;if(entry.isDirectory()){const match=find(full);if(match)return match;}}}
const executable=find(extracted);if(!executable)throw new Error('Runtime executable missing.');
fs.cpSync(path.dirname(executable),path.join(base,'runtime'),{recursive:true});
await download('https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf',path.join(base,'qwen2.5-1.5b-instruct-q4_k_m.gguf'),'6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e');
console.log('Local AI installed. Restart steadily to load it. No model API account or credits required.');
