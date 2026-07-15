/* ============================================================
   FRAUD INTEL — app.js
   Loads the query-output CSVs, renders KPIs/charts/tables,
   and wires the global fraud-type filter + sidebar navigation.
   ============================================================ */

(() => {
'use strict';

/* ---------------------------------------------------------
   CONFIG
   --------------------------------------------------------- */
const DATA = {
  fraudPatterns: 'fraud_patterns.csv',
  q1: 'q1_resource_efficiency.csv',
  q2: 'q2_yoy_evolution.csv',
  q3: 'q3_synthetic_identity.csv',
  q4: 'q4_money_mule.csv',
  q5: 'q5_ring_contagion.csv',
  q6: 'q6_cross_subsidy.csv',
  q7: 'q7_attack_window.csv',
  q8: 'q8_response_lag.csv',
  q9: 'q9_precrime_drift.csv',
  q10: 'q10_pattern_evolution.csv',
  heatmap: 'hourly_heatmap.json',
};

const FRAUD_TYPES = [
  'account_takeover','card_not_present','card_present_stolen',
  'friendly_fraud','atm_fraud','money_laundering','identity_theft'
];

const FRAUD_COLORS = {
  card_not_present:    '#F2A93B',
  account_takeover:    '#E8674A',
  card_present_stolen: '#F0873A',
  friendly_fraud:      '#C97B63',
  atm_fraud:           '#C9A227',
  money_laundering:    '#8C6E3F',
  identity_theft:      '#8FBB53',
};

const VERDICT_COLORS = {
  critical: '#E8664A',
  caution:  '#F2A93B',
  watch:    '#F0873A',
  good:     '#8FBB53',
  neutral:  '#A6906F',
};

Chart.defaults.font.family = "'IBM Plex Mono', monospace";
Chart.defaults.font.size = 11;
Chart.defaults.color = '#A6906F';
Chart.defaults.borderColor = '#2A2013';

let state = { fraudFilter: 'all' };
let store = {}; // parsed datasets live here

/* ---------------------------------------------------------
   UTILITIES
   --------------------------------------------------------- */
function fmtNum(n, decimals = 0) {
  const v = Number(n);
  if (Number.isNaN(v)) return String(n ?? '');
  return v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtMoney(n, decimals = 0) {
  const v = Number(n);
  if (Number.isNaN(v)) return String(n ?? '');
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtCompactMoney(n) {
  const v = Number(n);
  if (Number.isNaN(v)) return String(n ?? '');
  if (Math.abs(v) >= 1e6) return '$' + (v/1e6).toFixed(2) + 'M';
  if (Math.abs(v) >= 1e3) return '$' + (v/1e3).toFixed(1) + 'K';
  return '$' + v.toFixed(0);
}
function fmtPct(n, decimals = 1) {
  const v = Number(n);
  if (Number.isNaN(v)) return String(n ?? '');
  return v.toFixed(decimals) + '%';
}
function titleCase(s) {
  return String(s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function verdictTier(text) {
  if (!text) return 'neutral';
  if (text.includes('🔴')) return 'critical';
  if (text.includes('🟠')) return 'watch';
  if (text.includes('🟡')) return 'caution';
  if (text.includes('🟢') || text.includes('💚')) return 'good';
  // fallback for verdict fields with no emoji (e.g. Q5 response_priority)
  const t = text.toUpperCase();
  if (t.startsWith('CRITICAL')) return 'critical';
  if (t.startsWith('HIGH')) return 'watch';
  if (t.startsWith('STANDARD') || t.startsWith('LOW')) return 'good';
  return 'neutral';
}
function stripEmoji(text) {
  return String(text || '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim();
}
function verdictChipHTML(text) {
  const tier = verdictTier(text);
  const label = stripEmoji(text);
  return `<span class="chip chip-${tier}"><span class="dot"></span>${label}</span>`;
}
function fraudTagHTML(pattern) {
  return `<span class="ftag">${titleCase(pattern)}</span>`;
}

/* ---------------------------------------------------------
   CSV LOADING
   --------------------------------------------------------- */
function loadCSV(path) {
  return new Promise((resolve, reject) => {
    Papa.parse(path, {
      download: true,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (res) => resolve(res.data),
      error: reject,
    });
  });
}
function loadJSON(path) {
  return fetch(path).then(r => r.json());
}

/* ---------------------------------------------------------
   GENERIC TABLE CONTROLLER
   columns: [{key,label,type:'text'|'num'|'money'|'compactMoney'|'pct'|'chip'|'ftag',decimals}]
   --------------------------------------------------------- */
function createTable({ tableEl, pagerEl, data, columns, pageSize = null, searchKeys = [], filters = {} }) {
  const state = { page: 0, sortKey: null, sortDir: 1, search: '', activeFilters: {} };

  function applyFilter(row) {
    if (state.search) {
      const s = state.search.toLowerCase();
      const hit = searchKeys.some(k => String(row[k] ?? '').toLowerCase().includes(s));
      if (!hit) return false;
    }
    for (const key in state.activeFilters) {
      const val = state.activeFilters[key];
      if (val && val !== '__all__' && String(row[key]) !== String(val)) return false;
    }
    return true;
  }

  function getRows() {
    let rows = data.filter(applyFilter);
    if (state.sortKey) {
      const k = state.sortKey;
      rows = [...rows].sort((a, b) => {
        let av = a[k], bv = b[k];
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * state.sortDir;
        av = String(av ?? ''); bv = String(bv ?? '');
        return av.localeCompare(bv) * state.sortDir;
      });
    }
    return rows;
  }

  function cellHTML(col, row) {
    const v = row[col.key];
    switch (col.type) {
      case 'chip': return `<td>${verdictChipHTML(v)}</td>`;
      case 'ftag': return `<td>${fraudTagHTML(v)}</td>`;
      case 'money': return `<td class="num-cell">${fmtMoney(v, col.decimals ?? 0)}</td>`;
      case 'compactMoney': return `<td class="num-cell">${fmtCompactMoney(v)}</td>`;
      case 'pct': return `<td class="num-cell">${fmtPct(v, col.decimals ?? 1)}</td>`;
      case 'num': return `<td class="num-cell">${fmtNum(v, col.decimals ?? 0)}</td>`;
      case 'mono': return `<td class="mono-cell">${v ?? ''}</td>`;
      default: return `<td>${v ?? ''}</td>`;
    }
  }

  function render() {
    const allRows = getRows();
    const total = allRows.length;
    const rows = pageSize ? allRows.slice(state.page * pageSize, state.page * pageSize + pageSize) : allRows;

    const thead = `<thead><tr>${columns.map(c =>
      `<th data-key="${c.key}" class="${state.sortKey === c.key ? 'sorted ' + (state.sortDir === 1 ? 'asc' : '') : ''}">${c.label}</th>`
    ).join('')}</tr></thead>`;

    const tbody = `<tbody>${rows.map(r =>
      `<tr>${columns.map(c => cellHTML(c, r)).join('')}</tr>`
    ).join('') || `<tr><td colspan="${columns.length}" class="loading-row">No matching rows</td></tr>`}</tbody>`;

    tableEl.innerHTML = thead + tbody;

    tableEl.querySelectorAll('thead th').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.dataset.key;
        if (state.sortKey === key) { state.sortDir *= -1; } else { state.sortKey = key; state.sortDir = 1; }
        render();
      });
    });

    if (pagerEl) {
      const pages = Math.max(1, Math.ceil(total / pageSize));
      state.page = Math.min(state.page, pages - 1);
      pagerEl.innerHTML = `
        <div class="info">${fmtNum(total)} rows &middot; page ${state.page + 1} / ${pages}</div>
        <div class="btns">
          <button class="pg-btn" data-act="first" ${state.page === 0 ? 'disabled' : ''}>&laquo; First</button>
          <button class="pg-btn" data-act="prev" ${state.page === 0 ? 'disabled' : ''}>&lsaquo; Prev</button>
          <button class="pg-btn" data-act="next" ${state.page >= pages - 1 ? 'disabled' : ''}>Next &rsaquo;</button>
          <button class="pg-btn" data-act="last" ${state.page >= pages - 1 ? 'disabled' : ''}>Last &raquo;</button>
        </div>`;
      pagerEl.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          const pages2 = Math.max(1, Math.ceil(getRows().length / pageSize));
          if (btn.dataset.act === 'first') state.page = 0;
          if (btn.dataset.act === 'prev') state.page = Math.max(0, state.page - 1);
          if (btn.dataset.act === 'next') state.page = Math.min(pages2 - 1, state.page + 1);
          if (btn.dataset.act === 'last') state.page = pages2 - 1;
          render();
        });
      });
    }
  }

  return {
    render,
    setSearch(v) { state.search = v; state.page = 0; render(); },
    setFilter(key, val) { state.activeFilters[key] = val; state.page = 0; render(); },
    setData(newData) { data = newData; state.page = 0; render(); },
  };
}

