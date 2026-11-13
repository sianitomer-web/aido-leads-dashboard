// Checks for Done means 17, 18 and 19 in SPEC.md: the Connection panel's settings, their privacy,
// and the columns the table needs. The browser's local storage is replaced by a small fake.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Connection = require('../src/connection.js');
const Airtable = require('../src/airtable.js');
const fixture = require('./fixtures/leads.js');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const BUILT_IN = { token: 'patBUILTIN.builtin', baseId: 'appBUILTIN0000000', tableId: 'tblBUILTIN0000000' };
const MINE = { baseId: 'appAbCdEfGhIjKlMn', tableId: 'tblAbCdEfGhIjKlMn', token: 'patSecretPart.0123456789abcdef' };

const fakeStorage = () => {
  const data = new Map();
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
};
const brokenStorage = {
  getItem() { throw new Error('denied'); },
  setItem() { throw new Error('denied'); },
  removeItem() { throw new Error('denied'); },
};

test('Done 17: saved settings win over the built-in connection, and Forget brings it back', () => {
  const storage = fakeStorage();
  assert.deepEqual(Connection.resolve(BUILT_IN, storage), { config: BUILT_IN, source: 'built-in' });
  Connection.save(storage, MINE);
  assert.deepEqual(Connection.resolve(BUILT_IN, storage), { config: MINE, source: 'saved' });
  Connection.forget(storage);
  assert.deepEqual(Connection.resolve(BUILT_IN, storage), { config: BUILT_IN, source: 'built-in' });
  assert.equal(storage.data.size, 0, 'Forget removes everything');
});

test('Done 17: spaces around what is typed are ignored', () => {
  const storage = fakeStorage();
  Connection.save(storage, { baseId: ` ${MINE.baseId} `, tableId: `${MINE.tableId}\n`, token: `  ${MINE.token}` });
  assert.deepEqual(Connection.load(storage), MINE);
});

test('Done 17: nothing saved, broken content or a browser without storage all mean the built-in connection', () => {
  assert.equal(Connection.resolve(BUILT_IN, null).source, 'built-in');
  assert.equal(Connection.resolve(BUILT_IN, brokenStorage).source, 'built-in');
  const storage = fakeStorage();
  storage.setItem(Connection.KEY, '{not json');
  assert.equal(Connection.resolve(BUILT_IN, storage).source, 'built-in');
  storage.setItem(Connection.KEY, JSON.stringify({ baseId: MINE.baseId }));
  assert.equal(Connection.resolve(BUILT_IN, storage).source, 'built-in');
  assert.doesNotThrow(() => Connection.forget(brokenStorage));
});

test('wrong settings are refused with a short message that never repeats what was typed, and nothing is saved', () => {
  const storage = fakeStorage();
  for (const bad of [
    { ...MINE, baseId: 'tblNotABase' },
    { ...MINE, tableId: 'appNotATable' },
    { ...MINE, token: 'keySECRETVALUE123' },
    { baseId: '', tableId: '', token: '' },
  ]) {
    assert.throws(() => Connection.save(storage, bad), (error) => {
      for (const typed of Object.values(bad)) if (typed) assert.ok(!error.message.includes(typed), 'the message repeats the input');
      return error.message.length > 20;
    });
  }
  assert.equal(storage.data.size, 0);
});

test('Done 18: the token is stored in one place only, and the page never prints it or logs it', () => {
  const storage = fakeStorage();
  Connection.save(storage, MINE);
  assert.deepEqual([...storage.data.keys()], [Connection.KEY]);
  const appJs = read('src/app.js');
  assert.ok(!/console\./.test(appJs), 'src/app.js writes to the console');
  assert.ok(!/\.token\b/.test(appJs), 'src/app.js reads the token itself');
  assert.ok(!/c-token'\)\.value\s*=/.test(appJs), 'src/app.js writes into the token field');
  assert.match(read('index.html'), /<input id="c-token"[^>]*type="password"/);
});

test('Done 18: the saved token goes to the Airtable request and nowhere else', async () => {
  const calls = [];
  const fetchFn = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: 200, json: async () => ({ records: [] }) };
  };
  const storage = fakeStorage();
  Connection.save(storage, MINE);
  await Airtable.loadLeads(Connection.resolve(BUILT_IN, storage).config, fetchFn);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.startsWith(`https://api.airtable.com/v0/${MINE.baseId}/${MINE.tableId}`));
  assert.equal(calls[0].options.headers.Authorization, `Bearer ${MINE.token}`);
  assert.ok(!calls[0].url.includes(MINE.token), 'the token is in the address');
});

test('Done 19: the panel lists the columns the board requires, taken from the code and not typed by hand', () => {
  const names = Airtable.COLUMNS.map((column) => column.name);
  assert.deepEqual(names, ['id', 'name', 'country', 'source', 'created_at', 'last_contact_at', 'stage', 'completeness', 'engagement']);
  assert.ok(Airtable.COLUMNS.every((column) => column.type.length > 3));
  assert.ok(/AirtableSource\.COLUMNS/.test(read('src/app.js')), 'the panel does not read the column list');
  assert.match(read('index.html'), /<ul id="connection-columns"[^>]*><\/ul>/, 'the column list is written by hand in index.html');
  // every listed column is really required: a row without it is refused, and the message names it
  for (const name of names) {
    const fields = { ...fixture.leads[0] };
    delete fields[name];
    assert.throws(() => Airtable.toLead({ id: 'recX', fields }), new RegExp(`empty cell: ${name}\\.`));
  }
});

test('Done 19: sample-leads.csv has the same columns and the same 60 leads as the built-in base', () => {
  const text = read('sample-leads.csv');
  assert.ok(!text.includes('"'), 'the sample file needs no quoting');
  const [header, ...rows] = text.trim().split('\n').map((line) => line.split(','));
  assert.deepEqual(header, Airtable.COLUMNS.map((column) => column.name));
  assert.equal(rows.length, fixture.leads.length);
  rows.forEach((row, i) => {
    const lead = Object.fromEntries(header.map((name, k) => [name, name === 'completeness' ? Number(row[k]) : row[k]]));
    assert.deepEqual(lead, fixture.leads[i]);
  });
});
