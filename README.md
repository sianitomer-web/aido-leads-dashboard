# Harbor Leads

A priority dashboard for a migration consultancy. It answers one question for a Head of Sales in ten seconds: **who do I call first?**

Built from a written spec, with the spec committed before any code. All data is mock: every lead is fictional, and the leads are read from an Airtable base.

## Open it

Double-click `index.html`. No server and no install, but it needs internet and an `airtable-config.js` file next to it (see "Airtable connection"). It also runs from GitHub Pages.

## What it shows

- Four numbers: open leads, new in 24h, overdue (no contact for 48h or more), hot.
- A priority queue: open leads ranked by a rule-based score out of 100, with the reasons behind each rank. Overdue leads are marked in red, and red is used for nothing else.
- A pipeline count per stage, and a source quality panel (share of leads that reached a consultation).
- Filters, name search, and a per-lead breakdown of the four score parts.
- A Connection panel: anyone can point the board at their own Airtable base (Base ID, Table ID, read-only token). The settings stay in that browser only.
- A news panel: up to five recent headlines about immigration to Canada or Australia, as background for a call. It touches no score or number.

## How it is built

| File | What it does |
|------|--------------|
| `SPEC.md` | What the dashboard is, what it is not, and when it counts as done |
| `Practice.md` | How work is done in this repository: review, build, test, commit |
| `data/meta.js` | The company name and the `as_of` time that acts as "now" |
| `scripts/fetch-news.js` | Fetches the headlines from the GNews API and writes `data/news.js`. Runs in Node, never in the browser |
| `data/news.js` | The headlines the page shows. Written by that script and not kept in git |
| `src/connection.js` | The Connection panel's settings: saved in the browser only, they override the built-in connection until forgotten |
| `sample-leads.csv` | The same 60 fictional leads as a file, to import into your own Airtable table |
| `src/airtable.js` | Reads the leads from the Airtable table: read-only GET requests, one per page of results |
| `airtable-config.js` | The Airtable base, table and read-only token. Git ignores it (see below) |
| `tests/fixtures/leads.js` | The 60 fictional leads as they are stored in Airtable, used by the tests |
| `src/scoring.js` | Score, bands, Overdue rule, queue order |
| `src/dashboard.js` | Numbers and labels for the page (no DOM) |
| `src/app.js` | Draws the page |
| `tests/` | Tests for the scoring, the numbers, the data, and the rules in the spec |

Plain scripts only, no build step, no dependencies. The only request the page makes is the read-only call to the Airtable API. The news comes from a file, not from a request.

## Run the tests

```
node --test
```

Requires Node 20 or newer. 77 tests, including checks that red is used only for Overdue, that text contrast meets WCAG AA, and that the page makes no external requests.

## Done means, and the evidence

| # | Requirement (see `SPEC.md`) | Checked by |
|---|-----------------------------|------------|
| 1 | Queue ordered by score, ties by oldest contact | `tests/scoring.test.js` |
| 2 | Scores match hand-computed values | `tests/scoring.test.js` |
| 3 | Overdue at exactly 48:00h, not at 47:59h | `tests/scoring.test.js` |
| 4 | Top four numbers equal counts from the data | `tests/dashboard.test.js` |
| 5 | Only red is on Overdue, and none at all when no lead is Overdue | `tests/rules.test.js`; browser computed-style check on the real data and on a copy with no Overdue leads |
| 6 | Works from disk; the only requests are reads to `api.airtable.com` | `tests/rules.test.js`, `tests/airtable.test.js`, browser |
| 7 | No horizontal scroll at 390px | Browser check, including filters and open details |
| 8 | First contentful paint under one second | Browser measurement: 56 ms |
| 9 | Filters keep ranks and top numbers | `tests/dashboard.test.js` and browser |
| 10 | Breakdown adds up to the score | `tests/dashboard.test.js` and browser |
| 11 | Source panel matches the data | `tests/dashboard.test.js` and browser |
| 12 | The leads on the page are the rows of the Airtable table, all pages, read-only | `tests/airtable.test.js`; browser against the live base: 46 open, 10 new, 8 overdue, 9 hot |
| 13 | If Airtable cannot be reached or refuses the token, one clear message and no leads | `tests/airtable.test.js`; browser with no token settings |
| 14 | News panel: at most five headlines from `data/news.js`, newest first, with the fetch time | `tests/news.test.js`; browser with real headlines |
| 15 | No `data/news.js` or no headlines: one note, and the board still works | `tests/news.test.js`; browser on a copy without the file |
| 16 | No news key in any file the browser receives | `tests/news.test.js` |
| 17 | Saved settings win, and Forget brings the built-in connection back | `tests/connection.test.js`; browser with saved settings |
| 18 | The saved token stays in this browser and goes only to `api.airtable.com` | `tests/connection.test.js` |
| 19 | The listed columns are the required ones, and the sample CSV matches the built-in base | `tests/connection.test.js` |

