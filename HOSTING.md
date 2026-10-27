# Put steadily on GitHub and online

## What GitHub can host

GitHub stores the full source. GitHub Pages serves static HTML, CSS, and JavaScript; it does not run this app's Node server, SQLite account database, or llama.cpp process. Uploading `dist/` to Pages will display files but sign-in and the `/api` features will fail. This package keeps the actual account-based application intact.

The practical setup is **GitHub for source + a Node web service for the website**. The included `render.yaml` describes one option on Render. No hosting account, repository, subscription, or deployment has been created for you.

## 1. Upload the source to GitHub

1. Extract `steadily-github-2026-10-27.zip`.
2. Sign in at https://github.com and choose **New repository** from the **+** menu. Name it `steadily`. Choose public or private; Render can connect to either with your permission. Create the repository.
3. On its main page, choose **Add file → Upload files** (or the **uploading an existing file** link in an empty repository).
4. Open the extracted `steadily-github-2026-10-27` folder. Drag **its contents**, including the `dist`, `scripts`, `tests`, and `data` folders, into the upload area. Do not upload just the ZIP or the enclosing folder.
5. Commit the files. At the repository root you should see `package.json`, `render.yaml`, `README.md`, and the folders above.
6. If Windows hides dotfiles, enable **View → Show → Hidden items** in File Explorer so you can include `.gitignore`, `.env.example`, and `.github/workflows/check.yml`. The workflow runs tests; it does not deploy the website. If the web uploader refuses workflow files, upload the rest, then use GitHub Desktop to add `.github`, or create `.github/workflows/check.yml` in GitHub's file editor.

All files in this source package are below GitHub's browser upload size limit, and the package contains fewer than 100 files. Your personal `.local` folder, account database, model downloads, Git history, and local tool configuration are excluded. Keep these exclusions when making future commits.

## 2. Host the account-based app on Render

This option has a hosting cost: a persistent disk requires a paid web service. Render's free web service loses SQLite files on restarts/redeploys and must not be used for your real journal.

1. Sign in at https://render.com and connect your GitHub account.
2. Choose **New → Blueprint**, select your `steadily` repository, and let Render read `render.yaml` from its root.
3. Review the proposed **Starter web service and 1 GB persistent disk**, including the displayed charges. Deploy only when you accept the price.
4. The blueprint sets Node 24, runs `node scripts/check.mjs`, starts `npm start`, and mounts the database at `/var/data/steadily.sqlite`. It uses Render's `RENDER_EXTERNAL_URL` to set the trusted HTTPS origin. The app listens on Render's assigned `PORT`.
5. When it reports healthy, open the `https://...onrender.com` address. Create a new account, log a test entry, reload, and confirm that it stays saved. Local accounts are not automatically copied to this separate server.
6. Future GitHub commits can trigger a redeploy. The attached disk preserves accounts and journals. Arrange a regular database backup separately.

If configuring a Web Service manually instead of a Blueprint, use **Node**, Node version **24**, build command `node scripts/check.mjs`, start command `npm start`, health path `/health`, a paid plan, and a disk mounted at `/var/data`. Set:

```text
NODE_ENV=production
DATABASE_PATH=/var/data/steadily.sqlite
TRUST_PROXY=1
STEADILY_AI_ENABLED=0
```

For another host or a custom domain, also set `PUBLIC_ORIGIN` to the exact HTTPS origin, with no trailing slash or path. Do not expose the database or the model's internal port publicly. HTTPS cookies and same-origin write checks are enabled by the public origin.

## 3. Understand the AI on a hosted website

The default hosted configuration disables the model. Food search, meals, accounts, journals, goals, and calculated weekly reviews work; the AI reflection reports unavailable. A model running on your laptop cannot automatically serve visitors to the hosted website.

To run credit-free inference on your own app server:

1. Use Windows x64 or Ubuntu-compatible Linux x64 with sufficient memory. The small model download is approximately 1.1 GB. Allow several GB of memory for the model, runtime, Node, and simultaneous requests; choose the host's compute plan accordingly.
2. Run `node scripts/setup-ai.mjs` on that server, or include it in the build command. It downloads an official CPU runtime and Qwen 2.5 1.5B model and checks their SHA-256 hashes. On Linux, install the shared system libraries required by the official llama.cpp Ubuntu build if the host does not include them.
3. Set `STEADILY_AI_ENABLED=1` and `STEADILY_AI_MODEL=small`, then restart. For a Render build, the build command can be `node scripts/check.mjs && node scripts/setup-ai.mjs` after you have selected a compute plan with enough memory.
4. Test **Weekly review → Write my weekly reflection**. The model runs on that server and uses no paid AI API credits. Hosting, bandwidth, storage, and compute can still cost money.

Linux/Render deployment and performance have not been executed from this workspace. The Windows model was tested locally. Email verification and password recovery are also not implemented; accounts should remain a controlled prototype until those flows and operational backups are added.

## If you specifically need a GitHub Pages URL

For a genuinely static website, GitHub's sequence is **Repository → Settings → Pages → Deploy from a branch → main → /(root) → Save**. Its address is normally `https://YOUR-USERNAME.github.io/steadily/`.

That sequence cannot run this package as a functional account-based app. A Pages-compatible edition would need a browser-storage mode or a separately hosted backend/authentication service. Do not enable Pages for `dist/` and assume it provides accounts, persistence, or AI.

## Official instructions

- GitHub Pages capabilities: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- Uploading files: https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository
- Creating a Pages site: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
- Render web services: https://render.com/docs/web-services
- Render persistent disks: https://render.com/docs/disks
- Render free-tier storage limits: https://render.com/docs/free
