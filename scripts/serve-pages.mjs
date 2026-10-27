import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../docs/',import.meta.url));
const port=Number(process.env.PAGES_PORT||4193);
// Deliberately test below a project prefix, as on USER.github.io/REPOSITORY/.
const prefix='/UXD-Project-2/';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml'};
http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');let p;
 try{p=decodeURIComponent(url.pathname);}catch{res.writeHead(400).end();return;}
 if(p==='/'){res.writeHead(302,{Location:prefix});res.end();return;}
 if(!p.startsWith(prefix)){res.writeHead(404).end('Not found');return;}
 const file=path.resolve(root,p.slice(prefix.length)||'index.html'),rel=path.relative(root,file);
 if(rel.startsWith('..')||path.isAbsolute(rel)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end('Not found');return;}
 res.writeHead(200,{'Content-Type':types[path.extname(file)]||'text/plain','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);
}).listen(port,'127.0.0.1',()=>console.log(`Pages preview: http://127.0.0.1:${port}${prefix}`));
