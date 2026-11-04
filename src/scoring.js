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
  // Every scoring rule lives here and nowhere else. Text on the page that
  // states a rule is generated from this object (see Dashboard.scoreRules).
  const RULES = {
    sourcePoints: {
      'Referral': 30,
      'Webinar': 25,
      'Google Search': 20,
      'Meta': 15,
      'Organic': 10,
    },
    engagementPoints: { booked: 25, replied: 15, none: 0 },
    completenessWeight: 0.25,
    urgencyPoints: { overdue: 20, warning: 10 },
    overdueHours: 48,
    warningHours: 24,
    newHours: 24,
    hotFrom: 70,
    warmFrom: 40,
    closedStages: ['Won', 'Lost'],
  };

  // Largest possible points for each part, and for the whole score.
  function maxPoints() {
    return {
      source: Math.max(...Object.values(RULES.sourcePoints)),
      completeness: Math.round(100 * RULES.completenessWeight),
      engagement: Math.max(...Object.values(RULES.engagementPoints)),
      urgency: Math.max(...Object.values(RULES.urgencyPoints)),
    };
  }

  function maxScore() {
    const max = maxPoints();
    return max.source + max.completeness + max.engagement + max.urgency;
  }

  function isOpen(lead) {
    return !RULES.closedStages.includes(lead.stage);
  }

  // Hours between the lead's last contact and `asOf`. Never reads the real clock.
  function hoursSince(timestamp, asOf) {
    return (Date.parse(asOf) - Date.parse(timestamp)) / (60 * 60 * 1000);
  }

  function isOverdue(lead, asOf) {
    return isOpen(lead) && hoursSince(lead.last_contact_at, asOf) >= RULES.overdueHours;
  }

  function urgencyPoints(lead, asOf) {
    const hours = hoursSince(lead.last_contact_at, asOf);
    if (hours >= RULES.overdueHours) return RULES.urgencyPoints.overdue;
    if (hours >= RULES.warningHours) return RULES.urgencyPoints.warning;
    return 0;
  }

  // The four parts of the score, or null for Won and Lost leads.
  function scoreBreakdown(lead, asOf) {
    if (!isOpen(lead)) return null;
    return {
      source: RULES.sourcePoints[lead.source],
      completeness: Math.round(lead.completeness * RULES.completenessWeight), // half up
      engagement: RULES.engagementPoints[lead.engagement],
      urgency: urgencyPoints(lead, asOf),
    };
  }

  function scoreLead(lead, asOf) {
    const parts = scoreBreakdown(lead, asOf);
    if (!parts) return null;
    return parts.source + parts.completeness + parts.engagement + parts.urgency;
  }

  function bandFor(score) {
    if (score >= RULES.hotFrom) return 'Hot';
    if (score >= RULES.warmFrom) return 'Warm';
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
      )
      .map((item, index) => ({ ...item, rank: index + 1 }));
  }

  return {
    RULES,
    SOURCE_POINTS: RULES.sourcePoints,
    ENGAGEMENT_POINTS: RULES.engagementPoints,
    maxPoints,
    maxScore,
    isOpen,
    hoursSince,
    isOverdue,
    scoreBreakdown,
    scoreLead,
    bandFor,
    buildQueue,
  };
});
