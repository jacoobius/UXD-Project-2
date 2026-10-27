import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createApp} from '../scripts/auth-server.mjs';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
test('hosting config rejects public HTTP and uses Secure cookies behind HTTPS hosting',async()=>{
 assert.throws(()=>createApp({root,databasePath:':memory:',origin:'http://example.com'}));
 assert.throws(()=>createApp({root,databasePath:':memory:',origin:'https://example.com/subdirectory'}));
 const origin='https://127.0.0.1:4186';
 const server=createApp({root,databasePath:':memory:',origin});
 await new Promise(resolve=>server.listen(4186,'127.0.0.1',resolve));
 try{
  // HTTP represents the internal hop from a TLS-terminating hosting proxy.
  const url='http://127.0.0.1:4186';
  assert.equal((await fetch(url+'/health')).status,200);
  const response=await fetch(url+'/api/signup',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:'hosting@example.test',password:'Temporary hosting test passphrase'})});
  assert.equal(response.status,200);assert.match(response.headers.get('set-cookie'),/; Secure/);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
