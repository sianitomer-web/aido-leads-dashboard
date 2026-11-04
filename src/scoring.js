// Priority score, bands, Overdue rule and queue order.
// All scoring rules live in this file (see SPEC.md, "Priority score").
// A plain script: it works in a browser (global `Scoring`) and in Node (`require`).
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.Scoring = api;
  }
})(typeof self !== 'undefined' ? self : globalThis, function () {
  const SOURCE_POINTS = {
    'Referral': 30,
    'Webinar': 25,
    'Google Search': 20,
    'Meta': 15,
    'Organic': 10,
  };

  const ENGAGEMENT_POINTS = { booked: 25, replied: 15, none: 0 };

  const CLOSED_STAGES = ['Won', 'Lost'];
  const OVERDUE_HOURS = 48;
  const WARNING_HOURS = 24;
  const HOT_FROM = 70;
  const WARM_FROM = 40;

  function isOpen(lead) {
    return !CLOSED_STAGES.includes(lead.stage);
  }

  // Hours between the lead's last contact and `asOf`. Never reads the real clock.
  function hoursSince(timestamp, asOf) {
    return (Date.parse(asOf) - Date.parse(timestamp)) / (60 * 60 * 1000);
  }

  function isOverdue(lead, asOf) {
    return isOpen(lead) && hoursSince(lead.last_contact_at, asOf) >= OVERDUE_HOURS;
  }

  function urgencyPoints(lead, asOf) {
    const hours = hoursSince(lead.last_contact_at, asOf);
    if (hours >= OVERDUE_HOURS) return 20;
    if (hours >= WARNING_HOURS) return 10;
    return 0;
  }

  // The four parts of the score, or null for Won and Lost leads.
  function scoreBreakdown(lead, asOf) {
    if (!isOpen(lead)) return null;
    return {
      source: SOURCE_POINTS[lead.source],
      completeness: Math.round(lead.completeness * 0.25), // half up
      engagement: ENGAGEMENT_POINTS[lead.engagement],
      urgency: urgencyPoints(lead, asOf),
    };
  }

  function scoreLead(lead, asOf) {
    const parts = scoreBreakdown(lead, asOf);
    if (!parts) return null;
    return parts.source + parts.completeness + parts.engagement + parts.urgency;
  }

  function bandFor(score) {
    if (score >= HOT_FROM) return 'Hot';
    if (score >= WARM_FROM) return 'Warm';
    return 'Cool';
  }

  // Open leads, highest score first. Ties: oldest last contact first, then id.
  function buildQueue(leads, asOf) {
    return leads
      .filter(isOpen)
      .map((lead) => {
        const score = scoreLead(lead, asOf);
        return {
          lead,
          score,
          band: bandFor(score),
          breakdown: scoreBreakdown(lead, asOf),
          overdue: isOverdue(lead, asOf),
          hoursSinceContact: hoursSince(lead.last_contact_at, asOf),
        };
      })
      .sort((a, b) =>
        b.score - a.score ||
        Date.parse(a.lead.last_contact_at) - Date.parse(b.lead.last_contact_at) ||
        String(a.lead.id).localeCompare(String(b.lead.id))
      );
  }

  return {
    SOURCE_POINTS,
    ENGAGEMENT_POINTS,
    OVERDUE_HOURS,
    isOpen,
    hoursSince,
    isOverdue,
    scoreBreakdown,
    scoreLead,
    bandFor,
    buildQueue,
  };
});
