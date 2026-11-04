// Draws the board. All numbers come from Scoring and Dashboard, which read data/leads.js.
(function () {
  'use strict';

  const data = window.LEADS_DATA;
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
  }

  const fullQueue = Scoring.buildQueue(data.leads, data.as_of);
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
    total.textContent = `Score ${item.score} out of 100`;
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

  renderHeader();
  renderKpis();
  setupFilters();
  renderQueue();
  renderPipeline();
  renderSources();
})();
