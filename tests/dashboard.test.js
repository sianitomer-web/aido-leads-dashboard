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
