# S&P 500

This project is a local git repo for an hourly S&P 500 monitoring app.

The safe local folder slug is `sp-500`. Using `S&P 500` as a Windows folder name breaks `npm` scripts because `&` is treated specially by the shell.

## What it does

- Checks the current S&P 500 membership list.
- Tracks known membership entry and exit dates from the published change log.
- Keeps the home dashboard public while protecting prediction screens behind sign-in.
- Serves the current-members table from a separately protected payload so it is not directly downloadable from the public snapshot JSON.
- Supports XLSX download and Google Sheets-ready copy for users who are signed in or who complete the Lemon Squeezy supporter checkout.
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
- The member table now loads from `public/data/current-members.json`, which is served behind a short-lived browser verification gate on Cloudflare Pages.
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
The live site keeps `public/data/latest.json`, `public/data/current-members.json`, and `public/data/predictions.json` instead of timestamped snapshot history, so deploys stay lean.

## Cloudflare Pages deployment

This repo can be deployed on Cloudflare Pages with a public home dashboard, a protected prediction view, and gated access to the raw current-members dataset.

### What is configured in this repo

- `functions/_middleware.js` keeps the home view public, requires login for prediction data, and protects `current-members.json` with a short-lived browser verification cookie.
- Prediction access is enforced server-side on Cloudflare Pages, not just hidden in React.
- Sessions and gated-access cookies are stored as HTTP-only cookies signed with `AUTH_SESSION_SECRET`.
- Supporter export unlock is handled by Lemon Squeezy checkout, a verified webhook, and a paid supporter cookie.
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
- `LEMON_SQUEEZY_API_KEY`: your Lemon Squeezy server-side API key.
- `LEMON_SQUEEZY_STORE_ID`: your Lemon Squeezy store ID.
- `LEMON_SQUEEZY_VARIANT_ID`: the product variant ID used for the supporter checkout.
- `LEMON_SQUEEZY_WEBHOOK_SECRET`: the signing secret for the Lemon Squeezy webhook.
- `SUPPORTER_EXPORT_TTL_SECONDS`: optional, defaults to `2592000` (30 days).
- `SUPPORTER_PENDING_TTL_SECONDS`: optional, defaults to `7200` (2 hours).
- `MEMBER_ACCESS_TTL_SECONDS`: optional, defaults to `1800` (30 minutes).
- `MEMBER_CHALLENGE_TTL_SECONDS`: optional, defaults to `300` (5 minutes).
- `MEMBER_CHALLENGE_DIFFICULTY`: optional, defaults to `3`.

Create a Cloudflare KV namespace and bind it to the Pages project as `SUPPORTER_CLAIMS`.
This namespace stores short-lived pending payment claims plus the paid claim records that back the supporter cookie.

- Put the Lemon API key in Cloudflare Pages environment variables, not in the React app and not in committed files.
- Point your Lemon Squeezy webhook URL to `/__supporter/webhook` on your deployed site.
- Configure the product or checkout to use the variant referenced by `LEMON_SQUEEZY_VARIANT_ID`.

If any Lemon or KV setting is missing, the donate button stays disabled and the supporter checkout will not start.

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
LEMON_SQUEEZY_API_KEY=lsq_api_xxx
LEMON_SQUEEZY_STORE_ID=12345
LEMON_SQUEEZY_VARIANT_ID=67890
LEMON_SQUEEZY_WEBHOOK_SECRET=replace-with-your-webhook-secret
```

Then build and run the Pages preview:

```bash
npm run build
npx wrangler pages dev dist
```

### Security note

Do not put the email, password, or session secret in the React app or in committed `.env` files. Keep them only in Cloudflare Pages secrets or your local `.dev.vars` file.
