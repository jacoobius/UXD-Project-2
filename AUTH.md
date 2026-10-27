# Email and password accounts

Run `node scripts/serve.mjs` with Node.js 24+. Open http://127.0.0.1:4173/signin.html and choose Create an account. After signing in, the original requested logging page opens. Sign out appears in every page header.

Passwords require 12–128 characters and support password managers, paste, spaces, and a Show password checkbox. Email addresses are normalized but are not verified in this local version. There is no password-recovery service yet.

## Storage and security

- Accounts, journals, and sessions persist in `.local/steadily.sqlite`, outside the static directory and excluded from Git.
- Passwords are hashed with Node scrypt, a random 16-byte salt, N=131072, r=8, p=1; plaintext passwords are never stored.
- Sessions contain 32 random bytes, are stored as SHA-256 hashes on the server, expire after seven days, and are revoked on sign-out. Session cookies are HttpOnly and SameSite=Strict.
- Every journal request resolves its owner from the session. Client-supplied user IDs are only consistency checks, never authorization.
- Requests use a strict host check and same-origin checks for writes. Auth attempts are rate-limited; password hashing concurrency is bounded.
- Journal updates use revision checks to reject conflicting saves and validate every log on the server.
- Prior guest entries are imported only after an explicit choice. Original localStorage entries remain untouched; repeated imports skip matching IDs.

## Deployment boundary

This is a functioning local implementation, not a deployed online authentication service. The server intentionally accepts only loopback HTTP origins. The cookie omits Secure for this local HTTP development server; online use requires HTTPS and Secure cookies, production hosting, durable storage/backups, shared rate limiting, and email verification/recovery. Do not publish just `dist/`: it depends on the `/api` routes.

Sites project lookup still returns project_not_found. Sites-hosted identity also has its own platform integration; resolve the target hosting and supported identity approach before migrating this Node server there. The existing hosting manifest has been preserved.

## Verification

`node --test tests/*.test.mjs` runs 14 tests. Authentication tests use a separate in-memory SQLite database and cover protected pages/APIs, signup, duplicate signup, wrong password, cookie flags, cross-origin rejection, user isolation, invalid journals, stale revisions, logout revocation, and persistence through a new login.

References: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html and https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback

Browser QA also verified account creation, a food save followed by reload, a four-exercise workout save, and sign-out using a temporary in-memory server. No test accounts were added to the app database.


## Hosting update (2026-10-27)
The app now supports a configured HTTPS PUBLIC_ORIGIN, Secure cookies, production binding, /health, and a persistent DATABASE_PATH. Earlier local-only deployment notes above describe the initial version. See HOSTING.md for the current setup. No production deployment has been verified.
