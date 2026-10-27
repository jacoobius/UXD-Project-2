import test from 'node:test';
import assert from 'node:assert/strict';
import {groupWorkouts,validateWorkout,replaceWorkout} from '../dist/workout-data.js';
import {localDate,emptyJournal,saveJournal,loadJournal} from '../dist/data.js';
const date=localDate();
const row={name:'Squat',sets:3,reps:8,weight:100,unit:'lb',notes:'',date};
test('a complete four-exercise workout validates; blank spare rows are ignored',()=>{
  const rows=['Squat','RDL','Leg extension','Leg curl'].map(name=>({...row,name}));
  assert.deepEqual(validateWorkout(date,'Leg day','', [...rows,{name:'',sets:'',reps:'',weight:'',unit:'lb',notes:''}]),[]);
  assert.ok(validateWorkout(date,'Leg day','', [{...row,reps:''}]).some(e=>e.row===0&&e.field==='reps'));
  assert.ok(validateWorkout(date,'','',[{name:'',unit:'lb'}]).length);
});
test('incomplete unnamed rows are errors rather than silently discarded',()=>{
  assert.ok(validateWorkout(date,'','',[{...row,name:''}]).some(e=>e.field==='name'));
  assert.ok(validateWorkout(date,'','',[{...row,sets:1.5}]).some(e=>e.field==='sets'));
  assert.deepEqual(validateWorkout(date,'','',[{...row,weight:0}]),[]);
});
test('old single lifts and separate workouts on the same day remain distinct',()=>{
  const entries=[{...row,id:'old'}, {...row,id:'a',workoutId:'workout-1',workoutName:'Leg day'}, {...row,id:'b',workoutId:'workout-1'}, {...row,id:'c',workoutId:'workout-2'}];
  const groups=groupWorkouts(entries);
  assert.equal(groups.length,3);assert.equal(groups.find(g=>g.id==='workout-1').rows.length,2);
  assert.equal(groups.find(g=>g.id==='old').legacy,true);
});
test('editing replaces every row in just the selected workout',()=>{
  const entries=[{...row,id:'old'}, {...row,id:'a',workoutId:'w'}, {...row,id:'b',workoutId:'w'}];
  const result=replaceWorkout(entries,'w',[{...row,id:'a',workoutId:'w',reps:10}]);
  assert.equal(result.length,2);assert.equal(result.find(e=>e.id==='a').reps,10);assert.equal(entries.length,3);
  assert.throws(()=>replaceWorkout(entries,'missing',[]));
});
test('workout metadata round-trips through the existing journal without migration',()=>{
  let raw=null;const storage={getItem:()=>raw,setItem:(_,v)=>{raw=v;}};
  const journal=emptyJournal();journal.lifts=[{...row,id:'a',workoutId:'w',workoutName:'Leg day',workoutNotes:'Feeling good'}];
  saveJournal(storage,journal);assert.deepEqual(loadJournal(storage),journal);
});
