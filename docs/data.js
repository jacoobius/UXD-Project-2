export const STORAGE_KEY = 'steadily.journal.v1';
export const emptyJournal = () => ({ version: 1, weight: [], food: [], lifts: [] });
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function dateIsValid(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && localDate(date) === value;
}
export function validateEntry(kind, entry) {
  const errors = {};
  if (!dateIsValid(entry.date)) errors.date = 'Choose a valid date.';
  else if (entry.date > localDate()) errors.date = 'Choose today or an earlier date for your log.';
  const positive = (field, label, zero = false, integer = false) => {
    const value = entry[field];
    const n = Number(value);
    if (value === '' || value === null || value === undefined || !Number.isFinite(n) || (zero ? n < 0 : n <= 0) || (integer && !Number.isInteger(n))) {
      errors[field] = `${label} must be ${integer ? 'a whole number' : 'a number'} ${zero ? 'of 0 or more' : 'greater than 0'}.`;
    }
  };
  if (kind === 'weight') {
    positive('weight', 'Bodyweight');
    if (!['lb', 'kg'].includes(entry.unit)) errors.unit = 'Choose lb or kg.';
  } else if (kind === 'food') {
    if (!String(entry.name || '').trim()) errors.name = 'Enter a food name.';
    positive('quantity', 'Quantity');
    if (!['serving', 'g', 'oz', 'cup', 'ml', 'item'].includes(entry.unit)) errors.unit = 'Choose a quantity unit.';
    if (!['Breakfast', 'Lunch', 'Dinner', 'Snack'].includes(entry.meal)) errors.meal = 'Choose a meal.';
    if (entry.calories !== '' && entry.calories !== null && entry.calories !== undefined) positive('calories', 'Calories', true);
  } else if (kind === 'lifts') {
    if (!String(entry.name || '').trim()) errors.name = 'Enter an exercise name.';
    positive('weight', 'Load', true);
    positive('sets', 'Sets', false, true);
    positive('reps', 'Reps per set', false, true);
    if (!['lb', 'kg'].includes(entry.unit)) errors.unit = 'Choose lb or kg.';
  }
  if (String(entry.name || '').length > 100) errors.name = 'Use 100 characters or fewer.';
  if (String(entry.notes || '').length > 500) errors.notes = 'Use 500 characters or fewer.';
  return errors;
}
export function loadJournal(storage) {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return emptyJournal();
  const parsed = JSON.parse(raw);
  if (parsed?.version !== 1 || !['weight', 'food', 'lifts'].every(key => Array.isArray(parsed[key]) && parsed[key].every(e => e && typeof e.id === 'string' && typeof e.date === 'string' && Object.keys(validateEntry(key, e)).length === 0))) {
    throw new Error('The saved journal could not be read. Your existing data has been left untouched.');
  }
  return parsed;
}
export function saveJournal(storage, journal) {
  storage.setItem(STORAGE_KEY, JSON.stringify(journal));
}
export function sorted(entries) {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt).localeCompare(String(a.createdAt)));
}
export function convertWeight(value, from, to) {
  return from === to ? Number(value) : from === 'kg' ? Number(value) * 2.2046226218 : Number(value) / 2.2046226218;
}
