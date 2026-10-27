import test from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEY, emptyJournal, loadJournal, saveJournal, localDate, convertWeight, validateEntry, sorted } from '../dist/data.js';
const today = localDate();
const weight = { id: 'one', date: today, weight: 180.5, unit: 'lb', notes: '', createdAt: '2026-01-01T12:00:00Z' };
const memory = () => {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};
test('journal persists decimal values, units, and user text without data loss', () => {
  const storage = memory();
  const journal = emptyJournal();
  journal.weight.push(weight);
  journal.food.push({ id: 'food', date: today, name: "<b>Oats & Jacob's yogurt</b>", quantity: 1.5, unit: 'cup', meal: 'Breakfast', calories: null });
  saveJournal(storage, journal);
  assert.deepEqual(loadJournal(storage), journal);
});
test('broken storage fails safely without overwriting original data', () => {
  const storage = memory();
  storage.setItem(STORAGE_KEY, '{damaged');
  assert.throws(() => loadJournal(storage));
  assert.equal(storage.getItem(STORAGE_KEY), '{damaged');
  storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, weight: [{}], food: [], lifts: [] }));
  assert.throws(() => loadJournal(storage));
});
test('unavailable or full browser storage is surfaced to caller', () => {
  assert.throws(() => loadJournal({ getItem: () => { throw new Error('denied'); } }));
  assert.throws(() => saveJournal({ setItem: () => { throw new Error('full'); } }, emptyJournal()));
});
test('bodyweight rejects blanks, zero, non-finite values, and invalid dates', () => {
  for (const value of ['', 0, -1, Infinity, NaN]) assert.ok(validateEntry('weight', { ...weight, weight: value }).weight);
  assert.ok(validateEntry('weight', { ...weight, date: '2026-02-30' }).date);
  assert.ok(validateEntry('weight', { ...weight, date: '2999-01-01' }).date);
  assert.deepEqual(validateEntry('weight', weight), {});
});
test('bodyweight lifts permit zero load while sets and reps require positive integers', () => {
  const lift = { name: 'Push-up', date: today, weight: 0, unit: 'lb', sets: 3, reps: 10 };
  assert.deepEqual(validateEntry('lifts', lift), {});
  assert.ok(validateEntry('lifts', { ...lift, reps: 1.5 }).reps);
  assert.ok(validateEntry('lifts', { ...lift, sets: 0 }).sets);
});
test('food calories are optional and a recorded zero is preserved', () => {
  const food = { name: 'Tea', date: today, quantity: 1, unit: 'cup', meal: 'Snack', calories: null };
  assert.deepEqual(validateEntry('food', food), {});
  assert.deepEqual(validateEntry('food', { ...food, calories: 0 }), {});
  assert.ok(validateEntry('food', { ...food, quantity: '' }).quantity);
  assert.ok(validateEntry('food', { ...food, name: ' ' }).name);
});
test('mixed weight units convert for comparisons without altering original entries', () => {
  assert.ok(Math.abs(convertWeight(100, 'kg', 'lb') - 220.46226218) < 0.0001);
  assert.ok(Math.abs(convertWeight(220.46226218, 'lb', 'kg') - 100) < 0.0001);
  assert.equal(weight.unit, 'lb');
});
test('sorting retains multiple check-ins per day without mutating source', () => {
  const entries = [{ ...weight, id: 'older' }, { ...weight, id: 'newer', createdAt: '2026-01-01T13:00:00Z' }];
  assert.deepEqual(sorted(entries).map(e => e.id), ['newer', 'older']);
  assert.equal(entries[0].id, 'older');
});
