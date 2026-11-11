// Checks for Done means 6, 12 and 13 in SPEC.md: the leads come from Airtable, read-only,
// and a failure shows a message instead of old data. Airtable is replaced by a fake fetch.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Airtable = require('../src/airtable.js');
const fixture = require('./fixtures/leads.js');
const meta = require('../data/meta.js');

const CONFIG = { token: 'patTESTTOKEN123456', baseId: 'appTEST', tableId: 'tblTEST' };

const toRecord = (lead, i) => ({ id: `rec${i}`, createdTime: '2026-11-11T00:00:00.000Z', fields: { ...lead } });

// A fake Airtable that serves `leads` in pages and remembers every request it got.
function fakeAirtable(leads, pageSize = 25) {
  const calls = [];
  const fetchFn = async (url, options) => {
    calls.push({ url, options });
    const offset = new URL(url).searchParams.get('offset');
    const start = offset ? Number(offset) : 0;
    const records = leads.slice(start, start + pageSize).map((l, i) => toRecord(l, start + i));
    const next = start + pageSize < leads.length ? String(start + pageSize) : undefined;
    return { ok: true, status: 200, json: async () => ({ records, offset: next }) };
  };
  return { fetchFn, calls };
}

test('Done 12: every row of the table is loaded, across all pages, and equals the stored leads', async () => {
  const { fetchFn, calls } = fakeAirtable(fixture.leads, 25);
  const leads = await Airtable.loadLeads(CONFIG, fetchFn);
  assert.equal(leads.length, fixture.leads.length);
  assert.deepEqual(leads, fixture.leads);
  assert.equal(calls.length, 3, '60 rows in pages of 25 take three requests');
  assert.match(calls[1].url, /offset=25/);
});

test('Done 6 and 12: the page only sends read requests to the Airtable API, with the token', async () => {
  const { fetchFn, calls } = fakeAirtable(fixture.leads, 100);
  await Airtable.loadLeads(CONFIG, fetchFn);
  for (const { url, options } of calls) {
    assert.ok(url.startsWith('https://api.airtable.com/v0/appTEST/tblTEST'), `unexpected address ${url}`);
    assert.equal(options.method, 'GET');
    assert.equal(options.body, undefined, 'a read request has no body');
    assert.equal(options.headers.Authorization, `Bearer ${CONFIG.token}`);
  }
});

test('Done 12: the source file has one address, the Airtable API, and no write method', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'src', 'airtable.js'), 'utf8');
  const urls = text.match(/https?:\/\/[^\s'"`)]+/g) || [];
  assert.deepEqual([...new Set(urls)], ['https://api.airtable.com/v0']);
  assert.ok(!/\b(POST|PATCH|PUT|DELETE)\b/.test(text), 'src/airtable.js names a write method');
});

test('Done 13: a refused token gives a clear message that never contains the token', async () => {
  const fetchFn = async () => ({ ok: false, status: 401, json: async () => ({}) });
  await assert.rejects(Airtable.loadLeads(CONFIG, fetchFn), (error) => {
    assert.match(error.message, /refused the token/);
    assert.ok(!error.message.includes(CONFIG.token));
    return true;
  });
});

test('Done 13: other Airtable errors and a missing connection give a clear message', async () => {
  await assert.rejects(
    Airtable.loadLeads(CONFIG, async () => ({ ok: false, status: 500, json: async () => ({}) })),
    /error \(500\)/
  );
  await assert.rejects(
    Airtable.loadLeads(CONFIG, async () => { throw new TypeError('Failed to fetch'); }),
    /Could not reach Airtable/
  );
});

test('Done 13: missing or placeholder settings stop the load before any request', async () => {
  const { fetchFn, calls } = fakeAirtable(fixture.leads);
  await assert.rejects(Airtable.loadLeads(undefined, fetchFn), /settings are missing/);
  await assert.rejects(Airtable.loadLeads({ ...CONFIG, token: 'PASTE_TOKEN_HERE' }, fetchFn), /settings are missing/);
  assert.equal(calls.length, 0);
});

test('a row with an empty required cell is rejected and named, never guessed', async () => {
  const broken = fixture.leads.map((l) => ({ ...l }));
  delete broken[4].stage;
  const { fetchFn } = fakeAirtable(broken);
  await assert.rejects(Airtable.loadLeads(CONFIG, fetchFn), /rec4 has an empty cell: stage/);
});

test('a completeness of 0 is a valid value, not an empty cell', () => {
  const lead = { ...fixture.leads[0], completeness: 0 };
  assert.equal(Airtable.toLead(toRecord(lead, 0)).completeness, 0);
});

test('data/meta.js carries the same company and as_of as the stored leads', () => {
  assert.equal(meta.company, fixture.company);
  assert.equal(meta.as_of, fixture.as_of);
});
