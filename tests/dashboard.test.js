const test = require('node:test');
const assert = require('node:assert/strict');
const data = require('../data/leads.js');
const Scoring = require('../src/scoring.js');
const Dashboard = require('../src/dashboard.js');

const AS_OF = data.as_of;

// Done means 4: the four top numbers equal counts taken directly from the data.
test('the four top numbers equal counts taken directly from the data', () => {
  const k = Dashboard.kpis(data.leads, AS_OF);

  const open = data.leads.filter((l) => l.stage !== 'Won' && l.stage !== 'Lost');
  const hoursOld = (l) => (Date.parse(AS_OF) - Date.parse(l.created_at)) / 3600000;
  const lastContact = (l) => (Date.parse(AS_OF) - Date.parse(l.last_contact_at)) / 3600000;

  assert.equal(k.open, open.length);
  assert.equal(k.newToday, open.filter((l) => hoursOld(l) < 24).length);
  assert.equal(k.overdue, open.filter((l) => lastContact(l) >= 48).length);
  assert.equal(k.hot, open.filter((l) => Scoring.scoreLead(l, AS_OF) >= 70).length);
});

test('the top numbers follow the data: removing overdue leads removes the overdue count', () => {
  const withoutOverdue = data.leads.filter((l) => !Scoring.isOverdue(l, AS_OF));
  assert.equal(Dashboard.kpis(withoutOverdue, AS_OF).overdue, 0);
  assert.equal(Dashboard.kpis([], AS_OF).open, 0);
});

test('pipeline counts cover all six stages in order and add up to every lead', () => {
  const counts = Dashboard.stageCounts(data.leads);
  assert.deepEqual(
    counts.map((c) => c.stage),
    ['New', 'Contacted', 'Consultation booked', 'Proposal sent', 'Won', 'Lost']
  );
  assert.equal(counts.reduce((sum, c) => sum + c.count, 0), data.leads.length);
  for (const c of counts) {
    assert.equal(c.count, data.leads.filter((l) => l.stage === c.stage).length);
  }
});

test('reasons name the biggest contributors to the score, largest first, at most three', () => {
  const lead = {
    id: 'R', name: 'Reason Test', country: 'Canada', source: 'Referral', stage: 'Consultation booked',
    completeness: 90, engagement: 'booked', created_at: '2026-10-20T09:00:00Z', last_contact_at: '2026-11-02T04:00:00Z',
  };
  // 30 + 23 + 25 + 20 (untouched 53h) = 98
  const parts = Scoring.scoreBreakdown(lead, AS_OF);
  const reasons = Dashboard.reasons(lead, parts, AS_OF);
  assert.equal(reasons.length, 3);
  assert.deepEqual(reasons.map((r) => r.points), [30, 25, 23]);
  assert.equal(reasons[0].label, 'Referral');
  assert.equal(reasons[1].label, 'Consultation booked');
});

test('reasons skip parts worth zero points', () => {
  const lead = {
    id: 'Q', name: 'Quiet Test', country: 'Canada', source: 'Organic', stage: 'New',
    completeness: 0, engagement: 'none', created_at: '2026-11-04T08:00:00Z', last_contact_at: '2026-11-04T08:00:00Z',
  };
  const reasons = Dashboard.reasons(lead, Scoring.scoreBreakdown(lead, AS_OF), AS_OF);
  assert.deepEqual(reasons.map((r) => r.label), ['Organic']);
});

test('age label shows hours since last contact', () => {
  assert.equal(Dashboard.ageLabel(0.4), 'under 1h');
  assert.equal(Dashboard.ageLabel(5.9), '5h');
  assert.equal(Dashboard.ageLabel(47.99), '47h');
  assert.equal(Dashboard.ageLabel(48), '48h');
  assert.equal(Dashboard.ageLabel(120.5), '120h');
});

test('as_of is formatted from the data, not from the real clock', () => {
  assert.equal(Dashboard.formatAsOf('2026-11-04T09:00:00Z'), '4 Nov 2026, 09:00 UTC');
});

