const test = require('node:test');
const assert = require('node:assert/strict');
const data = require('../data/leads.js');
const Scoring = require('../src/scoring.js');

const COUNTRIES = ['Canada', 'Australia'];
const SOURCES = Object.keys(Scoring.SOURCE_POINTS);
const STAGES = ['New', 'Contacted', 'Consultation booked', 'Proposal sent', 'Won', 'Lost'];
const ENGAGEMENT = Object.keys(Scoring.ENGAGEMENT_POINTS);

test('data file defines as_of, a company name and about 60 leads', () => {
  assert.ok(!Number.isNaN(Date.parse(data.as_of)), 'as_of is a valid timestamp');
  assert.equal(data.company, 'Harbor Migration');
  assert.ok(data.leads.length >= 55 && data.leads.length <= 65, `got ${data.leads.length} leads`);
});

test('every lead has valid fields and ids are unique', () => {
  const ids = new Set();
  for (const lead of data.leads) {
    assert.ok(!ids.has(lead.id), `duplicate id ${lead.id}`);
    ids.add(lead.id);
    assert.ok(lead.name && lead.name.trim().length > 0, `${lead.id} has a name`);
    assert.ok(COUNTRIES.includes(lead.country), `${lead.id} country`);
    assert.ok(SOURCES.includes(lead.source), `${lead.id} source`);
    assert.ok(STAGES.includes(lead.stage), `${lead.id} stage`);
    assert.ok(ENGAGEMENT.includes(lead.engagement), `${lead.id} engagement`);
    assert.ok(Number.isInteger(lead.completeness) && lead.completeness >= 0 && lead.completeness <= 100, `${lead.id} completeness`);
  }
});

test('timestamps are valid, ordered, and never later than as_of', () => {
  const asOf = Date.parse(data.as_of);
  for (const lead of data.leads) {
    const created = Date.parse(lead.created_at);
    const contact = Date.parse(lead.last_contact_at);
    assert.ok(!Number.isNaN(created) && !Number.isNaN(contact), `${lead.id} timestamps parse`);
    assert.ok(created <= contact, `${lead.id} created before last contact`);
    assert.ok(contact <= asOf, `${lead.id} last contact not in the future`);
  }
});

test('the queue builds from the data with no missing scores', () => {
  const queue = Scoring.buildQueue(data.leads, data.as_of);
  assert.equal(queue.length, data.leads.filter(Scoring.isOpen).length);
  for (const item of queue) {
    assert.ok(Number.isInteger(item.score) && item.score >= 0 && item.score <= 100, `${item.lead.id} score`);
  }
});

// The demo only works if there is something to see in every part of the board.
test('the data covers every stage, every band, overdue leads and new leads', () => {
  const queue = Scoring.buildQueue(data.leads, data.as_of);
  for (const stage of STAGES) {
    assert.ok(data.leads.some((l) => l.stage === stage), `has a ${stage} lead`);
  }
  for (const band of ['Hot', 'Warm', 'Cool']) {
    assert.ok(queue.some((q) => q.band === band), `has a ${band} lead`);
  }
  assert.ok(queue.filter((q) => q.overdue).length >= 5, 'at least 5 overdue leads');
  assert.ok(queue.filter((q) => q.overdue).length < queue.length / 2, 'fewer than half of open leads are overdue');
  const newIn24h = data.leads.filter((l) => Scoring.isOpen(l) && Scoring.hoursSince(l.created_at, data.as_of) < 24);
  assert.ok(newIn24h.length >= 3, 'at least 3 leads created in the last 24h');
});
