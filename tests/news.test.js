// Checks for Done means 6, 14, 15 and 16 in SPEC.md. A scheduled job fetches the headlines from GNews
// (scripts/fetch-news.js) and the page only reads data/news.js. GNews is replaced by a fake fetch.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const News = require('../scripts/fetch-news.js');

const KEY = '0123456789abcdef0123456789abcdef';
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

const article = (n, day, extra = {}) => ({
  title: `Headline ${n}`,
  url: `https://news.example/${n}`,
  publishedAt: `2026-11-${String(day).padStart(2, '0')}T08:00:00Z`,
  source: { name: `Paper ${n}` },
  ...extra,
});
const serve = (articles) => {
  const calls = [];
  const fetchFn = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: 200, json: async () => ({ articles }) };
  };
  return { fetchFn, calls };
};

test('Done 14: at most five headlines, newest first, each with source, date and link', async () => {
  const { fetchFn } = serve([1, 2, 3, 4, 5, 6, 7].map((n) => article(n, n)));
  const news = await News.fetchNews(KEY, fetchFn);
  assert.equal(news.length, 5);
  assert.deepEqual(news.map((h) => h.title), ['Headline 7', 'Headline 6', 'Headline 5', 'Headline 4', 'Headline 3']);
  assert.deepEqual(news[0], { title: 'Headline 7', source: 'Paper 7', published_at: '2026-11-07T08:00:00Z', url: 'https://news.example/7' });
});

test('the same headline from two papers is shown once', () => {
  const news = News.pickHeadlines([article(1, 3), article(2, 2, { title: 'headline 1 ' }), article(3, 1)]);
  assert.deepEqual(news.map((h) => h.url), ['https://news.example/1', 'https://news.example/3']);
});

test('an article without a title or a web link is dropped, so a headline never carries a script link', () => {
  const news = News.pickHeadlines([
    article(1, 5),
    article(2, 4, { url: 'javascript:alert(1)' }),
    article(3, 3, { title: '' }),
    article(4, 2, { url: undefined }),
  ]);
  assert.deepEqual(news.map((h) => h.title), ['Headline 1']);
});

test('the job makes one read request to GNews and nothing else', async () => {
  const { fetchFn, calls } = serve([article(1, 1)]);
  await News.fetchNews(KEY, fetchFn);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.startsWith('https://gnews.io/api/v4/search?'));
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[0].options.body, undefined);
  const text = read('scripts/fetch-news.js');
  const urls = (text.match(/https?:\/\/[^\s'"`)\\]+/g) || []).filter((u) => !/^https?:\/\/$/.test(u) && !u.includes('news.example'));
  assert.ok(urls.every((u) => u.startsWith('https://gnews.io/api/v4/search')), `unexpected address in ${urls}`);
  assert.ok(!/\b(POST|PATCH|PUT|DELETE)\b/.test(text), 'the job names a write method');
});

test('a refused key, an error, no network or a missing key stop the job with a message that never holds the key', async () => {
  const fail = (status) => async () => ({ ok: false, status, json: async () => ({}) });
  await assert.rejects(News.fetchNews(KEY, fail(403)), (error) => {
    assert.match(error.message, /refused the key/);
    assert.ok(!error.message.includes(KEY));
    return true;
  });
  await assert.rejects(News.fetchNews(KEY, fail(429)), /error \(429\)/);
  await assert.rejects(News.fetchNews(KEY, async () => { throw new TypeError('Failed to fetch'); }), /Could not reach GNews/);
  const { fetchFn, calls } = serve([]);
  await assert.rejects(News.fetchNews('', fetchFn), /key is missing/);
  await assert.rejects(News.fetchNews('PASTE_KEY_HERE', fetchFn), /key is missing/);
  assert.equal(calls.length, 0, 'no request without a key');
});

test('Done 16: the file the page loads holds the headlines and the fetch time, never the key', async () => {
  const { fetchFn } = serve([article(1, 2), article(2, 1)]);
  const headlines = await News.fetchNews(KEY, fetchFn);
  const file = News.buildNewsFile(headlines, '2026-11-11T12:00:00.000Z');
  assert.ok(!file.includes(KEY) && !/apikey/i.test(file));
  const sandbox = { self: {}, globalThis: {} };
  sandbox.self = sandbox;
  vm.runInNewContext(file, sandbox);
  assert.equal(sandbox.NEWS_DATA.fetched_at, '2026-11-11T12:00:00.000Z');
  // The script runs in its own realm, so compare the plain values.
  assert.deepEqual(JSON.parse(JSON.stringify(sandbox.NEWS_DATA.headlines)), headlines);
});

test('Done 16: the page files never mention the key or GNews', () => {
  for (const file of ['index.html', 'styles.css', 'src/app.js', 'src/scoring.js', 'src/dashboard.js', 'src/airtable.js']) {
    assert.ok(!/gnews/i.test(read(file)), `${file} mentions GNews`);
  }
});

test('Done 15: the board never waits for the news, and headline text is never inserted as HTML', () => {
  const appJs = read('src/app.js');
  assert.ok(/renderNews\(\);/.test(appJs), 'src/app.js shows the news');
  assert.ok(!/await[^;\n]*[Nn]ews/.test(appJs), 'src/app.js waits for the news');
  assert.ok(!/\bfetch\s*\(/.test(appJs), 'src/app.js fetches');
  assert.ok(!/innerHTML/.test(appJs), 'src/app.js inserts HTML');
});
