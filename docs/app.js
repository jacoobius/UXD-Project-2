import {api,setupAccount} from './account.js';
import {setupFoodLibrary} from './food-library.js';
import { STORAGE_KEY, emptyJournal, localDate, loadJournal, saveJournal, sorted, convertWeight, validateEntry } from './data.js';
import { groupWorkouts } from './workout-data.js';
import { setupWorkouts } from './workouts.js';

const $ = id => document.getElementById(id);
const page = document.body.dataset.page;
const initialEditId = new URLSearchParams(location.search).get('edit');
const titles = { weight: 'bodyweight', food: 'food', lifts: 'lift' };
const paths = { weight: 'weight.html', food: 'food.html', lifts: 'lifts.html' };
const dateText = date => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const fmt = value => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
let journal = emptyJournal();
let editingId = null;
let deleted = null;
let storageReady = false;
let workoutUI;
let revision=0;
let saving=false;
const currentUser=await setupAccount();
let formDirty = false;
const today = localDate();
$('today').dateTime = today;
$('today').textContent = new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
function storageError(message) {
  const box = $('storage-error');
  box.hidden = false;
  box.textContent = message;
}
async function read() {
  try {
    if(!currentUser) return false;
    const result=await api('journal');
    if(result.userId!==currentUser.id) throw new Error('Your device journal changed. Reload before continuing.');
    journal=result.journal; revision=result.revision;
    storageReady = true;
    $('storage-error').hidden = true;
    return true;
  } catch {
    storageReady = false;
    storageError('Your device journal is unavailable. Check browser storage permissions and reload. Your form has been kept.');
    return false;
  }
}
async function write(change) {
  if(saving){announce('A save is already in progress. Please wait and try again.');return false;}
  saving=true;
  try {
    if (!await read()) return false;
    const next = structuredClone(journal);
    change(next);
    const result=await api('journal','PUT',{journal:next,revision,userId:currentUser.id});
    revision=result.revision;
    journal = next;
    return true;
  } catch(error) {
    storageError(error.message || 'This change could not be saved. Your form has been kept.');
    return false;
  } finally {saving=false;}
}
function announce(message) {
  $('status-wrap').hidden = false;
  $('status').textContent = '';
  window.setTimeout(() => { $('status').textContent = message; }, 40);
}
function empty(container, heading, description, href, linkLabel) {
  const el = node('div', 'empty-state');
  const symbol = node('span', 'empty-symbol', '↗');
  symbol.setAttribute('aria-hidden', 'true');
  el.append(symbol, node('h3', '', heading), node('p', '', description));
  if (href) {
    const link = node('a', '', linkLabel);
    link.href = href;
    el.append(link);
  }
  container.append(el);
}
function entryTitle(kind, entry) {
  if (kind === 'weight') return `${fmt(entry.weight)} ${entry.unit}`;
  return entry.name;
}
function entryDetail(kind, entry) {
  if (entry.rows) return `${entry.rows.length} exercise rows · ${entry.rows.reduce((sum,row)=>sum+Number(row.sets),0)} sets`;
  if (kind === 'weight') return 'Bodyweight check-in';
  if (kind === 'food') return `${entry.meal} · ${fmt(entry.quantity)} ${entry.unit}${entry.calories !== null && entry.calories !== '' && entry.calories !== undefined ? ` · ${fmt(entry.calories)} kcal` : ''}`;
  return `${fmt(entry.sets)} ${Number(entry.sets) === 1 ? 'set' : 'sets'} × ${fmt(entry.reps)} reps · ${fmt(entry.weight)} ${entry.unit}`;
}
function summary(label, value, detail) {
  const card = node('div', 'stat');
  card.append(node('span', 'stat-label', label), node('strong', 'stat-value', value), node('span', 'stat-detail', detail));
  return card;
}
function renderOverview() {
  const latest = sorted(journal.weight)[0];
  const foods = journal.food.filter(e => e.date === today);
  const lifts = journal.lifts.filter(e => e.date === today);
  $('weight-summary').textContent = latest ? `${fmt(latest.weight)} ${latest.unit} · latest check-in` : 'Log your first check-in';
  $('food-summary').textContent = foods.length ? `${foods.length} ${foods.length === 1 ? 'food' : 'foods'} logged today` : 'Make a little room for today';
  $('lifts-summary').textContent = lifts.length ? `${lifts.reduce((sum, e) => sum + Number(e.sets), 0)} sets logged today` : 'Your next set starts here';
  const bannerLink = document.querySelector('.welcome-banner .button');
  bannerLink.firstChild.textContent = journal.lifts.length ? 'Log a workout ' : 'Log your first workout ';
  const activity = $('activity-list');
  activity.replaceChildren();
  const all = sorted(['weight', 'food', 'lifts'].flatMap(kind => (kind === 'lifts' ? groupWorkouts(journal.lifts) : journal[kind]).map(e => ({ ...e, kind })))).slice(0, 6);
  if (!all.length) {
    empty(activity, 'Your story starts with one entry.', 'Log a meal, a lift, or a bodyweight check-in. Your recent activity will appear here.', 'weight.html', 'Start with a check-in →');
    return;
  }
  for (const e of all) {
    const link = node('a', 'activity-row');
    link.href = `${paths[e.kind]}?edit=${encodeURIComponent(e.id)}`;
    const tile = node('span', `icon-tile ${e.kind}`, e.kind === 'weight' ? '↗' : e.kind === 'food' ? '◒' : '＋');
    tile.setAttribute('aria-hidden', 'true');
    const text = node('span', 'activity-text');
    text.append(node('strong', 'activity-name', entryTitle(e.kind, e)), node('span', 'activity-date', entryDetail(e.kind, e)));
    link.append(tile, text, node('span', '', dateText(e.date)));
    activity.append(link);
  }
}
function renderStats() {
  const entries = sorted(journal[page]);
  const stats = $('stats');
  stats.replaceChildren();
  const recent = entries.filter(e => e.date === today);
  if (page === 'weight') {
    const latest = entries[0];
    let change = '—';
    if (entries.length >= 2) {
      const diff = Number(latest.weight) - convertWeight(entries[1].weight, entries[1].unit, latest.unit);
      change = `${diff > 0 ? '+' : ''}${fmt(diff)} ${latest.unit}`;
    }
    stats.append(summary('Latest check-in', latest ? `${fmt(latest.weight)} ${latest.unit}` : '—', latest ? dateText(latest.date) : 'Your starting point awaits'), summary('Since previous entry', change, entries.length >= 2 ? 'One part of a bigger picture' : 'Add two entries to compare'), summary('Total check-ins', entries.length, entries.length === 1 ? 'One moment recorded' : 'Every check-in counts'));
  } else if (page === 'food') {
    const known = recent.filter(e => e.calories !== null && e.calories !== '' && e.calories !== undefined);
    stats.append(summary('Foods logged today', recent.length, 'One meal at a time'), summary('Recorded calories', known.length ? fmt(known.reduce((sum, e) => sum + Number(e.calories), 0)) : '—', known.length ? `${known.length} of ${recent.length} entries · kcal today` : 'Optional, always'), summary('Total food entries', entries.length, 'Your nourishment journal'));
  } else {
    stats.append(summary('Sets today', recent.reduce((sum, e) => sum + Number(e.sets), 0), 'A little effort adds up'), summary('Reps today', recent.reduce((sum, e) => sum + Number(e.sets) * Number(e.reps), 0), 'Across your logged sets'), summary('Training days', new Set(entries.map(e => e.date)).size, 'Days with a lift logged'));
  }
}
function renderChart() {
  const box = $('weight-chart');
  box.replaceChildren();
  const entries = sorted(journal.weight).slice(0, 14).reverse();
  if (entries.length < 2) {
    empty(box, 'Give your progress a little time.', 'Your trend will appear after two check-ins. Every body has its own rhythm.');
    return;
  }
  const unit = entries.at(-1).unit;
  const values = entries.map(e => convertWeight(e.weight, e.unit, unit));
  const low = Math.min(...values), high = Math.max(...values);
  const padding = Math.max((high - low) * .25, 1);
  const y = value => 115 - (value - low + padding) / (high - low + padding * 2) * 95;
  const x = i => 15 + i / (values.length - 1) * 470;
  box.append(node('p', 'trend-summary', `${fmt(values[0])} → ${fmt(values.at(-1))} ${unit} across ${entries.length} check-ins. Entries are spaced evenly; dates and values are in the history below.`));
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 500 135');
  svg.setAttribute('class', 'chart');
  svg.setAttribute('aria-hidden', 'true');
  for (const level of [25, 65, 105]) {
    const line = document.createElementNS(svg.namespaceURI, 'line');
    for (const [k, v] of Object.entries({ x1: 15, x2: 485, y1: level, y2: level, stroke: '#dce1d7', 'stroke-dasharray': '4 5' })) line.setAttribute(k, v);
    svg.append(line);
  }
  const line = document.createElementNS(svg.namespaceURI, 'polyline');
  line.setAttribute('points', values.map((value, i) => `${x(i)},${y(value)}`).join(' '));
  line.setAttribute('fill', 'none'); line.setAttribute('stroke', '#426b46'); line.setAttribute('stroke-width', '3');
  svg.append(line);
  values.forEach((value, i) => {
    const dot = document.createElementNS(svg.namespaceURI, 'circle');
    dot.setAttribute('cx', x(i)); dot.setAttribute('cy', y(value)); dot.setAttribute('r', '4'); dot.setAttribute('fill', '#426b46'); svg.append(dot);
  });
  const labels = node('div', 'chart-labels');
  labels.append(node('span', '', dateText(entries[0].date)), node('span', '', dateText(entries.at(-1).date)));
  box.append(svg, labels);
}
function renderHistory() {
  const list = $('entry-list');
  list.replaceChildren();
  const filter = $('history-date').value;
  const entries = sorted(journal[page]).filter(e => !filter || e.date === filter);
  $('entry-count').textContent = `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`;
  if (!entries.length) {
    empty(list, filter ? 'No entries on this date.' : 'A fresh page, just for you.', filter ? 'Choose another date or select Show all.' : `Your ${titles[page]} entries will appear here once you save your first log.`);
    return;
  }
  const ul = node('ul', 'entries');
  for (const entry of entries) {
    const li = node('li', 'entry');
    const content = node('div', 'entry-content');
    content.append(node('h3', 'entry-title', entryTitle(page, entry)), node('p', 'entry-meta', `${dateText(entry.date)}${page === 'weight' ? '' : ' · ' + entryDetail(page, entry)}`));
    if (entry.notes) content.append(node('p', 'entry-notes', entry.notes));
    const actions = node('div', 'entry-tools');
    for (const action of ['edit', 'repeat', 'delete']) {
      if (page === 'weight' && action === 'repeat') continue;
      const button = node('button', '', action[0].toUpperCase() + action.slice(1));
      button.type = 'button';
      button.dataset.action = action;
      button.setAttribute('aria-label', `${button.textContent} ${entryTitle(page, entry)} from ${dateText(entry.date)}`);
      button.addEventListener('click', async () => {
        if (action === 'delete') deleteEntry(entry.id);
        else fillForm(entry.id, action === 'repeat');
      });
      actions.append(button);
    }
    li.append(content, actions); ul.append(li);
  }
  list.append(ul);
}
function render() {
  if (page === 'overview') return renderOverview();
  if (page === 'lifts') { renderStats(); workoutUI.render(); return; }
  renderStats(); renderHistory();
  if (page === 'weight') renderChart();
  const suggestions = $('recent-names');
  if (suggestions) {
    suggestions.replaceChildren();
    [...new Set(sorted(journal[page]).map(e => e.name))].slice(0, 30).forEach(name => {
      const option = node('option'); option.value = name; suggestions.append(option);
    });
  }
}
function clearErrors() {
  document.querySelectorAll('.field-error').forEach(el => { el.hidden = true; el.textContent = ''; });
  document.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
  $('form-error').hidden = true;
}
function resetForm(focus = false) {
  formDirty = false;
  editingId = null;
  $('log-form').reset();
  $('date').value = localDate();
  const latest = sorted(journal[page])[0];
  if (latest && page !== 'food') $('unit').value = latest.unit;
  $('form-title').textContent = `Log ${page === 'lifts' ? 'a lift' : titles[page]}`;
  $('save-button').textContent = `Save ${titles[page]} →`;
  $('cancel-edit').hidden = true;
  clearErrors();
  if (new URLSearchParams(location.search).has('edit')) history.replaceState(null, '', location.pathname);
  if (focus) (page === 'weight' ? $('weight') : $('name')).focus();
}
async function fillForm(id, repeat = false) {
  if (!await read()) return;
  const entry = journal[page].find(e => e.id === id);
  if (!entry) { render(); announce('This entry is no longer available.'); return; }
  if (formDirty && !window.confirm('Replace your unsaved entry with this entry?')) return;
  document.dispatchEvent(new Event('clear-food-selection'));
  formDirty = repeat;
  clearErrors();
  editingId = repeat ? null : id;
  for (const input of $('log-form').elements) {
    if (input.name && Object.hasOwn(entry, input.name)) input.value = entry[input.name] ?? '';
  }
  if (repeat) $('date').value = localDate();
  $('form-title').textContent = repeat ? 'Repeat this entry' : `Edit ${titles[page]}`;
  $('save-button').textContent = repeat ? `Save ${titles[page]} →` : 'Save changes →';
  $('cancel-edit').textContent = repeat ? 'Cancel repeat' : 'Cancel edit';
  $('cancel-edit').hidden = false;
  announce(repeat ? 'Entry copied to today. Review the details and save when ready.' : 'Editing entry. Update the details and save your changes.');
  (page === 'weight' ? $('weight') : $('name')).focus();
}
async function deleteEntry(id) {
  let removed;
  if (!await write(next => {
    removed = next[page].find(e => e.id === id);
    next[page] = next[page].filter(e => e.id !== id);
  })) return;
  if (!removed) { render(); announce('This entry was already removed.'); return; }
  deleted = { kind: page, entry: removed };
  if (editingId === id) resetForm();
  $('undo-delete').hidden = false;
  render();
  $('history-title').focus();
  announce(`${entryTitle(page, removed)} deleted. You can undo this deletion.`);
}
$('undo-delete').addEventListener('click', async () => {
  if (!deleted) return;
  if (!await write(next => {
    if (!next[deleted.kind].some(e => e.id === deleted.entry.id)) next[deleted.kind].push(deleted.entry);
  })) return;
  deleted = null;
  $('undo-delete').hidden = true;
  render();
  $('history-title')?.focus();
  announce('Entry restored.');
});
$('export-data').addEventListener('click', async () => {
  try {
    if(!await read())return;
    const raw = JSON.stringify(await api('backup'));
    const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
    const a = node('a'); a.href = url; a.download = `steadily-journal-${localDate()}.json`;
    document.body.append(a); a.click(); a.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce('Your journal export is ready. Keep the downloaded JSON file as a backup.');
  } catch { storageError('The journal could not be exported. Check browser storage and download permissions, then try again.'); }
});
if (page === 'lifts') workoutUI = setupWorkouts({getJournal:()=>journal,read,write,renderAll:render,announce,node,dateText,fmt,empty});
await read();
render();
// Existing guest data stays untouched until its owner chooses to copy it.
try {
  const guest=loadJournal(window.localStorage);
  if(currentUser && ['weight','food','lifts'].some(kind=>guest[kind].length)) {
    const panel=node('div','status-wrap');
    panel.append(node('p','','Have entries from the older browser edition? Copy this browser’s older journal into this edition.'));
    const button=node('button','text-button','Import my previous entries');button.type='button';panel.append(button);
    $('main').insertBefore(panel,$('storage-error'));
    button.addEventListener('click',async()=>{
      if(!confirm(`Copy your older browser entries into this device journal? Only import them if they belong to you.`))return;
      button.disabled=true;
      const ok=await write(next=>{for(const kind of ['weight','food','lifts']){const ids=new Set(next[kind].map(e=>e.id));for(const entry of guest[kind])if(!ids.has(entry.id)){next[kind].push(entry);ids.add(entry.id);}}});
      button.disabled=false;
      if(ok){panel.remove();render();announce('Previous entries copied to this device journal. The original browser copy has been kept.');}
    });
  }
} catch { /* Preserve unreadable legacy data without assigning it to an account. */ }
if (page === 'lifts' && initialEditId) workoutUI.open(initialEditId);
if (page !== 'overview' && page !== 'lifts') {
  $('log-form').addEventListener('input', () => { formDirty = true; });
  window.addEventListener('beforeunload', event => {
    if (formDirty) { event.preventDefault(); event.returnValue = ''; }
  });
  resetForm();
  $('date').max = localDate();
  $('history-date').addEventListener('change', renderHistory);
  $('show-all').addEventListener('click', async () => { $('history-date').value = ''; renderHistory(); });
  $('cancel-edit').addEventListener('click', async () => { resetForm(true); announce('Edit cancelled. Your saved entries are unchanged.'); });
  $('log-form').addEventListener('submit', async event => {
    event.preventDefault(); clearErrors();
    const entry = Object.fromEntries(new FormData(event.currentTarget));
    const errors = validateEntry(page, entry);
    const invalid = Object.keys(errors);
    if (invalid.length) {
      for (const field of invalid) {
        $(field).setAttribute('aria-invalid', 'true');
        $(`${field}-error`).textContent = errors[field];
        $(`${field}-error`).hidden = false;
      }
      $('form-error').hidden = false;
      $('form-error').textContent = `Please check ${invalid.length === 1 ? 'the highlighted field' : 'the highlighted fields'} and try again.`;
      $(invalid[0]).focus(); return;
    }
    if (entry.name) entry.name = entry.name.trim();
    entry.notes = entry.notes.trim();
    for (const key of ['weight', 'sets', 'reps', 'quantity']) if (Object.hasOwn(entry, key)) entry[key] = Number(entry[key]);
    if (Object.hasOwn(entry, 'calories')) entry.calories = entry.calories === '' ? null : Number(entry.calories);
    const isEdit = Boolean(editingId);
    let missing = false;
    $('save-button').disabled = true;
    const saved = await write(next => {
      if (isEdit) {
        const index = next[page].findIndex(e => e.id === editingId);
        if (index === -1) { missing = true; throw new Error('Missing entry'); }
        next[page][index] = { ...next[page][index], ...entry };
      } else {
        next[page].push({ ...entry, id: crypto.randomUUID(), createdAt: new Date().toISOString() });
      }
    });
    $('save-button').disabled = false;
    if (missing) { storageError('This entry was removed in another tab. Cancel editing to create a new entry.'); return; }
    if (!saved) return;
    $('history-date').value = '';
    resetForm(); render();
    announce(`${page === 'weight' ? 'Bodyweight' : page === 'food' ? 'Food' : 'Lift'} ${isEdit ? 'updated' : 'saved'} successfully.`);
  });
  if (initialEditId) fillForm(initialEditId);
}
if(page==='food'&&currentUser)await setupFoodLibrary({user:currentUser,prefill:entry=>{
  if(formDirty&&!confirm('Replace the unsaved food entry?'))return false;
  resetForm();for(const [key,value] of Object.entries(entry))$(key).value=value;
  formDirty=true;$('quantity').focus();return true;
}});

