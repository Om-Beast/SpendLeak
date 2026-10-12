const app = document.querySelector('#app');
const toastRegion = document.querySelector('#toast-region');
const state = {
  user: null,
  dashboard: null,
  preferences: { remindersEnabled: true, currency: 'INR' },
  section: 'overview',
  transactions: [],
  budgets: [],
  budgetPeriod: new Date().toISOString().slice(0, 7),
  transactionQuery: '',
  transactionDirection: 'all',
  importBusy: false,
  aiBusy: false,
  aiResult: null,
  selectedFile: null,
  authMode: 'login'
};

const icons = {
  overview: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
  transactions: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  recurring: '<path d="M20 7v5h-5"/><path d="M4.8 9A8 8 0 0 1 18.5 6L20 7M4 17v-5h5"/><path d="M19.2 15A8 8 0 0 1 5.5 18L4 17"/>',
  insights: '<path d="M4 19V5M4 19h17"/><path d="m7 15 4-4 3 2 6-7"/><path d="M16 6h4v4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.3 1-1.4 2.4-1.6-.6a7.5 7.5 0 0 1-1.8 1.1l-.3 1.7h-2.8l-.3-1.7a7.5 7.5 0 0 1-1.8-1.1l-1.6.6-1.4-2.4 1.3-1a7.6 7.6 0 0 1 0-2.1l-1.3-1 1.4-2.4 1.6.6a7.5 7.5 0 0 1 1.8-1.1L12.9 7h2.8l.3 1.7a7.5 7.5 0 0 1 1.8 1.1l1.6-.6 1.4 2.4-1.3 1a7.6 7.6 0 0 1-.1 2.4Z" transform="translate(-1.5 -1) scale(1.1)"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  down: '<path d="m7 10 5 5 5-5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  alert: '<path d="M10.3 3.9 2.5 17.4A1.8 1.8 0 0 0 4.1 20h15.8a1.8 1.8 0 0 0 1.6-2.6L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  sparkles: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15ZM5 2l.7 1.3L7 4l-1.3.7L5 6l-.7-1.3L3 4l1.3-.7L5 2Z"/>',
  shield: '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',
  wallet: '<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 9h18M16 15h.01"/><path d="M6 5V3h12v2"/>',
  arrowUp: '<path d="m7 14 5-5 5 5"/>',
  arrowDown: '<path d="m7 10 5 5 5-5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  close: '<path d="m18 6-12 12M6 6l12 12"/>',
  coffee: '<path d="M10 2v2M14 2v2M4 7h14v10a4 4 0 0 1-4 4h-6a4 4 0 0 1-4-4V7ZM18 9h2a2 2 0 1 1 0 4h-2"/>',
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  cart: '<circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M2 3h2l2.4 11.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6L22 7H5"/>',
  car: '<path d="m5 11 2-5h10l2 5M5 11h14l2 3v4h-2M3 18v-4l2-3M7 18h10"/><circle cx="7" cy="18" r="1.5"/><circle cx="17" cy="18" r="1.5"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  logout: '<path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  trend: '<path d="m3 17 6-6 4 4 8-9"/><path d="M15 6h6v6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>'
};

