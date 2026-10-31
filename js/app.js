/* =============================================
   BudgetTrack — Vanilla JS Expense Tracker
   All data stored in localStorage.
   Charts drawn on <canvas> (no libraries).
   ============================================= */

'use strict';

/* ── Constants ── */
const STORAGE_KEY = 'budgettrack_v1';

const CATEGORY_COLORS = {
  'Food & Drink':      '#f97316',
  'Transportation':    '#3b82f6',
  'Entertainment':     '#a855f7',
  'Shopping':          '#ec4899',
  'Health':            '#14b8a6',
  'Education':         '#8b5cf6',
  'Bills & Utilities': '#ef4444',
  'Income':            '#22c55e',
  'Other':             '#94a3b8',
};

const CATEGORY_ICONS = {
  'Food & Drink':      '🍜',
  'Transportation':    '🚗',
  'Entertainment':     '🎬',
  'Shopping':          '🛍️',
  'Health':            '💊',
  'Education':         '📚',
  'Bills & Utilities': '💡',
  'Income':            '💰',
  'Other':             '📌',
};

/* ── State ── */
let transactions = loadTransactions();
let budgets = { monthly: 2000000 };

/* ── DOM refs ── */
const form          = document.getElementById('transactionForm');
const itemNameInput = document.getElementById('itemName');
const amountInput   = document.getElementById('amount');
const typeSelect    = document.getElementById('type');
const categorySelect= document.getElementById('category');
const txDateInput   = document.getElementById('txDate');
const balanceEl     = document.getElementById('balanceDisplay');
const txListEl      = document.getElementById('txList');
const txCountEl     = document.getElementById('txCount');
const listEmptyEl   = document.getElementById('listEmpty');
const pieCanvas     = document.getElementById('pieChart');
const pieLegendEl   = document.getElementById('pieLegend');
const pieEmptyEl    = document.getElementById('pieEmpty');
const lineCanvas    = document.getElementById('lineChart');
const lineEmptyEl   = document.getElementById('lineEmpty');
const toastEl       = document.getElementById('toast');
const budgetListEl  = document.getElementById('budgetList');
const themeToggle   = document.getElementById('themeToggle');
const themeIcon     = document.getElementById('themeIcon');
const themeRays     = document.getElementById('themeRays');

/* ── Theme Toggle ── */
function loadTheme() {
  return localStorage.getItem('budgettrack_theme') || 'light';
}

function saveTheme(theme) {
  localStorage.setItem('budgettrack_theme', theme);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  if (theme === 'dark') {
    themeIcon.innerHTML = '<circle cx="12" cy="12" r="5" fill="currentColor" stroke="none"></circle>';
    themeRays.setAttribute('stroke', '#fbbf24');
  } else {
    themeIcon.innerHTML = '<circle cx="12" cy="12" r="5" fill="none" stroke="currentColor"></circle>';
    themeRays.setAttribute('stroke', '#fbbf24');
  }
}

// Initial theme
const currentTheme = loadTheme();
applyTheme(currentTheme);

// Toggle handler
themeToggle.addEventListener('click', () => {
  const newTheme = loadTheme() === 'light' ? 'dark' : 'light';
  saveTheme(newTheme);
  applyTheme(newTheme);
});

/* ── Init ── */
function init() {
  setTodayAsDefault();
  render();
}
init();

/* ── Form submit ── */
form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!validateForm()) return;

  const tx = {
    id:       crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2),
    name:     itemNameInput.value.trim(),
    amount:   parseFloat(amountInput.value),
    type:     typeSelect.value,
    category: categorySelect.value,
    date:     txDateInput.value || todayString(),
    createdAt: Date.now(),
  };

  transactions.unshift(tx);
  saveTransactions();
  render();
  form.reset();
  setTodayAsDefault();
  showToast('Transaction added ✓');
});

