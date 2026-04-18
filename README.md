# S&P 500

This project is a local git repo for an hourly S&P 500 monitoring app.

The safe local folder slug is `sp-500`. Using `S&P 500` as a Windows folder name breaks `npm` scripts because `&` is treated specially by the shell.

## What it does

- Checks the current S&P 500 membership list.
- Tracks known membership entry and exit dates from the published change log.
- Produces 25 possible fall-out names and 25 possible entrant names using a transparent heuristic.
- Captures dividend status and dividend amount for current S&P 500 members.
- Produces 25 most overvalued and 25 most undervalued names using a sector-relative heuristic inspired by common bank and sell-side screening practices.

## Data sources

- Wikipedia current S&P 500 constituents and change history.
- Wikipedia S&P 400, S&P 600, and Nasdaq-100 constituents as the entrant candidate universe.
- Finviz quote pages for market cap, valuation, profitability, leverage, growth, and dividend fields.

## Important caveats

- This is not an official S&P Dow Jones methodology implementation.
- Entry, removal, and valuation lists are heuristic rankings, not investment advice.
- Wikipedia history is helpful but not a perfect historical record for every older membership period.
- The hourly workflow caches fundamentals for 24 hours in `public/data/fundamentals-cache.json` to reduce unnecessary source traffic.
- GitHub repository slugs do not support spaces or `&`, so if you later publish this to GitHub, use a slug like `sp-500` or `s-and-p-500`.

## Local usage

```bash
npm install
npm run update:data
npm run dev
```

## Hourly refresh

The repo includes `.github/workflows/hourly-refresh.yml`, which runs every hour and commits refreshed data back to the repository.
Visitors do not generate snapshots by loading the page. The snapshot is created only by the scheduled refresh job or by running `npm run update:data` manually.
Only `public/data/latest.json` is kept for the live site so old timestamped snapshots do not bloat deploys or bandwidth.

## Cloudflare Pages deployment

This repo can be deployed on Cloudflare Pages with all content protected behind an email and password.

### What is configured in this repo

- `functions/_middleware.js` blocks every route and asset until the visitor signs in.
- The login gate is enforced server-side on Cloudflare Pages, not in client-side React code.
- Sessions are stored in an HTTP-only cookie signed with `AUTH_SESSION_SECRET`.
- `wrangler.toml` sets the Pages output directory to `dist`.

### Cloudflare Pages build settings

- Framework preset: `Vite`
- Build command: `npm ci && npm run build`
- Build output directory: `dist`
- Production branch: `main`

This repo also includes a GitHub Actions deploy workflow for direct uploads to Cloudflare Pages on every push to `main`.
Use that workflow instead of Git-based Pages builds if you want the hourly snapshot refresh commits to deploy without depending on Cloudflare's own build pipeline.

### Required Cloudflare Pages secrets

Add these as environment variables in the Cloudflare Pages project settings for the Production environment:

- `PROTECTED_EMAIL`: the single allowed login email.
- `PROTECTED_PASSWORD`: the password paired with that email.
- `AUTH_SESSION_SECRET`: a long random secret used to sign the session cookie.
- `AUTH_SESSION_TTL_SECONDS`: optional, defaults to `604800` (7 days).

### Required GitHub Actions secrets

Add these repository secrets in GitHub so `.github/workflows/deploy-cloudflare-pages.yml` can deploy on push to `main`:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_PAGES_PROJECT_NAME`

The token only needs Pages deployment permissions for the target account.

### Recommended deployment mode

Prefer direct upload from GitHub Actions for this repo.
If you also connect the repo directly in Cloudflare Pages, you may end up with duplicate deploys for the same commit.
For this setup, keep `main` as the single live branch, use GitHub Actions as the deploy path, and use Cloudflare Pages mainly as the hosting target plus environment-secret store.

### Local Pages-style testing

For local testing with Cloudflare Pages Functions, create a `.dev.vars` file:

```bash
PROTECTED_EMAIL=you@example.com
PROTECTED_PASSWORD=change-this-password
AUTH_SESSION_SECRET=replace-with-a-long-random-string
```

Then build and run the Pages preview:

```bash
npm run build
npx wrangler pages dev dist
```

### Security note

Do not put the email, password, or session secret in the React app or in committed `.env` files. Keep them only in Cloudflare Pages secrets or your local `.dev.vars` file.
