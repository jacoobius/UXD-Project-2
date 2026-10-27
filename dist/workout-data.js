import { sorted, validateEntry } from './data.js';
export function workoutKey(entry) { return entry.workoutId || entry.id; }
export function groupWorkouts(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const key = workoutKey(entry);
    if (!groups.has(key)) groups.set(key, { id: key, name: entry.workoutName || (entry.workoutId ? 'Workout' : entry.name), notes: entry.workoutNotes || '', date: entry.date, createdAt: entry.createdAt, rows: [], legacy: !entry.workoutId });
    groups.get(key).rows.push(entry);
  }
  return sorted([...groups.values()]);
}
export function blankRow(row) {
  return ['name', 'sets', 'reps', 'weight', 'notes'].every(key => !String(row[key] ?? '').trim());
}
export function validateWorkout(date, name, notes, rows) {
  const errors = [];
  const dateError = validateEntry('lifts', {date, name:'Exercise',sets:1,reps:1,weight:0,unit:'lb'}).date;
  if (dateError) errors.push({field:'workout-date', message:dateError});
  if (name.length > 100) errors.push({field:'workout-name',message:'Use 100 characters or fewer.'});
  if (notes.length > 500) errors.push({field:'workout-notes',message:'Use 500 characters or fewer.'});
  rows.forEach((row,index) => {
    if (blankRow(row)) return;
    for (const [field,message] of Object.entries(validateEntry('lifts', {...row,date}))) {
      if (field !== 'date') errors.push({row:index,field,message});
    }
  });
  if (rows.every(blankRow)) errors.push({row:0,field:'name',message:'Add at least one exercise to save a workout.'});
  return errors;
}
export function replaceWorkout(entries, editingId, newRows) {
  if (editingId && !entries.some(e => workoutKey(e) === editingId)) throw new Error('This workout no longer exists.');
  return [...entries.filter(e => !editingId || workoutKey(e) !== editingId), ...newRows];
}