/* ── Validate ── */
function validateForm() {
  let ok = true;
  const nameErr = document.getElementById('itemNameError');
  const amtErr  = document.getElementById('amountError');
  const catErr  = document.getElementById('categoryError');
  [itemNameInput, amountInput, categorySelect].forEach(el => el.classList.remove('invalid'));
  nameErr.textContent = ''; amtErr.textContent = ''; catErr.textContent = '';

  if (!itemNameInput.value.trim()) {
    itemNameInput.classList.add('invalid');
    nameErr.textContent = 'Item name is required.';
    ok = false;
  }
  const amt = parseFloat(amountInput.value);
  if (!amountInput.value || isNaN(amt) || amt <= 0) {
    amountInput.classList.add('invalid');
    amtErr.textContent = 'Enter a valid positive amount.';
    ok = false;
  }
  if (!categorySelect.value) {
    categorySelect.classList.add('invalid');
    catErr.textContent = 'Please select a category.';
    ok = false;
  }
  return ok;
}

[itemNameInput, amountInput, categorySelect].forEach(el => {
  el.addEventListener('input', () => el.classList.remove('invalid'));
  el.addEventListener('change', () => el.classList.remove('invalid'));
});

/* ── Render everything ── */
function render() {
  renderBalance();
  renderTransactionList();
  renderPieChart();
  renderLineChart();
  renderBudgetSummary();
  renderBudgetHistory();
}

/* ── Balance ── */
function renderBalance() {
  const balance = computeBalance();
  balanceEl.textContent = formatRp(balance);
  balanceEl.classList.toggle('negative', balance < 0);
  balanceEl.classList.toggle('positive', balance >= 0);
}

function computeBalance() {
  return transactions.reduce((sum, tx) => tx.type === 'income' ? sum + tx.amount : sum - tx.amount, 0);
}

/* ── Transaction list ── */
function renderTransactionList() {
  Array.from(txListEl.querySelectorAll('.tx-item')).forEach(el => el.remove());
  const count = transactions.length;
  txCountEl.textContent = `${count} ${count === 1 ? 'entry' : 'entries'}`;
  listEmptyEl.style.display = count === 0 ? 'block' : 'none';
  transactions.forEach(tx => txListEl.appendChild(buildTxItem(tx)));
}

function buildTxItem(tx) {
  const div = document.createElement('div');
  div.className = 'tx-item';
  div.dataset.id = tx.id;
  const color = CATEGORY_COLORS[tx.category] || '#94a3b8';
  const icon  = CATEGORY_ICONS[tx.category]  || '📌';
  const sign  = tx.type === 'income' ? '+' : '−';
  div.innerHTML = `
    <div class="tx-icon" style="background:${color}22; color:${color}; font-size:1.15rem;">
      ${icon}
    </div>
    <div class="tx-details">
      <div class="tx-name">${escapeHtml(tx.name)}</div>
      <div class="tx-meta">
        <span>${formatDate(tx.date)}</span>
        <span class="tx-category-badge" style="color:${color};">${escapeHtml(tx.category)}</span>
      </div>
    </div>
    <span class="tx-amount ${tx.type}">${sign}${formatRp(tx.amount)}</span>
    <button class="btn-delete" title="Delete transaction" aria-label="Delete">✕</button>
  `;
  div.querySelector('.btn-delete').addEventListener('click', () => deleteTransaction(tx.id));
  return div;
}

/* ── Delete ── */
function deleteTransaction(id) {
  transactions = transactions.filter(tx => tx.id !== id);
  saveTransactions();
  render();
  showToast('Transaction deleted.');
}

/* ── Pie Chart ── */
function renderPieChart() {
  const ctx = pieCanvas.getContext('2d');
  const size = 160;
  pieCanvas.width = size; pieCanvas.height = size;
  const expenses = transactions.filter(tx => tx.type === 'expense');
  if (expenses.length === 0) {
    ctx.clearRect(0, 0, size, size);
    pieEmptyEl.classList.add('visible');
    pieLegendEl.innerHTML = '';
    pieCanvas.style.display = 'none';
    return;
  }
  pieEmptyEl.classList.remove('visible');
  pieCanvas.style.display = 'block';
  const totals = {};
  expenses.forEach(tx => totals[tx.category] = (totals[tx.category] || 0) + tx.amount);
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  const cx = size / 2, cy = size / 2, r = size / 2 - 6;
  let startAngle = -Math.PI / 2;
  ctx.clearRect(0, 0, size, size);
  entries.forEach(([cat, val]) => {
    const slice = (val / total) * 2 * Math.PI;
    const color = CATEGORY_COLORS[cat] || '#94a3b8';
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, startAngle, startAngle + slice); ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    startAngle += slice;
  });
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.42, 0, 2 * Math.PI); ctx.fillStyle = '#fff'; ctx.fill();
  pieLegendEl.innerHTML = entries.map(([cat, val]) => {
    const pct = ((val / total) * 100).toFixed(1);
    const color = CATEGORY_COLORS[cat] || '#94a3b8';
    return `<div class="legend-item"><span class="legend-dot" style="background:${color};"></span><span>${escapeHtml(cat)} <strong>${pct}%</strong></span></div>`;
  }).join('');
}

