// The company name. The leads themselves come from Airtable.
// "Now" is the browser's clock, read once when the page loads. To pin the whole dashboard
// to a fixed moment (a demo or a screenshot), add `as_of: "2026-11-04T09:00:00Z"` below.
(function (root) {
  const meta = {
    company: "Harbor Migration"
  };
  if (typeof module === 'object' && module.exports) {
    module.exports = meta;
  } else {
    root.LEADS_META = meta;
  }
})(typeof self !== 'undefined' ? self : globalThis);
