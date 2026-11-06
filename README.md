# SplitPop (browser-only)

Split bills with friends. No login, no server, no database. Everything is saved in the visitor's own browser (localStorage).

- Make a pop (a group), add friends, add bills (title, amount, who paid, split equally or by exact amounts).
- Shows who gets back / who owes, and the fewest payments needed to settle. "Paid" records a payment (with undo).
- "Share a copy" makes a link holding a snapshot of the pop, so a friend can open their own copy. Changes made later do not sync.

## Run it
Open `index.html` in a browser. That's it.

## Deploy on Vercel
Push these files to a GitHub repo and import it in Vercel (Framework Preset: Other, no build command).

## Files
- `index.html`: the page shell
- `css/splitpop.css`: the look
- `js/logic.js`: money, splitting, balances, safe import of shared links
- `js/app.js`: screens, forms, storage