/* ---------------------------------------------------------
   DIST BARS (verdict distribution mini component)
   --------------------------------------------------------- */
function renderDistBars(container, groups) {
  // groups: [{label, count, tier}]
  const total = groups.reduce((s, g) => s + g.count, 0) || 1;
  container.innerHTML = groups.map(g => {
    const pct = (g.count / total * 100);
    return `<div class="dist-row">
      <div class="dist-label">${verdictChipHTML(g.raw ?? g.label)}</div>
      <div class="dist-bar-track"><div class="dist-bar-fill" style="width:${pct}%;background:${VERDICT_COLORS[g.tier]}"></div></div>
      <div class="dist-val">${fmtNum(g.count)} · ${pct.toFixed(1)}%</div>
    </div>`;
  }).join('');
}

/* ---------------------------------------------------------
   SIDEBAR TOGGLE
   --------------------------------------------------------- */
function initSidebarToggle() {
  const btn = document.getElementById('sidebar-toggle');
  if (!btn) return;
  const body = document.body;

  if (localStorage.getItem('fraudIntelSidebarCollapsed') === '1') {
    body.classList.add('sidebar-collapsed');
  }

  btn.addEventListener('click', () => {
    body.classList.toggle('sidebar-collapsed');
    localStorage.setItem('fraudIntelSidebarCollapsed', body.classList.contains('sidebar-collapsed') ? '1' : '0');
  });
}

/* ---------------------------------------------------------
   NAVIGATION
   --------------------------------------------------------- */
function initNav() {
  const items = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.section');
  const topbarCurrent = document.getElementById('topbar-current');

  items.forEach(item => {
    item.addEventListener('click', () => {
      document.getElementById(item.dataset.target).scrollIntoView({ behavior: 'smooth' });
    });
  });

  const labels = {};
  items.forEach(i => labels[i.dataset.target] = i.querySelector('.nav-label').childNodes[0].textContent.trim());

  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        items.forEach(i => i.classList.toggle('active', i.dataset.target === e.target.id));
        topbarCurrent.textContent = labels[e.target.id] || e.target.id;
      }
    });
  }, { rootMargin: '-20% 0px -70% 0px', threshold: 0 });

  sections.forEach(s => io.observe(s));
}

/* ---------------------------------------------------------
   FILTER BAR (7 fraud types)
   --------------------------------------------------------- */
function initFilterBar() {
  const bar = document.getElementById('filter-bar');
  const allPill = document.createElement('div');
  allPill.className = 'pill active';
  allPill.dataset.val = 'all';
  allPill.textContent = 'All patterns';
  bar.insertBefore(allPill, document.getElementById('filter-reset'));

  FRAUD_TYPES.forEach(ft => {
    const pill = document.createElement('div');
    pill.className = 'pill';
    pill.dataset.val = ft;
    pill.innerHTML = `<span class="swatch" style="background:${FRAUD_COLORS[ft]}"></span>${titleCase(ft)}`;
    bar.insertBefore(pill, document.getElementById('filter-reset'));
  });

  bar.querySelectorAll('.pill').forEach(p => {
    p.addEventListener('click', () => {
      bar.querySelectorAll('.pill').forEach(x => x.classList.remove('active'));
      p.classList.add('active');
      state.fraudFilter = p.dataset.val;
      applyFraudFilter();
    });
  });

  const resetBtn = document.getElementById('filter-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      bar.querySelectorAll('.pill').forEach(x => x.classList.remove('active'));
      allPill.classList.add('active');
      state.fraudFilter = 'all';
      applyFraudFilter();
    });
  }
}

/* ---------------------------------------------------------
   QUICK JUMP (topbar search — find & scroll to a case query)
   --------------------------------------------------------- */
function initQuickJump() {
  const input = document.getElementById('quick-jump');
  if (!input) return;

  const searchable = Array.from(document.querySelectorAll('.nav-item')).map(item => ({
    target: item.dataset.target,
    text: item.querySelector('.nav-label').textContent.toLowerCase(),
    el: item,
  }));

  function jumpTo(target) {
    const section = document.getElementById(target);
    if (section) section.scrollIntoView({ behavior: 'smooth' });
    input.value = '';
    input.blur();
    searchable.forEach(s => s.el.style.opacity = '');
  }

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    searchable.forEach(s => { s.el.style.opacity = (q && !s.text.includes(q)) ? '0.35' : ''; });
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = input.value.trim().toLowerCase();
      const match = q ? searchable.find(s => s.text.includes(q)) : null;
      if (match) jumpTo(match.target);
    } else if (e.key === 'Escape') {
      jumpTo('overview');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== input && !['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)) {
      e.preventDefault();
      input.focus();
    }
  });
}

