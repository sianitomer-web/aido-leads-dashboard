// Fetches the newest headlines about immigration to Canada or Australia from GNews and writes
// them as data/news.js. It runs in Node (on your computer or in the GitHub publish job), never
// in the browser, so the GNews key never reaches the page.
//
//   node scripts/fetch-news.js                      writes data/news.js
//   node scripts/fetch-news.js --out _site/data/news.js
//
// The key comes from the environment variable GNEWS_API_KEY, or from the git-ignored gnews-config.js.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const API = 'https://gnews.io/api/v4/search';
const QUERY = '(Canada OR Australia) AND (immigration OR visa)';
const MAX_HEADLINES = 5;

// Only web links are accepted, so a headline can never carry a script link.
function toHeadline(article) {
  const url = article && article.url;
  if (!article || !article.title || typeof url !== 'string' || !/^https?:\/\//i.test(url)) return null;
  return {
    title: article.title,
    source: (article.source && article.source.name) || '',
    published_at: article.publishedAt || '',
    url,
  };
}

// Up to five headlines, newest first, without the same title twice.
function pickHeadlines(articles) {
  const seen = new Set();
  return (articles || [])
    .map(toHeadline)
    .filter((headline) => {
      if (!headline) return false;
      const key = headline.title.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))
    .slice(0, MAX_HEADLINES);
}

// One read-only request. Error messages never contain the key.
async function fetchNews(apiKey, fetchFn) {
  if (!apiKey || apiKey === 'PASTE_KEY_HERE') {
    throw new Error('The GNews key is missing. Set GNEWS_API_KEY or fill in gnews-config.js.');
  }
  const doFetch = fetchFn || fetch;
  const url = `${API}?q=${encodeURIComponent(QUERY)}&lang=en&max=${MAX_HEADLINES}&sortby=publishedAt&apikey=${encodeURIComponent(apiKey)}`;
  let response;
  try {
    response = await doFetch(url, { method: 'GET' });
  } catch (err) {
    throw new Error('Could not reach GNews.');
  }
  if (!response.ok) {
    throw new Error(
      response.status === 401 || response.status === 403
        ? 'GNews refused the key.'
        : `GNews answered with an error (${response.status}).`
    );
  }
  const body = await response.json();
  return pickHeadlines(body.articles);
}

// The file the page loads: a plain script like data/meta.js. It holds headlines only, never the key.
function buildNewsFile(headlines, fetchedAt) {
  const data = { fetched_at: fetchedAt, headlines };
  return `// Real public headlines fetched from GNews by scripts/fetch-news.js. Do not edit by hand.
(function (root) {
  const data = ${JSON.stringify(data, null, 2)};
  root.NEWS_DATA = data;
})(typeof self !== 'undefined' ? self : globalThis);
`;
}

function readKey(root) {
  if (process.env.GNEWS_API_KEY) return process.env.GNEWS_API_KEY.trim();
  const file = path.join(root, 'gnews-config.js');
  if (!fs.existsSync(file)) return '';
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox);
  return (sandbox.window.GNEWS_CONFIG && sandbox.window.GNEWS_CONFIG.apiKey) || '';
}

async function main(argv) {
  const root = path.join(__dirname, '..');
  const outIndex = argv.indexOf('--out');
  const out = path.resolve(outIndex >= 0 ? argv[outIndex + 1] : path.join(root, 'data', 'news.js'));
  const headlines = await fetchNews(readKey(root));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, buildNewsFile(headlines, new Date().toISOString()));
  console.log(`Wrote ${headlines.length} headlines to ${path.relative(process.cwd(), out)}`);
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { toHeadline, pickHeadlines, fetchNews, buildNewsFile };