function icon(name, size = 18, className = '') {
  return `<svg class="icon ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.info}</svg>`;
}
function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
function formatMoney(minor, compact = false) {
  const currency = state.preferences.currency || 'INR';
  const amount = Number(minor || 0) / 100;
  const locale = currency === 'INR' ? 'en-IN' : 'en-US';
  return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: amount % 1 === 0 ? 0 : 2, notation: compact && Math.abs(amount) >= 100000 ? 'compact' : 'standard' }).format(amount);
}
function formatDate(date) {
  if (!date) return '—';
  const parsed = new Date(`${date.slice(0, 10)}T00:00:00`);
  return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function initials(name = 'SpendLeak') {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase();
}
function toast(message, kind = 'success') {
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.innerHTML = `${icon(kind === 'error' ? 'alert' : 'check', 17)}<span>${escapeHtml(message)}</span>`;
  toastRegion.append(el);
  setTimeout(() => { el.classList.add('toast-leave'); setTimeout(() => el.remove(), 220); }, 3600);
}
async function api(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (typeof options.body === 'string' && !headers['content-type']) headers['content-type'] = 'application/json';
  const response = await fetch(url, { credentials: 'same-origin', ...options, headers });
  const type = response.headers.get('content-type') || '';
  const payload = type.includes('application/json') ? await response.json() : null;
  if (!response.ok) throw Object.assign(new Error(payload?.error || 'Request failed. Please try again.'), { status: response.status });
  return payload;
}
async function loadDashboard() {
  const result = await api('/api/dashboard');
  state.dashboard = result.dashboard;
  state.preferences = result.preferences || state.preferences;
  await loadBudgets().catch(() => { state.budgets = []; });
}
async function loadBudgets() {
  const result = await api('/api/budgets');
  state.budgets = result.budgets || [];
  state.budgetPeriod = result.period || new Date().toISOString().slice(0, 7);
}
async function loadTransactions() {
  const params = new URLSearchParams({ limit: '500' });
  if (state.transactionQuery) params.set('q', state.transactionQuery);
  if (state.transactionDirection !== 'all') params.set('direction', state.transactionDirection);
  const result = await api(`/api/transactions?${params}`);
  state.transactions = result.transactions;
}

function bootScreen() {
  app.innerHTML = `<div class="boot-screen"><div class="brand-mark">S</div><span>Loading your workspace…</span></div>`;
}

function renderAuth() {
  const isSignup = state.authMode === 'signup';
  app.innerHTML = `
    <main class="auth-layout">
      <section class="auth-story">
        <div class="auth-story-glow"></div>
        <div class="auth-brand"><span class="brand-mark">S</span><span>spend<span class="brand-emphasis">leak</span></span></div>
        <div class="story-copy">
          <div class="eyebrow"><span class="pulse-dot"></span> YOUR MONEY, MADE CLEAR</div>
          <h1>Know where<br/>your money <span>goes.</span></h1>
          <p>Find recurring payments, catch unusual charges, and understand your spending — without handing over your bank login.</p>
          <div class="story-points">
            <div>${icon('shield', 19)}<span><b>Private by design</b><small>Import the CSV. Keep your bank credentials to yourself.</small></span></div>
            <div>${icon('trend', 19)}<span><b>Useful, not overwhelming</b><small>Clear patterns, practical explanations, no finance jargon.</small></span></div>
            <div>${icon('sparkles', 19)}<span><b>AI with guardrails</b><small>Deterministic checks first. Optional AI explanation second.</small></span></div>
          </div>
        </div>
        <div class="story-footer"><span>SpendLeak · Spending intelligence</span><span>Built for clarity.</span></div>
      </section>
      <section class="auth-panel">
        <div class="auth-panel-top"><span>Personal finance, minus the guesswork</span><span class="secure-label">${icon('shield', 14)} Private workspace</span></div>
        <form class="auth-card" id="auth-form">
          <div class="auth-card-kicker">${isSignup ? 'LET’S GET STARTED' : 'WELCOME BACK'}</div>
          <h2>${isSignup ? 'Create your workspace' : 'Welcome back'}</h2>
          <p>${isSignup ? 'Your spending, organized in one calm place.' : 'Sign in to pick up where you left off.'}</p>
          ${isSignup ? `<label class="field-label" for="auth-name">Your name</label><input class="field-input" id="auth-name" name="name" autocomplete="name" placeholder="e.g. Om Kesharwani" minlength="2" maxlength="70" required />` : ''}
          <label class="field-label" for="auth-email">Email address</label><input class="field-input" id="auth-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" maxlength="254" required />
          <label class="field-label" for="auth-password">Password</label><input class="field-input" id="auth-password" name="password" type="password" autocomplete="${isSignup ? 'new-password' : 'current-password'}" placeholder="${isSignup ? 'At least 10 characters' : 'Enter your password'}" minlength="${isSignup ? 10 : 1}" maxlength="128" required />
          ${isSignup ? `<div class="password-hint">Use at least 10 characters, including one letter and one number.</div>` : ''}
          <div id="auth-error" class="inline-error" role="alert" hidden></div>
          <button class="button button-primary button-full auth-submit" type="submit"><span>${isSignup ? 'Create free workspace' : 'Sign in securely'}</span>${icon('chevron', 17)}</button>
          <div class="auth-switch">${isSignup ? 'Already have an account?' : 'New to SpendLeak?'} <button type="button" class="text-button" data-action="toggle-auth">${isSignup ? 'Sign in' : 'Create an account'}</button></div>
          <div class="auth-divider"><span>OR TRY IT FIRST</span></div>
          <button type="button" class="button button-secondary button-full demo-button" data-action="demo"><span class="demo-sparkle">${icon('sparkles', 17)}</span><span><b>Explore the demo</b><small>Sample data · No sign-up required</small></span>${icon('chevron', 16)}</button>
          <div class="auth-disclaimer">${icon('lock', 15)} Your data stays in your workspace. Never enter online banking passwords here.</div>
        </form>
        <div class="auth-panel-bottom">© ${new Date().getFullYear()} SpendLeak <span>·</span> Clarity is a good habit.</div>
      </section>
    </main>`;
}

function renderShell(content) {
  const userName = state.user?.name || 'Your workspace';
  const nav = [
    { id: 'overview', label: 'Overview', icon: 'overview' },
    { id: 'transactions', label: 'Transactions', icon: 'transactions' },
    { id: 'recurring', label: 'Recurring payments', icon: 'recurring', count: state.dashboard?.recurring?.length || 0 },
    { id: 'budgets', label: 'Budget planner', icon: 'wallet', count: state.budgets?.length || 0 },
    { id: 'insights', label: 'Insights', icon: 'insights' }
  ];
  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar" id="sidebar">
        <a class="side-brand" href="#overview" data-action="navigate" data-section="overview"><span class="brand-mark">S</span><span>spend<span class="brand-emphasis">leak</span><small>SPENDING INTELLIGENCE</small></span></a>
        <div class="workspace-label">WORKSPACE</div>
        <div class="workspace-card"><span class="workspace-icon">${icon('wallet', 18)}</span><span><b>Personal finances</b><small>Private workspace</small></span><span class="workspace-chevron">${icon('down', 15)}</span></div>
        <nav class="primary-nav" aria-label="Main navigation">
          ${nav.map((item) => `<button class="nav-link ${state.section === item.id ? 'active' : ''}" type="button" data-action="navigate" data-section="${item.id}">${icon(item.icon, 18)}<span>${item.label}</span>${item.count ? `<span class="nav-count">${item.count}</span>` : ''}</button>`).join('')}
        </nav>
        <div class="sidebar-insight">
          <div class="sidebar-insight-icon">${icon('sparkles', 18)}</div><b>Small patterns add up.</b><p>SpendLeak helps you spot the little things before they become big surprises.</p><button type="button" class="text-button" data-action="navigate" data-section="insights">Explore your insights ${icon('chevron', 14)}</button>
        </div>
        <div class="sidebar-bottom">
          <button class="nav-link ${state.section === 'settings' ? 'active' : ''}" data-action="navigate" data-section="settings" type="button">${icon('settings', 18)}<span>Settings & privacy</span></button>
          <div class="user-menu"><span class="avatar">${escapeHtml(initials(userName))}</span><span class="user-meta"><b>${escapeHtml(userName)}</b><small>${state.user?.is_demo ? 'Interactive demo' : escapeHtml(state.user?.email || '')}</small></span><button class="icon-button logout-button" type="button" aria-label="Sign out" title="Sign out" data-action="logout">${icon('logout', 17)}</button></div>
        </div>
      </aside>
      <div class="mobile-scrim" data-action="close-sidebar"></div>
      <main class="main-panel">
        <header class="topbar"><button class="icon-button mobile-menu" aria-label="Open navigation" data-action="toggle-sidebar" type="button">${icon('menu', 20)}</button><div class="breadcrumb"><span>Workspace</span>${icon('chevron', 13)}<b>${nav.find((n) => n.id === state.section)?.label || (state.section === 'settings' ? 'Settings & privacy' : 'Insights')}</b></div><div class="topbar-actions"><span class="topbar-status"><span class="status-dot"></span> All data synced</span><button class="icon-button notification-button" type="button" data-action="notifications" aria-label="Upcoming reminders" title="Upcoming reminders">${icon('bell', 18)}${state.preferences.remindersEnabled ? '<i></i>' : ''}</button><span class="avatar avatar-small">${escapeHtml(initials(userName))}</span></div></header>
        <div class="page-content" id="page-content">${content}</div>
        <footer class="app-footer"><span>Made for clarity, not complexity.</span><span>${icon('shield', 14)} Your bank credentials are never requested.</span></footer>
      </main>
    </div>`;
}

function renderTrendChart(trend) {
  const items = trend || [];
  const max = Math.max(1, ...items.map((item) => item.amountMinor));
  return `<div class="trend-chart" role="img" aria-label="Monthly spending trend for the last six months">${items.map((item) => {
    const height = Math.max(3, Math.round(item.amountMinor / max * 100));
    const active = item.month === state.dashboard?.summary?.period;
    return `<div class="trend-column"><div class="trend-value">${formatMoney(item.amountMinor, true)}</div><div class="trend-track"><div class="trend-bar ${active ? 'is-current' : ''}" style="height:${height}%"></div></div><span class="trend-month ${active ? 'is-current' : ''}">${escapeHtml(item.label)}</span></div>`;
  }).join('')}</div>`;
}
function categoryIcon(category) {
  const lower = category.toLowerCase();
  if (lower.includes('food') || lower.includes('dining')) return ['coffee', 'lavender'];
  if (lower.includes('home') || lower.includes('bill')) return ['home', 'mint'];
  if (lower.includes('transport')) return ['car', 'blue'];
  if (lower.includes('shop')) return ['cart', 'peach'];
  if (lower.includes('subscription')) return ['sparkles', 'lavender'];
  if (lower.includes('grocer')) return ['cart', 'mint'];
  if (lower.includes('income')) return ['wallet', 'mint'];
  return ['wallet', 'blue'];
}
function renderCategories(categories) {
  if (!categories?.length) return `<div class="empty-inline">Your category breakdown will appear when you import transactions.</div>`;
  const palette = ['purple', 'green', 'orange', 'blue', 'pink', 'gray'];
  return `<div class="category-list">${categories.map((item, index) => {
    const [categoryIconName, color] = categoryIcon(item.name);
    return `<div class="category-row"><div class="category-icon ${color}">${icon(categoryIconName, 17)}</div><div class="category-copy"><div class="category-top"><span>${escapeHtml(item.name)}</span><b>${formatMoney(item.amountMinor)}</b></div><div class="category-progress"><span class="progress-fill ${palette[index % palette.length]}" style="width:${Math.max(2, Math.min(100, item.sharePercent))}%"></span></div><small>${item.sharePercent}% of monthly spend</small></div></div>`;
  }).join('')}</div>`;
}
function transactionIcon(transaction) {
  if (transaction.direction === 'income') return ['arrowDown', 'mint'];
  const [name, color] = categoryIcon(transaction.category || 'Other');
  return [name, color];
}
function renderRecentRows(transactions) {
  if (!transactions?.length) return `<div class="empty-state compact"><div class="empty-art">${icon('file', 25)}</div><b>No transactions yet</b><p>Upload a statement CSV or explore sample data to see your spending.</p><button class="button button-secondary" data-action="open-import">${icon('upload', 16)} Import CSV</button></div>`;
  return transactions.slice(0, 6).map((t) => {
    const [iconName, color] = transactionIcon(t);
    return `<tr><td><div class="merchant-cell"><span class="merchant-icon ${color}">${icon(iconName, 17)}</span><span><b>${escapeHtml(t.merchant || t.description)}</b><small>${escapeHtml(t.description)}</small></span></div></td><td><span class="date-text">${formatDate(t.date)}</span></td><td><span class="category-pill">${escapeHtml(t.category || 'Other')}</span></td><td class="amount-cell ${t.direction === 'income' ? 'income-amount' : ''}">${t.direction === 'income' ? '+' : '−'}${formatMoney(t.amountMinor)}</td></tr>`;
  }).join('');
}
function renderAnomalyPreview(anomalies) {
  if (!anomalies?.length) return `<div class="quiet-state"><span class="quiet-icon">${icon('check', 20)}</span><div><b>Nothing needs your attention</b><p>No unusual patterns found in the current data set.</p></div></div>`;
  return `<div class="anomaly-list">${anomalies.slice(0, 3).map((anomaly) => `<div class="anomaly-row"><span class="anomaly-icon ${anomaly.severity === 'high' ? 'danger' : ''}">${icon(anomaly.type === 'possible_duplicate' ? 'copy' : 'alert', 17)}</span><div class="anomaly-copy"><b>${escapeHtml(anomaly.title)}</b><small>${escapeHtml(anomaly.merchant)} · ${formatDate(anomaly.date)}</small><p>${escapeHtml(anomaly.reason)}</p></div><strong>${formatMoney(anomaly.amountMinor)}</strong></div>`).join('')}</div>`;
}
function renderRecurringPreview(items) {
  if (!items?.length) return `<div class="empty-inline">No recurring patterns yet. Import at least a few months of data to detect them.</div>`;
  return `<div class="recurring-preview">${items.slice(0, 4).map((item) => `<div class="recurring-row"><span class="merchant-icon lavender">${icon('clock', 17)}</span><span class="recurring-name"><b>${escapeHtml(item.merchant)}</b><small>${escapeHtml(item.cadence)} · Next ${formatDate(item.nextDate)}</small></span><span class="recurring-cost"><b>${formatMoney(item.amountMinor)}</b><small>${item.confidence === 'Likely' ? 'Likely recurring' : 'Possible recurring'}</small></span></div>`).join('')}</div>`;
}
function summaryMetric(label, value, iconName, color, trend, note) {
  return `<article class="metric-card"><div class="metric-card-top"><span>${escapeHtml(label)}</span><span class="metric-icon ${color}">${icon(iconName, 18)}</span></div><div class="metric-value">${value}</div><div class="metric-foot">${trend || ''}<span>${note}</span></div></article>`;
}

function renderBudgetSnapshot() {
  const items = [...state.budgets].sort((a, b) => b.usagePercent - a.usagePercent).slice(0, 3);
  const content = items.length ? items.map((item) => {
    const percent = Math.max(0, Math.min(100, item.usagePercent));
    const rightText = item.isOverBudget
      ? \`Over by \${formatMoney(Math.abs(item.remainingMinor))}\`
      : \`\${formatMoney(item.remainingMinor)} left\`;
    return \`<div class="budget-snapshot-row">
      <div class="budget-snapshot-meta"><span>\${escapeHtml(item.category)}</span><b>\${formatMoney(item.spentMinor)} <small>of \${formatMoney(item.monthlyLimitMinor)}</small></b></div>
      <div class="budget-snapshot-track" role="progressbar" aria-label="\${escapeHtml(item.category)} budget usage" aria-valuemin="0" aria-valuemax="100" aria-valuenow="\${Math.max(0, Math.min(100, item.usagePercent))}"><span class="\${item.isOverBudget ? 'over' : item.usagePercent >= 80 ? 'near' : ''}" style="width:\${percent}%"></span></div>
      <div class="budget-snapshot-foot \${item.isOverBudget ? 'over' : item.usagePercent >= 80 ? 'near' : ''}"><span>\${item.usagePercent}% used</span><small>\${rightText}</small></div>
    </div>\`;
  }).join('') : \`<div class="budget-snapshot-empty"><b>Give your spending a plan</b><p>Set a monthly category limit and see your progress here, alongside your spending trends.</p></div>\`;
  const savedLimit = state.budgets.reduce((sum, item) => sum + item.monthlyLimitMinor, 0);
  const tracked = state.budgets.reduce((sum, item) => sum + item.spentMinor, 0);
  return \`<section class="card budget-snapshot-card">
    <div class="budget-snapshot-heading"><div><span class="section-kicker">A PLAN FOR THIS MONTH</span><h2>Budget pulse</h2><p>\${state.budgets.length ? \`\${state.budgets.length} category limits · \${formatMoney(Math.max(0, savedLimit - tracked))} remaining across budgeted categories\` : 'Set limits to make spending goals easier to follow.'}</p></div><button class="button button-secondary" type="button" data-action="navigate" data-section="budgets">\${state.budgets.length ? 'Manage budgets' : 'Set a budget'} \${icon('chevron', 15)}</button></div>
    <div class="budget-snapshot-list">\${content}</div>
    \${state.budgets.length > 3 ? \`<button class="inline-link budget-snapshot-more" data-action="navigate" data-section="budgets">View all \${state.budgets.length} budgets \${icon('chevron', 14)}</button>\` : ''}
  </section>\`;
}

function renderOverview() {
  const dashboard = state.dashboard;
  const summary = dashboard.summary;
  const change = summary.monthChangePercent;
  const changeText = change === null ? '<span class="metric-neutral">—</span>' : `<span class="${change > 0 ? 'metric-up' : change < 0 ? 'metric-down' : 'metric-neutral'}">${change > 0 ? '↑' : change < 0 ? '↓' : '→'} ${Math.abs(change)}%</span>`;
  const firstName = (state.user?.name || 'there').split(/\s+/)[0];
  const remaining = Math.max(0, (summary.currentIncomeMinor || 0) - (summary.currentSpendMinor || 0));
  return `
    <section class="welcome-row"><div><div class="eyebrow subtle-eyebrow"><span class="pulse-dot"></span> YOUR MONEY, AT A GLANCE</div><h1>Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, ${escapeHtml(firstName)} <span class="wave">✳</span></h1><p>Here's how your money is moving this month. Let's make it make sense.</p></div><div class="welcome-actions"><button class="button button-secondary" type="button" data-action="export">${icon('download', 16)} Export</button><button class="button button-primary" type="button" data-action="open-import">${icon('plus', 17)} Import transactions</button></div></section>
    <section class="metrics-grid" aria-label="Monthly summary">
      ${summaryMetric('Tracked spending', formatMoney(summary.currentSpendMinor, true), 'wallet', 'purple', changeText, change === null ? 'vs. last month' : `${Math.abs(change)}% vs. last month`)}
      ${summaryMetric('Recurring payments', formatMoney(summary.recurringMonthlyMinor, true), 'recurring', 'mint', `<span class="metric-neutral">${dashboard.recurring.length} found</span>`, 'estimated monthly')}
      ${summaryMetric('Things to review', String(dashboard.anomalies.length).padStart(2, '0'), 'alert', 'peach', dashboard.anomalies.length ? '<span class="metric-attention">Worth a look</span>' : '<span class="metric-down">All clear</span>', 'unusual patterns')}
      ${summaryMetric('Transactions tracked', summary.availableTransactions.toLocaleString('en-IN'), 'transactions', 'blue', `<span class="metric-neutral">${summary.transactionCount} this month</span>`, 'across your imports')}
    </section>
    ${renderBudgetSnapshot()}
    <section class="main-grid dashboard-grid">
      <article class="card trend-card"><div class="card-heading"><div><span class="section-kicker">YOUR HISTORY</span><h2>Spending over time</h2><p>A six-month view of your outflow.</p></div><span class="period-chip">Last 6 months ${icon('down', 13)}</span></div><div class="chart-summary"><span>Total this month</span><b>${formatMoney(summary.currentSpendMinor)}</b>${change !== null ? `<span class="change-chip ${change > 0 ? 'change-negative' : 'change-positive'}">${change > 0 ? '+' : ''}${change}% <small>vs prior month</small></span>` : ''}</div>${renderTrendChart(dashboard.trend)}<div class="chart-footnote">${icon('info', 14)} Expenses only · Based on imported transactions</div></article>
      <article class="card category-card"><div class="card-heading"><div><span class="section-kicker">WHERE IT GOES</span><h2>Spending breakdown</h2><p>Current month by category.</p></div><button class="icon-button subtle-icon" title="View all transactions" data-action="navigate" data-section="transactions">${icon('more', 19)}</button></div>${renderCategories(dashboard.categories)}${dashboard.categories.length ? `<button class="inline-link" data-action="navigate" data-section="transactions">Explore transactions ${icon('chevron', 14)}</button>` : ''}</article>
    </section>
    <section class="lower-grid">
      <article class="card transactions-card"><div class="card-heading"><div><span class="section-kicker">LATEST ACTIVITY</span><h2>Recent transactions</h2><p>Your latest imported activity.</p></div><button class="inline-link" data-action="navigate" data-section="transactions">View all ${icon('chevron', 14)}</button></div><div class="table-wrap"><table class="data-table"><thead><tr><th>MERCHANT</th><th>DATE</th><th>CATEGORY</th><th class="align-right">AMOUNT</th></tr></thead><tbody>${renderRecentRows(dashboard.recentTransactions)}</tbody></table></div></article>
      <div class="right-stack"><article class="card recurring-card"><div class="card-heading"><div><span class="section-kicker">ON REPEAT</span><h2>Recurring payments</h2></div><button class="small-arrow" aria-label="View recurring payments" data-action="navigate" data-section="recurring">${icon('chevron', 17)}</button></div>${renderRecurringPreview(dashboard.recurring)}<div class="recurring-total"><span>Estimated monthly total</span><b>${formatMoney(summary.recurringMonthlyMinor)}</b></div></article>
      <article class="attention-card"><div class="attention-art">${icon('sparkles', 21)}</div><div class="attention-copy"><span class="section-kicker">A LITTLE CLARITY</span><h3>Make your money make sense.</h3><p>Get a plain-English read on your spending patterns. No scary jargon, just useful context.</p><button type="button" class="button button-dark" data-action="generate-ai" ${state.aiBusy ? 'disabled' : ''}>${icon('sparkles', 15)} ${state.aiBusy ? 'Thinking…' : 'Explain my spending'}</button></div></article></div>
    </section>
    <section class="privacy-note">${icon('shield', 17)}<span><b>Your data stays yours.</b> SpendLeak never asks for bank credentials. Optional AI explanations use aggregated numbers, not raw transaction descriptions.</span><button class="inline-link" data-action="navigate" data-section="settings">Privacy details ${icon('chevron', 13)}</button></section>
    ${state.aiResult ? renderAiResult() : ''}`;
}
function renderAiResult() {
  return `<article class="card ai-result-card"><div class="ai-result-heading"><span class="ai-orb">${icon('sparkles', 18)}</span><div><span class="section-kicker">SPENDLEAK EXPLAINS</span><h2>Your spending, in plain English</h2></div><button class="icon-button" data-action="dismiss-ai" aria-label="Dismiss insight">${icon('close', 17)}</button></div><div class="ai-result-text">${escapeHtml(state.aiResult.text).split('\n\n').map((p) => `<p>${p}</p>`).join('')}</div><small class="ai-disclaimer">${escapeHtml(state.aiResult.disclaimer || 'Helpful context, not financial advice.')}</small></article>`;
}

function renderTransactions() {
  const rows = state.transactions;
  return `<section class="page-heading"><div><div class="eyebrow subtle-eyebrow">YOUR MONEY, LINE BY LINE</div><h1>Transactions</h1><p>Every imported transaction, searchable and ready to understand.</p></div><button class="button button-primary" data-action="open-import">${icon('upload', 16)} Import CSV</button></section>
    <section class="card transaction-manager"><div class="table-toolbar"><div class="search-wrap">${icon('search', 17)}<input type="search" id="transaction-search" class="search-input" value="${escapeHtml(state.transactionQuery)}" placeholder="Search merchants, categories…" aria-label="Search transactions"/><kbd>/</kbd></div><div class="toolbar-right"><select class="select-input" id="transaction-direction" aria-label="Filter transaction type"><option value="all" ${state.transactionDirection === 'all' ? 'selected' : ''}>All transactions</option><option value="expense" ${state.transactionDirection === 'expense' ? 'selected' : ''}>Expenses</option><option value="income" ${state.transactionDirection === 'income' ? 'selected' : ''}>Income</option></select><button class="button button-secondary" data-action="export">${icon('download', 15)} Export CSV</button></div></div>
    <div class="table-wrap"><table class="data-table full-transactions"><thead><tr><th>MERCHANT / DESCRIPTION</th><th>DATE</th><th>CATEGORY</th><th>TYPE</th><th class="align-right">AMOUNT</th><th></th></tr></thead><tbody>${rows.length ? rows.map((t) => { const [name, color] = transactionIcon(t); return `<tr><td><div class="merchant-cell"><span class="merchant-icon ${color}">${icon(name, 16)}</span><span><b>${escapeHtml(t.merchant || t.description)}</b><small>${escapeHtml(t.description)}</small></span></div></td><td>${formatDate(t.date)}</td><td><span class="category-pill">${escapeHtml(t.category || 'Other')}</span></td><td><span class="type-pill ${t.direction}">${t.direction === 'income' ? 'Income' : 'Expense'}</span></td><td class="amount-cell align-right ${t.direction === 'income' ? 'income-amount' : ''}">${t.direction === 'income' ? '+' : '−'}${formatMoney(t.amountMinor)}</td><td><button class="icon-button row-delete" data-action="delete-transaction" data-id="${escapeHtml(t.id)}" aria-label="Delete transaction" title="Delete transaction">${icon('trash', 15)}</button></td></tr>`; }).join('') : `<tr><td colspan="6"><div class="empty-state"><div class="empty-art">${icon('search', 25)}</div><b>No transactions found</b><p>Try a different search or import a CSV statement.</p><button class="button button-secondary" data-action="open-import">Import CSV</button></div></td></tr>`}</tbody></table></div><div class="table-bottom"><span>Showing <b>${rows.length}</b> transaction${rows.length === 1 ? '' : 's'} · Private to your workspace</span><span>${icon('shield', 14)} Stored on your application server</span></div></section>
    <div class="inline-info">${icon('info', 16)} Exact same-merchant, same-date, same-amount transactions are flagged as possible duplicates — they are not automatically deleted.</div>`;
}

function renderRecurring() {
  const items = state.dashboard.recurring;
  const yearly = items.reduce((sum, item) => sum + item.totalAnnualMinor, 0);
  return `<section class="page-heading"><div><div class="eyebrow subtle-eyebrow">THE CHARGES THAT COME BACK</div><h1>Recurring payments</h1><p>Spot subscriptions and repeat bills from the history you uploaded.</p></div><button class="button button-secondary" data-action="open-import">${icon('plus', 16)} Add more history</button></section>
    <section class="metrics-grid recurring-metrics">${summaryMetric('Estimated monthly cost', formatMoney(state.dashboard.summary.recurringMonthlyMinor), 'recurring', 'mint', `<span class="metric-neutral">${items.length} patterns</span>`, 'normalised to 30 days')}${summaryMetric('Estimated yearly cost', formatMoney(yearly), 'calendar', 'purple', '<span class="metric-neutral">Projection</span>', 'not a bill forecast')}${summaryMetric('Needs confirmation', String(items.filter((item) => item.confidence !== 'Likely').length), 'info', 'peach', '<span class="metric-neutral">2 observations</span>', 'possible recurring patterns')}</section>
    <section class="card recurring-table-card"><div class="card-heading"><div><span class="section-kicker">REPEAT PATTERNS</span><h2>Payments we noticed</h2><p>Patterns are inferred from transaction dates and amounts, not merchant claims.</p></div><span class="soft-pill">${items.length} detected</span></div>${items.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>MERCHANT</th><th>FREQUENCY</th><th>LAST CHARGE</th><th>NEXT ESTIMATE</th><th class="align-right">TYPICAL AMOUNT</th></tr></thead><tbody>${items.map((item) => `<tr><td><div class="merchant-cell"><span class="merchant-icon lavender">${icon('clock', 17)}</span><span><b>${escapeHtml(item.merchant)}</b><small>${item.confidence === 'Likely' ? 'Likely recurring' : 'Possible recurring'} · ${item.occurrences} observations</small></span></div></td><td><span class="category-pill">${escapeHtml(item.cadence)}</span></td><td>${formatDate(item.lastDate)}</td><td><b>${formatDate(item.nextDate)}</b>${item.increased ? `<small class="amount-increase">↑ ${item.amountChangePercent}% vs previous</small>` : ''}</td><td class="amount-cell align-right">${formatMoney(item.amountMinor)}</td></tr>`).join('')}</tbody></table></div>` : `<div class="empty-state"><div class="empty-art">${icon('recurring', 26)}</div><b>Not enough repeat history yet</b><p>Recurring patterns need at least two matching transactions with a plausible interval. Three or more observations increase confidence.</p><button class="button button-primary" data-action="open-import">Import a statement</button></div>`}</section>
    <section class="privacy-note">${icon('info', 17)}<span><b>Estimates are not promises.</b> Payment dates can shift, cards can change, and merchants may use different descriptors. Confirm a subscription with the provider before making decisions.</span></section>`;
}

function renderInsights() {
  const anomalies = state.dashboard.anomalies;
  return `<section class="page-heading"><div><div class="eyebrow subtle-eyebrow">PATTERNS WORTH A SECOND LOOK</div><h1>Insights</h1><p>Rule-based flags with the evidence behind them. You stay in control.</p></div><button class="button button-primary" data-action="generate-ai" ${state.aiBusy ? 'disabled' : ''}>${icon('sparkles', 16)} Explain my spending</button></section>
    <section class="insight-hero"><div class="insight-hero-copy"><span class="eyebrow">A CLEARER PICTURE</span><h2>Small clues.<br/><span>Better questions.</span></h2><p>SpendLeak does not label a transaction as fraud. It looks for patterns that may deserve a closer look and shows why a pattern was flagged.</p><button class="button button-dark" data-action="navigate" data-section="transactions">Review transactions ${icon('chevron', 15)}</button></div><div class="insight-hero-stats"><div><span>Patterns found</span><b>${anomalies.length.toString().padStart(2, '0')}</b><small>across imported history</small></div><div><span>Recurring payments</span><b>${state.dashboard.recurring.length.toString().padStart(2, '0')}</b><small>estimated by cadence</small></div></div></section>
    <section class="card insight-list-card"><div class="card-heading"><div><span class="section-kicker">REVIEW QUEUE</span><h2>Things to check</h2><p>Each finding links back to its source transaction.</p></div><span class="soft-pill">${anomalies.length} flags</span></div>${anomalies.length ? `<div class="insights-list">${anomalies.map((item) => `<article class="insight-item"><span class="insight-item-icon ${item.severity === 'high' ? 'danger' : item.type === 'possible_duplicate' ? 'orange' : 'purple'}">${icon(item.type === 'possible_duplicate' ? 'copy' : 'trend', 19)}</span><div class="insight-item-content"><div class="insight-item-top"><h3>${escapeHtml(item.title)}</h3><span class="severity-pill ${item.severity}">${item.severity === 'high' ? 'Higher priority' : 'Review suggested'}</span></div><p>${escapeHtml(item.reason)}</p><div class="insight-evidence"><span>${icon('calendar', 13)} ${formatDate(item.date)}</span><span>${icon('wallet', 13)} ${escapeHtml(item.merchant)}</span><span>${icon('info', 13)} ${item.type === 'possible_duplicate' ? 'Exact-pattern match' : 'Median-based comparison'}</span></div></div><div class="insight-amount"><b>${formatMoney(item.amountMinor)}</b><button class="inline-link" data-action="navigate" data-section="transactions">View ledger ${icon('chevron', 13)}</button></div></article>`).join('')}</div>` : `<div class="quiet-state large-quiet"><span class="quiet-icon">${icon('check', 22)}</span><div><b>No review flags in this dataset</b><p>That's good. New flags may appear as you import more history. A quiet result is not a guarantee that every transaction is correct.</p></div></div>`}</section>
    ${state.aiResult ? renderAiResult() : ''}
    <div class="inline-info">${icon('shield', 16)} These checks identify unusual patterns, not fraud. Verify transactions with your bank or merchant before taking action.</div>`;
}

function renderSettings() {
  return `<section class="page-heading"><div><div class="eyebrow subtle-eyebrow">YOUR DATA, YOUR CALL</div><h1>Settings & privacy</h1><p>Manage your preferences and choose what happens to your imported data.</p></div></section>
    <div class="settings-layout"><section class="card settings-card"><div class="settings-section-title"><span class="settings-icon">${icon('wallet', 19)}</span><div><h2>Workspace preferences</h2><p>Choose how amounts and reminders are shown.</p></div></div><div class="setting-row"><div><b>Display currency</b><small>Changes the displayed symbol. Does not convert underlying amounts.</small></div><select class="select-input" id="currency-select"><option value="INR" ${state.preferences.currency === 'INR' ? 'selected' : ''}>INR · Indian rupee</option><option value="USD" ${state.preferences.currency === 'USD' ? 'selected' : ''}>USD · US dollar</option><option value="EUR" ${state.preferences.currency === 'EUR' ? 'selected' : ''}>EUR · Euro</option><option value="GBP" ${state.preferences.currency === 'GBP' ? 'selected' : ''}>GBP · Pound sterling</option></select></div><div class="setting-row"><div><b>Reminder prompts</b><small>Show in-app reminders for estimated recurring payment dates.</small></div><label class="toggle"><input type="checkbox" id="reminders-toggle" ${state.preferences.remindersEnabled ? 'checked' : ''}/><span></span></label></div><div class="settings-note">${icon('info', 15)} Reminder dates are estimates based on past transactions. This MVP does not access bank accounts or send background SMS/email notifications.</div></section>
    <section class="card settings-card"><div class="settings-section-title"><span class="settings-icon blue">${icon('shield', 19)}</span><div><h2>Privacy & AI</h2><p>Understand what is stored and what leaves the server.</p></div></div><div class="privacy-bullet"><span>${icon('check', 16)}</span><div><b>No bank login connections</b><p>SpendLeak reads the CSV you choose to import; it never requests banking passwords, account numbers, or API access.</p></div></div><div class="privacy-bullet"><span>${icon('check', 16)}</span><div><b>AI is optional</b><p>Only when you click “Explain my spending” may aggregated totals, category labels, and counts be sent to Gemini. Raw descriptions and transaction dates are excluded.</p></div></div><div class="privacy-bullet"><span>${icon('check', 16)}</span><div><b>Server-side persistence</b><p>Transactions are saved in this app’s SQLite database, associated with your account. Use the data controls below to delete imports.</p></div></div></section>
    <section class="card settings-card danger-zone"><div class="settings-section-title"><span class="settings-icon danger">${icon('trash', 19)}</span><div><h2>Data controls</h2><p>These actions cannot be undone.</p></div></div><div class="setting-row"><div><b>Delete imported data</b><small>Remove all transactions and import history from this workspace. Your account will remain.</small></div><button class="button button-danger" data-action="clear-data">Delete all data</button></div></section></div>`;
}


function renderBudgets() {
  const presets = ['Food & dining','Shopping','Transport','Home & bills','Subscriptions','Groceries','Entertainment','Other'];
  const categories = [...new Set([...presets, ...(state.dashboard?.categories || []).map(x => x.name), ...state.budgets.map(x => x.category)])].sort((a,b)=>a.localeCompare(b));
  const totalLimit = state.budgets.reduce((s,x)=>s+x.monthlyLimitMinor,0);
  const totalSpent = state.budgets.reduce((s,x)=>s+x.spentMinor,0);
  const remaining = totalLimit-totalSpent;
  const cards = state.budgets.length ? state.budgets.map(item => {
    const percent=Math.max(0,Math.min(100,item.usagePercent));
    const status=item.isOverBudget ? `Over by ${formatMoney(Math.abs(item.remainingMinor))}` : `${formatMoney(item.remainingMinor)} left`;
    return `<article class="budget-card">
      <div class="budget-card-top"><span class="budget-category-icon">${icon('wallet',18)}</span><div class="budget-title"><b>${escapeHtml(item.category)}</b><small>${escapeHtml(state.budgetPeriod)} · Monthly limit</small></div><div class="budget-actions"><button class="icon-button" data-action="edit-budget" data-category="${escapeHtml(item.category)}" data-limit="${item.monthlyLimitMinor}" type="button" title="Edit budget" aria-label="Edit budget">${icon('settings',16)}</button><button class="icon-button budget-delete" data-action="delete-budget" data-id="${escapeHtml(item.id)}" type="button" title="Delete budget" aria-label="Delete budget">${icon('trash',16)}</button></div></div>
      <div class="budget-numbers"><div><strong>${formatMoney(item.spentMinor)}</strong><span>spent</span></div><div class="budget-limit"><strong>${formatMoney(item.monthlyLimitMinor)}</strong><span>monthly budget</span></div></div>
      <div class="budget-progress" role="progressbar" aria-label="${escapeHtml(item.category)} budget usage" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.max(0,Math.min(100,item.usagePercent))}"><span class="${item.isOverBudget?'over':item.usagePercent>=80?'near':''}" style="width:${percent}%"></span></div>
      <div class="budget-status ${item.isOverBudget?'over':item.usagePercent>=80?'near':''}"><span>${item.usagePercent}% used</span><b>${status}</b></div></article>`;
  }).join('') : `<div class="budget-empty"><span>${icon('wallet',25)}</span><b>Your first budget starts here</b><p>Choose a category and monthly limit. SpendLeak compares it with expenses from the current month.</p></div>`;
  return `<section class="page-heading budget-page-heading"><div><div class="eyebrow subtle-eyebrow">PLAN WITH CLARITY</div><h1>Budget planner</h1><p>Set monthly limits and see how your tracked spending is progressing.</p></div><span class="budget-period-pill">${escapeHtml(state.budgetPeriod)} · Current month</span></section>
  <section class="budget-summary-grid"><article class="budget-summary-card"><span>Total monthly limits</span><strong>${formatMoney(totalLimit)}</strong><small>Across ${state.budgets.length} categories</small></article><article class="budget-summary-card"><span>Tracked spend in budgeted categories</span><strong>${formatMoney(totalSpent)}</strong><small>Current month, expenses only</small></article><article class="budget-summary-card ${remaining<0?'over':''}"><span>${remaining<0?'Combined overage':'Budget remaining'}</span><strong>${formatMoney(Math.abs(remaining))}</strong><small>Only categories with a saved budget</small></article></section>
  <div class="budget-layout"><section class="budget-list-panel"><div class="budget-section-heading"><div><span class="section-kicker">YOUR LIMITS</span><h2>Category budgets</h2></div><span class="budget-count">${state.budgets.length} set</span></div><div class="budget-card-list">${cards}</div><div class="budget-footnote">${icon('info',15)} Calculated from imported transactions with a matching category. This is not a live bank balance.</div></section>
  <aside class="card budget-form-card"><div class="budget-form-icon">${icon('sliders-horizontal',21)}</div><span class="section-kicker">MAKE A PLAN</span><h2 id="budget-form-title">Set a monthly limit</h2><p>Create a budget or choose an existing category to update its limit.</p><form id="budget-form">
  <label class="field-label" for="budget-category">Spending category</label><input class="field-input" id="budget-category" name="category" list="budget-category-options" maxlength="48" placeholder="e.g. Food & dining" required/><datalist id="budget-category-options">${categories.map(x=>`<option value="${escapeHtml(x)}"></option>`).join('')}</datalist>
  <label class="field-label" for="budget-limit">Monthly budget (₹)</label><div class="budget-amount-input"><span>₹</span><input class="field-input" id="budget-limit" name="monthlyLimit" type="number" min="1" max="1000000000" step="0.01" inputmode="decimal" placeholder="5000" required/></div>
  <p class="budget-form-hint">Use the same category label as your transactions. You can update or remove a limit any time.</p><div class="budget-form-error" id="budget-error" role="alert" hidden></div><div class="budget-form-buttons"><button class="button button-primary button-full" id="budget-submit" type="submit">Save budget ${icon('chevron',16)}</button><button class="button button-secondary button-full" id="budget-cancel-edit" type="button" data-action="cancel-budget-edit" hidden>Cancel edit</button></div></form></aside></div>`;
}

function showPage() {
  if (!state.user || !state.dashboard) return renderAuth();
  let content = '';
  if (state.section === 'overview') content = renderOverview();
  if (state.section === 'transactions') content = renderTransactions();
  if (state.section === 'recurring') content = renderRecurring();
  if (state.section === 'budgets') content = renderBudgets();
  if (state.section === 'insights') content = renderInsights();
  if (state.section === 'settings') content = renderSettings();
  renderShell(content);
}

function renderImportModal() {
  const existing = document.querySelector('.modal-layer');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.className = 'modal-layer';
  modal.innerHTML = `<section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="import-title"><div class="modal-heading"><div><span class="section-kicker">ADD YOUR HISTORY</span><h2 id="import-title">Import transactions</h2><p>Bring a CSV statement. Keep bank credentials out of it.</p></div><button class="icon-button" data-action="close-modal" aria-label="Close">${icon('close', 18)}</button></div><div class="import-privacy">${icon('shield', 16)} CSV stays on your application server. Files are limited to 1 MB / 10,000 rows.</div><label for="csv-file" class="dropzone" id="dropzone"><span class="dropzone-icon">${icon('upload', 24)}</span><b id="file-title">Drop a CSV here or <span>browse files</span></b><small id="file-subtitle">CSV only · Up to 1 MB</small><input type="file" id="csv-file" accept=".csv,text/csv" hidden /></label><div class="csv-expectations"><b>We look for:</b><span>Date</span><span>Description</span><span>Amount</span><small>Debit / Credit columns also supported.</small></div><div class="sample-data-row"><div class="sample-file-icon">${icon('file', 18)}</div><div><b>Need a sample format?</b><small>Download a safe example to see the supported columns.</small></div><button class="inline-link" data-action="sample-csv">Get sample ${icon('download', 13)}</button></div><div id="import-result" class="inline-error" role="status" hidden></div><div class="modal-actions"><button class="button button-secondary" data-action="close-modal">Cancel</button><button class="button button-primary" id="confirm-import" data-action="confirm-import" disabled>${icon('upload', 16)} Import transactions</button></div></section>`;
  document.body.append(modal);
  state.selectedFile = null;
  const fileInput = modal.querySelector('#csv-file');
  const dropzone = modal.querySelector('#dropzone');
  const chooseFile = (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) return showImportError('Choose a .csv file.');
    if (file.size > 1_000_000) return showImportError('This file is too large. Please choose a CSV under 1 MB.');
    state.selectedFile = file;
    modal.querySelector('#file-title').innerHTML = `<span class="file-selected-name">${escapeHtml(file.name)}</span>`;
    modal.querySelector('#file-subtitle').textContent = `${(file.size / 1024).toFixed(1)} KB · Ready to import`;
    modal.querySelector('#confirm-import').disabled = false;
    modal.querySelector('#import-result').hidden = true;
    dropzone.classList.add('has-file');
  };
  fileInput.addEventListener('change', () => chooseFile(fileInput.files?.[0]));
  dropzone.addEventListener('dragover', (event) => { event.preventDefault(); dropzone.classList.add('is-dragging'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-dragging'));
  dropzone.addEventListener('drop', (event) => { event.preventDefault(); dropzone.classList.remove('is-dragging'); chooseFile(event.dataTransfer?.files?.[0]); });
  modal.querySelector('#confirm-import').addEventListener('click', importSelectedFile);
  modal.querySelectorAll('[data-action="close-modal"]').forEach((button) => button.addEventListener('click', closeImportModal));
  modal.addEventListener('click', (event) => { if (event.target === modal) closeImportModal(); });
  modal.querySelector('[data-action="sample-csv"]').addEventListener('click', downloadSampleCsv);
  modal.querySelector('#csv-file').focus();
}
function showImportError(message) {
  const error = document.querySelector('#import-result');
  if (!error) return toast(message, 'error');
  error.textContent = message; error.hidden = false; error.className = 'inline-error visible';
}
function closeImportModal() { document.querySelector('.modal-layer')?.remove(); state.selectedFile = null; state.importBusy = false; }
async function importSelectedFile() {
  if (!state.selectedFile || state.importBusy) return;
  state.importBusy = true;
  const button = document.querySelector('#confirm-import');
  button.disabled = true; button.innerHTML = '<span class="spinner"></span> Importing…';
  try {
    const text = await state.selectedFile.text();
    const result = await api('/api/import', { method: 'POST', headers: { 'content-type': 'text/csv; charset=utf-8', 'x-file-name': encodeURIComponent(state.selectedFile.name) }, body: text });
    await loadDashboard();
    await loadTransactions();
    closeImportModal();
    state.section = 'overview'; state.aiResult = null; showPage();
    toast(result.alreadyImported ? 'This exact file was already imported.' : `${result.imported} transactions imported successfully.`);
    if (result.invalidRows) toast(`${result.invalidRows} row(s) could not be imported. Review your CSV format.`, 'error');
    if (result.duplicateCandidates) toast(`${result.duplicateCandidates} repeated row(s) may be duplicates; review them in Insights.`, 'error');
  } catch (error) {
    state.importBusy = false;
    button.disabled = false; button.innerHTML = `${icon('upload', 16)} Import transactions`;
    showImportError(error.message);
  }
}
function downloadText(filename, text, mime = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function downloadSampleCsv() {
  const sample = [
    'Date,Description,Amount,Type,Category',
    '2026-10-02,NETFLIX.COM MONTHLY,649,Debit,Subscriptions',
    '2026-10-03,SWIGGY UPI REF 982771,499,Debit,Food & dining',
    '2026-10-04,SALARY CREDIT,65000,Credit,Income',
    '2026-10-06,SPOTIFY PREMIUM,119,Debit,Subscriptions',
    '2026-10-07,AMAZON PAY ORDER 873413,1299,Debit,Shopping',
    '2026-10-08,GOOGLE ONE STORAGE,130,Debit,Subscriptions',
    '2026-10-09,UBER INDIA TRIP 44920,284,Debit,Transport'
  ].join('\r\n');
  downloadText('spendleak-sample-transactions.csv', `\uFEFF${sample}`);
}
async function exportTransactions() {
  try {
    const response = await fetch('/api/export.csv', { credentials: 'same-origin' });
    if (!response.ok) throw new Error('Could not export transactions.');
    const blob = await response.blob(); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'spendleak-transactions.csv'; a.click(); URL.revokeObjectURL(url);
    toast('Your CSV export is ready.');
  } catch (error) { toast(error.message, 'error'); }
}
async function generateAI() {
  if (state.aiBusy) return;
  state.aiBusy = true; state.aiResult = null; showPage();
  try {
    const result = await api('/api/ai/insights', { method: 'POST', body: '{}' });
    state.aiResult = result.insights;
    toast(result.insights.provider === 'gemini' ? 'AI explanation is ready.' : 'Rule-based explanation is ready.');
  } catch (error) { toast(error.message, 'error'); }
  finally { state.aiBusy = false; showPage(); }
}
async function navigate(section) {
  state.section = section;
  if (section === 'transactions') await loadTransactions();
  if (section === 'budgets') await loadBudgets();
  showPage();
  document.querySelector('#sidebar')?.classList.remove('sidebar-open');
  document.querySelector('.mobile-scrim')?.classList.remove('visible');
}
async function submitAuth(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  const error = form.querySelector('#auth-error');
  const button = form.querySelector('.auth-submit');
  error.hidden = true; button.disabled = true; button.classList.add('is-loading');
  try {
    const route = state.authMode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
    const result = await api(route, { method: 'POST', body: JSON.stringify(data) });
    state.user = result.user; state.section = 'overview'; state.aiResult = null;
    await loadDashboard(); await loadTransactions(); showPage();
    toast(state.user.is_demo ? 'Welcome to the interactive demo.' : 'You are signed in.');
  } catch (err) { error.textContent = err.message; error.hidden = false; }
  finally { button.disabled = false; button.classList.remove('is-loading'); }
}
async function exploreDemo(button) {
  button.disabled = true; button.classList.add('is-loading');
  try {
    const result = await api('/api/demo', { method: 'POST', body: '{}' });
    state.user = result.user; state.section = 'overview'; await loadDashboard(); await loadTransactions(); showPage();
    toast('Demo workspace ready. Sample transactions are loaded.');
  } catch (error) { toast(error.message, 'error'); button.disabled = false; button.classList.remove('is-loading'); }
}
async function logout() {
  try { await api('/api/auth/logout', { method: 'POST', body: '{}' }); } catch { /* Local UI still clears if the network is unavailable. */ }
  state.user = null; state.dashboard = null; state.transactions = []; state.aiResult = null; state.section = 'overview'; state.authMode = 'login'; renderAuth();
}

async function submitBudget(form) {
  const data=new FormData(form), category=String(data.get('category')||'').trim(), amount=Number(data.get('monthlyLimit'));
  const error=form.querySelector('#budget-error'), button=form.querySelector('#budget-submit');
  error.hidden=true;
  if(!category||category.length>48||/[<>]/.test(category)){error.textContent='Enter a category name between 1 and 48 characters.';error.hidden=false;return;}
  if(!Number.isFinite(amount)||amount<1||amount>1_000_000_000){error.textContent='Enter a monthly limit between ₹1 and ₹1,000,000,000.';error.hidden=false;return;}
  button.disabled=true;button.classList.add('is-loading');
  try {
    await api('/api/budgets',{method:'POST',body:JSON.stringify({category,monthlyLimitMinor:Math.round(amount*100)})});
    await loadBudgets();showPage();toast(`Monthly budget saved for ${category}.`);
  } catch(err){error.textContent=err.message;error.hidden=false;}
  finally{button.disabled=false;button.classList.remove('is-loading');}
}
async function deleteBudget(id) {
  if(!confirm('Delete this category budget? Your transactions will not be changed.'))return;
  try{await api(`/api/budgets/${encodeURIComponent(id)}`,{method:'DELETE'});await loadBudgets();showPage();toast('Budget deleted.');}
  catch(error){toast(error.message,'error');}
}
function editBudget(category,limitMinor) {
  const form=document.querySelector('#budget-form');if(!form)return;
  form.elements.category.value=category;form.elements.monthlyLimit.value=(Number(limitMinor)/100).toFixed(2);
  document.querySelector('#budget-form-title').textContent='Update monthly limit';
  document.querySelector('#budget-submit').innerHTML='Update budget '+icon('chevron',16);
  document.querySelector('#budget-cancel-edit').hidden=false;document.querySelector('#budget-category').focus();
  form.scrollIntoView({behavior:'smooth',block:'start'});
}
function cancelBudgetEdit() {
  const form=document.querySelector('#budget-form');if(!form)return;form.reset();
  document.querySelector('#budget-form-title').textContent='Set a monthly limit';
  document.querySelector('#budget-submit').innerHTML='Save budget '+icon('chevron',16);
  document.querySelector('#budget-cancel-edit').hidden=true;
  const error=document.querySelector('#budget-error');if(error)error.hidden=true;
}

async function deleteTransaction(id) {
  if (!confirm('Delete this transaction? This cannot be undone.')) return;
  try { await api(`/api/transactions/${encodeURIComponent(id)}`, { method: 'DELETE' }); await loadDashboard(); await loadTransactions(); showPage(); toast('Transaction deleted.'); }
  catch (error) { toast(error.message, 'error'); }
}
async function clearData() {
  if (!confirm('Delete every imported transaction and import history from this workspace? Your account will stay.')) return;
  try { await api('/api/data', { method: 'DELETE' }); state.aiResult = null; await loadDashboard(); await loadTransactions(); showPage(); toast('Imported data deleted.'); }
  catch (error) { toast(error.message, 'error'); }
}
function showUpcomingReminders() {
  if (!state.preferences.remindersEnabled) return toast('In-app reminders are turned off in settings.', 'error');
  const next = state.dashboard.recurring.filter((item) => item.nextDate >= new Date().toISOString().slice(0, 10)).slice(0, 3);
  if (!next.length) return toast('No upcoming estimated recurring dates found yet.');
  toast(`Next estimate: ${next.map((item) => `${item.merchant} on ${formatDate(item.nextDate)}`).join(' · ')}`);
}
let searchDebounce = null;
function onAppInput(event) {
  if (event.target.id === 'transaction-search') {
    state.transactionQuery = event.target.value;
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(async () => {
      try { await loadTransactions(); const input = document.querySelector('#transaction-search'); showPage(); const next = document.querySelector('#transaction-search'); if (next) { next.focus(); next.setSelectionRange(input?.selectionStart || 0, input?.selectionStart || 0); } }
      catch (error) { toast(error.message, 'error'); }
    }, 180);
  }
}
async function onAppChange(event) {
  if (event.target.id === 'transaction-direction') {
    state.transactionDirection = event.target.value;
    await loadTransactions(); showPage();
  }
  if (event.target.id === 'currency-select') {
    try { const result = await api('/api/preferences', { method: 'PATCH', body: JSON.stringify({ currency: event.target.value }) }); state.preferences = result.preferences; await loadDashboard(); showPage(); toast('Display preference saved.'); }
    catch (error) { toast(error.message, 'error'); }
  }
  if (event.target.id === 'reminders-toggle') {
    try { const result = await api('/api/preferences', { method: 'PATCH', body: JSON.stringify({ remindersEnabled: event.target.checked }) }); state.preferences = result.preferences; showPage(); toast(`In-app reminder prompts ${event.target.checked ? 'enabled' : 'disabled'}.`); }
    catch (error) { toast(error.message, 'error'); }
  }
}

app.addEventListener('click', async (event) => {
  const control = event.target.closest('[data-action]');
  if (!control) return;
  const action = control.dataset.action;
  if (action === 'toggle-auth') { state.authMode = state.authMode === 'signup' ? 'login' : 'signup'; renderAuth(); }
  else if (action === 'demo') exploreDemo(control);
  else if (action === 'navigate') navigate(control.dataset.section);
  else if (action === 'open-import') renderImportModal();
  else if (action === 'close-modal') closeImportModal();
  else if (action === 'sample-csv') downloadSampleCsv();
  else if (action === 'export') exportTransactions();
  else if (action === 'generate-ai') generateAI();
  else if (action === 'dismiss-ai') { state.aiResult = null; showPage(); }
  else if (action === 'logout') logout();
  else if (action === 'delete-transaction') deleteTransaction(control.dataset.id);
  else if (action === 'edit-budget') editBudget(control.dataset.category, control.dataset.limit);
  else if (action === 'delete-budget') deleteBudget(control.dataset.id);
  else if (action === 'cancel-budget-edit') cancelBudgetEdit();
  else if (action === 'clear-data') clearData();
  else if (action === 'notifications') showUpcomingReminders();
  else if (action === 'toggle-sidebar') { document.querySelector('#sidebar')?.classList.toggle('sidebar-open'); document.querySelector('.mobile-scrim')?.classList.toggle('visible'); }
  else if (action === 'close-sidebar') { document.querySelector('#sidebar')?.classList.remove('sidebar-open'); document.querySelector('.mobile-scrim')?.classList.remove('visible'); }
});
app.addEventListener('submit', (event) => {
  if (event.target.id === 'auth-form') { event.preventDefault(); submitAuth(event.target); }
  if (event.target.id === 'budget-form') { event.preventDefault(); submitBudget(event.target); }
});
app.addEventListener('input', onAppInput);
app.addEventListener('change', onAppChange);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeImportModal();
  if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) && state.section === 'transactions') {
    event.preventDefault(); document.querySelector('#transaction-search')?.focus();
  }
});

async function init() {
  try {
    const result = await api('/api/me');
    state.user = result.user;
    if (state.user) { await loadDashboard(); await loadTransactions(); showPage(); }
    else renderAuth();
  } catch { renderAuth(); toast('Could not reach the server. Check that SpendLeak is running.', 'error'); }
}
init();
