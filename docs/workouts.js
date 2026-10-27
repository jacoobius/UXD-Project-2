import {localDate} from './data.js';
import {groupWorkouts, workoutKey, blankRow, validateWorkout, replaceWorkout} from './workout-data.js';

export function setupWorkouts({getJournal, read, write, renderAll, announce, node, dateText, fmt, empty}) {
  const $ = id => document.getElementById(id);
  const body = $('workout-rows');
  let editing = null, deleted = null, removedRow = null, dirty = false, rowSerial = 0;
  function rowValues(tr) {
    const result = {};
    tr.querySelectorAll('[data-field]').forEach(input => {result[input.dataset.field] = input.value;});
    if (tr.dataset.entryId) result.id = tr.dataset.entryId;
    if (tr.dataset.createdAt) result.createdAt = tr.dataset.createdAt;
    return result;
  }
  const rows = () => [...body.children].map(rowValues);
  function updateRows() {
    [...body.children].forEach((tr,index) => {
      tr.querySelector('th').textContent = String(index+1).padStart(2,'0');
      tr.querySelectorAll('[data-label]').forEach(input => input.setAttribute('aria-label',`${input.dataset.label}, row ${index+1}`));
      tr.querySelector('button').setAttribute('aria-label',`Remove exercise row ${index+1}`);
    });
    const active = rows().filter(row=>!blankRow(row));
    const sets = active.reduce((sum,row)=>sum+(Number.isFinite(Number(row.sets)) ? Number(row.sets) : 0),0);
    $('sheet-summary').textContent = `${active.length} exercise ${active.length===1?'row':'rows'} · ${fmt(sets)} sets`;
  }
  function addRow(value = {}, focus = false) {
    const tr = node('tr');
    if(value.id) tr.dataset.entryId=value.id;
    if(value.createdAt) tr.dataset.createdAt=value.createdAt;
    const count=node('th');count.scope='row';tr.append(count);
    const serial=++rowSerial;
    for(const [field,label,type,placeholder] of [['name','Exercise','text','Squat'],['sets','Sets','number','3'],['reps','Reps per set','number','10'],['weight','Load','number','0'],['unit','Unit','select','']]) {
      const cell=node('td');
      const input=node(type==='select'?'select':'input');
      input.dataset.field=field;input.dataset.label=label;input.id=`exercise-${serial}-${field}`;
      if(type==='select') for(const unit of ['lb','kg']){const option=node('option','',unit);option.value=unit;input.append(option);}
      else {input.type=type;input.placeholder=placeholder;if(type==='number'){input.min=field==='weight'?'0':'1';input.step=field==='weight'?'any':'1';input.inputMode=field==='weight'?'decimal':'numeric';}else{input.maxLength=100;input.setAttribute('list','exercise-names');}}
      input.value=value[field]??(field==='unit'?'lb':'');
      input.setAttribute('aria-describedby',`${input.id}-error`);
      const error=node('span','field-error');error.id=`${input.id}-error`;error.hidden=true;
      cell.append(input,error);
      if(field==='name') {
        const note=node('input','exercise-note');note.type='text';note.maxLength=500;note.placeholder='Note (optional)';note.dataset.field='notes';note.dataset.label='Exercise note (optional)';note.value=value.notes||'';note.id=`exercise-${serial}-notes`;note.setAttribute('aria-describedby',`${note.id}-error`);
        const noteError=node('span','field-error');noteError.id=`${note.id}-error`;noteError.hidden=true;cell.append(note,noteError);
      }
      tr.append(cell);
    }
    const action=node('td');const remove=node('button','remove-exercise','×');remove.type='button';
    remove.addEventListener('click',async()=>{
      removedRow={value:rowValues(tr),index:[...body.children].indexOf(tr)};
      const next=tr.nextElementSibling||tr.previousElementSibling;
      tr.remove();if(!body.children.length)addRow();updateRows();dirty=true;
      $('undo-row').hidden=false;
      (next?.querySelector('input')||body.querySelector('input')).focus();announce('Exercise row removed. Use Undo removed row to restore it.');
    });
    action.append(remove);tr.append(action);body.append(tr);updateRows();if(focus)tr.querySelector('input').focus();return tr;
  }
  function clearErrors() {
    $('workout-form').querySelectorAll('[aria-invalid]').forEach(e=>e.removeAttribute('aria-invalid'));
    $('workout-form').querySelectorAll('.field-error').forEach(e=>{e.hidden=true;e.textContent='';});
    $('workout-error').hidden=true;
  }
  function reset() {
    editing=null;dirty=false;removedRow=null;
    $('workout-form').reset();body.replaceChildren();
    for(let i=0;i<4;i++)addRow();
    $('workout-date').value=localDate();$('workout-date').max=localDate();
    $('workout-form-title').textContent='Log a workout';$('save-workout').textContent='Save workout →';
    $('cancel-workout').hidden=true;$('undo-row').hidden=true;clearErrors();
    if(new URLSearchParams(location.search).has('edit'))history.replaceState(null,'',location.pathname);
  }
  async function open(id,repeat=false) {
    if(!await read())return;
    const group=groupWorkouts(getJournal().lifts).find(g=>g.id===id||g.rows.some(r=>r.id===id));
    if(!group){announce('This workout is no longer available.');return;}
    // Opening another workout must not silently discard a filled sheet.
    if(dirty && !window.confirm('Replace the unsaved workout sheet with this workout?'))return;
    reset();editing=repeat?null:group.id;
    $('workout-name').value=group.name;$('workout-date').value=repeat?localDate():group.date;$('workout-notes').value=group.notes;
    body.replaceChildren();group.rows.forEach(row=>addRow(repeat?{...row,id:undefined,createdAt:undefined}:row));
    $('workout-form-title').textContent=repeat?'Repeat workout':'Edit workout';$('save-workout').textContent=repeat?'Save workout →':'Save workout changes →';
    $('cancel-workout').textContent=repeat?'Cancel repeat':'Cancel edit';$('cancel-workout').hidden=false;dirty=repeat;
    body.querySelector('input').focus();announce(repeat?'Workout copied to today. Review each row and save when ready.':'Workout opened for editing.');
  }
  function render() {
    const groups=groupWorkouts(getJournal().lifts);
    const filter=$('history-date').value;
    const selected=groups.filter(g=>!filter||g.date===filter);
    $('workout-count').textContent=`${selected.length} ${selected.length===1?'workout':'workouts'}`;
    const list=$('workout-list');list.replaceChildren();
    if(!selected.length)empty(list,filter?'No workouts on this date.':'Your next session starts here.',filter?'Choose another date or select Show all.':'Fill in your exercises above and save the whole workout together.');
    selected.forEach(group=>{
      const article=node('article','saved-workout');
      const header=node('div','saved-workout-heading');const info=node('div');
      info.append(node('h3','',group.name),node('p','entry-meta',`${dateText(group.date)} · ${group.rows.length} exercise ${group.rows.length===1?'row':'rows'} · ${group.rows.reduce((n,r)=>n+Number(r.sets),0)} sets${group.legacy?' · Previous lift entry':''}`));
      const actions=node('div','entry-tools');
      for(const label of ['Edit','Repeat','Delete']){
        const button=node('button','',label);button.type='button';button.dataset.action=label.toLowerCase();button.setAttribute('aria-label',`${label} workout ${group.name} from ${dateText(group.date)}`);
        button.addEventListener('click',async()=>{
          if(label!=='Delete'){open(group.id,label==='Repeat');return;}
          let removed;
          if(!await write(next=>{removed=next.lifts.filter(e=>workoutKey(e)===group.id);next.lifts=next.lifts.filter(e=>workoutKey(e)!==group.id);} ))return;
          if(!removed.length){renderAll();announce('This workout was already removed.');return;}
          deleted=removed;$('undo-delete').hidden=false;
          // Keep any unsaved edit available as a new workout after deletion.
          if(editing===group.id){editing=null;$('workout-form-title').textContent='Log a workout';$('save-workout').textContent='Save workout →';dirty=true;}
          renderAll();$('history-title').focus();announce(`${group.name} deleted. Undo delete restores every exercise in the workout.`);
        });actions.append(button);
      }
      header.append(info,actions);article.append(header);
      const exerciseList=node('ul','workout-exercise-list');
      group.rows.forEach(row=>{const li=node('li');const name=node('span','saved-exercise-name',row.name);if(row.notes)name.append(node('small','',row.notes));li.append(name,node('span','',`${fmt(row.sets)} × ${fmt(row.reps)} reps`),node('span','',`${fmt(row.weight)} ${row.unit}`));exerciseList.append(li);});
      article.append(exerciseList);if(group.notes)article.append(node('p','entry-notes',group.notes));list.append(article);
    });
    const suggestions=$('exercise-names');suggestions.replaceChildren();
    [...new Set(['Squat','Romanian deadlift (RDL)','Leg extension','Leg curl',...getJournal().lifts.map(e=>e.name)])].forEach(name=>{const option=node('option');option.value=name;suggestions.append(option);});
  }
  $('workout-form').addEventListener('input',()=>{dirty=true;updateRows();});
  $('workout-form').addEventListener('change',()=>{dirty=true;});
  $('add-exercise').addEventListener('click',async()=>{addRow({},true);announce('Exercise row added.');});
  $('leg-day').addEventListener('click',async()=>{
    [...body.children].filter(tr=>blankRow(rowValues(tr))).forEach(tr=>tr.remove());
    let first;
    ['Squat','Romanian deadlift (RDL)','Leg extension','Leg curl'].forEach(name=>{const tr=addRow({name});first??=tr;});
    dirty=true;first.querySelector('input').focus();announce('Four leg-day exercises added. Enter your sets, reps, and load.');
  });
  $('undo-row').addEventListener('click',async()=>{
    if(!removedRow)return;
    const tr=addRow(removedRow.value);body.insertBefore(tr,body.children[removedRow.index]||null);updateRows();removedRow=null;$('undo-row').hidden=true;dirty=true;tr.querySelector('input').focus();announce('Exercise row restored.');
  });
  $('cancel-workout').addEventListener('click',async()=>{reset();$('workout-name').focus();announce('Workout editing cancelled. Saved workouts are unchanged.');});
  $('history-date').addEventListener('change',render);
  $('show-all').addEventListener('click',async()=>{$('history-date').value='';render();});
  $('undo-delete').addEventListener('click',async()=>{
    if(!deleted)return;
    if(!await write(next=>{for(const entry of deleted)if(!next.lifts.some(e=>e.id===entry.id))next.lifts.push(entry);} ))return;
    deleted=null;$('undo-delete').hidden=true;renderAll();$('history-title').focus();announce('Workout restored with all its exercises.');
  });
  $('workout-form').addEventListener('submit',async event=>{
    event.preventDefault();clearErrors();const values=rows();const date=$('workout-date').value;const name=$('workout-name').value.trim();const notes=$('workout-notes').value.trim();
    const errors=validateWorkout(date,name,notes,values);
    if(errors.length){
      let first;
      for(const error of errors){
        const input=error.row===undefined?$(error.field):body.children[error.row].querySelector(`[data-field="${error.field}"]`);
        input.setAttribute('aria-invalid','true');const message=$(`${input.id}-error`);message.textContent=error.message;message.hidden=false;first??=input;
      }
      $('workout-error').textContent='Check the highlighted cells. Nothing has been saved yet.';$('workout-error').hidden=false;first.focus();return;
    }
    const id=editing||crypto.randomUUID();const createdAt=new Date().toISOString();
    const entries=values.filter(row=>!blankRow(row)).map(row=>({...row,id:row.id||crypto.randomUUID(),createdAt:row.createdAt||createdAt,date,name:row.name.trim(),notes:row.notes.trim(),sets:Number(row.sets),reps:Number(row.reps),weight:Number(row.weight),workoutId:id,workoutName:name||'Workout',workoutNotes:notes}));
    const isEdit=Boolean(editing);$('save-workout').disabled=true;
    const ok=await write(next=>{next.lifts=replaceWorkout(next.lifts,editing,entries);});$('save-workout').disabled=false;
    if(!ok)return;
    reset();$('history-date').value='';renderAll();announce(`Workout ${isEdit?'updated':'saved'} with ${entries.length} exercise ${entries.length===1?'row':'rows'}.`);
  });
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
  reset();return {render,open};
}
