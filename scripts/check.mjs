import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
for(const folder of ['dist','scripts'])for(const file of fs.readdirSync(folder)){
 if(!/\.(m?js)$/.test(file))continue;
 const result=spawnSync(process.execPath,['--check',path.join(folder,file)],{stdio:'inherit'});if(result.status)process.exit(result.status);
}
const files=fs.readdirSync('tests').filter(f=>f.endsWith('.test.mjs')).map(f=>path.join('tests',f));
const result=spawnSync(process.execPath,['--test',...files],{stdio:'inherit'});process.exit(result.status??1);
