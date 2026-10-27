import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, createHash, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { emptyJournal, loadJournal } from '../dist/data.js';
import {featureRoutes} from './features.mjs';
const derive = promisify(scrypt);
const hash = token => createHash('sha256').update(token).digest('hex');
const key = (password,salt) => derive(password,salt,64,{N:131072,r:8,p:1,maxmem:256*1024*1024});
const ttl = 7*24*60*60;
const fail = (status,message) => Object.assign(new Error(message),{status});

export function createApp({databasePath,root,origin,ai=null,trustProxy=false}) {
  const publicURL=new URL(origin);
  const loopback=publicURL.protocol==='http:'&&['127.0.0.1','localhost'].includes(publicURL.hostname);
  if(publicURL.origin!==origin||(!loopback&&publicURL.protocol!=='https:'))throw new Error('PUBLIC_ORIGIN must be an HTTPS origin, or HTTP loopback for development.');
  const secure=publicURL.protocol==='https:';
  if(databasePath!==':memory:') fs.mkdirSync(path.dirname(databasePath),{recursive:true});
  const db = new DatabaseSync(databasePath);
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,salt TEXT NOT NULL,password_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS journals(user_id TEXT PRIMARY KEY REFERENCES users(id),data TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0);`);
  const features=featureRoutes(db,ai);
  const attempts = new Map(); let hashing = 0;
  function limited(bucket) {
    const now=Date.now();
    for(const [k,v] of attempts) if(v.until<now) attempts.delete(k);
    const item=attempts.get(bucket)||{count:0,until:now+15*60*1000};
    if(++item.count>15) throw fail(429,'Too many attempts. Please try again in 15 minutes.');
    attempts.set(bucket,item);
  }
  const tokenFrom = req => /(?:^|;\s*)steadily_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie||'')?.[1];
  function session(req) {
    const token=tokenFrom(req);
    return token ? db.prepare('SELECT users.id,users.email FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires>?').get(hash(token),Date.now()) : null;
  }
  function cookie(res,token,maxAge=ttl) {res.setHeader('Set-Cookie',`steadily_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure?'; Secure':''}`);}
  function invalidate(req) {const token=tokenFrom(req);if(token)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token));}
  async function body(req) {
    if(req.headers['content-type']?.split(';')[0]!=='application/json')throw fail(415,'Send JSON data.');
    let size=0;const chunks=[];
    for await(const chunk of req){size+=chunk.length;if(size>2*1024*1024)throw fail(413,'This journal is too large to save.');chunks.push(chunk);}
    try{return JSON.parse(Buffer.concat(chunks).toString());}catch{throw fail(400,'Invalid request.');}
  }
  const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
  const server=http.createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    try{
      if(req.headers.host!==new URL(origin).host)throw fail(403,'Unrecognized host.');
      const p=new URL(req.url,origin).pathname;
      if(p==='/health'&&req.method==='GET')return send(res,200,{status:'ok'});
      if(p.startsWith('/api/')){
        if(!['GET','POST','PUT','DELETE'].includes(req.method))throw fail(405,'Method not supported.');
        if(req.method!=='GET'&&req.headers.origin!==origin)throw fail(403,'Please submit from the steadily website.');
        if(p==='/api/session'&&req.method==='GET')return send(res,200,{user:session(req)||null});
        if(p==='/api/logout'&&req.method==='POST'){invalidate(req);cookie(res,'',0);return send(res,200,{ok:true});}
        if(['/api/signup','/api/login'].includes(p)&&req.method==='POST'){
          const clientIP=trustProxy?String(req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',').at(-1).trim():req.socket.remoteAddress;
          limited(`ip:${clientIP}`);
          const input=await body(req);
          const email=typeof input.email==='string'?input.email.trim().toLowerCase():'';
          const password=input.password;
          if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw fail(400,'Enter a valid email address.');
          if(typeof password!=='string'||password.length<12||password.length>128)throw fail(400,'Use a password with 12–128 characters.');
          limited(`email:${email}`);
          if(hashing>=2)throw fail(503,'Please try again in a moment.');
          hashing++;let user;
          try{
            user=db.prepare('SELECT * FROM users WHERE email=?').get(email);
            const salt=user?.salt||randomBytes(16).toString('hex');const derived=await key(password,salt);
            if(p==='/api/signup'){
              if(user)throw fail(400,'Unable to create this account. Try signing in instead.');
              user={id:randomUUID(),email};db.exec('BEGIN');
              try{
                db.prepare('INSERT INTO users VALUES(?,?,?,?)').run(user.id,email,salt,derived.toString('hex'));
                db.prepare('INSERT INTO journals(user_id,data) VALUES(?,?)').run(user.id,JSON.stringify(emptyJournal()));db.exec('COMMIT');
              }catch{db.exec('ROLLBACK');throw fail(400,'Unable to create this account. Try signing in instead.');}
            }else if(!user||!timingSafeEqual(derived,Buffer.from(user.password_hash,'hex')))throw fail(401,'Email or password is incorrect.');
          }finally{hashing--;}
          invalidate(req);db.prepare('DELETE FROM sessions WHERE expires<=?').run(Date.now());
          const token=randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(token),user.id,Date.now()+ttl*1000);cookie(res,token);
          return send(res,200,{user:{id:user.id,email:user.email}});
        }
        const user=session(req);if(!user)throw fail(401,'Please sign in to continue. Your unsaved form is still here.');
        if(await features(req,res,user,new URL(req.url,origin),body,send))return;
        if(p==='/api/journal'&&req.method==='GET'){
          const row=db.prepare('SELECT data,revision FROM journals WHERE user_id=?').get(user.id);return send(res,200,{journal:JSON.parse(row.data),revision:row.revision,userId:user.id});
        }
        if(p==='/api/journal'&&req.method==='PUT'){
          const input=await body(req);
          if(input.userId!==user.id)throw fail(409,'Account changed in another tab. Reload before continuing.');
          try{loadJournal({getItem:()=>JSON.stringify(input.journal)});}catch{throw fail(400,'The journal contains an invalid entry. Nothing was saved.');}
          if(!Number.isSafeInteger(input.revision))throw fail(400,'Invalid journal revision.');
          const result=db.prepare('UPDATE journals SET data=?,revision=revision+1 WHERE user_id=? AND revision=?').run(JSON.stringify(input.journal),user.id,input.revision);
          if(!result.changes)throw fail(409,'Your journal changed in another tab. Please try saving again.');
          return send(res,200,{revision:input.revision+1});
        }
        throw fail(404,'Not found.');
      }
      if(!['GET','HEAD'].includes(req.method))throw fail(405,'Method not supported.');
      let name=decodeURIComponent(p);if(name.endsWith('/'))name+='index.html';
      const file=path.resolve(root,'.'+name),relative=path.relative(root,file);
      if(relative.startsWith('..')||path.isAbsolute(relative)||!fs.existsSync(file)||!fs.statSync(file).isFile())throw fail(404,'Page not found.');
      if(path.extname(file)==='.html'&&name!=='/signin.html'&&!session(req)){res.writeHead(302,{Location:`/signin.html?next=${encodeURIComponent(name)}`});return res.end();}
      const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};
      res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});
      if(req.method==='HEAD')return res.end();fs.createReadStream(file).pipe(res);
    }catch(error){if(!res.headersSent)send(res,error.status||500,{error:error.status?error.message:'Something went wrong. Please try again.'});else res.end();}
  });
  server.on('close',()=>db.close());return server;
}
