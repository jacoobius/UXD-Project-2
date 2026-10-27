# Publish steadily on GitHub Pages for free

This edition is ready for static hosting. No Render service, server setup, API key, database account, or payment is needed. On GitHub Free, the repository must be public to use Pages.

## What stays

- Separate overview, bodyweight, food, workout, and weekly-review pages.
- Bodyweight history, chart, and weekly trends.
- The bundled USDA catalog of 7,793 foods, quantities, and calorie calculation.
- Saved custom meals, recipe servings, editing, deletion, and undo.
- Whole-workout spreadsheet logging, edit/repeat, leg-day shortcut, and history.
- Exercise comparisons, longer-term trends, goals, and exercise-name grouping.
- Weekly reflections calculated from your data.
- Full JSON backup export/import, including recipes and settings, with undo of the last import.

## What changes

- There is no email/password sign-in or account synchronization. Each browser/device has its own journal in IndexedDB.
- Reflections use programmed calculations and text, not an AI model. No model usage limits or credits apply.
- Your journal is not uploaded to GitHub. Clearing this site's browser storage removes it. Use Backups to export first, and import the file when moving to another browser or device.
- Journals from the earlier localhost/server edition do not automatically transfer to the GitHub URL. Export from the old app, then import through Backups on the published site.

## 1. Upload the new docs folder

1. Extract `steadily-github-pages-2026-10-27.zip`.
2. Open the extracted folder. It contains a **docs** folder and this guide.
3. Open your existing GitHub repository, for example `UXD-Project-2`.
4. Choose **Add file → Upload files**.
5. Drag the **docs folder itself** into the upload area. This time, keep that folder: GitHub Pages will publish it directly. Do not drag the outer ZIP/extracted folder, and do not flatten the contents of docs into the repository root.
6. Confirm the upload list includes paths such as `/docs/index.html`, `/docs/account.js`, and `/docs/data/foods.json`.
7. Commit the changes. You can leave all the previously uploaded server files in place; Pages will publish only docs.

After the upload, your repository can look like:

```text
UXD-Project-2/
  package.json             # earlier server edition; Pages does not use it
  render.yaml              # earlier hosting config; Pages does not use it
  dist/                    # earlier server frontend
  scripts/
  data/
  tests/
  docs/                    # NEW: this is the Pages website
    index.html
    weight.html
    food.html
    lifts.html
    review.html
    account.js
    device-store.js
    persistence.js
    styles.css
    ...
    data/
      foods.json
```

The `.nojekyll` file is an optional static-hosting hint. If GitHub's uploader rejects it as hidden, you can skip it: this edition has no underscore-prefixed assets or template headers that require it. No `.github` workflow folder is required for this upload.

## 2. Switch on free Pages hosting

1. Make sure the repository is public if your account uses GitHub Free. Do not purchase a plan for this edition.
2. Open the repository's **Settings** tab.
3. Select **Pages** from the left sidebar.
4. Under **Build and deployment → Source**, choose **Deploy from a branch**.
5. Choose branch **main** (or the branch containing your uploaded docs folder).
6. In the folder selector, choose **/docs**. This is the important difference from the earlier root-folder instructions.
7. Click **Save**.
8. Wait for GitHub's Pages deployment. It can take up to 10 minutes. Refresh the Pages settings and click **Visit site** when it appears.

Your address will usually be:

```text
https://YOUR-USERNAME.github.io/UXD-Project-2/
```

The repository name determines the final path. Use the URL GitHub displays. No custom domain is required.

## 3. Check your published site

1. Confirm the homepage says **Free browser edition** and opens without a sign-in form.
2. Log one bodyweight entry and reload: it should remain in the history.
3. Search for banana on Food, save a custom recipe, and log a serving.
4. Save a workout with several exercise rows, then open Weekly review.
5. Open **Backups → Export full backup**. Keep that file outside the repository.

If a password form appears, you are viewing the earlier `dist/signin.html` or localhost version. Open the Pages URL above and verify that the publishing folder is `/docs`.

If a page is missing, check that `docs/index.html` is directly inside docs, not nested inside another `steadily-github-pages...` folder. Use **Actions** to inspect the Pages build if it fails.

## Verification

This build was tested locally below `/UXD-Project-2/`, rather than only at a domain root, to check repository-relative links and catalog loading. Four new automated tests cover local journal changes, stale revisions, recipes/settings, calculated reflections, backup validation, import, and undo. Browser checks covered bodyweight save/reload, food search, recipe save and portion scaling, a four-exercise workout, weekly feedback, goal saving, backup export/import, and undo import.

No real journal records are included in the ZIP. This session has not published the site to your GitHub account, and no WAVE/WCAG conformance claim is made.

Official GitHub instructions: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