/* ── Line Chart ── */
function renderLineChart() {
  const ctx = lineCanvas.getContext('2d');
  const W = lineCanvas.offsetWidth || 340, H = 180;
  lineCanvas.width = W; lineCanvas.height = H;
  if (transactions.length === 0) {
    ctx.clearRect(0, 0, W, H);
    lineEmptyEl.classList.add('visible');
    lineCanvas.style.display = 'none';
    return;
  }
  lineEmptyEl.classList.remove('visible');
  lineCanvas.style.display = 'block';
  const sorted = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date) || a.createdAt - b.createdAt);
  const points = [];
  let running = 0;
  sorted.forEach(tx => {
    running += tx.type === 'income' ? tx.amount : -tx.amount;
    points.push({ date: tx.date, balance: running, name: tx.name });
  });
  const pad = { top: 20, right: 16, bottom: 36, left: 56 };
  const chartW = W - pad.left - pad.right, chartH = H - pad.top - pad.bottom;
  const balances = points.map(p => p.balance);
  const minVal = Math.min(...balances, 0), maxVal = Math.max(...balances, 0);
  const range = maxVal - minVal || 1;
  const toX = (i) => pad.left + (i / Math.max(points.length - 1, 1)) * chartW;
  const toY = (v) => pad.top + (1 - (v - minVal) / range) * chartH;
  ctx.clearRect(0, 0, W, H);
  const gridSteps = 4;
  ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1;
  ctx.fillStyle = '#94a3b8'; ctx.font = '10px system-ui'; ctx.textAlign = 'right';
  for (let i = 0; i <= gridSteps; i++) {
    const val = minVal + (range * i) / gridSteps, y = toY(val);
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
    ctx.fillText(shortRp(val), pad.left - 6, y + 3.5);
  }
  if (minVal < 0 && maxVal > 0) {
    const y0 = toY(0);
    ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(pad.left, y0); ctx.lineTo(W - pad.right, y0); ctx.stroke();
    ctx.setLineDash([]);
  }
  const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
  grad.addColorStop(0, 'rgba(79,70,229,.25)'); grad.addColorStop(1, 'rgba(79,70,229,.02)');
  ctx.beginPath(); ctx.moveTo(toX(0), toY(points[0].balance));
  points.forEach((p, i) => { if (i === 0) return; ctx.lineTo(toX(i), toY(p.balance)); });
  ctx.lineTo(toX(points.length - 1), pad.top + chartH); ctx.lineTo(toX(0), pad.top + chartH); ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();
  ctx.beginPath(); ctx.strokeStyle = '#4f46e5'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  points.forEach((p, i) => i === 0 ? ctx.moveTo(toX(i), toY(p.balance)) : ctx.lineTo(toX(i), toY(p.balance)));
  ctx.stroke();
  points.forEach((p, i) => {
    const x = toX(i), y = toY(p.balance);
    ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 2 * Math.PI); ctx.fillStyle = '#4f46e5'; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
  });
  ctx.fillStyle = '#94a3b8'; ctx.font = '9.5px system-ui'; ctx.textAlign = 'center'; ctx.lineWidth = 1;
  const labelStep = Math.ceil(points.length / 6);
  points.forEach((p, i) => { if (i % labelStep !== 0 && i !== points.length - 1) return; ctx.fillText(shortDate(p.date), toX(i), H - pad.bottom + 14); });
}

/* ── Storage ── */
function loadTransactions() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; } }
function saveTransactions() { localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions)); }