function filteredRows(rows, key = 'fraud_pattern') {
  if (state.fraudFilter === 'all') return rows;
  return rows.filter(r => r[key] === state.fraudFilter);
}

/* Sections that react to the global fraud-type filter: overview, q1, q2, q10 */
function applyFraudFilter() {
  renderOverview();
  renderQ1();
  renderQ2();
  renderQ10();
}

/* ---------------------------------------------------------
   CHART HELPERS
   --------------------------------------------------------- */
const chartRegistry = {};
function makeChart(id, config) {
  const el = document.getElementById(id);
  if (!el) return;
  if (chartRegistry[id]) chartRegistry[id].destroy();
  chartRegistry[id] = new Chart(el, config);
}
const gridColor = '#1A2438';
const commonScales = {
  x: { grid: { color: gridColor }, ticks: { color: '#8996AC' } },
  y: { grid: { color: gridColor }, ticks: { color: '#8996AC' } },
};

/* ============================================================
   OVERVIEW
   ============================================================ */
function renderOverview() {
  const q1 = filteredRows(store.q1);
  const fp = filteredRows(store.fraudPatterns);

  const totalLoss = q1.reduce((s, r) => s + (r.total_loss || 0), 0);
  const totalTxns = q1.reduce((s, r) => s + (r.total_fraud_txns || 0), 0);
  const ringCount = store.q5.length;
  const avgDaysToSpread = store.q5.reduce((s, r) => s + (r.avg_days_to_spread || 0), 0) / (store.q5.length || 1);
  const lagLoss = store.q8.reduce((s, r) => s + (r.loss_after_response_window_missed || 0), 0);

  const kpiEl = document.getElementById('overview-kpis');
  kpiEl.innerHTML = `
    <div class="kpi crit">
      <div class="kpi-label">Total fraud loss</div>
      <div class="kpi-value">${fmtCompactMoney(totalLoss)}</div>
      <div class="kpi-sub">${state.fraudFilter === 'all' ? 'across all 7 patterns' : titleCase(state.fraudFilter)}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Fraudulent transactions</div>
      <div class="kpi-value">${fmtNum(totalTxns)}</div>
      <div class="kpi-sub">of 1,000,000 total transactions</div>
    </div>
    <div class="kpi warn">
      <div class="kpi-label">Fraud rings detected</div>
      <div class="kpi-value">${fmtNum(ringCount)}</div>
      <div class="kpi-sub">avg ${avgDaysToSpread.toFixed(1)} days to full spread</div>
    </div>
    <div class="kpi crit">
      <div class="kpi-label">Lost to response lag</div>
      <div class="kpi-value">${fmtCompactMoney(lagLoss)}</div>
      <div class="kpi-sub">missed the 5-day quarantine window</div>
    </div>`;

  document.getElementById('overview-donut-note').textContent =
    state.fraudFilter === 'all' ? '' : `filtered: ${titleCase(state.fraudFilter)}`;

  const donutSource = state.fraudFilter === 'all' ? store.q1 : q1;
  makeChart('chart-overview-donut', {
    type: 'doughnut',
    data: {
      labels: donutSource.map(r => titleCase(r.fraud_pattern)),
      datasets: [{
        data: donutSource.map(r => r.total_loss),
        backgroundColor: donutSource.map(r => FRAUD_COLORS[r.fraud_pattern]),
        borderColor: '#211910',
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: '#B7C1D6', boxWidth: 10, padding: 12, font: { size: 11 } } },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${fmtMoney(ctx.raw)}` } },
      },
    },
  });

  renderHeatmap();
  renderFraudPatternsTable();
  renderQIndex();
}

function renderHeatmap() {
  const wrap = document.getElementById('heatmap-wrap');
  if (wrap.dataset.built) { return; }
  wrap.dataset.built = '1';
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const maxRate = Math.max(...store.heatmap.map(c => c.rate));

  let html = '<div style="display:grid;grid-template-columns:34px repeat(24,1fr);gap:2px;height:100%;align-content:center;">';
  html += '<div></div>';
  for (let h = 0; h < 24; h += 1) {
    html += `<div style="font-size:8.5px;color:#4E5A72;text-align:center;font-family:var(--font-mono);">${h % 3 === 0 ? h : ''}</div>`;
  }
  for (let d = 0; d < 7; d += 1) {
    html += `<div style="font-size:9.5px;color:#7C879E;display:flex;align-items:center;font-family:var(--font-mono);">${days[d]}</div>`;
    for (let h = 0; h < 24; h += 1) {
      const cell = store.heatmap.find(c => c.day === d && c.hour === h);
      const rate = cell ? cell.rate : 0;
      const intensity = maxRate ? rate / maxRate : 0;
      const bg = `rgba(232,102,74,${0.08 + intensity * 0.82})`;
      html += `<div title="${days[d]} ${h}:00 — fraud rate ${rate.toFixed(2)}%" style="aspect-ratio:1;border-radius:3px;background:${bg};"></div>`;
    }
  }
  html += '</div>';
  wrap.innerHTML = html;
}

function renderFraudPatternsTable() {
  const table = document.getElementById('table-fraud-patterns');
  createTable({
    tableEl: table,
    data: store.fraudPatterns,
    columns: [
      { key: 'fraud_pattern', label: 'Pattern', type: 'ftag' },
      { key: 'description', label: 'Description', type: 'text' },
      { key: 'transaction_count', label: 'Fraud Txns', type: 'num' },
      { key: 'fraud_share_pct', label: 'Share of Fraud', type: 'pct' },
      { key: 'avg_amount', label: 'Avg Amount', type: 'money', decimals: 2 },
      { key: 'pct_night_0_5', label: 'Night (0-5h) %', type: 'pct' },
      { key: 'pct_foreign', label: 'Foreign %', type: 'pct' },
      { key: 'pct_card_not_present', label: 'CNP %', type: 'pct' },
      { key: 'pct_no_2fa', label: 'No 2FA %', type: 'pct' },
    ],
  }).render();
}

function renderQIndex() {
  const grid = document.getElementById('q-index-grid');
  if (grid.dataset.built) return;
  grid.dataset.built = '1';
  const items = [
    ['q1','01','Resource Allocation','Under vs. over-policed patterns'],
    ['q2','02','YoY Evolution','Are attacks getting smarter?'],
    ['q3','03','Synthetic Identity','Fabricated-identity scoring'],
    ['q4','04','Money Mule / AML','SAR filing candidates'],
    ['q5','05','Ring Contagion','Speed of fraud ring spread'],
    ['q6','06','Cross-Subsidy','Fraud tax by customer segment'],
    ['q7','07','Attack Window','The perfect fraud recipe'],
    ['q8','08','Response Lag Cost','$ cost of investigation delay'],
    ['q9','09','Pre-Crime Drift','Early warning candidates'],
    ['q10','10','Pattern Evolution','Which fraud teaches the rest?'],
  ];
  grid.innerHTML = items.map(([id,tag,title,desc]) => `
    <div class="q-index-card" data-target="${id}">
      <div class="qn">${tag}</div>
      <div>
        <div class="qt">${title}</div>
        <div class="qd">${desc}</div>
      </div>
    </div>`).join('');
  grid.querySelectorAll('.q-index-card').forEach(c => {
    c.addEventListener('click', () => document.getElementById(c.dataset.target).scrollIntoView({ behavior: 'smooth' }));
  });
}

/* ============================================================
   Q1 — Resource Efficiency
   ============================================================ */
function renderQ1() {
  const rows = filteredRows(store.q1);

  makeChart('chart-q1-bars', {
    type: 'bar',
    data: {
      labels: rows.map(r => titleCase(r.fraud_pattern)),
      datasets: [
        { label: 'Share of fraud volume %', data: rows.map(r => r.share_of_fraud_volume), backgroundColor: '#F2A93B' },
        { label: 'Share of fraud loss %', data: rows.map(r => r.share_of_fraud_loss), backgroundColor: '#E5484D' },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: commonScales,
      plugins: { legend: { labels: { color: '#B7C1D6' } } },
    },
  });

  const sorted = [...rows].sort((a,b) => b.resource_efficiency_gap - a.resource_efficiency_gap);
  makeChart('chart-q1-gap', {
    type: 'bar',
    data: {
      labels: sorted.map(r => titleCase(r.fraud_pattern)),
      datasets: [{
        label: 'Resource efficiency gap',
        data: sorted.map(r => r.resource_efficiency_gap),
        backgroundColor: sorted.map(r => r.resource_efficiency_gap > 5 ? VERDICT_COLORS.critical : r.resource_efficiency_gap < -5 ? VERDICT_COLORS.caution : VERDICT_COLORS.good),
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      scales: commonScales,
      plugins: { legend: { display: false } },
    },
  });

  createTable({
    tableEl: document.getElementById('table-q1'),
    data: rows,
    columns: [
      { key: 'fraud_pattern', label: 'Pattern', type: 'ftag' },
      { key: 'total_fraud_txns', label: 'Fraud Txns', type: 'num' },
      { key: 'total_loss', label: 'Total Loss', type: 'money', decimals: 2 },
      { key: 'avg_loss_per_attack', label: 'Avg / Attack', type: 'money', decimals: 2 },
      { key: 'share_of_fraud_volume', label: 'Vol Share %', type: 'pct' },
      { key: 'share_of_fraud_loss', label: 'Loss Share %', type: 'pct' },
      { key: 'resource_efficiency_gap', label: 'Gap', type: 'pct' },
      { key: 'control_efficiency_verdict', label: 'Verdict', type: 'chip' },
    ],
  }).render();
}

/* ============================================================
   Q2 — YoY Evolution
   ============================================================ */
function renderQ2() {
  const rows = filteredRows(store.q2);
  const select = document.getElementById('q2-metric-select');
  if (!select.dataset.built) {
    select.dataset.built = '1';
    const metrics = [...new Set(store.q2.map(r => r.metric))];
    select.innerHTML = metrics.map(m => `<option value="${m}">${titleCase(m)}</option>`).join('');
    select.addEventListener('change', drawQ2Chart);
  }
  drawQ2Chart();

  createTable({
    tableEl: document.getElementById('table-q2'),
    data: rows,
    columns: [
      { key: 'fraud_pattern', label: 'Pattern', type: 'ftag' },
      { key: 'metric', label: 'Metric', type: 'mono' },
      { key: 'y_2022', label: '2022', type: 'num', decimals: 2 },
      { key: 'y_2023', label: '2023', type: 'num', decimals: 2 },
      { key: 'y_2024', label: '2024', type: 'num', decimals: 2 },
      { key: 'avg_pct_change', label: 'Avg % Chg', type: 'pct' },
      { key: 'avg_change_trend', label: 'Trend', type: 'text' },
      { key: 'business_interpretation', label: 'Read', type: 'text' },
    ],
  }).render();
}
function drawQ2Chart() {
  const metric = document.getElementById('q2-metric-select').value;
  const rows = filteredRows(store.q2).filter(r => r.metric === metric);
  makeChart('chart-q2-trend', {
    type: 'line',
    data: {
      labels: ['2022','2023','2024'],
      datasets: rows.map(r => ({
        label: titleCase(r.fraud_pattern),
        data: [r.y_2022, r.y_2023, r.y_2024],
        borderColor: FRAUD_COLORS[r.fraud_pattern],
        backgroundColor: FRAUD_COLORS[r.fraud_pattern],
        tension: 0.35,
        pointRadius: 4,
      })),
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: commonScales,
      plugins: { legend: { labels: { color: '#B7C1D6' } } },
    },
  });
}

/* ============================================================
   Q3 — Synthetic Identity
   ============================================================ */
let q3Table;
function renderQ3() {
  const rows = store.q3;
  const suspicious = rows.filter(r => verdictTier(r.synthetic_id_verdict) !== 'good');
  const truePositives = suspicious.filter(r => r.is_fraudster === 1).length;
  const avgScore = rows.reduce((s,r)=>s+(r.synthetic_id_suspicion_score||0),0) / rows.length;

  document.getElementById('q3-kpis').innerHTML = `
    <div class="kpi"><div class="kpi-label">Accounts scored</div><div class="kpi-value">${fmtNum(rows.length)}</div><div class="kpi-sub">full population</div></div>
    <div class="kpi warn"><div class="kpi-label">Flagged (elevated+)</div><div class="kpi-value">${fmtNum(suspicious.length)}</div><div class="kpi-sub">${fmtPct(suspicious.length/rows.length*100)} of population</div></div>
    <div class="kpi crit"><div class="kpi-label">Precision on flagged</div><div class="kpi-value">${fmtPct(truePositives/suspicious.length*100)}</div><div class="kpi-sub">${fmtNum(truePositives)} confirmed fraudsters</div></div>
    <div class="kpi"><div class="kpi-label">Avg suspicion score</div><div class="kpi-value">${avgScore.toFixed(1)}</div><div class="kpi-sub">0–100 scale</div></div>`;

  const verdictGroups = {};
  rows.forEach(r => { verdictGroups[r.synthetic_id_verdict] = (verdictGroups[r.synthetic_id_verdict]||0)+1; });
  renderDistBars(document.getElementById('q3-dist'), Object.entries(verdictGroups).map(([label,count]) => ({ label, raw: label, count, tier: verdictTier(label) })));

  // histogram of suspicion score, split by is_fraudster
  const bins = Array.from({length: 10}, (_,i) => i*10);
  const fraudCounts = bins.map(b => rows.filter(r => r.synthetic_id_suspicion_score >= b && r.synthetic_id_suspicion_score < b+10 && r.is_fraudster === 1).length);
  const legitCounts = bins.map(b => rows.filter(r => r.synthetic_id_suspicion_score >= b && r.synthetic_id_suspicion_score < b+10 && r.is_fraudster === 0).length);
  makeChart('chart-q3-scatter', {
    type: 'bar',
    data: {
      labels: bins.map(b => `${b}-${b+10}`),
      datasets: [
        { label: 'Confirmed fraudster', data: fraudCounts, backgroundColor: VERDICT_COLORS.critical },
        { label: 'Legitimate', data: legitCounts, backgroundColor: VERDICT_COLORS.good },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: { ...commonScales, x: { ...commonScales.x, stacked: true }, y: { ...commonScales.y, stacked: true, type: 'logarithmic' } },
      plugins: { legend: { labels: { color: '#B7C1D6' } }, tooltip: { mode: 'index' } },
    },
  });

  const filterSel = document.getElementById('q3-verdict-filter');
  if (!filterSel.dataset.built) {
    filterSel.dataset.built = '1';
    const verdicts = [...new Set(rows.map(r => r.synthetic_id_verdict))];
    filterSel.innerHTML = `<option value="__all__">All verdicts</option>` + verdicts.map(v => `<option value="${v}">${stripEmoji(v)}</option>`).join('');
    filterSel.addEventListener('change', () => q3Table.setFilter('synthetic_id_verdict', filterSel.value));
    document.getElementById('q3-search').addEventListener('input', (e) => q3Table.setSearch(e.target.value));
  }

  q3Table = createTable({
    tableEl: document.getElementById('table-q3'),
    pagerEl: document.getElementById('pg-q3'),
    data: rows,
    pageSize: 25,
    searchKeys: ['account_id','home_country'],
    columns: [
      { key: 'account_id', label: 'Account', type: 'mono' },
      { key: 'account_type', label: 'Type', type: 'text' },
      { key: 'home_country', label: 'Country', type: 'mono' },
      { key: 'account_age_days', label: 'Age (d)', type: 'num' },
      { key: 'countries_per_year', label: 'Countries/yr', type: 'num', decimals: 2 },
      { key: 'foreign_txn_pct', label: 'Foreign %', type: 'pct' },
      { key: 'avg_ip_risk', label: 'IP Risk', type: 'num', decimals: 1 },
      { key: 'synthetic_id_suspicion_score', label: 'Score', type: 'num', decimals: 1 },
      { key: 'synthetic_id_verdict', label: 'Verdict', type: 'chip' },
    ],
  });
  q3Table.render();
}

/* ============================================================
   Q4 — Money Mule / AML
   ============================================================ */
let q4Table;
function renderQ4() {
  const rows = store.q4;
  const flagged = rows.filter(r => verdictTier(r.aml_verdict) !== 'good');
  const structuring = rows.filter(r => r.structuring_txn_count > 0).length;
  const avgScore = rows.reduce((s,r)=>s+(r.mule_suspicion_score||0),0) / rows.length;

  document.getElementById('q4-kpis').innerHTML = `
    <div class="kpi"><div class="kpi-label">Accounts scored</div><div class="kpi-value">${fmtNum(rows.length)}</div><div class="kpi-sub">full population</div></div>
    <div class="kpi crit"><div class="kpi-label">SAR / escalate candidates</div><div class="kpi-value">${fmtNum(flagged.length)}</div><div class="kpi-sub">${fmtPct(flagged.length/rows.length*100)} of population</div></div>
    <div class="kpi warn"><div class="kpi-label">Structuring detected</div><div class="kpi-value">${fmtNum(structuring)}</div><div class="kpi-sub">threshold-evading accounts</div></div>
    <div class="kpi"><div class="kpi-label">Avg mule score</div><div class="kpi-value">${avgScore.toFixed(1)}</div><div class="kpi-sub">composite risk score</div></div>`;

  const verdictGroups = {};
  rows.forEach(r => { verdictGroups[r.aml_verdict] = (verdictGroups[r.aml_verdict]||0)+1; });
  renderDistBars(document.getElementById('q4-dist'), Object.entries(verdictGroups).map(([label,count]) => ({ label, raw: label, count, tier: verdictTier(label) })));

  const types = [...new Set(rows.map(r => r.account_type))];
  const avgByType = types.map(t => {
    const sub = rows.filter(r => r.account_type === t);
    return sub.reduce((s,r)=>s+(r.mule_suspicion_score||0),0) / sub.length;
  });
  makeChart('chart-q4-box', {
    type: 'bar',
    data: { labels: types.map(titleCase), datasets: [{ label: 'Avg mule suspicion score', data: avgByType, backgroundColor: '#F2A93B' }] },
    options: { responsive: true, maintainAspectRatio: false, scales: commonScales, plugins: { legend: { display: false } } },
  });

  const filterSel = document.getElementById('q4-verdict-filter');
  if (!filterSel.dataset.built) {
    filterSel.dataset.built = '1';
    const verdicts = [...new Set(rows.map(r => r.aml_verdict))];
    filterSel.innerHTML = `<option value="__all__">All verdicts</option>` + verdicts.map(v => `<option value="${v}">${stripEmoji(v)}</option>`).join('');
    filterSel.addEventListener('change', () => q4Table.setFilter('aml_verdict', filterSel.value));
    document.getElementById('q4-search').addEventListener('input', (e) => q4Table.setSearch(e.target.value));
  }

  q4Table = createTable({
    tableEl: document.getElementById('table-q4'),
    pagerEl: document.getElementById('pg-q4'),
    data: rows,
    pageSize: 25,
    searchKeys: ['account_id','home_country'],
    columns: [
      { key: 'account_id', label: 'Account', type: 'mono' },
      { key: 'account_type', label: 'Type', type: 'text' },
      { key: 'home_country', label: 'Country', type: 'mono' },
      { key: 'total_txns', label: 'Txns', type: 'num' },
      { key: 'total_volume', label: 'Volume', type: 'money', decimals: 0 },
      { key: 'pct_night_activity', label: 'Night %', type: 'pct' },
      { key: 'structuring_txn_count', label: 'Structuring', type: 'num' },
      { key: 'countries_touched', label: 'Countries', type: 'num' },
      { key: 'mule_suspicion_score', label: 'Score', type: 'num', decimals: 1 },
      { key: 'aml_verdict', label: 'Verdict', type: 'chip' },
    ],
  });
  q4Table.render();
}

/* ============================================================
   Q5 — Ring Contagion
   ============================================================ */
let q5Table;
function renderQ5() {
  const rows = store.q5;
  const avgConnected = rows.reduce((s,r)=>s+(r.connected_accounts||0),0)/rows.length;
  const avgSpread = rows.reduce((s,r)=>s+(r.avg_days_to_spread||0),0)/rows.length;
  const critical = rows.filter(r => r.response_priority.includes('CRITICAL')).length;
  const fastestReplication = Math.min(...rows.map(r => r.first_replication_speed_days));

  document.getElementById('q5-kpis').innerHTML = `
    <div class="kpi"><div class="kpi-label">Rings detected</div><div class="kpi-value">${fmtNum(rows.length)}</div><div class="kpi-sub">2022–2024</div></div>
    <div class="kpi"><div class="kpi-label">Avg ring size</div><div class="kpi-value">${avgConnected.toFixed(1)}</div><div class="kpi-sub">connected accounts</div></div>
    <div class="kpi crit"><div class="kpi-label">Critical priority</div><div class="kpi-value">${fmtNum(critical)}</div><div class="kpi-sub">manual response too slow</div></div>
    <div class="kpi warn"><div class="kpi-label">Fastest replication</div><div class="kpi-value">${fastestReplication.toFixed(1)}d</div><div class="kpi-sub">avg full spread: ${avgSpread.toFixed(0)}d</div></div>`;

  const groups = {};
  rows.forEach(r => { groups[r.response_priority] = (groups[r.response_priority]||0)+1; });
  renderDistBars(document.getElementById('q5-dist'), Object.entries(groups).map(([label,count]) => ({ label, raw: label, count, tier: verdictTier(label) })));

  makeChart('chart-q5-scatter', {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Rings',
        data: rows.map(r => ({ x: r.connected_accounts, y: r.avg_days_to_spread })),
        backgroundColor: rows.map(r => VERDICT_COLORS[verdictTier(r.response_priority)]),
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: { x: { ...commonScales.x, title: { display: true, text: 'Connected accounts', color: '#7C879E' } }, y: { ...commonScales.y, title: { display: true, text: 'Avg days to spread', color: '#7C879E' } } },
      plugins: { legend: { display: false } },
    },
  });

  const filterSel = document.getElementById('q5-priority-filter');
  if (!filterSel.dataset.built) {
    filterSel.dataset.built = '1';
    const vals = [...new Set(rows.map(r => r.response_priority))];
    filterSel.innerHTML = `<option value="__all__">All priorities</option>` + vals.map(v => `<option value="${v}">${stripEmoji(v)}</option>`).join('');
    filterSel.addEventListener('change', () => q5Table.setFilter('response_priority', filterSel.value));
    document.getElementById('q5-search').addEventListener('input', (e) => q5Table.setSearch(e.target.value));
  }

  q5Table = createTable({
    tableEl: document.getElementById('table-q5'),
    pagerEl: document.getElementById('pg-q5'),
    data: rows,
    pageSize: 25,
    searchKeys: ['ring_id','seed_account'],
    columns: [
      { key: 'ring_id', label: 'Ring', type: 'mono' },
      { key: 'seed_account', label: 'Seed Account', type: 'mono' },
      { key: 'ring_detected_date', label: 'Detected', type: 'mono' },
      { key: 'connected_accounts', label: 'Size', type: 'num' },
      { key: 'first_replication_speed_days', label: 'First Replication (d)', type: 'num', decimals: 1 },
      { key: 'avg_days_to_spread', label: 'Avg Spread (d)', type: 'num', decimals: 1 },
      { key: 'response_priority', label: 'Priority', type: 'chip' },
    ],
  });
  q5Table.render();
}

/* ============================================================
   Q6 — Cross-Subsidy
   ============================================================ */
function renderQ6() {
  const rows = store.q6;
  makeChart('chart-q6-tax', {
    type: 'bar',
    data: {
      labels: rows.map(r => titleCase(r.account_type)),
      datasets: [
        { label: 'Implied fraud tax / txn', data: rows.map(r => r.implied_fraud_tax_per_txn), backgroundColor: '#F2A93B' },
        { label: 'Blended portfolio tax / txn', data: rows.map(r => r.blended_portfolio_fraud_tax_per_txn), backgroundColor: '#7C879E' },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false, scales: commonScales, plugins: { legend: { labels: { color: '#B7C1D6' } } } },
  });
  makeChart('chart-q6-subsidy', {
    type: 'bar',
    data: {
      labels: rows.map(r => titleCase(r.account_type)),
      datasets: [{
        label: 'Net dollar subsidy effect',
        data: rows.map(r => r.net_dollar_subsidy_effect),
        backgroundColor: rows.map(r => r.net_dollar_subsidy_effect > 0 ? VERDICT_COLORS.good : VERDICT_COLORS.critical),
      }],
    },
    options: { responsive: true, maintainAspectRatio: false, scales: commonScales, plugins: { legend: { display: false } } },
  });

  createTable({
    tableEl: document.getElementById('table-q6'),
    data: rows,
    columns: [
      { key: 'account_type', label: 'Segment', type: 'text' },
      { key: 'total_accounts', label: 'Accounts', type: 'num' },
      { key: 'fraud_rate_pct', label: 'Fraud Rate %', type: 'pct' },
      { key: 'fraud_loss', label: 'Fraud Loss', type: 'money', decimals: 2 },
      { key: 'fraud_cost_per_account', label: 'Cost / Acct', type: 'money', decimals: 2 },
      { key: 'implied_fraud_tax_per_txn', label: 'Tax / Txn', type: 'money', decimals: 4 },
      { key: 'subsidy_gap_per_txn', label: 'Gap / Txn', type: 'money', decimals: 4 },
      { key: 'net_dollar_subsidy_effect', label: 'Net Effect', type: 'money', decimals: 2 },
      { key: 'cross_subsidy_verdict', label: 'Verdict', type: 'chip' },
    ],
  }).render();
}

/* ============================================================
   Q7 — Attack Window
   ============================================================ */
function renderQ7() {
  const rows = [...store.q7].sort((a,b) => a.risk_rank - b.risk_rank);
  makeChart('chart-q7-bars', {
    type: 'bar',
    data: {
      labels: rows.map(r => `${r.time_window} · ${r.device_type} · ${r.merchant_category}`),
      datasets: [{ label: 'Fraud success rate %', data: rows.map(r => r.fraud_success_rate_pct), backgroundColor: '#E5484D' }],
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      scales: commonScales,
      plugins: { legend: { display: false } },
    },
  });

  createTable({
    tableEl: document.getElementById('table-q7'),
    data: rows,
    columns: [
      { key: 'risk_rank', label: '#', type: 'num' },
      { key: 'time_window', label: 'Window', type: 'text' },
      { key: 'day_type', label: 'Day', type: 'text' },
      { key: 'device_type', label: 'Device', type: 'text' },
      { key: 'txn_geography', label: 'Geo', type: 'text' },
      { key: 'auth_strength', label: 'Auth', type: 'text' },
      { key: 'merchant_category', label: 'Category', type: 'text' },
      { key: 'total_txns', label: 'Txns', type: 'num' },
      { key: 'fraud_success_rate_pct', label: 'Fraud %', type: 'pct' },
      { key: 'sample_reliability', label: 'Confidence', type: 'text' },
      { key: 'total_fraud_loss', label: 'Loss', type: 'money', decimals: 2 },
    ],
  }).render();
}

/* ============================================================
   Q8 — Response Lag Cost
   ============================================================ */
let q8Table;
function renderQ8() {
  const rows = store.q8;
  const totalPreventable = rows.reduce((s,r)=>s+(r.preventable_loss_usd||0),0);
  const totalMissed = rows.reduce((s,r)=>s+(r.loss_after_response_window_missed||0),0);
  const totalWithin = rows.reduce((s,r)=>s+(r.loss_within_5day_response_window||0),0);

  document.getElementById('q8-kpis').innerHTML = `
    <div class="kpi crit"><div class="kpi-label">Total preventable loss</div><div class="kpi-value">${fmtCompactMoney(totalPreventable)}</div><div class="kpi-sub">across ${fmtNum(rows.length)} rings</div></div>
    <div class="kpi good"><div class="kpi-label">Caught within window</div><div class="kpi-value">${fmtCompactMoney(totalWithin)}</div><div class="kpi-sub">${fmtPct(totalWithin/totalPreventable*100)} of preventable</div></div>
    <div class="kpi crit"><div class="kpi-label">Lost after window missed</div><div class="kpi-value">${fmtCompactMoney(totalMissed)}</div><div class="kpi-sub">${fmtPct(totalMissed/totalPreventable*100)} of preventable</div></div>
    <div class="kpi"><div class="kpi-label">Avg loss / ring</div><div class="kpi-value">${fmtCompactMoney(totalPreventable/rows.length)}</div><div class="kpi-sub">preventable loss</div></div>`;

  const top20 = [...rows].sort((a,b) => b.preventable_loss_usd - a.preventable_loss_usd).slice(0, 20);
  makeChart('chart-q8-stacked', {
    type: 'bar',
    data: {
      labels: top20.map(r => r.ring_id),
      datasets: [
        { label: 'Within 5-day window', data: top20.map(r => r.loss_within_5day_response_window), backgroundColor: VERDICT_COLORS.good },
        { label: 'After window missed', data: top20.map(r => r.loss_after_response_window_missed), backgroundColor: VERDICT_COLORS.critical },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: { x: { ...commonScales.x, stacked: true }, y: { ...commonScales.y, stacked: true } },
      plugins: { legend: { labels: { color: '#B7C1D6' } } },
    },
  });

  document.getElementById('q8-search').addEventListener('input', (e) => q8Table.setSearch(e.target.value));

  q8Table = createTable({
    tableEl: document.getElementById('table-q8'),
    pagerEl: document.getElementById('pg-q8'),
    data: rows,
    pageSize: 25,
    searchKeys: ['ring_id','seed_account'],
    columns: [
      { key: 'ring_id', label: 'Ring', type: 'mono' },
      { key: 'seed_account', label: 'Seed Account', type: 'mono' },
      { key: 'ring_detected_date', label: 'Detected', type: 'mono' },
      { key: 'downstream_accounts_activated', label: 'Downstream Accts', type: 'num' },
      { key: 'downstream_fraud_txns', label: 'Downstream Txns', type: 'num' },
      { key: 'preventable_loss_usd', label: 'Preventable Loss', type: 'money', decimals: 2 },
      { key: 'loss_within_5day_response_window', label: 'Within Window', type: 'money', decimals: 2 },
      { key: 'loss_after_response_window_missed', label: 'After Missed', type: 'money', decimals: 2 },
    ],
  });
  q8Table.render();
}

/* ============================================================
   Q9 — Pre-Crime Drift
   ============================================================ */
let q9Table;
function renderQ9() {
  const rows = store.q9;
  const avgSignals = rows.reduce((s,r)=>s+(r.drift_signals_positive||0),0)/rows.length;
  const maxSignal = rows.filter(r => r.drift_signals_positive === 4).length;

  document.getElementById('q9-kpis').innerHTML = `
    <div class="kpi"><div class="kpi-label">Accounts in pre-crime queue</div><div class="kpi-value">${fmtNum(rows.length)}</div><div class="kpi-sub">drifted before first fraud</div></div>
    <div class="kpi warn"><div class="kpi-label">Avg positive signals</div><div class="kpi-value">${avgSignals.toFixed(2)}</div><div class="kpi-sub">of 4 tracked drift metrics</div></div>
    <div class="kpi crit"><div class="kpi-label">All 4 signals positive</div><div class="kpi-value">${fmtNum(maxSignal)}</div><div class="kpi-sub">highest-confidence early warning</div></div>
    <div class="kpi"><div class="kpi-label">Avg IP-risk drift</div><div class="kpi-value">${(rows.reduce((s,r)=>s+(r.ip_drift||0),0)/rows.length).toFixed(1)}</div><div class="kpi-sub">percentage points</div></div>`;

  const signalCounts = [1,2,3,4].map(n => rows.filter(r => r.drift_signals_positive === n).length);
  makeChart('chart-q9-signals', {
    type: 'bar',
    data: {
      labels: ['1 signal','2 signals','3 signals','4 signals'],
      datasets: [{ label: 'Accounts', data: signalCounts, backgroundColor: ['#7C879E','#F0A23C','#F0793A','#E5484D'] }],
    },
    options: { responsive: true, maintainAspectRatio: false, scales: commonScales, plugins: { legend: { display: false } } },
  });

  makeChart('chart-q9-scatter', {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Accounts',
        data: rows.map(r => ({ x: r.ip_drift, y: r.velocity_drift })),
        backgroundColor: rows.map(r => r.drift_signals_positive === 4 ? VERDICT_COLORS.critical : '#F2A93B88'),
        pointRadius: 2.5,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: { x: { ...commonScales.x, title: { display: true, text: 'IP-risk drift (pp)', color: '#7C879E' } }, y: { ...commonScales.y, title: { display: true, text: 'Velocity drift', color: '#7C879E' } } },
      plugins: { legend: { display: false } },
    },
  });

  const filterSel = document.getElementById('q9-signal-filter');
  if (!filterSel.dataset.built) {
    filterSel.dataset.built = '1';
    filterSel.innerHTML = `<option value="__all__">All signal counts</option>` + [1,2,3,4].map(n => `<option value="${n}">${n} signals positive</option>`).join('');
    filterSel.addEventListener('change', () => q9Table.setFilter('drift_signals_positive', filterSel.value));
    document.getElementById('q9-search').addEventListener('input', (e) => q9Table.setSearch(e.target.value));
  }

  q9Table = createTable({
    tableEl: document.getElementById('table-q9'),
    pagerEl: document.getElementById('pg-q9'),
    data: rows,
    pageSize: 25,
    searchKeys: ['account_id'],
    columns: [
      { key: 'account_id', label: 'Account', type: 'mono' },
      { key: 'ip_drift', label: 'IP Drift', type: 'num', decimals: 2 },
      { key: 'velocity_drift', label: 'Velocity Drift', type: 'num', decimals: 2 },
      { key: 'foreign_pct_drift', label: 'Foreign % Drift', type: 'num', decimals: 2 },
      { key: 'spend_ratio_drift', label: 'Spend Ratio Drift', type: 'num', decimals: 2 },
      { key: 'drift_signals_positive', label: 'Signals', type: 'num' },
      { key: 'pre_crime_verdict', label: 'Verdict', type: 'chip' },
    ],
  });
  q9Table.render();
}

/* ============================================================
   Q10 — Pattern Evolution
   ============================================================ */
function renderQ10() {
  const rows = filteredRows(store.q10, 'pattern_a');
  // aggregate predecessor counts by pattern_a (unfiltered baseline for the bar view — always show full picture, filter still narrows table)
  const agg = {};
  store.q10.forEach(r => { agg[r.pattern_a] = (agg[r.pattern_a]||0) + (r.times_flagged_as_predecessor||0); });
  const labels = Object.keys(agg);
  makeChart('chart-q10-bars', {
    type: 'bar',
    data: {
      labels: labels.map(titleCase),
      datasets: [{ label: 'Times flagged as predecessor', data: labels.map(l => agg[l]), backgroundColor: labels.map(l => FRAUD_COLORS[l] || '#F2A93B') }],
    },
    options: { responsive: true, maintainAspectRatio: false, scales: commonScales, plugins: { legend: { display: false } } },
  });

  makeChart('chart-q10-scatter', {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Pattern transitions',
        data: store.q10.map(r => ({ x: r.behavioural_distance, y: r.median_distance_in_cohort })),
        backgroundColor: store.q10.map(r => VERDICT_COLORS[verdictTier(r.signal_strength_verdict)]),
        pointRadius: 6,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: { x: { ...commonScales.x, title: { display: true, text: 'Behavioural distance', color: '#7C879E' } }, y: { ...commonScales.y, title: { display: true, text: 'Cohort median distance', color: '#7C879E' } } },
      plugins: { legend: { display: false } },
    },
  });

  createTable({
    tableEl: document.getElementById('table-q10'),
    data: rows,
    columns: [
      { key: 'pattern_a', label: 'Predecessor', type: 'ftag' },
      { key: 'year_a', label: 'Year A', type: 'num' },
      { key: 'pattern_b', label: 'Successor', type: 'ftag' },
      { key: 'year_b', label: 'Year B', type: 'num' },
      { key: 'behavioural_distance', label: 'Distance', type: 'num', decimals: 3 },
      { key: 'median_distance_in_cohort', label: 'Cohort Median', type: 'num', decimals: 2 },
      { key: 'times_flagged_as_predecessor', label: 'Times Flagged', type: 'num' },
      { key: 'signal_strength_verdict', label: 'Verdict', type: 'chip' },
    ],
  }).render();
}

/* ---------------------------------------------------------
   BOOT
   --------------------------------------------------------- */
async function boot() {
  const statusEl = document.getElementById('boot-status');

  try { initSidebarToggle(); } catch (err) { console.error('initSidebarToggle failed (non-fatal):', err); }
  try { initNav(); } catch (err) { console.error('initNav failed (non-fatal):', err); }
  try { initFilterBar(); } catch (err) { console.error('initFilterBar failed (non-fatal):', err); }
  try { initQuickJump(); } catch (err) { console.error('initQuickJump failed (non-fatal):', err); }

  try {
    const [fraudPatterns, q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, heatmap] = await Promise.all([
      loadCSV(DATA.fraudPatterns), loadCSV(DATA.q1), loadCSV(DATA.q2), loadCSV(DATA.q3),
      loadCSV(DATA.q4), loadCSV(DATA.q5), loadCSV(DATA.q6), loadCSV(DATA.q7),
      loadCSV(DATA.q8), loadCSV(DATA.q9), loadCSV(DATA.q10), loadJSON(DATA.heatmap),
    ]);

    store = { fraudPatterns, q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, heatmap };

    if (statusEl) statusEl.textContent = 'Rendering case file…';

    renderOverview();
    renderQ1();
    renderQ2();
    renderQ3();
    renderQ4();
    renderQ5();
    renderQ6();
    renderQ7();
    renderQ8();
    renderQ9();
    renderQ10();

    const overlay = document.getElementById('boot-overlay');
    if (overlay) overlay.classList.add('hidden');
  } catch (err) {
    console.error('Failed to load case file data:', err);
    if (statusEl) statusEl.textContent = 'Error loading data — check the browser console and confirm you are running this via a local server (not file://).';
  }
}

document.addEventListener('DOMContentLoaded', boot);
})();
