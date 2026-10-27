import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createApp} from '../scripts/auth-server.mjs';
import {emptyJournal,localDate} from '../dist/data.js';

test('accounts enforce authentication, isolation, revision checks, CSRF protection and logout',async()=>{
  const origin='http://127.0.0.1:4187';
  const server=createApp({databasePath:':memory:',root:fileURLToPath(new URL('../dist/',import.meta.url)),origin});
  await new Promise(resolve=>server.listen(4187,'127.0.0.1',resolve));
  async function request(path,method='GET',data,cookie='',source=origin){
    return fetch(origin+path,{method,redirect:'manual',headers:{Origin:source,Cookie:cookie,...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});
  }
  try{
    assert.equal((await request('/api/journal')).status,401);
    assert.equal((await request('/food.html')).status,302);
    assert.equal((await request('/signin.html')).status,200);
    const credentials={email:'alice@example.test',password:'A test passphrase 2026'};
    const a=await request('/api/signup','POST',credentials);assert.equal(a.status,200);
    const ca=a.headers.get('set-cookie').split(';')[0];assert.match(a.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
    const alice=(await a.json()).user;
    assert.equal((await request('/api/signup','POST',credentials)).status,400);
    assert.equal((await request('/api/login','POST',{...credentials,password:'Wrong passphrase 2026'})).status,401);
    const journal=emptyJournal();journal.weight.push({id:'entry-1',date:localDate(),weight:150,unit:'lb',notes:''});
    const payload={journal,revision:0,userId:alice.id};
    assert.equal((await request('/api/journal','PUT',payload,ca,'https://elsewhere.test')).status,403);
    assert.equal((await request('/api/journal','PUT',payload,ca)).status,200);
    assert.equal((await request('/api/journal','PUT',payload,ca)).status,409);
    const b=await request('/api/signup','POST',{email:'bob@example.test',password:'Another test passphrase'});
    const cb=b.headers.get('set-cookie').split(';')[0];const bob=(await b.json()).user;
    assert.equal((await (await request('/api/journal','GET',null,cb)).json()).journal.weight.length,0);
    assert.equal((await request('/api/journal','PUT',payload,cb)).status,409);
    const search=await (await request('/api/foods?q=banana','GET',null,ca)).json();assert.ok(search.foods.length>0);assert.ok(search.foods.every(f=>Number.isFinite(f.kcal)));
    const recipe={name:'Test bowl',servings:2,ingredients:[{name:'Rice',grams:200,kcal:130}],userId:alice.id};
    const created=await request('/api/meals','POST',recipe,ca);assert.equal(created.status,200);const meal=await created.json();
    assert.equal((await (await request('/api/meals','GET',null,ca)).json()).meals.length,1);
    assert.equal((await (await request('/api/meals','GET',null,cb)).json()).meals.length,0);
    assert.equal((await request('/api/meals','DELETE',{id:meal.id,revision:0,userId:bob.id},cb)).status,409);
    assert.equal((await request('/api/meals','PUT',{...recipe,id:meal.id,revision:0,name:'Edited bowl'},ca)).status,200);
    assert.equal((await request('/api/meals','PUT',{...recipe,id:meal.id,revision:0},ca)).status,409);
    assert.equal((await request('/api/review','GET',null,ca)).status,200);
    const goal={goal:{weight:140,unit:'lb'},aliases:{'back squat':'Squat'}};
    assert.equal((await request('/api/settings','PUT',{userId:alice.id,settings:goal},ca)).status,200);
    assert.equal((await request('/api/settings','PUT',{userId:alice.id,settings:goal},cb)).status,409);
    assert.equal((await request('/api/settings','PUT',{userId:alice.id,settings:{goal:{weight:-1,unit:'lb'}}},ca)).status,400);
    assert.deepEqual((await (await request('/api/settings','GET',null,ca)).json()).settings,goal);
    assert.equal((await (await request('/api/settings','GET',null,cb)).json()).settings.goal,null);
    const backup=await (await request('/api/backup','GET',null,ca)).json();
    assert.equal(backup.weight[0].weight,150);assert.equal(backup.meals[0].name,'Edited bowl');assert.equal(backup.settings.goal.weight,140);
    const otherBackup=await (await request('/api/backup','GET',null,cb)).json();assert.equal(otherBackup.meals.length,0);assert.equal(otherBackup.weight.length,0);

    assert.equal((await (await request('/api/review','GET',null,ca)).json()).summary.weight.goal.target,140);
    assert.equal((await request('/api/review/ai','POST',{},ca)).status,503);

    const invalid={...emptyJournal(),weight:[{id:'bad',date:localDate(),weight:-1,unit:'lb'}]};
    assert.equal((await request('/api/journal','PUT',{journal:invalid,revision:0,userId:bob.id},cb)).status,400);
    assert.equal((await request('/api/logout','POST',{},ca)).status,200);
    assert.equal((await request('/api/journal','GET',null,ca)).status,401);
    const login=await request('/api/login','POST',credentials);assert.equal(login.status,200);
    const renewed=login.headers.get('set-cookie').split(';')[0];assert.notEqual(renewed,ca);
    assert.equal((await (await request('/api/journal','GET',null,renewed)).json()).journal.weight[0].weight,150);
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
