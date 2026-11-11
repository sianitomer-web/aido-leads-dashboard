// Checks for the "Rules that must hold everywhere" in SPEC.md and Done means 5 and 6.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const html = read('index.html');
const css = read('styles.css');
const appJs = read('src/app.js');

// ---------- colour helpers ----------

function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

function luminance([r, g, b]) {
  const lin = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function contrast(hexA, hexB) {
  const a = luminance(hexToRgb(hexA));
  const b = luminance(hexToRgb(hexB));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// A colour counts as red when its hue is within 20 degrees of red and it is clearly coloured.
function isRed(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return false;
  const l = (max + min) / 2;
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return s >= 0.3 && (h <= 20 || h >= 340);
}

// ---------- tiny CSS reader: custom properties and rule blocks ----------

function customProperties(source) {
  const vars = {};
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(source))) vars[m[1]] = m[2].trim();
  return vars;
}

// Returns [{ selector, body }] for every block that holds declarations (handles @media nesting).
function ruleBlocks(source) {
  const blocks = [];
  const stack = [];
  let buffer = '';
  for (const ch of source.replace(/\/\*[\s\S]*?\*\//g, '')) {
    if (ch === '{') {
      stack.push({ head: buffer.trim(), body: '' });
      buffer = '';
    } else if (ch === '}') {
      const top = stack.pop();
      top.body += buffer;
      buffer = '';
      if (top.body.includes(':')) blocks.push({ selector: top.head, body: top.body });
      if (stack.length) stack[stack.length - 1].body += ' ';
    } else if (stack.length) {
      buffer += ch;
    } else {
      buffer += ch;
    }
  }
  return blocks;
}

const vars = customProperties(css);

// ---------- Rules ----------

// Done means 5: the only red on the page is on Overdue markers.
test('every red colour is defined as an --overdue-* custom property', () => {
  const hexes = css.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || [];
  for (const hex of hexes.filter(isRed)) {
    const holders = Object.entries(vars).filter(([, v]) => v.toLowerCase() === hex.toLowerCase());
    assert.ok(holders.length > 0, `${hex} is a red colour used outside a custom property`);
    for (const [name] of holders) {
      assert.ok(name.startsWith('--overdue'), `${hex} is red but is defined as ${name}`);
    }
  }
});

test('--overdue-* colours are only used inside rules for overdue elements', () => {
  for (const { selector, body } of ruleBlocks(css)) {
    if (selector === ':root') continue;
    if (/var\(\s*--overdue/.test(body)) {
      assert.ok(/overdue/.test(selector), `"${selector}" uses an --overdue colour but is not an overdue rule`);
    }
  }
});

test('no other custom property resolves to a red colour', () => {
  for (const [name, value] of Object.entries(vars)) {
    if (name.startsWith('--overdue')) continue;
    if (/^#[0-9a-fA-F]{3,6}$/.test(value)) {
      assert.ok(!isRed(value), `${name} (${value}) is red`);
    }
  }
});

test('no red keyword or colour literal in the HTML or the page script', () => {
  const colourLiteral = /['"]#[0-9a-fA-F]{3,8}['"]|rgba?\(|hsla?\(|\bred\b|crimson|tomato/i;
  assert.ok(!colourLiteral.test(appJs), 'src/app.js sets a colour; colours belong in styles.css');
  assert.ok(!/style\s*=\s*["'][^"']*(color|background)/i.test(html), 'index.html has inline colours');
  assert.ok(!/\bred\b|crimson|tomato/i.test(css), 'styles.css uses a red colour keyword');
});

// Done means 6: no page file but src/airtable.js has a URL (it holds the one Airtable address, tested in
// tests/airtable.test.js); works when opened from disk.
test('no external URLs anywhere in the page files', () => {
  for (const [name, text] of [['index.html', html], ['styles.css', css], ['src/app.js', appJs]]) {
    assert.ok(!/https?:\/\//i.test(text), `${name} contains an absolute URL`);
    assert.ok(!/(^|[\s"'(])\/\/[a-z]/i.test(text), `${name} contains a protocol-relative URL`);
    assert.ok(!/@import/.test(text), `${name} imports another file`);
  }
});

test('plain scripts only, no fetching, so the page works from disk', () => {
  assert.ok(!/type\s*=\s*["']module["']/.test(html), 'index.html loads an ES module');
  assert.ok(!/\bfetch\s*\(|XMLHttpRequest|\bimport\s*\(|^\s*import\s/m.test(appJs), 'src/app.js fetches or imports');
  const scripts = [...html.matchAll(/<script[^>]*src\s*=\s*["']([^"']+)["']/g)].map((m) => m[1]);
  assert.ok(scripts.length >= 3, 'index.html loads the data and the scripts');
  for (const src of scripts) {
    assert.ok(!/^[a-z]+:|^\//i.test(src), `${src} is not a relative path`);
    // airtable-config.js holds the token, so git ignores it and a fresh clone does not have it.
    if (src !== 'airtable-config.js') assert.ok(fs.existsSync(path.join(ROOT, src)), `${src} exists`);
  }
});

// Rules: text contrast meets WCAG AA (4.5:1).
test('text and background pairs meet WCAG AA contrast', () => {
  const pairs = [
    ['--ink', '--surface'], ['--ink', '--bg'],
    ['--ink-soft', '--surface'], ['--ink-soft', '--bg'],
    ['--accent-ink', '--surface'],
    ['--hot-ink', '--hot-bg'], ['--warm-ink', '--warm-bg'], ['--cool-ink', '--cool-bg'],
    ['--overdue-ink', '--overdue-bg'], ['--overdue-ink', '--surface'],
    ['--on-accent', '--accent'],
  ];
  for (const [fg, bg] of pairs) {
    assert.ok(vars[fg] && vars[bg], `${fg} and ${bg} are defined`);
    const ratio = contrast(vars[fg], vars[bg]);
    assert.ok(ratio >= 4.5, `${fg} on ${bg} is ${ratio.toFixed(2)}:1, needs 4.5:1`);
  }
});

// Done means 7 (the part a script can check): the page scales and stacks on narrow screens.
test('the page declares a viewport and stacks the queue on narrow screens', () => {
  assert.match(html, /<meta[^>]+name=["']viewport["'][^>]+width=device-width/);
  assert.match(css, /@media\s*\(max-width:\s*(\d+)px\)/);
  const widths = [...css.matchAll(/@media\s*\(max-width:\s*(\d+)px\)/g)].map((m) => Number(m[1]));
  assert.ok(widths.some((w) => w >= 600 && w <= 900), 'a breakpoint between 600 and 900px');
});

test('keyboard: nothing forces a custom tab order and every control is native', () => {
  assert.ok(!/tabindex\s*=\s*["']?[1-9]/i.test(html), 'positive tabindex found');
  assert.ok(!/<div[^>]+onclick|<span[^>]+onclick/i.test(html), 'a div or span acts as a button');
  assert.match(css, /:focus-visible/);
});

// Done means 5 (full): with no Overdue leads there is no red at all, including the Overdue number.
test('the Overdue card is red only while at least one lead is Overdue', () => {
  for (const { selector, body } of ruleBlocks(css)) {
    if (selector === ':root') continue;
    if (/var\(\s*--overdue/.test(body) && /kpi-overdue/.test(selector)) {
      assert.ok(/has-overdue/.test(selector), `"${selector}" colours the Overdue card without checking for Overdue leads`);
    }
  }
  assert.match(appJs, /classList\.toggle\(\s*['"]has-overdue['"]\s*,\s*[^)]*overdue\s*>\s*0/, 'app.js switches the red on only when the count is above zero');
});

// Rules: scoring rules are defined once; the page text that states them is generated.
test('the HTML and the page script do not repeat scoring rules as fixed text', () => {
  for (const [name, text] of [['index.html', html], ['src/app.js', appJs]]) {
    assert.ok(!/Referral\s+30|Webinar\s+25|\b48h|\b70 and above|out of 100|up to 30|up to 25|up to 20/.test(text), `${name} states a scoring rule as fixed text`);
  }
});

// Where: the layout changes exactly where SPEC.md says (1023px and 760px).
test('layout breakpoints match the spec: side column moves below at 1023px, cards at 760px', () => {
  const widths = [...css.matchAll(/@media\s*\(max-width:\s*(\d+)px\)/g)].map((m) => Number(m[1]));
  assert.ok(widths.includes(1023), 'a max-width: 1023px breakpoint');
  assert.ok(widths.includes(760), 'a max-width: 760px breakpoint');
  assert.match(css, /@media\s*\(min-width:\s*1024px\)/, 'the sticky side column starts at 1024px');
});
