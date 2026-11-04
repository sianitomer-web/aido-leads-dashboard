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

  function renderQueue() {
    const body = document.getElementById('queue-body');
    body.textContent = '';
    Scoring.buildQueue(data.leads, data.as_of).forEach((item, index) => {
      const { lead, score, band, breakdown, overdue, hoursSinceContact } = item;
      const row = el('tr', overdue ? 'row-overdue' : '');

      const who = el('div', 'who');
      who.appendChild(el('span', 'who-name', lead.name));
      who.appendChild(el('span', 'who-meta', `${lead.country} · ${lead.source}`));
      const leadWrap = el('div', 'lead-wrap');
      leadWrap.appendChild(el('span', 'rank', String(index + 1)));
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

  renderHeader();
  renderKpis();
  renderQueue();
  renderPipeline();
})();
