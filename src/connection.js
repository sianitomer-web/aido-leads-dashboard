// The Connection panel's settings: which Airtable base the board reads from.
// They are kept in the browser's local storage only, and they override the built-in connection
// until they are forgotten. Nothing here sends anything anywhere.
(function (root) {
  'use strict';

  const KEY = 'harborLeadsConnection';

  // Returns a short message for the first problem, or '' when the settings look right.
  // The message never contains what the user typed.
  function validate(settings) {
    if (!/^app[A-Za-z0-9]{14}$/.test(settings.baseId)) {
      return 'The Base ID starts with "app" and has 17 characters. You can see it in the address bar of your base.';
    }
    if (!/^tbl[A-Za-z0-9]{14}$/.test(settings.tableId)) {
      return 'The Table ID starts with "tbl" and has 17 characters. You can see it in the address bar of your table.';
    }
    if (!/^pat[A-Za-z0-9]+\.[A-Za-z0-9]+$/.test(settings.token)) {
      return 'A token starts with "pat" and has one dot. Create it in Airtable under Builder hub, Personal access tokens, with the data.records:read scope for your base.';
    }
    return '';
  }

  // The saved settings, or null when nothing valid is saved or the browser does not allow storage.
  function load(storage) {
    try {
      const saved = JSON.parse(storage.getItem(KEY));
      if (saved && !validate(saved)) return { token: saved.token, baseId: saved.baseId, tableId: saved.tableId };
    } catch (error) {
      // no storage, or unreadable content: behave as if nothing is saved
    }
    return null;
  }

  function save(storage, settings) {
    const clean = {
      baseId: String(settings.baseId || '').trim(),
      tableId: String(settings.tableId || '').trim(),
      token: String(settings.token || '').trim(),
    };
    const problem = validate(clean);
    if (problem) throw new Error(problem);
    storage.setItem(KEY, JSON.stringify(clean));
  }

  function forget(storage) {
    try {
      storage.removeItem(KEY);
    } catch (error) {
      // nothing to remove
    }
  }

  // Saved settings win over the built-in ones.
  function resolve(builtIn, storage) {
    const saved = storage ? load(storage) : null;
    return saved ? { config: saved, source: 'saved' } : { config: builtIn, source: 'built-in' };
  }

  const api = { KEY, validate, load, save, forget, resolve };
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.Connection = api;
  }
})(typeof self !== 'undefined' ? self : globalThis);
