import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const source=fileURLToPath(new URL('../',import.meta.url));
const workspace=path.resolve(source,'..');
const target=path.join(workspace,'releases','steadily-github-2026-10-27');
if(!target.startsWith(workspace+path.sep))throw new Error('Package target is outside the workspace.');
if(fs.existsSync(target))throw new Error('Package folder already exists. Use a new folder name instead of overwriting a release.');
fs.mkdirSync(target,{recursive:true});
const items=['dist','scripts','tests','data','.github','.gitignore','.env.example','package.json','render.yaml','README.md','HOSTING.md','REVIEW-REPORT.md','AUTH.md','USABILITY.md'];
for(const item of items){const from=path.join(source,item);if(fs.existsSync(from))fs.cpSync(from,path.join(target,item),{recursive:true,dereference:false});}
const manifest=[];
function visit(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isSymbolicLink())throw new Error('Source package contains a symlink.');if(entry.isDirectory())visit(full);else{const relative=path.relative(target,full).split(path.sep).join('/');if(/(^|\/)(\.local|\.git|\.openai|\.claude|node_modules)(\/|$)|\.(sqlite|gguf|exe|dll|zip)$|(^|\/)\.env$/.test(relative))throw new Error(`Unexpected package content: ${relative}`);const data=fs.readFileSync(full);manifest.push({file:relative,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')});}}}
visit(target);fs.writeFileSync(path.join(target,'PACKAGE-MANIFEST.json'),JSON.stringify({created:'2026-10-27',files:manifest.sort((a,b)=>a.file.localeCompare(b.file))},null,2)+'\n');
console.log(JSON.stringify({folder:target,fileCount:manifest.length+1,totalBytes:manifest.reduce((n,f)=>n+f.bytes,0)},null,2));
