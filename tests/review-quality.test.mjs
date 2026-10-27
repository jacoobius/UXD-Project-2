import test from 'node:test';
import assert from 'node:assert/strict';
import {checkedReflection} from '../scripts/reflection-quality.mjs';
test('AI reflections fall back when numbers are invented or sentences are incomplete',()=>{
 const facts='You logged 3 workouts and averaged 2,200 kcal on recorded days.';
 const fallback='Calculated fallback.';
 assert.equal(checkedReflection('You completed 9 workouts this week, which shows that you have been consistent with your training.',facts,fallback),fallback);
 assert.equal(checkedReflection('You completed 3 workouts this week and you should now aim to reach',facts,fallback),fallback);
 const supported='You logged 3 workouts this week and averaged 2200 kcal on the days you recorded.';
 assert.equal(checkedReflection(supported,facts,fallback),supported);
 assert.equal(checkedReflection('You logged 3 workouts and your recorded calories show a moderate intake that is appropriate for you.',facts,fallback),fallback);
});
