export function workoutTemplate() {
  return `<section class="stats-grid" id="stats" aria-label="Workout summary"></section>
  <section class="panel workout-panel" aria-labelledby="workout-form-title">
    <div class="section-heading"><div><span class="eyebrow">ONE SESSION. ONE SHEET.</span><h2 id="workout-form-title">Log a workout</h2></div><span class="sheet-badge">WORKOUT SHEET</span></div>
    <form id="workout-form" novalidate>
      <div class="workout-meta"><div class="field"><label for="workout-name">Workout name <span class="optional">optional</span></label><input id="workout-name" maxlength="100" placeholder="Lower body day" aria-describedby="workout-name-error"><p class="field-error" id="workout-name-error" hidden></p></div><div class="field"><label for="workout-date">Date</label><input id="workout-date" type="date" required aria-describedby="workout-date-error"><p class="field-error" id="workout-date-error" hidden></p></div></div>
      <div class="sheet-instructions"><p id="sheet-help">Tab between cells. Use another row when an exercise’s load or reps change. Blank rows are skipped. Use 0 for bodyweight exercises.</p><button type="button" class="text-button" id="leg-day">+ Add leg-day exercises</button></div>
      <div class="sheet-scroll" role="region" aria-label="Workout exercise sheet, scroll horizontally on small screens" tabindex="0">
        <table class="workout-sheet" aria-describedby="sheet-help"><caption class="sr-only">Exercises in this workout</caption><thead><tr><th scope="col">#</th><th scope="col">Exercise</th><th scope="col">Sets</th><th scope="col">Reps / set</th><th scope="col">Load</th><th scope="col">Unit</th><th scope="col"><span class="sr-only">Remove row</span></th></tr></thead><tbody id="workout-rows"></tbody></table>
      </div><datalist id="exercise-names"></datalist>
      <div class="sheet-toolbar"><button type="button" class="button secondary" id="add-exercise">+ Add exercise</button><span id="sheet-summary">0 exercises · 0 sets</span><button type="button" class="text-button" id="undo-row" hidden>Undo removed row</button></div>
      <div class="field"><label for="workout-notes">Workout notes <span class="optional">optional</span></label><textarea id="workout-notes" maxlength="500" rows="2" placeholder="How did the session feel?" aria-describedby="workout-notes-error"></textarea><p class="field-error" id="workout-notes-error" hidden></p></div>
      <div id="workout-error" class="error-box" role="alert" hidden></div><div class="workout-save"><span>Save all your exercises together.</span><div class="form-actions"><button class="button secondary" type="button" id="cancel-workout" hidden>Cancel edit</button><button class="button primary" type="submit" id="save-workout">Save workout →</button></div></div>
    </form>
  </section>
  <section class="panel workout-history" aria-labelledby="history-title"><div class="section-heading"><h2 id="history-title" tabindex="-1">Workout history</h2><span id="workout-count"></span></div><div class="history-filter"><div class="field"><label for="history-date">Filter by date</label><input id="history-date" type="date"></div><button type="button" class="text-button" id="show-all">Show all</button></div><div id="workout-list"></div></section>`;
}
