# Steadily feature review — October 27, 2026

## Result

The app works as a local Node application in the tested scenarios. The original 23 tests passed. After review fixes, all 25 tests pass, and syntax checks cover every JavaScript module in `dist/` and `scripts/`. It is not a GitHub Pages application: sign-in, account data, recipes, settings, food search, and AI requests depend on its server.

## Features checked

| Feature | Evidence |
| --- | --- |
| Email/password accounts | Automated signup, duplicate signup, wrong-password, session, authorization, account isolation, and logout checks; browser signup succeeded. |
| Food database | Browser search found banana results from the bundled USDA catalog; API tests check valid nutrition data. |
| Custom meals | Browser created a 200 g banana recipe making two servings, then logged two servings for 178 kcal. API checks cover ownership, editing, and stale revisions. |
| Whole-workout logging | Browser saved a two-exercise workout; tests cover validation, groups, selective edits, legacy entries, and metadata. |
| Exercise-name grouping | Browser combined Back squat with Squat, then separated them; tests cover aliases and rejected chains. |
| Goal weight | Browser saved a goal; API checks cover account privacy and invalid goals. Calculation tests cover trends and estimates. |
| Training review | Tests cover changes in reps/load, bodyweight exercises, skipped weeks, volume, multi-week trends, and stall detection. |
| Bodyweight/calorie review | Tests cover daily averages, mixed units, minimum-data rules, goal estimates, and recorded calorie averages. |
| Local AI | A real installed Qwen 2.5 1.5B model generated feedback in an isolated test. A second smoke check confirmed the corrected incomplete-intake fallback. |
| Hosted configuration | Tests check refusal of public HTTP, the health endpoint, and Secure session cookies with a configured HTTPS origin. Actual Render/Linux deployment has not been performed. |
| Complete export | API tests now check that the backup contains logs, custom meals, and goal/name settings without exposing another account. |

All test accounts and browser-created records used an in-memory database. The user's persistent account database was not used for test entries.

## Problems fixed

1. **AI interpretation of incomplete food logs.** During browser testing, the model called a recorded 178 kcal day “moderate” and potentially appropriate. The bodyweight paragraph now uses calculated wording when days may be incomplete. An additional guard rejects intake-adequacy judgments and unsupported numeric values. No-data training now uses an explicit insufficient-data message. These guards reduce known errors; they do not prove every AI sentence is factually correct.
2. **Incomplete export.** Journal export previously left out custom meals and settings. A server-authorized backup endpoint now exports all three together.
3. **Local-only hosting assumptions.** The original server rejected hosted origins and listened only on loopback. Production can now bind to the host's port, use a configured HTTPS origin, set Secure cookies, and store SQLite on a persistent disk. A Render blueprint and health endpoint are included.
4. **Runtime recovery and portability.** A failed GPU executable spawn now attempts the CPU fallback. Linux uses its native executable name. The setup script installs the official small model/runtime separately with checksum checks, keeping large files out of GitHub.

## Limits to understand

- Estimated one-rep max and stall detection are heuristics, not a direct strength measurement. Changes in technique, effort, equipment, or range of motion are not measured.
- The calorie-based maintenance estimate assumes logged intake reflects actual intake and uses a rough weight-change conversion. Incomplete logs or short-term water shifts can distort it. Treat it as descriptive, not a calorie prescription.
- Goal dates extrapolate a short trend; future progress can differ.
- Windows small-model generation was tested. The 7B model, all GPU combinations, Linux setup, and a real production deployment were not exhaustively tested.
- Email verification, password recovery, automatic backup restoration, and operational production backups remain unfinished. Use as a controlled prototype before a broad public launch.
- WAVE, screen-reader behavior, and every mobile/zoom state have not been exhaustively evaluated in this review; there is no WCAG-conformance claim.

## Source-package contents

The downloadable GitHub folder includes source, the public food catalog, tests, hosting configuration, and instructions. It excludes `.local`, personal databases, model binaries, runtime downloads, Git history, and local agent configuration. Model installation remains a separate server step. No repository or paid service was created.
