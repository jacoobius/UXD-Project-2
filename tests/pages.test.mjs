import test from 'node:test';
import assert from 'node:assert/strict';
import {createDeviceService,initialState,validateBackup} from '../docs/device-store.js';
import {emptyJournal,localDate} from '../docs/data.js';
function service(ai=null){let state=initialState(),id=0;const api=createDeviceService({read:async()=>structuredClone(state),transact:async change=>{const next=structuredClone(state),result=change(next);state=next;return result;},loadCatalog:async()=>({source:'Fixture',foods:[{id:'banana',name:'Bananas, raw',kcal:89}]}),uuid:()=>`meal-${++id}`,ai});return api;}
test('Pages uses the in-browser AI when available and falls back to calculated text when it fails',async()=>{
 const working=service({label:'Browser model',available:async()=>true,reflect:async summary=>`AI saw ${summary.workouts} workouts.`});
 assert.equal((await working('review')).aiReady,true);
 assert.deepEqual([(await working('review/ai','POST',{})).text,(await working('review/ai','POST',{})).model],['AI saw 0 workouts.','Browser model']);
 const failing=service({label:'Browser model',available:async()=>true,reflect:async()=>{throw new Error('download interrupted');}});
 const fallback=await failing('review/ai','POST',{});assert.match(fallback.model,/AI coach unavailable: download interrupted/);assert.match(fallback.text,/cannot establish/);
 assert.equal((await service({label:'x',available:async()=>false,reflect:async()=>'unused'})('review')).aiReady,false);
});
test('Pages journal saves without a server and rejects stale revisions',async()=>{
 const api=service(),j=emptyJournal();j.weight.push({id:'w',date:localDate(),weight:150,unit:'lb',notes:''});
 assert.equal((await api('session')).user.id,'device-journal');
 await api('journal','PUT',{journal:j,revision:0,userId:'device-journal'});
 assert.equal((await api('journal')).journal.weight[0].weight,150);
 await assert.rejects(api('journal','PUT',{journal:j,revision:0,userId:'device-journal'}),/another tab/);
});
test('Pages food catalog, custom meals, settings and calculated reflections work locally',async()=>{
 const api=service(),userId='device-journal';assert.equal((await api('foods?q=banana')).foods[0].kcal,89);
 const meal=await api('meals','POST',{userId,name:'Banana bowl',servings:2,ingredients:[{name:'Banana',grams:200,kcal:89}]});
 assert.equal((await api('meals')).meals.length,1);
 await api('meals','PUT',{...meal,userId,name:'Edited bowl'});
 await assert.rejects(api('meals','DELETE',{...meal,userId}),/another tab/);
 await api('settings','PUT',{userId,settings:{goal:{weight:140,unit:'lb'},aliases:{}}});
 assert.equal((await api('settings')).settings.goal.weight,140);
 const review=await api('review');assert.equal(review.summary.workouts,0);
 const feedback=await api('review/ai','POST',{});assert.match(feedback.model,/no AI model/);assert.match(feedback.text,/cannot establish/);
});
test('Pages imports server backups atomically and undo restores the complete prior state',async()=>{
 const api=service();await api('meals','POST',{userId:'device-journal',name:'Original',servings:1,ingredients:[{name:'Oats',grams:100,kcal:380}]});
 const backup={...emptyJournal(),weight:[{id:'old',date:localDate(),weight:70,unit:'kg',notes:''}],meals:[],settings:{goal:{weight:65,unit:'kg'},aliases:{}}};
 await api('backup/import','POST',{backup});assert.equal((await api('journal')).journal.weight[0].weight,70);assert.equal((await api('meals')).meals.length,0);
 const exported=await api('backup');assert.equal(exported.settings.goal.weight,65);
 await assert.rejects(api('backup/import','POST',{backup:{...backup,weight:[{id:'bad',date:'invalid',weight:-1,unit:'lb'}]}}));
 assert.equal((await api('journal')).journal.weight[0].weight,70);
 await api('backup/undo','POST',{});assert.equal((await api('journal')).journal.weight.length,0);assert.equal((await api('meals')).meals[0].name,'Original');
});
test('Pages backup validation rejects duplicate IDs rather than overwriting records',()=>{
 const row={id:'same',date:localDate(),weight:150,unit:'lb',notes:''};assert.throws(()=>validateBackup({...emptyJournal(),weight:[row,row]}),/duplicate/);
});
