# How we work on this project

Read `SPEC.md` before making any change. It is the source of truth for what this dashboard is, what it is not, and when a feature counts as done.

## On every request

1. **Review.** Does the request fit `SPEC.md`? Name the feature (Must, Should or Later). If it is on the "is not" list or breaks a rule in "Rules that must hold everywhere", say so and stop. If anything is unclear, ask. Never fill a blank with a guess.
2. **Plan.** Write three to five lines: what will change, which "Done means" lines it touches. Wait for approval.
3. **Build.** Make the change. Touch only what the request needs.
4. **Test.** Run all tests with `node --test`. Add at least one test for the new behaviour, taken from a "Done means" line. If a test fails, fix it before moving on. Never delete or weaken a test to make it pass.
5. **Commit and push.** One request, one commit, then `git push`. Say why, not only what, and reference the spec.

## Commits

- Format: a short summary line, a blank line, then one or two lines of why, ending with `Spec: <section> / <feature>`.
- Example: `Rank open leads by priority score` ... `Spec: Features / Must / priority queue`.
- Run `git status` before every commit and add files by name. Never `git add .`.
- Work on a branch named `feature/<short-name>` or `fix/<short-name>`. Never commit straight to `main`. Merge through a pull request: `gh pr create`, then `gh pr merge` after the tests pass.
- Uncommitted work does not exist. A request is not finished until it is committed and pushed.

## Changing the spec

The spec may change, but only on purpose. Edit `SPEC.md` in its own commit, with the reason in the message, before touching the code it affects. Code is never changed first and the spec updated afterwards.

## Bugs found along the way

If you find a bug that is not part of the current request, do not fix it silently and do not only mention it in chat. Open an issue and carry on with the request:

`gh issue create --title "<what is wrong>" --body "Steps: ... Expected: ... Actual: ... Found while: <request>"`

Close it with a commit that says `Fixes #<number>`.

## Project rules

- No external requests from the browser except the read-only call to the Airtable API that loads the leads: no CDN, no web fonts, no analytics. Plain scripts only, so the page also works when opened from disk.
- All numbers on screen are computed from the leads loaded from Airtable. The dashboard never reads the real clock; "now" is `as_of` in `data/meta.js`.
- Red marks Overdue leads only.
- Mock data only for the leads: no real people, companies or contact details, and the Airtable base holds fictional leads only. The news panel is the one exception: it shows real public headlines, and no score or number depends on it.
- The Airtable token lives only in `airtable-config.js`, which git ignores; on GitHub Pages that file is written at publish time from the repository secret `AIRTABLE_TOKEN` (`.github/workflows/pages.yml`). The GNews key is read only by `scripts/fetch-news.js`, from the secret `GNEWS_API_KEY` or from the git-ignored `gnews-config.js`, and is never served to the browser. Never paste a token or key in chat, and never commit one.
- Scoring rules live in one place in the code. If the spec changes a weight, change it there, with a test.

## When the agent does the wrong thing

Fix this file, not the chat. If it skipped the tests, this file was unclear about tests. Edit it, commit it, and it is fixed for good.
