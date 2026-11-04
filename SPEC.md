# Harbor Leads — priority dashboard for a migration consultancy

## Who

- **Maya, Head of Sales (primary user).** Checks the board several times a day: on a desktop at her desk, and on her phone between meetings. Each look lasts about ten seconds, and she wants one answer: *who do I call first?*
- **Marketing manager (secondary, read-only, "Should" tier).** Looks at one panel to see which lead sources produce booked consultations.
- **Not users:** the leads themselves, finance, and individual sales reps. There are no accounts and no per-rep views.

## What it is / is not

**It is** a single-page, read-only dashboard over a fictional dataset of about 60 leads for "Harbor Migration" (Canada and Australia). It ranks open leads by a transparent priority score, flags leads nobody has touched for 48 hours or more, and shows where the pipeline stands.

**It is not:**
- a CRM: no adding, editing or deleting leads
- a messaging tool: no email, SMS or WhatsApp
- a login, accounts or permissions system
- connected to real data or any API
- a forecast or revenue tool
- an AI or machine-learning model: the score is rule-based and every point is explainable
- a ranking of sales reps

## Where

Browser only. Static site: HTML, CSS, JavaScript and one data file. No backend, no build step, no external requests (no CDN, no web fonts). It must work both when `index.html` is opened straight from disk and when served from GitHub Pages, so scripts are plain (non-module) scripts and the data is loaded as a script, not fetched. It is one page with no tabs or navigation, and it scrolls vertically. Desktop-first (1024px and up): the queue and a side column sit next to each other. Between 761 and 1023px the side column moves below the queue; at 760px and below each queue row becomes a card. Must stay fully usable at 390px wide.

## Data (mock)

One file, `data/leads.js`, which defines the dataset and an `as_of` timestamp that acts as "now". The dashboard never reads the real clock, so every number is reproducible.

Each lead: `id`, `name` (fictional), `country` (Canada | Australia), `source` (Referral | Webinar | Google Search | Meta | Organic), `created_at`, `last_contact_at`, `stage` (New | Contacted | Consultation booked | Proposal sent | Won | Lost), `completeness` (0–100, share of intake form answered), `engagement` (none | replied | booked).

## Definitions

- **Open lead:** a lead whose stage is not Won or Lost.
- **Hours since contact:** hours from `last_contact_at` to `as_of`, shown rounded down; under one hour is shown as "under 1h".
- **New in 24h:** an open lead whose `created_at` is less than 24 hours before `as_of`.
- **Overdue:** an open lead with 48 hours or more since last contact. Exactly 48:00 counts.
- **Rank:** position in the queue. Ties on score go to the oldest last contact; if still tied, the lower `id` goes first.
- **Reason for a rank:** the up to three largest non-zero parts of its score, largest first, each shown as a label and its points.

## Priority score (0–100)

| Part | Points |
|------|--------|
| Source: Referral 30, Webinar 25, Google Search 20, Meta 15, Organic 10 | 0–30 |
| Profile completeness: completeness × 0.25, rounded half up | 0–25 |
| Engagement: booked 25, replied 15, none 0 | 0–25 |
| Urgency: 48h or more since contact 20; 24h or more but under 48h 10; under 24h 0 | 0–20 |

Bands: **Hot** 70 and above, **Warm** 40 to 69, **Cool** below 40. Won and Lost leads are not scored.

Five reference leads, scored by hand. The tests use exactly these, with `as_of` as "now":

| Lead | Source | Completeness | Engagement | Since last contact | Score | Overdue |
|------|--------|--------------|------------|--------------------|-------|---------|
| L1 | Referral | 100 | booked | 2h | 80 | no |
| L2 | Meta | 40 | none | 50h | 45 | yes |
| L3 | Organic | 90 | replied | 30h | 58 | no |
| L4 | Webinar | 0 | none | 48h 00m | 45 | yes |
| L5 | Google Search | 60 | replied | 47h 59m | 60 | no |

Their queue order is L1, L5, L3, L2, L4. L2 comes before L4 because it was contacted longer ago.

## Features

**Must**
- As Maya, I see four numbers at the top: open leads, new in the last 24h, overdue, hot.
- As Maya, I see open leads in a queue ordered by score, highest first, each with its band and the reason it ranks there.
- As Maya, I see overdue leads marked, with the hours since last contact.
- As Maya, I see how many leads sit in each pipeline stage.

**Should**
- Filter the queue by source, stage, band and country (one value each, all of them must match), and search it by name (any part of the name, ignoring case and accents). Filters narrow the queue only: the top four numbers and the pipeline do not change, and each lead keeps its rank from the full queue. If nothing matches, the page says so.
- Open a lead to see its score broken into the four parts, each shown as points out of its maximum.
- Marketing panel: for each source, the number of leads and the share that reached a consultation. "Reached a consultation" means the lead is in stage Consultation booked, Proposal sent or Won. All leads of the source count, closed ones included. The share is a whole percent; sources are listed highest share first, then most leads. A lead that reached a consultation and was later marked Lost is not counted, because the data has no stage history.

**Later**
- CSV import, rep assignment, reminders, a live CRM connection.

## Rules that must hold everywhere

- **Red is used only to mark Overdue.** It appears on the Overdue number and on Overdue rows, and only while at least one lead is Overdue. Bands and stages use other colours.
- Every number about the leads is computed from `data/leads.js`. The scoring rules (weights, thresholds, maximums) are defined once, in `src/scoring.js`, and any text on the page that states them is generated from there.
- All text has a contrast ratio of at least 4.5:1 (WCAG AA), and every control can be reached with Tab and operated with Enter or Space.

## Done means

1. The queue is ordered by score, highest first; ties go to the lead with the oldest last contact.
2. For the five reference leads in the table above, the score, the Overdue flag and the queue order equal the table.
3. A lead last contacted exactly 48:00h before `as_of` is Overdue; at 47:59h it is not. At exactly 24:00h the urgency part is 10. Won and Lost leads are never Overdue.
4. The four top numbers always equal counts taken directly from the data file.
5. The only red on the page marks Overdue. With no Overdue leads in the data there is no red anywhere on the page, including the Overdue number.
6. Opening `index.html` from disk shows the full dashboard, and the browser's network panel shows no requests to any other origin.
7. At 390px width there is no horizontal scroll on the page.
8. First contentful paint with the full dataset is under one second, measured in a desktop browser.
9. With filters or a search active, every lead shown matches all of them, its rank is the same as in the unfiltered queue, and the top four numbers are unchanged. With no match, a message is shown.
10. Opening a lead shows four parts whose points add up to its score, and their maximums add up to 100.
11. For each source, the lead count and the share in the marketing panel equal counts taken from the data file.
