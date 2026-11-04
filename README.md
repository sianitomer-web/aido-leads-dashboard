# Harbor Leads

A priority dashboard for a migration consultancy. It answers one question for a Head of Sales in ten seconds: **who do I call first?**

Built from a written spec, with the spec committed before any code. All data is mock: every lead is fictional.

## Open it

Double-click `index.html`. No server, no install, no internet. It also runs from GitHub Pages.

## What it shows

- Four numbers: open leads, new in 24h, overdue (no contact for 48h or more), hot.
- A priority queue: open leads ranked by a rule-based score out of 100, with the reasons behind each rank. Overdue leads are marked in red, and red is used for nothing else.
- A pipeline count per stage, and a source quality panel (share of leads that reached a consultation).
- Filters, name search, and a per-lead breakdown of the four score parts.

## How it is built

| File | What it does |
|------|--------------|
| `SPEC.md` | What the dashboard is, what it is not, and when it counts as done |
| `Practice.md` | How work is done in this repository: review, build, test, commit |
| `data/leads.js` | 60 fictional leads and the `as_of` time that acts as "now" |
| `src/scoring.js` | Score, bands, Overdue rule, queue order |
| `src/dashboard.js` | Numbers and labels for the page (no DOM) |
| `src/app.js` | Draws the page |
| `tests/` | Tests for the scoring, the numbers, the data, and the rules in the spec |

Plain scripts only, no build step, no dependencies, no external requests.

## Run the tests

```
node --test
```

Requires Node 20 or newer. 50 tests, including checks that red is used only for Overdue, that text contrast meets WCAG AA, and that the page makes no external requests.

## Done means, and the evidence

| # | Requirement (see `SPEC.md`) | Checked by |
|---|-----------------------------|------------|
| 1 | Queue ordered by score, ties by oldest contact | `tests/scoring.test.js` |
| 2 | Scores match hand-computed values | `tests/scoring.test.js` |
| 3 | Overdue at exactly 48:00h, not at 47:59h | `tests/scoring.test.js` |
| 4 | Top four numbers equal counts from the data | `tests/dashboard.test.js` |
| 5 | Only red is on Overdue, and none at all when no lead is Overdue | `tests/rules.test.js`; browser computed-style check on the real data and on a copy with no Overdue leads |
| 6 | Works from disk, no requests to other origins | `tests/rules.test.js`, browser network log |
| 7 | No horizontal scroll at 390px | Browser check, including filters and open details |
| 8 | First contentful paint under one second | Browser measurement: 56 ms |
| 9 | Filters keep ranks and top numbers | `tests/dashboard.test.js` and browser |
| 10 | Breakdown adds up to the score | `tests/dashboard.test.js` and browser |
| 11 | Source panel matches the data | `tests/dashboard.test.js` and browser |

Also checked with real key presses: Tab reaches every control in a sensible order, and Enter or Space opens and closes a lead's score breakdown.

## Independent review

The dashboard was reviewed by an agent that had seen only `SPEC.md` and `Practice.md`. It found one real defect (red stayed on the Overdue card with zero Overdue leads), scoring rules repeated as fixed text, and a list of ambiguities in the spec. All were fixed spec-first; the commit history shows the order.

## History

The commit log shows the order of work: `SPEC.md` first, then `Practice.md`, then tests and code. Spec changes are separate commits made before the code they affect.
