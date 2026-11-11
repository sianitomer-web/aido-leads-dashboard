// Loads the leads from the Airtable table. Read-only: one GET request per page of results.
(function (root) {
  'use strict';

  const API = 'https://api.airtable.com/v0';
  const REQUIRED = ['id', 'name', 'country', 'source', 'created_at', 'last_contact_at', 'stage', 'completeness', 'engagement'];

  // One Airtable row becomes one lead. A row with an empty required cell is rejected, never guessed.
  function toLead(record) {
    const f = record.fields || {};
    const missing = REQUIRED.filter((key) => f[key] === undefined || f[key] === null || f[key] === '');
    if (missing.length > 0) {
      throw new Error(`Airtable row ${record.id} has an empty cell: ${missing.join(', ')}.`);
    }
    return {
      id: f.id,
      name: f.name,
      country: f.country,
      source: f.source,
      created_at: f.created_at,
      last_contact_at: f.last_contact_at,
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

  const api = { loadLeads, toLead };
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.AirtableSource = api;
  }
})(typeof self !== 'undefined' ? self : globalThis);
