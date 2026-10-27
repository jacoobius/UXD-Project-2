# Steadily

A small, responsive wellness journal with five real pages:

- `index.html`: overview and recent activity
- `weight.html`: bodyweight, trend, and entry history
- `food.html`: meals, quantities, and optional calories
- `lifts.html`: whole-workout spreadsheet with exercise rows, load, units, sets, reps, and notes
- `review.html`: weekly review of training and bodyweight, with an optional local AI coach

## Food library and custom meals

The food page searches 7,793 generic foods from the USDA FoodData Central SR Legacy dataset (public domain, nutrients per 100 g). The catalog is compiled into `data/foods.json` and served by `/api/foods`, so search works offline. To rebuild it, extract the SR Legacy CSV download and run `node scripts/build-food-catalog.mjs <csv-folder>`.

"Use in log" fills the log form with 100 g of a food; changing grams or ounces recalculates calories. "Add to recipe" starts a custom meal. Custom meals hold 1–50 ingredients (USDA or typed from a label), the total grams of each, and how many servings the recipe makes. Calories and protein are calculated per serving. Meals are saved per account in the `meals` table and can be used in the log by the serving, edited, or deleted (with undo).

## Weekly review and local AI coach

The review (`dist/insights.js`) looks at the seven days ending on the chosen date, against up to eight weeks of history:

- **Exercises** compare this week's best set with the last session of that exercise, even if it was weeks ago. Different weights are compared by estimated one-rep max (Epley, `load × (1 + reps / 30)`); comparisons above 15 reps at different weights are skipped as unreliable. At the same weight, more reps count as progress, and bodyweight exercises compare by reps.
- **Four-week trend** compares this week's best with the first session in the last 28 days, if it is at least two weeks old.
- **Stalls** are flagged when an exercise's best is three or more weeks old and at least two later sessions have not beaten it.
- **Volume** is sets × reps × weight (total reps for bodyweight exercises), this week against last week.
- **Exercise names** ignore case, punctuation and plurals ("Squats" = "squat"). Different names for one lift can be combined on the review page; logged entries are not changed, and combinations can be undone.
- **Bodyweight** uses daily averages: weekly change and % of bodyweight, a four-week least-squares trend, the first week's average against this week, and an optional goal weight with an estimated date at the current trend.
- **Calories** average only days with calories logged, flag days under 1,000 kcal as possibly incomplete, and give a rough maintenance estimate (about 3,500 kcal per lb) once 14 of the last 28 days have calories and there is a weight trend.

Every figure has a minimum-data rule and shows "—" or a prompt instead of guessing. The goal weight and combined names are stored per account in the `settings` table, not in the journal.

"Write my weekly reflection" asks a Qwen 2.5 Instruct model (Apache 2.0) running through llama.cpp's `llama-server` on this computer. It uses no API, account, or credits, and nothing leaves the machine. The server starts it automatically on 127.0.0.1:4174; if no model is installed, the calculated review still works. The model writes three short paragraphs (training, bodyweight, next steps) from calculated facts only. Malformed or truncated output and unsupported numeric claims fall back to calculated wording. Incomplete low-calorie logs use calculated wording for the bodyweight paragraph; this does not guarantee that every AI sentence is correct.

The server picks the best setup the computer can handle (`scripts/local-ai.mjs`):

| Files in `.local/ai/` | Used when |
| --- | --- |
| `qwen2.5-7b-instruct-q4_k_m-0000{1,2}-of-00002.gguf` (4.4 GB) | 16 GB+ RAM and 8+ CPU threads |
| `qwen2.5-1.5b-instruct-q4_k_m.gguf` (1.1 GB) | Any other computer, or if the 7B files are missing |
| `runtime-gpu/` ([llama.cpp Vulkan build](https://github.com/ggml-org/llama.cpp/releases)) | Any NVIDIA, AMD or Intel GPU, integrated included. Only the first GPU is used, which is the dedicated one on laptops with two |
| `runtime/` (llama.cpp CPU build) | Fallback when the GPU runtime is missing or fails to start |

Set `STEADILY_AI_MODEL=small` or `STEADILY_AI_MODEL=large` before starting the server to override the model choice. A reflection takes a few seconds on a dedicated GPU, about 10–30 seconds with the 1.5B model on a CPU or integrated GPU, and up to a couple of minutes with the 7B model on a CPU only.

## GitHub and hosting

Read [HOSTING.md](HOSTING.md) before uploading. GitHub Pages cannot run the Node server or SQLite/AI features. The included Render configuration preserves the backend on a server host. Model downloads and personal data are excluded from the source package.

## Run locally

With Node installed, run `node scripts/serve.mjs` in this folder, then visit http://127.0.0.1:4173. Requires Node.js 24 or later (built-in SQLite). There are no dependencies to install. Run `node --test tests/data.test.mjs` for data validation tests. The equivalent `npm run dev` and `npm run check` commands are also provided when npm is installed.

The `dist` folder contains frontend assets; the Node server is now required for authentication and journal storage. Static hosting alone cannot run this version. Shared code lives in `dist/app.js`, `dist/data.js`, and `dist/styles.css`. The five HTML pages are generated by `node scripts/create-pages.mjs` when their shared template needs updating. No compilation is needed to serve the website.

## Data and behavior

Accounts and journals are stored in `.local/steadily.sqlite` on the local Node server. This directory is excluded from Git and must be backed up separately. Each authenticated account has its own journal, and every journal request is authorized on the server. Passwords use salted scrypt hashes; sessions use random, expiring HttpOnly SameSite cookies. Development listens on loopback. Production supports a configured HTTPS origin, Secure cookies, and a persistent database path. See HOSTING.md for GitHub upload and server hosting.

Old browser-only entries remain untouched. After signing in, use Import my previous entries if those entries belong to you. Export journal downloads your account journal as JSON. Units remain stored on each entry, and calories are optional.

Editing and deletion operate on unique IDs. Undo restores the most recent deletion while the current page remains open. Repeat pre-fills today's form for review and explicit saving. Multiple entries on the same date are supported. Dates use the local calendar day.

## Accessibility

## Workout sheet

The lifts page saves all exercise rows in one storage operation. Add/remove rows, undo a removed row, and use the leg-day shortcut to add Squat, RDL, Leg extension, and Leg curl. Blank rows are skipped; partially completed rows receive validation errors. Use another row for the same exercise if load or reps change. Save, edit, repeat, delete, and undo operate on an entire workout. Existing single-lift entries remain available individually. Workouts use the original journal format with additive workout IDs and names, so existing bodyweight, food, and lift data remains readable. The sheet supports Tab navigation and horizontal scrolling within the table on narrow screens. Unsaved changes trigger the browser's leave-page warning.

## Accessibility checks

The site uses native form controls, persistent labels, associated validation messages, real navigation links, a skip link, visible keyboard focus, live save feedback, and reduced-motion support. Charts have equivalent text and entry history. Decorative illustrations are hidden from assistive technology. Google Fonts are optional; local system fonts are used if unavailable.

Run WAVE against each page and its edit/error states, then manually check keyboard navigation, screen-reader announcements, and zoom before making a WCAG conformance claim. Automated checks alone do not establish accessibility.
