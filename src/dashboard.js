// Numbers and labels for the page, computed from the data. No DOM in this file.
// A plain script: it works in a browser (global `Dashboard`) and in Node (`require`).
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./scoring.js') : root.Scoring);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.Dashboard = api;
  }
})(typeof self !== 'undefined' ? self : globalThis, function (Scoring) {
  const STAGES = ['New', 'Contacted', 'Consultation booked', 'Proposal sent', 'Won', 'Lost'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MAX_REASONS = 3;

  // The four numbers at the top of the board.
  function kpis(leads, asOf) {
    const open = leads.filter(Scoring.isOpen);
    return {
      open: open.length,
      newToday: open.filter((l) => Scoring.hoursSince(l.created_at, asOf) < Scoring.RULES.newHours).length,
      overdue: open.filter((l) => Scoring.isOverdue(l, asOf)).length,
      hot: open.filter((l) => Scoring.bandFor(Scoring.scoreLead(l, asOf)) === 'Hot').length,
    };
  }

  // How many leads sit in each pipeline stage, in pipeline order.
  function stageCounts(leads) {
    return STAGES.map((stage) => ({ stage, count: leads.filter((l) => l.stage === stage).length }));
  }

  function ageLabel(hours) {
    if (hours < 1) return 'under 1h';
    return `${Math.floor(hours)}h`;
  }

  // Why a lead ranks where it does: its biggest score parts, largest first.
  function reasons(lead, parts, asOf) {
    const hours = Scoring.hoursSince(lead.last_contact_at, asOf);
    const engagementLabel = lead.engagement === 'booked' ? 'Consultation booked' : 'Replied';
    const all = [
      { label: lead.source, points: parts.source },
      { label: engagementLabel, points: parts.engagement },
      { label: `Profile ${lead.completeness}%`, points: parts.completeness },
      { label: `Untouched ${ageLabel(hours)}`, points: parts.urgency },
    ];
    return all
      .map((r, order) => ({ ...r, order }))
      .filter((r) => r.points > 0)
      .sort((a, b) => b.points - a.points || a.order - b.order)
      .slice(0, MAX_REASONS)
      .map(({ label, points }) => ({ label, points }));
  }

  // Per source: how many leads, and how many reached a consultation
  // (stage Consultation booked, Proposal sent or Won). Closed leads are included.
  const REACHED_STAGES = ['Consultation booked', 'Proposal sent', 'Won'];

  function sourceQuality(leads) {
    return Object.keys(Scoring.SOURCE_POINTS)
      .map((source) => {
        const mine = leads.filter((l) => l.source === source);
        const reached = mine.filter((l) => REACHED_STAGES.includes(l.stage)).length;
        return {
          source,
          leads: mine.length,
          reached,
          share: mine.length === 0 ? 0 : Math.round((reached / mine.length) * 100),
        };
      })
      .sort((a, b) => b.share - a.share || b.leads - a.leads);
  }

  // The four parts of one lead's score, each with its maximum and a plain-words note.
  function breakdownRows(lead, parts, asOf) {
    const hours = Scoring.hoursSince(lead.last_contact_at, asOf);
    const engagementNote = { booked: 'Consultation booked', replied: 'Replied', none: 'No reply yet' }[lead.engagement];
    const max = Scoring.maxPoints();
    return [
      { label: 'Source', points: parts.source, max: max.source, note: lead.source },
      { label: 'Profile', points: parts.completeness, max: max.completeness, note: `${lead.completeness}% of the intake form answered` },
      { label: 'Engagement', points: parts.engagement, max: max.engagement, note: engagementNote },
      { label: 'Urgency', points: parts.urgency, max: max.urgency, note: `Untouched ${ageLabel(hours)}` },
    ];
  }

  // The values each filter can take, in a fixed order.
  function filterOptions() {
    return {
      sources: Object.keys(Scoring.SOURCE_POINTS),
      stages: STAGES.filter((stage) => stage !== 'Won' && stage !== 'Lost'),
      bands: ['Hot', 'Warm', 'Cool'],
      countries: ['Canada', 'Australia'],
    };
  }

  // The scoring rules in words, generated from Scoring.RULES so they cannot drift from the code.
  function scoreRules() {
    const r = Scoring.RULES;
    const max = Scoring.maxPoints();
    const pairs = (obj) => Object.entries(obj).map(([name, points]) => `${name} ${points}`).join(', ');
    return [
      `Source, up to ${max.source}: ${pairs(r.sourcePoints)}`,
      `Profile, up to ${max.completeness}: share of the intake form answered`,
      `Engagement, up to ${max.engagement}: ${pairs(r.engagementPoints)}`,
      `Urgency, up to ${max.urgency}: ${r.overdueHours}h or more since contact ${r.urgencyPoints.overdue}, ` +
        `${r.warningHours}h to ${r.overdueHours}h ${r.urgencyPoints.warning}`,
      `Hot is ${r.hotFrom} and above, Warm ${r.warmFrom} to ${r.hotFrom - 1}, Cool below ${r.warmFrom}.`,
    ];
  }

  // The small note under each top number, generated from the same rules.
  function kpiNotes() {
    const r = Scoring.RULES;
    return {
      newToday: `created in the last ${r.newHours}h`,
      overdue: `no contact for ${r.overdueHours}h or more`,
      hot: `score ${r.hotFrom} and above`,
    };
  }

  // Lower-case and strip accents, so "tomas" finds "Tomás".
  function fold(text) {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  // Keeps the queue items that match every active filter. Ranks are not renumbered.
  // A filter set to 'all' (or an empty search) is not active.
  function filterQueue(queue, filters) {
    const query = fold((filters.query || '').trim());
    return queue.filter((item) => {
      const { lead, band } = item;
      return (
        (filters.source === 'all' || lead.source === filters.source) &&
        (filters.stage === 'all' || lead.stage === filters.stage) &&
        (filters.band === 'all' || band === filters.band) &&
        (filters.country === 'all' || lead.country === filters.country) &&
        (query === '' || fold(lead.name).includes(query))
      );
    });
  }

  // "4 Nov 2026, 09:00 UTC", from the data's own timestamp.
  function formatAsOf(timestamp) {
    const d = new Date(timestamp);
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${hh}:${mm} UTC`;
  }

  return { STAGES, kpis, stageCounts, ageLabel, reasons, breakdownRows, sourceQuality, scoreRules, kpiNotes, filterOptions, filterQueue, formatAsOf };
});