// ---------- Filters and search (Done means 9) ----------

const fullQueue = () => Scoring.buildQueue(data.leads, AS_OF);
const ALL = { source: 'all', stage: 'all', band: 'all', country: 'all', query: '' };

test('with no filters the whole queue is returned unchanged', () => {
  const queue = fullQueue();
  assert.deepEqual(Dashboard.filterQueue(queue, ALL), queue);
});

test('every lead shown matches all active filters, and none that match are missing', () => {
  const queue = fullQueue();
  const filters = { ...ALL, source: 'Meta', country: 'Canada' };
  const shown = Dashboard.filterQueue(queue, filters);
  const expected = queue.filter((q) => q.lead.source === 'Meta' && q.lead.country === 'Canada');
  assert.ok(expected.length > 0, 'the data has Meta leads in Canada');
  assert.deepEqual(shown.map((q) => q.lead.id), expected.map((q) => q.lead.id));

  const byBand = Dashboard.filterQueue(queue, { ...ALL, band: 'Hot' });
  assert.ok(byBand.length > 0 && byBand.every((q) => q.band === 'Hot'));
  const byStage = Dashboard.filterQueue(queue, { ...ALL, stage: 'Proposal sent' });
  assert.ok(byStage.length > 0 && byStage.every((q) => q.lead.stage === 'Proposal sent'));
});

test('a lead keeps its rank from the full queue when filtered', () => {
  const queue = fullQueue();
  const shown = Dashboard.filterQueue(queue, { ...ALL, source: 'Organic' });
  for (const item of shown) {
    assert.equal(item.rank, queue.findIndex((q) => q.lead.id === item.lead.id) + 1);
  }
  assert.ok(shown.some((item) => item.rank > shown.length), 'ranks are not renumbered');
});

test('search matches part of a name, ignoring case and surrounding spaces', () => {
  const queue = fullQueue();
  const target = queue[3].lead;
  const piece = target.name.slice(2, 7).toUpperCase();
  const found = Dashboard.filterQueue(queue, { ...ALL, query: `  ${piece} ` });
  assert.ok(found.some((q) => q.lead.id === target.id));
  assert.ok(found.every((q) => q.lead.name.toLowerCase().includes(piece.toLowerCase())));
});

test('filters do not change the top numbers', () => {
  const before = Dashboard.kpis(data.leads, AS_OF);
  Dashboard.filterQueue(fullQueue(), { ...ALL, source: 'Referral', query: 'zzz' });
  assert.deepEqual(Dashboard.kpis(data.leads, AS_OF), before);
});

test('when nothing matches the result is an empty list', () => {
  assert.deepEqual(Dashboard.filterQueue(fullQueue(), { ...ALL, query: 'no such person' }), []);
});

test('filter options list the real values, in a fixed order', () => {
  const o = Dashboard.filterOptions();
  assert.deepEqual(o.sources, ['Referral', 'Webinar', 'Google Search', 'Meta', 'Organic']);
  assert.deepEqual(o.stages, ['New', 'Contacted', 'Consultation booked', 'Proposal sent']);
  assert.deepEqual(o.bands, ['Hot', 'Warm', 'Cool']);
  assert.deepEqual(o.countries, ['Canada', 'Australia']);
});

// ---------- Score breakdown for one lead (Done means 10) ----------

test('for every open lead the four parts add up to its score and the maximums add up to 100', () => {
  for (const item of fullQueue()) {
    const rows = Dashboard.breakdownRows(item.lead, item.breakdown, AS_OF);
    assert.equal(rows.length, 4, `${item.lead.id} has four parts`);
    assert.equal(rows.reduce((sum, r) => sum + r.points, 0), item.score, `${item.lead.id} points add up`);
    assert.equal(rows.reduce((sum, r) => sum + r.max, 0), 100, `${item.lead.id} maximums add up`);
    for (const r of rows) assert.ok(r.points >= 0 && r.points <= r.max, `${item.lead.id} ${r.label} within its maximum`);
  }
});

