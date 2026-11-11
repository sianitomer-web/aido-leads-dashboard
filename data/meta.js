// The company name and the "now" time of the dashboard. The leads themselves come from Airtable.
// `as_of` is "now" for the whole dashboard: nothing reads the real clock.
(function (root) {
  const meta = {
    as_of: "2026-11-04T09:00:00Z",
    company: "Harbor Migration"
  };
  if (typeof module === 'object' && module.exports) {
    module.exports = meta;
  } else {
    root.LEADS_META = meta;
  }
})(typeof self !== 'undefined' ? self : globalThis);