Also checked with real key presses: Tab reaches every control in a sensible order, and Enter or Space opens and closes a lead's score breakdown.

## Airtable connection

The leads live in the table `Leads` of the Airtable base "Harbor Leads". The page reads them with a **read-only** token that can see that base only. The token goes in `airtable-config.js`. Git ignores that file, so the token is never in the repository. On GitHub Pages, `.github/workflows/pages.yml` writes the file at publish time from the repository secret `AIRTABLE_TOKEN`. The file looks like this:

```js
window.AIRTABLE_CONFIG = {
  token: "PASTE_TOKEN_HERE",   // a personal access token with data.records:read, for one base
  baseId: "appXXXXXXXXXXXXXX",
  tableId: "tblXXXXXXXXXXXXXX"
};
```

Without this file the page shows a message and no leads, by design (Done 13). The token must never have write access. The browser still receives the token, because the page itself calls Airtable, so it is deliberately a read-only token for one base of fictional leads.

## Try it with your own Airtable base

The board reads from a built-in base, so it works as soon as it opens. To read from your own base instead:

1. Download [`sample-leads.csv`](sample-leads.csv) (60 fictional leads) and import it in Airtable: **Add or import, CSV file**. In the import preview keep `created_at` and `last_contact_at` as text or as date with time (UTC). Airtable turns the file's `2026-10-06T19:09:00Z` into the text `2026-10-06 19:09`; the board reads a time without a zone as UTC, so the numbers stay the same. The panel lists all nine columns and what each one holds.
2. Create a token in Airtable (**Builder hub, Personal access tokens**) with the scope `data.records:read` for that base only.
3. Copy the Base ID (`app...`) and the Table ID (`tbl...`) from the address bar of your table.
4. Open **Connection** at the top of the page, enter the three values and press **Save and reload**.

The values stay in your browser's local storage and the token is never shown again. **Forget** removes them and brings the built-in connection back. If a column is missing or empty, the page names it.

## News panel

The panel reads `data/news.js`. A script, `scripts/fetch-news.js`, writes that file from the GNews API with a free key. The page never calls GNews, for two reasons: GNews does not allow other websites to read its answers (a real browser test showed the request is blocked), and a key in the page would be visible to everyone. Putting a small layer in the middle that holds the key is how this is done in real projects.

- **On your computer:** put your key in `gnews-config.js` (git ignores it), then run `node scripts/fetch-news.js` and reload the page.
- **On GitHub Pages:** the publish workflow runs the same script with the repository secret `GNEWS_API_KEY`, on every push to `main` and every six hours. The key is never published.
- The free GNews plan delays articles by about twelve hours.

## Independent review

The dashboard was reviewed by an agent that had seen only `SPEC.md` and `Practice.md`. It found one real defect (red stayed on the Overdue card with zero Overdue leads), scoring rules repeated as fixed text, and a list of ambiguities in the spec. All were fixed spec-first; the commit history shows the order.

## History

The commit log shows the order of work: `SPEC.md` first, then `Practice.md`, then tests and code. Spec changes are separate commits made before the code they affect.
