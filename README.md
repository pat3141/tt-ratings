# 🏓 Rally — ACT Table Tennis Ratings

A fast, good-looking viewer for [Ratings Central](https://www.ratingscentral.com) table tennis ratings in the ACT.

- **Instant fuzzy search.** Search by name, ID or club from anywhere with <kbd>⌘K</kbd> or <kbd>/</kbd>. Typos are fine.
- **Rating history.** Interactive chart with a ±1 SD uncertainty band, a peak marker and 1Y/2Y/5Y/All ranges.
- **Match records.** Every match with game scores, plus an opponent breakdown, best wins, toughest losses and win rate by opponent strength.
- **Compare up to 6 players.** Overlay their histories by date or by career stage (aligned at each player's first event). Includes a side-by-side stats table and a head-to-head matrix.
- **Events and clubs.** Field results with rating changes, plus club rosters and rating spreads.
- **Stars, dark mode and mobile.** Star your players, use dark mode, and use it on a phone. Compare links are shareable.

## How it works

It is a static React + Vite site, hosted free on GitHub Pages.

`scripts/fetch-data.mjs` downloads Ratings Central's public CSV exports and writes them as JSON under `public/data/`:

| File | Contents |
|---|---|
| `players.json` | the player list |
| `clubs.json` | clubs |
| `events.json` | events |
| `p/<id>.json` | each player's history and matches |

The fetch is incremental: a player is only re-downloaded when their last event changes.

The GitHub Action in `.github/workflows/deploy.yml` runs every 6 hours and on every push. It refreshes the data, commits it, builds the site and deploys it to Pages. You can also run it manually from the **Actions** tab; tick **full** to re-download everything.

## Develop

```bash
npm install
npm run data   # fetch/refresh data (first run takes ~10 min, later runs are quick)
npm run dev
```

## Change region

Edit `scripts/region.json`. For example, NSW is `{ "name": "NSW", "country": "AUS", "province": "NSW" }`. Then run `npm run data:full`.

---

Data © Ratings Central. This is an unofficial fan-made viewer, not affiliated with Ratings Central.
