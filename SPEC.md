# Harbor Leads — priority dashboard for a migration consultancy

## Who

- **Maya, Head of Sales (primary user).** Checks the board several times a day: on a desktop at her desk, and on her phone between meetings. Each look lasts about ten seconds, and she wants one answer: *who do I call first?*
- **Marketing manager (secondary, read-only, "Should" tier).** Looks at one panel to see which lead sources produce booked consultations.
- **Not users:** the leads themselves, finance, and individual sales reps. There are no accounts and no per-rep views.

## What it is / is not

**It is** a single-screen, read-only dashboard over a fictional dataset of about 60 leads for "Harbor Migration" (Canada and Australia). It ranks open leads by a transparent priority score, flags leads nobody has touched for 48 hours or more, and shows where the pipeline stands.

**It is not:**
- a CRM: no adding, editing or deleting leads
- a messaging tool: no email, SMS or WhatsApp
- a login, accounts or permissions system
- connected to real data or any API
- a forecast or revenue tool
- an AI or machine-learning model: the score is rule-based and every point is explainable
- a ranking of sales reps

## Where

Browser only. Static site: HTML, CSS, JavaScript and one JSON data file. No backend, no build step, no external requests (no CDN, no web fonts), so it also runs from GitHub Pages. Desktop-first (1024px and up); must stay fully usable at 390px wide.

## Data (mock)

One file, `data/leads.json`, with an `as_of` timestamp that acts as "now". The dashboard never reads the real clock, so every number is reproducible.

Each lead: `id`, `name` (fictional), `country` (Canada | Australia), `source` (Referral | Webinar | Google Search | Meta | Organic), `created_at`, `last_contact_at`, `stage` (New | Contacted | Consultation booked | Proposal sent | Won | Lost), `completeness` (0–100, share of intake form answered), `engagement` (none | replied | booked).

## Priority score (0–100)

| Part | Points |
|------|--------|
| Source: Referral 30, Webinar 25, Google Search 20, Meta 15, Organic 10 | 0–30 |
| Profile completeness: completeness × 0.25, rounded | 0–25 |
| Engagement: booked 25, replied 15, none 0 | 0–25 |
| Urgency: untouched 48h or more 20, 24–48h 10, under 24h 0 | 0–20 |

Bands: **Hot** 70 and above, **Warm** 40 to 69, **Cool** below 40. Won and Lost leads are not scored.

**Overdue** = an open lead whose last contact was 48 hours or more before `as_of`.

## Features

**Must**
- As Maya, I see four numbers at the top: open leads, new in the last 24h, overdue, hot.
- As Maya, I see open leads in a queue ordered by score, highest first, each with its band and the reason it ranks there.
- As Maya, I see overdue leads marked, with the hours since last contact.
- As Maya, I see how many leads sit in each pipeline stage.

**Should**
- Filter the queue by source, stage, band and country; search by name.
- Open a lead to see its score broken into the four parts.
- Marketing panel: per source, number of leads and share that reached a booked consultation.

**Later**
- CSV import, rep assignment, reminders, a live CRM connection.

## Rules that must hold everywhere

- **Red is used only to mark Overdue.** Bands and stages use other colours.
- Every figure on screen is computed from `leads.json`. Nothing is hard-coded.
- Text contrast meets WCAG AA, and every control works from the keyboard.

## Done means

1. The queue is ordered by score, highest first; ties go to the lead with the oldest last contact.
2. For the five reference leads in `tests/`, the score equals the hand-computed value to the point.
3. A lead last contacted exactly 48:00h before `as_of` is Overdue; at 47:59h it is not. Won and Lost leads are never Overdue.
4. The four top numbers always equal counts taken directly from the data file.
5. The only red on the page is on Overdue markers. Removing Overdue leads from the data removes all red.
6. Opening `index.html` triggers zero network requests.
7. At 390px width there is no horizontal scroll on the page.
8. First paint with the full dataset takes under one second on a normal laptop.