test('breakdown rows are named in a fixed order and explain each part in words', () => {
  const lead = {
    id: 'B', name: 'Breakdown Test', country: 'Australia', source: 'Webinar', stage: 'Contacted',
    completeness: 60, engagement: 'replied', created_at: '2026-10-20T09:00:00Z', last_contact_at: '2026-11-03T09:00:00Z',
  };
  // 25 + 15 + 15 + 10 (untouched exactly 24h) = 65
  const rows = Dashboard.breakdownRows(lead, Scoring.scoreBreakdown(lead, AS_OF), AS_OF);
  assert.deepEqual(rows.map((r) => r.label), ['Source', 'Profile', 'Engagement', 'Urgency']);
  assert.deepEqual(rows.map((r) => [r.points, r.max]), [[25, 30], [15, 25], [15, 25], [10, 20]]);
  assert.equal(rows[0].note, 'Webinar');
  assert.equal(rows[1].note, '60% of the intake form answered');
  assert.equal(rows[2].note, 'Replied');
  assert.equal(rows[3].note, 'Untouched 24h');
});

test('engagement note covers all three engagement values', () => {
  const base = { id: 'E', name: 'E', country: 'Canada', source: 'Meta', stage: 'New', completeness: 50, created_at: '2026-11-04T08:00:00Z', last_contact_at: '2026-11-04T08:00:00Z' };
  const noteFor = (engagement) => {
    const lead = { ...base, engagement };
    return Dashboard.breakdownRows(lead, Scoring.scoreBreakdown(lead, AS_OF), AS_OF)[2].note;
  };
  assert.equal(noteFor('booked'), 'Consultation booked');
  assert.equal(noteFor('replied'), 'Replied');
  assert.equal(noteFor('none'), 'No reply yet');
});

// ---------- Marketing panel: source quality (Done means 11) ----------

test('for each source the lead count and the share that reached a consultation come from the data', () => {
  const rows = Dashboard.sourceQuality(data.leads);
  const reachedStages = ['Consultation booked', 'Proposal sent', 'Won'];
  assert.deepEqual([...rows.map((r) => r.source)].sort(), Object.keys(Scoring.SOURCE_POINTS).sort());
  for (const row of rows) {
    const mine = data.leads.filter((l) => l.source === row.source);
    const reached = mine.filter((l) => reachedStages.includes(l.stage)).length;
    assert.equal(row.leads, mine.length, `${row.source} lead count`);
    assert.equal(row.reached, reached, `${row.source} reached count`);
    assert.equal(row.share, Math.round((reached / mine.length) * 100), `${row.source} share`);
  }
  assert.equal(rows.reduce((sum, r) => sum + r.leads, 0), data.leads.length, 'closed leads are counted too');
});

test('lost leads count in the total but never as having reached a consultation', () => {
  const leads = [
    { source: 'Meta', stage: 'Lost' },
    { source: 'Meta', stage: 'Won' },
    { source: 'Meta', stage: 'New' },
    { source: 'Meta', stage: 'Proposal sent' },
  ];
  const meta = Dashboard.sourceQuality(leads).find((r) => r.source === 'Meta');
  assert.deepEqual([meta.leads, meta.reached, meta.share], [4, 2, 50]);
});

test('a source with no leads shows zero and does not divide by zero', () => {
  const rows = Dashboard.sourceQuality([{ source: 'Meta', stage: 'Won' }]);
  const organic = rows.find((r) => r.source === 'Organic');
  assert.deepEqual([organic.leads, organic.reached, organic.share], [0, 0, 0]);
});

test('sources are listed best share first, then by number of leads', () => {
  const rows = Dashboard.sourceQuality(data.leads);
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1];
    const b = rows[i];
    assert.ok(a.share > b.share || (a.share === b.share && a.leads >= b.leads), `${a.source} before ${b.source}`);
  }
});
