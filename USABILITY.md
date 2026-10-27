# Steadily: design and accessibility

Use plain HTML for semantic page structure, CSS for the shared visual system, and small JavaScript modules for validation and journal behavior. This version has no framework dependencies. Each tracker has a real URL, so browser Back, bookmarks, and navigation links work naturally.

The cream background, forest-green actions, generous spacing, and restrained typography keep the interface calm. Labels remain visible after typing. Color supplements text rather than replacing it. The workout uses a real table with native inputs, column headers, row numbers, and keyboard Tab navigation. Add a second row for an exercise when its load or repetitions vary between sets.

## Nielsen's ten heuristics in this implementation

| Heuristic | Implementation |
| --- | --- |
| Visibility of system status | Save feedback, entry counts, and the active navigation link show the current state. |
| Match with the real world | Familiar exercise names, dates, meals, sets, repetitions, and explicit lb/kg units. |
| User control and freedom | Edit, cancel, delete, and undo; workout row removal is also reversible. |
| Consistency and standards | Shared navigation, buttons, labels, and validation patterns on all pages. |
| Error prevention | Numeric/date validation, optional fields identified, and warnings when leaving unsaved forms. |
| Recognition rather than recall | Visible labels, history, exercise suggestions, and a leg-day shortcut. |
| Flexibility and efficiency | Save a whole workout, Tab through cells, repeat past workouts, and filter history by date. |
| Aesthetic and minimalist design | Three focused trackers, restrained colors, and optional details. |
| Recognize, diagnose, and recover from errors | Specific inline errors, focus on the first invalid field, and retained input after storage failure. |
| Help and documentation | In-page help, spreadsheet instructions, unit guidance, and browser-storage disclosure. |

Source: https://www.nngroup.com/articles/ten-usability-heuristics/

## WAVE review procedure

Run WAVE on all four pages, then repeat with populated history, an edit form, and validation errors visible. For local or private pages, use the WAVE browser extension. Review errors, contrast errors, and alerts individually; alerts require judgment. Automated results do not establish full accessibility or usability.

Manually verify:

- Navigate each page using only Tab, Shift+Tab, Enter, and Space. Verify visible focus and the skip link.
- Check the workout table with a screen reader: each input should identify both its field and row.
- Submit incomplete forms. Verify understandable errors, retained input, and focus on the first problem.
- Save, edit, repeat, delete, and undo a complete four-exercise workout.
- Test at 200% zoom and a narrow viewport. Only the workout sheet should need horizontal scrolling.
- Confirm charts have equivalent text and history; verify interface meaning without color.

WAVE guidance: https://wave.webaim.org/help
Extension: https://wave.webaim.org/extension/

## Verification and limitations

The 13 automated data/workout tests pass. They cover persistence, damaged/unavailable storage, validation, optional calories, mixed units, multi-exercise workouts, and selective workout edits. All four pages returned HTTP 200. The workout page was visually inspected at desktop size, and its accessibility tree exposes field-and-row labels. WAVE, mobile layout, and end-to-end browser interactions remain unverified. Publishing was attempted but the saved Sites project returned project_not_found.

Email/password accounts now use a local Node server with SQLite journal storage scoped to the authenticated user. Old browser entries can be explicitly imported. Export provides a JSON backup. See AUTH.md for current security controls and the remaining online deployment work.

