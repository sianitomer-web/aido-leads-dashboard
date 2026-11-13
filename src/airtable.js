// Loads the leads from the Airtable table. Read-only: one GET request per page of results.
(function (root) {
  'use strict';

  const API = 'https://api.airtable.com/v0';
  // The columns a table needs, with what each one holds. The Connection panel lists them from here.
  const COLUMNS = [
    { name: 'id', type: 'text, one per lead (for example L001)' },
    { name: 'name', type: 'text' },
    { name: 'country', type: 'text or single select: Canada, Australia' },
    { name: 'source', type: 'text or single select: Referral, Webinar, Google Search, Meta, Organic' },
    { name: 'created_at', type: 'date with time (UTC), or text such as 2026-10-06 19:09 (read as UTC)' },
    { name: 'last_contact_at', type: 'date with time (UTC), or text such as 2026-10-14 16:32 (read as UTC)' },
    { name: 'stage', type: 'text or single select: New, Contacted, Consultation booked, Proposal sent, Won, Lost' },
    { name: 'completeness', type: 'number from 0 to 100' },
    { name: 'engagement', type: 'text or single select: none, replied, booked' },
  ];
  const REQUIRED = COLUMNS.map((column) => column.name);

  // A time written without a zone, such as "2026-10-25 08:58" (what a CSV import produces) or a date
  // alone, is UTC. A browser would read it as local time and shift every number, so it is made explicit.
  // A time that already has a zone (Z or +02:00) is left as it is.
  function toUtc(value) {
    const match = String(value).trim().match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2})(?::(\d{2}))?)?$/);
    return match ? `${match[1]}T${match[2] || '00:00'}:${match[3] || '00'}Z` : String(value).trim();
  }

  // One Airtable row becomes one lead. A row with an empty required cell is rejected, never guessed.
  function toLead(record) {
    const f = record.fields || {};
    const missing = REQUIRED.filter((key) => f[key] === undefined || f[key] === null || f[key] === '');
    if (missing.length > 0) {
      throw new Error(`Airtable row ${record.id} has an empty cell: ${missing.join(', ')}.`);
    }
    const times = {};
    for (const key of ['created_at', 'last_contact_at']) {
      times[key] = toUtc(f[key]);
      if (Number.isNaN(Date.parse(times[key]))) {
        throw new Error(`Airtable row ${record.id} has a time that cannot be read: ${key}.`);
      }
    }
    return {
      id: f.id,
      name: f.name,
      country: f.country,
      source: f.source,
      created_at: times.created_at,
      last_contact_at: times.last_contact_at,
      stage: f.stage,
      completeness: f.completeness,
      engagement: f.engagement,
    };
  }

  // Reads every page of the table and returns the leads. Messages never contain the token.
  async function loadLeads(config, fetchFn) {
    if (!config || !config.token || !config.baseId || !config.tableId || config.token === 'PASTE_TOKEN_HERE') {
      throw new Error('The Airtable settings are missing. Add airtable-config.js with a read-only token.');
    }
    const doFetch = fetchFn || root.fetch.bind(root);
    const leads = [];
    let offset = null;
    do {
      let url = `${API}/${config.baseId}/${config.tableId}?pageSize=100`;
      if (offset) url += `&offset=${encodeURIComponent(offset)}`;
      let response;
      try {
        response = await doFetch(url, { method: 'GET', headers: { Authorization: `Bearer ${config.token}` } });
      } catch (err) {
        throw new Error('Could not reach Airtable. Check the connection and try again.');
      }
      if (!response.ok) {
        throw new Error(
          response.status === 401 || response.status === 403
            ? 'Airtable refused the token. Check that it is valid and can read this base.'
            : `Airtable answered with an error (${response.status}).`
        );
      }
      const body = await response.json();
      body.records.forEach((record) => leads.push(toLead(record)));
      offset = body.offset || null;
    } while (offset);
    return leads;
  }

  const api = { loadLeads, toLead, COLUMNS };
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.AirtableSource = api;
  }
})(typeof self !== 'undefined' ? self : globalThis);
