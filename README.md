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

The repo includes `.github/workflows/hourly-refresh.yml`, which runs every hour and commits refreshed snapshot data back to the repository.
