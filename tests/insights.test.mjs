import test from 'node:test';
import assert from 'node:assert/strict';
import {weeklySummary,exerciseKey,validateSettings,shiftDay} from '../dist/insights.js';
import {mealTotals,validateMeal} from '../dist/nutrition.js';
import {emptyJournal} from '../dist/data.js';
const END='2026-10-26',day=n=>shiftDay(END,-n);
const lift=(n,name,weight,reps,id,sets=3,unit='lb')=>({date:day(n),name,weight,unit,reps,sets,workoutId:id});
test('weekly averages give each day equal weight and convert mixed units',()=>{
 const j=emptyJournal();j.weight=[{date:'2026-10-13',weight:100,unit:'kg'},{date:'2026-10-14',weight:100,unit:'kg'},{date:'2026-10-20',weight:198.41603598,unit:'lb'},{date:'2026-10-20',weight:90,unit:'kg'},{date:'2026-10-21',weight:98,unit:'kg'}];
 const s=weeklySummary(j,END,'kg');assert.equal(s.weight.current.average,94);assert.equal(s.weight.previous.average,100);assert.equal(s.weight.change,-6);assert.equal(s.weight.rate,-6);assert.equal(s.weight.current.days,2);
});
test('sparse weeks do not invent weight change, trends, goals or overload',()=>{
 const j=emptyJournal();j.weight=[{date:'2026-10-25',weight:150,unit:'lb'}];const s=weeklySummary(j,END,'lb',{goal:{weight:140,unit:'lb'},aliases:{}});
 assert.equal(s.weight.change,null);assert.equal(s.weight.trend,null);assert.equal(s.weight.sinceStart,null);assert.equal(s.weight.goal.eta,null);assert.equal(s.weight.goal.status,'unknown');
 assert.equal(s.workouts,0);assert.equal(s.exercises.length,0);assert.equal(s.nutrition.current.average,null);
});
test('different weights compare by estimated max; more reps at the same weight is progress',()=>{
 const j=emptyJournal();
 j.lifts=[lift(9,'RDL',50,12,'a',3,'kg'),lift(2,'RDL',60,8,'b',3,'kg'),lift(9,'Bench',135,8,'a'),lift(2,'Bench',135,10,'b'),lift(9,'Squat',225,5,'a'),lift(2,'Squat',185,20,'b'),lift(9,'Dips',0,10,'a'),lift(2,'Dips',0,8,'b')];
 const s=weeklySummary(j,END,'kg'),by=Object.fromEntries(s.exercises.map(e=>[e.name,e]));
 assert.equal(by.RDL.signal,'up');assert.equal(by.RDL.pct,8.6);
 assert.equal(by.Bench.signal,'up');assert.equal(by.Bench.detail,'2 more reps at the same weight');
 assert.equal(by.Squat.signal,'mixed');assert.equal(by.Dips.signal,'down');
});
test('the last session counts even when the previous week was skipped, and volume is compared week to week',()=>{
 const j=emptyJournal();j.lifts=[lift(20,'Squat',185,8,'a'),lift(1,'Squat',195,8,'b',4)];
 const e=weeklySummary(j,END).exercises[0];assert.equal(e.previous.date,day(20));assert.equal(e.signal,'up');
 assert.equal(e.volume.current,6240);assert.equal(e.volume.previous,null);assert.equal(e.volume.change,null);
 assert.equal(e.trend.since,day(20));assert.ok(e.trend.pct>0);
 const k=emptyJournal();k.lifts=[lift(8,'Row',100,10,'a'),lift(1,'Row',100,10,'b',4)];assert.equal(weeklySummary(k,END).exercises[0].volume.change,33.3);
});
test('stalls need a best that is three weeks old and two sessions that failed to beat it',()=>{
 const j=emptyJournal();j.lifts=[lift(35,'Bench',185,5,'a'),lift(28,'Bench',200,5,'b'),lift(21,'Bench',195,5,'c'),lift(14,'Bench',200,4,'d'),lift(2,'Bench',195,5,'e')];
 const e=weeklySummary(j,END).exercises[0];assert.deepEqual(e.stall,{weeks:3,since:day(28)});
 j.lifts.push(lift(1,'Bench',205,5,'f'));assert.equal(weeklySummary(j,END).exercises[0].stall,null);
});
test('exercise names ignore case, punctuation and plurals, and saved merges combine history',()=>{
 assert.equal(exerciseKey('  Squats! '),'squat');assert.equal(exerciseKey('Leg curls'),'leg curl');assert.equal(exerciseKey('Press'),'press');assert.equal(exerciseKey('Développé'),'développé');
 const j=emptyJournal();j.lifts=[lift(9,'Back squat',185,8,'a'),lift(2,'Squats',195,8,'b')];
 assert.equal(weeklySummary(j,END).exercises[0].previous,null);
 const merged=weeklySummary(j,END,'lb',{aliases:{'back squat':'Squat'}});
 assert.equal(merged.exercises.length,1);assert.equal(merged.exercises[0].name,'Squat');assert.equal(merged.exercises[0].previous.load,185);
 assert.equal(merged.exerciseNames.find(n=>n.key==='back squat').mergedInto,'Squat');
});
test('settings validation rejects bad goals, self-merges and chains',()=>{
 assert.deepEqual(validateSettings({goal:{weight:180,unit:'lb'},aliases:{'back squat':' Squat '}}),{goal:{weight:180,unit:'lb'},aliases:{'back squat':'Squat'}});
 assert.throws(()=>validateSettings({goal:{weight:5,unit:'lb'}}));
 assert.throws(()=>validateSettings({aliases:{squat:'Squats'}}));
 assert.throws(()=>validateSettings({aliases:{a:'Bench',bench:'Press'}}));
 assert.throws(()=>validateSettings({aliases:{'Back Squat':'Squat'}}));
});
test('bodyweight trend, start comparison, goal pace and calories use averages, not single days',()=>{
 const j=emptyJournal();
 for(let n=27;n>=0;n--)j.weight.push({date:day(n),weight:200-(27-n)*0.2,unit:'lb'});
 for(let n=20;n>=0;n--)j.food.push({date:day(n),calories:n===3?600:2200,name:'Food',meal:'Lunch',quantity:1,unit:'serving'},{date:day(n),calories:'',name:'Tea',meal:'Snack',quantity:1,unit:'serving'});
 const s=weeklySummary(j,END,'lb',{goal:{weight:190,unit:'lb'},aliases:{}});
 assert.equal(s.weight.trend.perWeek,-1.4);assert.equal(s.weight.trend.pct,-0.7);
 assert.equal(s.weight.sinceStart,-4.2);
 assert.equal(s.weight.goal.status,'toward');assert.equal(s.weight.goal.remaining,-5.2);assert.equal(s.weight.goal.weeks,4);
 assert.equal(s.nutrition.current.days,7);assert.equal(s.nutrition.current.low,1);assert.equal(s.nutrition.current.average,1971);
 // (20 × 2,200 + 600) / 21 logged days ≈ 2,124 kcal, plus 1.4 lb/week × 3,500 / 7 = 700 kcal, rounded to 50.
 assert.equal(s.nutrition.maintenance,2800);
 assert.ok(s.facts.some(f=>f.includes('maintenance estimate is 2,800')));
});
test('recipes scale by ingredient grams and servings without inventing missing macros',()=>{
 const meal=validateMeal({name:'Rice bowl',servings:2,ingredients:[{name:'Rice',grams:200,kcal:130,protein:2.7,carbs:28,fat:0.3},{name:'Sauce',grams:50,kcal:100}]});const totals=mealTotals(meal);assert.equal(totals.kcal,155);assert.equal(totals.protein,null);assert.throws(()=>validateMeal({...meal,servings:0}));assert.throws(()=>validateMeal({...meal,ingredients:[{name:'Bad',grams:100,kcal:null}]}));
});
