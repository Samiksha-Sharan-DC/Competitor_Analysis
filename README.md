# Competitor Intelligence Board

A comparison board that automatically captures screenshots of 5 certificate management competitors every Monday and displays them as a visual board.

## How it works

- **Every Monday at 06:00 IST**, GitHub Actions opens a real browser, visits each competitor's documentation pages, and takes screenshots
- Screenshots are saved to this repository automatically
- The board at `index.html` reads them and displays the comparison

## Competitors monitored

- Sectigo
- GlobalSign
- AWS Certificate Manager
- Let's Encrypt
- Cloudflare

## Viewing the board

Open the GitHub Pages URL for this repository. Share it with teammates — no login needed.

## Running manually

Go to **Actions → Weekly competitor screenshots → Run workflow** to capture screenshots immediately without waiting for Monday.

## Adding more pages to capture

Edit `capture.js` and add entries to the `PAGES` array following the existing pattern.