/* ── Toast ── */
let toastTimer;
function showToast(msg) {
  toastEl.textContent = msg; toastEl.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2400);
}

/* ── Helpers ── */
function formatRp(n) { return 'Rp ' + Math.abs(n).toLocaleString('id-ID'); }
function shortRp(n) {
  const abs = Math.abs(n), sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return sign + (abs / 1_000_000).toFixed(1) + 'M';
  if (abs >= 1_000) return sign + (abs / 1_000).toFixed(0) + 'K';
  return sign + abs.toFixed(0);
}
function formatDate(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1]} ${y}`;
}
function shortDate(str) {
  if (!str) return '';
  const [, m, d] = str.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1]}`;
}
function todayString() { return new Date().toISOString().slice(0, 10); }
function setTodayAsDefault() { txDateInput.value = todayString(); }
function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── Monthly Budget Functions ── */
function computeMonthlySpending(year, month) {
  return transactions
    .filter(tx => {
      const txDate = new Date(tx.date + 'T00:00:00');
      return tx.type === 'expense' && txDate.getFullYear() === year && txDate.getMonth() === month;
    })
    .reduce((sum, tx) => sum + tx.amount, 0);
}

function computeCurrentMonthSpending() {
  const now = new Date();
  return computeMonthlySpending(now.getFullYear(), now.getMonth());
}

function getCurrentMonthStatus() {
  const used = computeCurrentMonthSpending();
  const limit = budgets.monthly || 0;
  if (limit <= 0) return { percent: 0, barClass: 'normal', cardClass: '' };
  const percent = Math.min((used / limit) * 100, 100);
  if (used > limit) return { percent: 100, barClass: 'overspent', cardClass: 'overspent' };
  if (used >= limit * 0.8) return { percent, barClass: 'warning', cardClass: 'warning' };
  return { percent, barClass: 'normal', cardClass: '' };
}

function renderBudgetSummary() {
  const status = getCurrentMonthStatus();
  const used = computeCurrentMonthSpending();
  const limit = budgets.monthly || 0;
  budgetListEl.innerHTML = `
    <div class="budget-card ${status.cardClass}">
      <div class="budget-title"><span>Current Month</span><span>${formatRp(used)}</span></div>
      <div class="budget-progress">
        <div class="budget-bar ${status.barClass}" style="width: ${status.percent}%"></div>
      </div>
      <div class="budget-label"><span>Limit: ${formatRp(limit)}</span><span>${status.percent.toFixed(1)}%</span></div>
    </div>
  `;
  document.getElementById('currentMonthBudget').textContent = formatRp(limit);
}

function renderBudgetHistory() {
  const historyListEl = document.getElementById('budgetHistoryList');
  const months = {};
  transactions.forEach(tx => {
    if (tx.type === 'expense') {
      const date = new Date(tx.date + 'T00:00:00');
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!months[key]) months[key] = { year: date.getFullYear(), month: date.getMonth(), total: 0 };
      months[key].total += tx.amount;
    }
  });
  const entries = Object.values(months).sort((a, b) => a.year !== b.year ? b.year - a.year : b.month - a.month);
  if (entries.length === 0) {
    historyListEl.innerHTML = '<p style="color:var(--text-muted); font-size:.85rem; text-align:center; padding:1rem;">No history available yet. Start adding transactions to see monthly trends.</p>';
    return;
  }
  const colors = { overspent: '#ef4444', warning: '#f59e0b', normal: '#22c55e' };
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  historyListEl.innerHTML = entries.map(m => {
    const spent = m.total, limit = budgets.monthly || 0;
    const status = spent > limit ? 'overspent' : (spent >= limit * 0.8 ? 'warning' : 'normal');
    return `
      <div class="budget-history-item" style="display:flex;justify-content:space-between;align-items:center;padding:.75rem 0;border-bottom:1px solid var(--border);">
        <div class="history-label"><strong>${monthNames[m.month]} ${m.year}</strong></div>
        <div class="history-value" style="color:${colors[status]};font-weight:600;">${formatRp(spent)}</div>
      </div>
    `;
  }).join('');
}

/* ── Re-render charts on window resize ── */
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { renderPieChart(); renderLineChart(); }, 150);
});
