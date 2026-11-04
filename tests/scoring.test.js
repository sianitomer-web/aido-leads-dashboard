const test = require('node:test');
const assert = require('node:assert/strict');
const Scoring = require('../src/scoring.js');

// "Now" for every test. The code never reads the real clock.
const AS_OF = '2026-11-04T09:00:00Z';

// Time helpers: an ISO timestamp this many hours (and minutes) before AS_OF.
function ago(hours, minutes = 0) {
  const ms = Date.parse(AS_OF) - (hours * 60 + minutes) * 60 * 1000;
  return new Date(ms).toISOString();
}

function lead(fields) {
  return {
    id: 'x',
    name: 'Test Lead',
    country: 'Canada',
    created_at: ago(200),
    ...fields,
  };
}

// Five reference leads, scored by hand (see SPEC.md, "Priority score").
const reference = {
  // 30 (Referral) + 25 (100% complete) + 25 (booked) + 0 (contacted 2h ago) = 80
  L1: lead({ id: 'L1', source: 'Referral', stage: 'Consultation booked', completeness: 100, engagement: 'booked', last_contact_at: ago(2) }),
  // 15 (Meta) + 10 (40% -> 10) + 0 (none) + 20 (50h untouched) = 45
  L2: lead({ id: 'L2', source: 'Meta', stage: 'New', completeness: 40, engagement: 'none', last_contact_at: ago(50) }),
  // 10 (Organic) + 23 (90% -> 22.5, half up) + 15 (replied) + 10 (30h untouched) = 58
  L3: lead({ id: 'L3', source: 'Organic', stage: 'Contacted', completeness: 90, engagement: 'replied', last_contact_at: ago(30) }),
  // 25 (Webinar) + 0 (0%) + 0 (none) + 20 (exactly 48:00h untouched) = 45
  L4: lead({ id: 'L4', source: 'Webinar', stage: 'New', completeness: 0, engagement: 'none', last_contact_at: ago(48) }),
  // 20 (Google Search) + 15 (60%) + 15 (replied) + 10 (47:59h untouched) = 60
  L5: lead({ id: 'L5', source: 'Google Search', stage: 'Contacted', completeness: 60, engagement: 'replied', last_contact_at: ago(47, 59) }),
};

// Done means 2: scores equal the hand-computed values, to the point.
test('priority score matches the hand-computed value for each reference lead', () => {
  assert.equal(Scoring.scoreLead(reference.L1, AS_OF), 80);
  assert.equal(Scoring.scoreLead(reference.L2, AS_OF), 45);
  assert.equal(Scoring.scoreLead(reference.L3, AS_OF), 58);
  assert.equal(Scoring.scoreLead(reference.L4, AS_OF), 45);
  assert.equal(Scoring.scoreLead(reference.L5, AS_OF), 60);
});

test('score breakdown lists the four parts and they add up to the score', () => {
  const b = Scoring.scoreBreakdown(reference.L3, AS_OF);
  assert.deepEqual(b, { source: 10, completeness: 23, engagement: 15, urgency: 10 });
  assert.equal(b.source + b.completeness + b.engagement + b.urgency, Scoring.scoreLead(reference.L3, AS_OF));
});

test('bands: Hot from 70, Warm from 40, Cool below', () => {
  assert.equal(Scoring.bandFor(100), 'Hot');
  assert.equal(Scoring.bandFor(70), 'Hot');
  assert.equal(Scoring.bandFor(69), 'Warm');
  assert.equal(Scoring.bandFor(40), 'Warm');
  assert.equal(Scoring.bandFor(39), 'Cool');
  assert.equal(Scoring.bandFor(0), 'Cool');
});

// Done means 3: the 48-hour boundary, and closed leads.
test('a lead last contacted exactly 48:00h before as_of is Overdue; at 47:59h it is not', () => {
  assert.equal(Scoring.isOverdue(reference.L4, AS_OF), true);
  assert.equal(Scoring.isOverdue(reference.L5, AS_OF), false);
  assert.equal(Scoring.isOverdue(reference.L2, AS_OF), true);
});

test('Won and Lost leads are never Overdue and are not scored', () => {
  const won = lead({ id: 'W', source: 'Referral', stage: 'Won', completeness: 100, engagement: 'booked', last_contact_at: ago(100) });
  const lost = lead({ id: 'Z', source: 'Meta', stage: 'Lost', completeness: 10, engagement: 'none', last_contact_at: ago(300) });
  assert.equal(Scoring.isOverdue(won, AS_OF), false);
  assert.equal(Scoring.isOverdue(lost, AS_OF), false);
  assert.equal(Scoring.scoreLead(won, AS_OF), null);
  assert.equal(Scoring.scoreLead(lost, AS_OF), null);
});

// Done means 1: highest score first; ties go to the oldest last contact.
test('queue is ordered by score, highest first, ties by oldest last contact, closed leads excluded', () => {
  const cool = lead({ id: 'L6', source: 'Organic', stage: 'New', completeness: 20, engagement: 'none', last_contact_at: ago(1) }); // 10 + 5 + 0 + 0 = 15
  const won = lead({ id: 'W', source: 'Referral', stage: 'Won', completeness: 100, engagement: 'booked', last_contact_at: ago(100) });
  const input = [reference.L4, won, reference.L2, cool, reference.L5, reference.L1, reference.L3];
  const queue = Scoring.buildQueue(input, AS_OF);
  // L2 and L4 both score 45; L2 was last contacted 50h ago, L4 48h ago, so L2 comes first.
  assert.deepEqual(queue.map((q) => q.lead.id), ['L1', 'L5', 'L3', 'L2', 'L4', 'L6']);
  assert.deepEqual(queue.map((q) => q.score), [80, 60, 58, 45, 45, 15]);
  assert.deepEqual(queue.map((q) => q.band), ['Hot', 'Warm', 'Warm', 'Warm', 'Warm', 'Cool']);
});

test('hours since last contact is measured from as_of, not from the real clock', () => {
  assert.equal(Scoring.hoursSince(ago(5, 30), AS_OF), 5.5);
});

test('queue does not modify its input', () => {
  const input = [reference.L2, reference.L1];
  const copy = JSON.stringify(input);
  Scoring.buildQueue(input, AS_OF);
  assert.equal(JSON.stringify(input), copy);
});
