// Draws the board. All numbers come from Scoring and Dashboard, which read the leads loaded from Airtable.
(function () {
  'use strict';

  const meta = window.LEADS_META;

  // Settings saved in the Connection panel win over the built-in connection.
  let storage = null;
  try {
    storage = window.localStorage;
  } catch (error) {
    storage = null;
  }
  const connection = window.Connection.resolve(window.AIRTABLE_CONFIG, storage);
  let data = null; // company, as_of and the leads, set once Airtable has answered
  const Scoring = window.Scoring;
  const Dashboard = window.Dashboard;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function cell(className, ...children) {
    const td = el('td', className);
    children.forEach((child) => td.appendChild(child));
    return td;
  }

  function renderHeader() {
    document.getElementById('company').textContent = data.company;
    const time = document.getElementById('as-of');
    time.textContent = Dashboard.formatAsOf(data.as_of);
    time.setAttribute('datetime', data.as_of);
  }

  function renderKpis() {
    const k = Dashboard.kpis(data.leads, data.as_of);
    document.getElementById('kpi-open').textContent = k.open;
    document.getElementById('kpi-new').textContent = k.newToday;
    document.getElementById('kpi-overdue').textContent = k.overdue;
    document.getElementById('kpi-hot').textContent = k.hot;

    const notes = Dashboard.kpiNotes();
    document.getElementById('kpi-new-note').textContent = notes.newToday;
    document.getElementById('kpi-overdue-note').textContent = notes.overdue;
    document.getElementById('kpi-hot-note').textContent = notes.hot;

    // The Overdue card is styled only while at least one lead is Overdue.
    const overdueCard = document.querySelector('.kpi-overdue');
    overdueCard.classList.toggle('has-overdue', k.overdue > 0);
  }

  function renderRules() {
    const list = document.getElementById('how-rules');
    list.textContent = '';
    Dashboard.scoreRules().forEach((line) => list.appendChild(el('li', '', line)));
  }

  let fullQueue = [];
  const filters = { source: 'all', stage: 'all', band: 'all', country: 'all', query: '' };

  function renderQueue() {
    const body = document.getElementById('queue-body');
    body.textContent = '';
    const shown = Dashboard.filterQueue(fullQueue, filters);

    document.getElementById('count').textContent =
      shown.length === fullQueue.length
        ? `Showing all ${fullQueue.length} open leads`
        : `Showing ${shown.length} of ${fullQueue.length} open leads`;

    if (shown.length === 0) {
      const row = el('tr', 'empty-row');
      const td = el('td', 'empty', 'No leads match these filters.');
      td.setAttribute('colspan', '5');
      row.appendChild(td);
      body.appendChild(row);
      return;
    }

    shown.forEach((item) => {
      const { lead, score, band, breakdown, overdue, hoursSinceContact, rank } = item;
      const row = el('tr', overdue ? 'row-overdue' : '');

      const who = el('div', 'who');
      const detailId = `detail-${lead.id}`;
      const toggle = el('button', 'who-name', lead.name);
      toggle.type = 'button';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-controls', detailId);
      who.appendChild(toggle);
      who.appendChild(el('span', 'who-meta', `${lead.country} · ${lead.source}`));
      const leadWrap = el('div', 'lead-wrap');
      leadWrap.appendChild(el('span', 'rank', String(rank)));
      leadWrap.appendChild(who);
      const leadCell = cell('c-lead', leadWrap);

      const scoreCell = cell('c-score', el('span', 'score', String(score)), el('span', `band band-${band.toLowerCase()}`, band));

      const age = overdue
        ? el('span', 'age overdue-mark', `Overdue · ${Dashboard.ageLabel(hoursSinceContact)}`)
        : el('span', 'age', `${Dashboard.ageLabel(hoursSinceContact)} ago`);

      const why = el('ul', 'reasons');
      Dashboard.reasons(lead, breakdown, data.as_of).forEach((reason) => {
        const chip = el('li', 'reason');
        chip.appendChild(el('span', '', reason.label));
        chip.appendChild(el('b', '', `+${reason.points}`));
        why.appendChild(chip);
      });

      row.appendChild(leadCell);
      row.appendChild(cell('c-stage', el('span', '', lead.stage)));
      row.appendChild(scoreCell);
      row.appendChild(cell('c-age', age));
      row.appendChild(cell('c-why', why));
      body.appendChild(row);

      const detail = renderDetail(item, detailId);
      body.appendChild(detail);
      toggle.addEventListener('click', () => {
        const open = detail.hidden;
        detail.hidden = !open;
        toggle.setAttribute('aria-expanded', String(open));
      });
    });
  }

  // The four parts of one lead's score, shown when its name is opened.
  function renderDetail(item, id) {
    const row = el('tr', 'detail-row');
    row.id = id;
    row.hidden = true;
    const td = el('td', 'detail');
    td.setAttribute('colspan', '5');
    const list = el('ul', 'parts');
    Dashboard.breakdownRows(item.lead, item.breakdown, data.as_of).forEach((part) => {
      const li = el('li', 'part');
      const head = el('div', 'part-head');
      head.appendChild(el('span', 'part-name', part.label));
      head.appendChild(el('span', 'part-note', part.note));
      head.appendChild(el('b', 'part-points', `${part.points} / ${part.max}`));
      const track = el('div', 'bar');
      const fill = el('div', 'bar-fill');
      fill.style.width = `${(part.points / part.max) * 100}%`;
      track.appendChild(fill);
      li.appendChild(head);
      li.appendChild(track);
      list.appendChild(li);
    });
    const total = el('p', 'part-total');
    total.textContent = `Score ${item.score} out of ${Scoring.maxScore()}`;
    td.appendChild(list);
    td.appendChild(total);
    row.appendChild(td);
    return row;
  }

  function fillSelect(id, label, values, key) {
    const select = document.getElementById(id);
    const all = el('option', '', `All ${label}`);
    all.value = 'all';
    select.appendChild(all);
    values.forEach((value) => {
      const option = el('option', '', value);
      option.value = value;
      select.appendChild(option);
    });
    select.addEventListener('change', () => {
      filters[key] = select.value;
      renderQueue();
    });
  }

  function setupFilters() {
    const options = Dashboard.filterOptions();
    fillSelect('f-source', 'sources', options.sources, 'source');
    fillSelect('f-stage', 'stages', options.stages, 'stage');
    fillSelect('f-band', 'bands', options.bands, 'band');
    fillSelect('f-country', 'countries', options.countries, 'country');

    const query = document.getElementById('f-query');
    query.addEventListener('input', () => {
      filters.query = query.value;
      renderQueue();
    });

    document.getElementById('f-clear').addEventListener('click', () => {
      Object.assign(filters, { source: 'all', stage: 'all', band: 'all', country: 'all', query: '' });
      query.value = '';
      ['f-source', 'f-stage', 'f-band', 'f-country'].forEach((id) => {
        document.getElementById(id).value = 'all';
      });
      renderQueue();
      query.focus();
    });
  }

  function renderPipeline() {
    const list = document.getElementById('pipeline');
    list.textContent = '';
    const counts = Dashboard.stageCounts(data.leads);
    const most = Math.max(1, ...counts.map((c) => c.count));
    counts.forEach(({ stage, count }) => {
      const item = el('li', 'stage');
      const head = el('div', 'stage-head');
      head.appendChild(el('span', 'stage-name', stage));
      head.appendChild(el('b', 'stage-count', String(count)));
      const track = el('div', 'bar');
      const fill = el('div', 'bar-fill');
      fill.style.width = `${(count / most) * 100}%`;
      track.appendChild(fill);
      item.appendChild(head);
      item.appendChild(track);
      list.appendChild(item);
    });
  }

  function renderSources() {
    const list = document.getElementById('sources');
    list.textContent = '';
    Dashboard.sourceQuality(data.leads).forEach((row) => {
      const item = el('li', 'stage');
      const head = el('div', 'stage-head');
      head.appendChild(el('span', 'stage-name', row.source));
      head.appendChild(el('b', 'stage-count', `${row.share}%`));
      const track = el('div', 'bar');
      const fill = el('div', 'bar-fill');
      fill.style.width = `${row.share}%`;
      track.appendChild(fill);
      item.appendChild(head);
      item.appendChild(track);
      item.appendChild(el('span', 'source-note', `${row.reached} of ${row.leads} leads`));
      list.appendChild(item);
    });
  }

  function showError(error) {
    const notice = document.getElementById('load-error');
    const hint = connection.source === 'saved' ? ' You are using your saved connection: open Connection to change it or forget it.' : '';
    notice.textContent = `Could not load the leads. ${error.message}${hint}`;
    notice.hidden = false;
    document.getElementById('count').textContent = 'No leads loaded.';
  }

  // The news panel reads data/news.js, written by the scheduled job. It is separate from the board:
  // a missing file or no headlines only shows a note, and the board never waits for it.
  function renderNews() {
    const news = window.NEWS_DATA;
    const list = document.getElementById('news');
    const note = document.getElementById('news-note');
    list.textContent = '';
    if (!news || !Array.isArray(news.headlines) || news.headlines.length === 0) {
      note.textContent = 'No headlines are available right now.';
      return;
    }
    news.headlines.forEach((headline) => {
      const item = el('li', 'news-item');
      const link = el('a', 'news-link', headline.title);
      link.href = headline.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      item.appendChild(link);
      item.appendChild(el('span', 'news-meta', `${headline.source} · ${headline.published_at.slice(0, 10)}`));
      list.appendChild(item);
    });
    note.textContent = `Fetched ${news.fetched_at.slice(0, 16).replace('T', ' ')} UTC`;
  }

  // The Connection panel: says which base is in use, lists the columns a table needs, saves or forgets the settings.
  function setupConnection() {
    document.getElementById('connection-status').textContent =
      connection.source === 'saved'
        ? `Using your saved connection (base ${connection.config.baseId}).`
        : 'Using the built-in connection.';
    const list = document.getElementById('connection-columns');
    window.AirtableSource.COLUMNS.forEach((column) => {
      const item = el('li', '');
      item.appendChild(el('b', '', column.name));
      item.appendChild(document.createTextNode(`: ${column.type}`));
      list.appendChild(item);
    });
    const problem = document.getElementById('connection-error');
    document.getElementById('connection-form').addEventListener('submit', (event) => {
      event.preventDefault();
      try {
        if (!storage) throw new Error('This browser does not allow saving settings.');
        window.Connection.save(storage, {
          baseId: document.getElementById('c-base').value,
          tableId: document.getElementById('c-table').value,
          token: document.getElementById('c-token').value,
        });
        window.location.reload();
      } catch (error) {
        problem.textContent = error.message;
      }
    });
    document.getElementById('c-forget').addEventListener('click', () => {
      window.Connection.forget(storage);
      window.location.reload();
    });
  }

  async function start() {
    setupConnection();
    renderNews();
    document.getElementById('company').textContent = meta.company;
    document.getElementById('count').textContent = 'Loading leads from Airtable…';
    try {
      const leads = await window.AirtableSource.loadLeads(connection.config);
      data = { company: meta.company, as_of: meta.as_of, leads };
      fullQueue = Scoring.buildQueue(data.leads, data.as_of);
    } catch (error) {
      showError(error);
      return;
    }
    renderHeader();
    renderKpis();
    renderRules();
    setupFilters();
    renderQueue();
    renderPipeline();
    renderSources();
  }

  start();
})();
