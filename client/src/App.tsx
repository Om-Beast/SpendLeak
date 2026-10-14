import React, { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3,
  Bell, CalendarClock, Check, ChevronDown, CircleDollarSign, Clock3, CreditCard,
  Download, FileUp, LayoutDashboard, LoaderCircle, LogOut, Menu, Plus,
  ReceiptText, Repeat2, Search, Settings2, ShieldCheck, Sparkles, Trash2,
  TrendingUp, Upload, Wallet, X, type LucideIcon
} from 'lucide-react';

type Page = 'overview' | 'transactions' | 'recurring' | 'insights' | 'budgets' | 'settings';
type User = { id: string; name: string; email: string; is_demo?: number };
type Summary = {
  currentSpendMinor: number; previousSpendMinor: number; currentIncomeMinor: number;
  monthChangePercent: number | null; transactionCount: number; averageTransactionMinor: number;
  recurringMonthlyMinor: number; availableTransactions: number; period: string;
};
type Transaction = {
  id: string; date: string; description: string; merchant: string; amountMinor: number;
  direction: 'expense' | 'income'; category: string;
};
type Recurring = {
  id: string; merchant: string; cadence: string; amountMinor: number; nextDate: string;
  lastDate: string; occurrences: number; confidence: string; totalAnnualMinor: number;
  increased: boolean; amountChangePercent: number;
};
type Anomaly = {
  transactionId: string; type: string; severity: string; title: string; reason: string;
  amountMinor: number; date: string; merchant: string; reviewStatus: 'open' | 'reviewed' | 'dismissed';
};
type Budget = {
  id: string; category: string; monthlyLimitMinor: number; spentMinor: number;
  remainingMinor: number; usagePercent: number; isOverBudget: boolean;
};
type Dashboard = {
  summary: Summary;
  trend: { month: string; label: string; amountMinor: number }[];
  categories: { name: string; amountMinor: number; sharePercent: number }[];
  topMerchants: { merchant: string; amountMinor: number; transactions: number }[];
  recurring: Recurring[];
  anomalies: Anomaly[];
  recentTransactions: Transaction[];
};
type Preferences = { remindersEnabled: number | boolean; currency: string };
type WorkspaceData = {
  dashboard: Dashboard; transactions: Transaction[]; budgets: Budget[]; preferences: Preferences;
};
type Notice = { message: string; kind: 'success' | 'error' | 'info' } | null;

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { credentials: 'same-origin', ...init });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok) throw new Error(payload?.error || 'Request failed. Please try again.');
  return payload as T;
}

async function loadWorkspace(): Promise<WorkspaceData> {
  const [dashboardResult, transactionsResult, budgetResult] = await Promise.all([
    request<{ dashboard: Dashboard; preferences: Preferences }>('/api/dashboard'),
    request<{ transactions: Transaction[] }>('/api/transactions?limit=500'),
    request<{ budgets: Budget[] }>('/api/budgets')
  ]);
  return {
    dashboard: dashboardResult.dashboard,
    preferences: dashboardResult.preferences || { currency: 'INR', remindersEnabled: false },
    transactions: transactionsResult.transactions || [],
    budgets: budgetResult.budgets || []
  };
}

const navItems: { id: Page; label: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', icon: ReceiptText },
  { id: 'recurring', label: 'Recurring payments', icon: Repeat2 },
  { id: 'insights', label: 'Insights & review', icon: Activity },
  { id: 'budgets', label: 'Budgets', icon: Wallet }
];

function money(minor: number | null | undefined, currency = 'INR', compact = false): string {
  const amount = Number(minor || 0) / 100;
  try {
    return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency', currency, maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
      notation: compact && Math.abs(amount) >= 100000 ? 'compact' : 'standard'
    }).format(amount);
  } catch {
    return '₹' + amount.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }
}

function niceDate(value: string): string {
  if (!value) return '—';
  const date = new Date(value.slice(0, 10) + 'T00:00:00Z');
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function monthName(value: string): string {
  return new Date(value + '-01T00:00:00Z').toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' });
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase() || 'SL';
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [preferences, setPreferences] = useState<Preferences>({ currency: 'INR', remindersEnabled: false });
  const [page, setPage] = useState<Page>('overview');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [initializing, setInitializing] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiResult, setAiResult] = useState<{ text: string; provider: string; disclaimer: string } | null>(null);
  const [query, setQuery] = useState('');
  const [direction, setDirection] = useState<'all' | 'expense' | 'income'>('all');
  const [budgetCategory, setBudgetCategory] = useState('Subscriptions');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [busyKey, setBusyKey] = useState('');

  const currency = preferences.currency || 'INR';
  const toast = useCallback((message: string, kind: 'success' | 'error' | 'info' = 'success') => {
    setNotice({ message, kind });
  }, []);

  const syncWorkspace = useCallback(async () => {
    const data = await loadWorkspace();
    setDashboard(data.dashboard);
    setTransactions(data.transactions);
    setBudgets(data.budgets);
    setPreferences(data.preferences);
  }, []);

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      try {
        const result = await request<{ user: User | null }>('/api/me');
        if (!active) return;
        if (result.user) {
          setUser(result.user);
          const data = await loadWorkspace();
          if (!active) return;
          setDashboard(data.dashboard);
          setTransactions(data.transactions);
          setBudgets(data.budgets);
          setPreferences(data.preferences);
        }
      } catch {
        if (active) setNotice({ message: 'Could not load your workspace. Please refresh and try again.', kind: 'error' });
      } finally {
        if (active) setInitializing(false);
      }
    };
    void initialize();
    return () => { active = false; };
  }, []);

  const completeAuth = async (nextUser: User, message: string) => {
    setUser(nextUser);
    setInitializing(true);
    try {
      await syncWorkspace();
      toast(message);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not load account data.', 'error');
    } finally {
      setInitializing(false);
    }
  };

  const handleAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthBusy(true);
    const form = new FormData(event.currentTarget);
    const body: Record<string, string> = {
      email: String(form.get('email') || '').trim(),
      password: String(form.get('password') || '')
    };
    if (authMode === 'signup') body.name = String(form.get('name') || '').trim();
    try {
      const result = await request<{ user: User }>('/api/auth/' + (authMode === 'signup' ? 'signup' : 'login'), {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
      });
      await completeAuth(result.user, authMode === 'signup' ? 'Your private workspace is ready.' : 'Welcome back.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Unable to sign in.', 'error');
    } finally {
      setAuthBusy(false);
    }
  };

  const exploreDemo = async () => {
    setAuthBusy(true);
    try {
      const result = await request<{ user: User }>('/api/demo', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}'
      });
      await completeAuth(result.user, 'Demo workspace loaded with synthetic transactions.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Unable to open demo.', 'error');
    } finally {
      setAuthBusy(false);
    }
  };

  const logout = async () => {
    try {
      await request('/api/auth/logout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      setUser(null); setDashboard(null); setTransactions([]); setBudgets([]); setAiResult(null);
      setPage('overview');
      toast('You have been signed out.', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not sign out.', 'error');
    }
  };

  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 1_000_000) {
      toast('CSV files must be 1 MB or smaller.', 'error');
      return;
    }
    setImportBusy(true);
    try {
      const csv = await file.text();
      const result = await request<{ imported: number; invalidRows: number; alreadyImported: boolean; message: string }>('/api/import', {
        method: 'POST',
        headers: { 'content-type': 'text/csv; charset=utf-8', 'x-file-name': encodeURIComponent(file.name) },
        body: csv
      });
      await syncWorkspace();
      toast(result.alreadyImported ? 'This CSV was already imported; no duplicate rows were added.' : result.message + ' Added ' + result.imported + ' rows.', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'CSV import failed.', 'error');
    } finally {
      setImportBusy(false);
    }
  };

  const explainSpending = async () => {
    setAiBusy(true);
    try {
      const result = await request<{ insights: { text: string; provider: string; disclaimer: string } }>('/api/ai/insights', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}'
      });
      setAiResult(result.insights);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not generate the explanation.', 'error');
    } finally {
      setAiBusy(false);
    }
  };

  const reviewAnomaly = async (id: string, status: 'reviewed' | 'dismissed') => {
    setBusyKey(id + status);
    try {
      await request('/api/anomaly-reviews', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ transactionId: id, status })
      });
      await syncWorkspace();
      toast(status === 'reviewed' ? 'Finding marked as reviewed.' : 'Finding dismissed.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not update finding.', 'error');
    } finally {
      setBusyKey('');
    }
  };

  const reopenAnomaly = async (id: string) => {
    try {
      await request('/api/anomaly-reviews/' + encodeURIComponent(id), { method: 'DELETE' });
      await syncWorkspace();
      toast('Finding returned to the review queue.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not reopen finding.', 'error');
    }
  };

  const deleteTransaction = async (transaction: Transaction) => {
    if (!window.confirm('Delete this transaction? This cannot be undone.')) return;
    try {
      await request('/api/transactions/' + encodeURIComponent(transaction.id), { method: 'DELETE' });
      await syncWorkspace();
      toast('Transaction deleted.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not delete transaction.', 'error');
    }
  };

  const saveBudget = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(budgetAmount);
    if (!Number.isFinite(amount) || amount < 1) {
      toast('Enter a monthly budget greater than zero.', 'error');
      return;
    }
    setBusyKey('budget');
    try {
      await request('/api/budgets', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ category: budgetCategory.trim(), monthlyLimitMinor: Math.round(amount * 100) })
      });
      await syncWorkspace();
      setBudgetAmount('');
      toast('Monthly budget saved.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not save budget.', 'error');
    } finally {
      setBusyKey('');
    }
  };

  const deleteBudget = async (id: string) => {
    try {
      await request('/api/budgets/' + encodeURIComponent(id), { method: 'DELETE' });
      await syncWorkspace();
      toast('Budget removed.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not remove budget.', 'error');
    }
  };

  const clearData = async () => {
    if (!window.confirm('Delete all imported transactions and import history from this account? Your account will remain.')) return;
    try {
      await request('/api/data', { method: 'DELETE' });
      setAiResult(null);
      await syncWorkspace();
      toast('Your transaction data and import history were deleted.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not delete account data.', 'error');
    }
  };

  const deleteAccount = async () => {
    if (!window.confirm('Permanently delete your account, sessions, budgets and associated data? This cannot be undone.')) return;
    try {
      await request('/api/account', { method: 'DELETE' });
      setUser(null); setDashboard(null); setTransactions([]); setBudgets([]); setAiResult(null);
      setPage('overview');
      toast('Account and associated app data deleted.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not delete account.', 'error');
    }
  };

  const filteredTransactions = useMemo(() => transactions.filter((transaction) => {
    const searchText = (transaction.description + ' ' + transaction.merchant + ' ' + transaction.category).toLowerCase();
    const matchesQuery = searchText.includes(query.toLowerCase().trim());
    return matchesQuery && (direction === 'all' || transaction.direction === direction);
  }), [transactions, query, direction]);

  if (initializing) {
    return <div className="loading-screen"><div className="loading-mark">S</div><LoaderCircle className="spin" size={19} /><span>Preparing your workspace</span></div>;
  }

  if (!user) {
    return (
      <div className="auth-shell">
        <section className="auth-story">
          <div className="auth-orb orb-one" /><div className="auth-orb orb-two" />
          <div className="brand-lockup"><span className="brand-symbol">S</span><span>spend<span className="brand-accent">leak</span></span></div>
          <div className="auth-copy">
            <div className="eyebrow"><span className="pulse-dot" /> SPENDING, WITH CLARITY</div>
            <h1>Your money has a story.<br /><span>Make sense of it.</span></h1>
            <p>Spot subscriptions that keep returning, review charges that look different, and see where your money goes — using a CSV you choose.</p>
            <div className="auth-promises">
              <div><ShieldCheck size={18} /><span><b>Privacy by design</b><small>No bank login, PIN or OTP required.</small></span></div>
              <div><TrendingUp size={18} /><span><b>Explainable analytics</b><small>Deterministic rules, with evidence to review.</small></span></div>
              <div><Sparkles size={18} /><span><b>AI, with boundaries</b><small>Optional plain-English explanations of totals.</small></span></div>
            </div>
          </div>
          <div className="auth-footnote">A portfolio project for transparent spending insights.</div>
        </section>
        <section className="auth-panel">
          <div className="auth-panel-top"><span>PERSONAL SPENDING INTELLIGENCE</span><span className="secure-pill"><ShieldCheck size={14} /> Private workspace</span></div>
          <form className="auth-card" onSubmit={(event) => void handleAuth(event)}>
            <div className="section-kicker">{authMode === 'login' ? 'WELCOME BACK' : 'START FRESH'}</div>
            <h2>{authMode === 'login' ? 'Sign in to SpendLeak' : 'Create your workspace'}</h2>
            <p>{authMode === 'login' ? 'Pick up where you left off.' : 'Your spending, organized in one calm place.'}</p>
            {authMode === 'signup' && <label className="field"><span>Your name</span><input name="name" autoComplete="name" placeholder="e.g. Om Kesharwani" minLength={2} maxLength={70} required /></label>}
            <label className="field"><span>Email address</span><input name="email" type="email" autoComplete="email" placeholder="you@example.com" maxLength={254} required /></label>
            <label className="field"><span>Password</span><input name="password" type="password" autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} placeholder={authMode === 'signup' ? 'At least 10 characters' : 'Enter your password'} minLength={authMode === 'signup' ? 10 : 1} maxLength={128} required /></label>
            {authMode === 'signup' && <div className="password-note">Use at least 10 characters with a letter and a number.</div>}
            <button className="btn btn-primary btn-wide" type="submit" disabled={authBusy}>{authBusy ? <LoaderCircle className="spin" size={17} /> : null}{authMode === 'login' ? 'Sign in' : 'Create account'}<ArrowRight size={17} /></button>
            <div className="auth-switch">{authMode === 'login' ? 'New to SpendLeak?' : 'Already have an account?'} <button className="link-button" type="button" onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}>{authMode === 'login' ? 'Create an account' : 'Sign in'}</button></div>
            <div className="auth-divider"><span />OR TRY IT FIRST<span /></div>
            <button className="btn btn-outline btn-wide" type="button" onClick={() => void exploreDemo()} disabled={authBusy}><Activity size={17} /> Explore synthetic demo</button>
            <div className="auth-disclaimer">Use synthetic or redacted statements while testing. This prototype is not a bank or a source of financial advice.</div>
          </form>
        </section>
        {notice && <div className={'toast toast-' + notice.kind} role="status">{notice.message}<button onClick={() => setNotice(null)} aria-label="Dismiss notice"><X size={15} /></button></div>}
      </div>
    );
  }

  const summary = dashboard?.summary;
  const openAnomalies = dashboard?.anomalies.filter((item) => item.reviewStatus === 'open') || [];
  const pageTitle = navItems.find((item) => item.id === page)?.label || 'Settings';
  const monthLabel = summary ? new Date(summary.period + '-01T00:00:00Z').toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : 'This month';

  const navButton = (item: { id: Page; label: string; icon: LucideIcon }) => {
    const Icon = item.icon;
    return <button className={'nav-item ' + (page === item.id ? 'active' : '')} key={item.id} onClick={() => { setPage(item.id); setMobileNav(false); }}>
      <Icon size={18} strokeWidth={1.8} /><span>{item.label}</span>{item.id === 'insights' && openAnomalies.length > 0 && <span className="nav-count">{openAnomalies.length}</span>}
    </button>;
  };

  const importButton = (compact = false) => (
    <label className={'btn btn-primary import-button ' + (compact ? 'btn-small' : '') + (importBusy ? ' is-busy' : '')}>
      {importBusy ? <LoaderCircle className="spin" size={16} /> : <Upload size={16} />}
      {importBusy ? 'Importing…' : 'Import CSV'}
      <input type="file" accept=".csv,text/csv" onChange={(event) => void chooseFile(event)} disabled={importBusy} />
    </label>
  );

  const transactionTable = (rows: Transaction[], showDelete = false) => (
    <div className="table-scroll"><table className="data-table"><thead><tr><th>Transaction</th><th>Date</th><th>Category</th><th className="numeric">Amount</th>{showDelete && <th aria-label="Actions" />}</tr></thead><tbody>
      {rows.map((transaction) => <tr key={transaction.id}>
        <td><div className="merchant-cell"><span className={'merchant-icon ' + (transaction.direction === 'income' ? 'income-icon' : '')}>{transaction.direction === 'income' ? <ArrowDownRight size={17} /> : <CreditCard size={16} />}</span><span className="merchant-meta"><b>{transaction.merchant || transaction.description}</b><small>{transaction.description}</small></span></div></td>
        <td className="date-cell">{niceDate(transaction.date)}</td>
        <td><span className="category-chip">{transaction.category || 'Other'}</span></td>
        <td className={'numeric amount ' + (transaction.direction === 'income' ? 'positive' : '')}>{transaction.direction === 'income' ? '+' : '−'}{money(transaction.amountMinor, currency)}</td>
        {showDelete && <td><button className="icon-button subtle-action" title="Delete transaction" aria-label="Delete transaction" onClick={() => void deleteTransaction(transaction)}><Trash2 size={15} /></button></td>}
      </tr>)}
      {rows.length === 0 && <tr><td colSpan={showDelete ? 5 : 4}><div className="table-empty"><ReceiptText size={22} /><b>No transactions found</b><span>Try another filter or import a CSV statement.</span></div></td></tr>}
    </tbody></table></div>
  );

  const budgetCards = (items: Budget[]) => items.length ? (
    <div className="budget-list">{items.map((budget) => {
      const width = Math.min(100, Math.max(0, budget.usagePercent));
      return <div className="budget-row" key={budget.id}>
        <div className="budget-row-top"><span className="budget-category"><span className="budget-dot" />{budget.category}</span><span className={budget.isOverBudget ? 'over-budget' : 'budget-remaining'}>{budget.isOverBudget ? 'Over by ' + money(Math.abs(budget.remainingMinor), currency) : money(budget.remainingMinor, currency) + ' left'}</span></div>
        <div className="progress-track"><div className={'progress-fill ' + (budget.isOverBudget ? 'over' : '')} style={{ width: width + '%' }} /></div>
        <div className="budget-row-bottom"><span>{money(budget.spentMinor, currency)} spent</span><span>{money(budget.monthlyLimitMinor, currency)} limit · {budget.usagePercent}%</span></div>
      </div>;
    })}</div>
  ) : <div className="empty-state compact-empty"><Wallet size={22} /><b>No budgets yet</b><span>Set a category limit to make spending easier to track.</span></div>;

  const anomalyCards = (items: Anomaly[]) => items.length ? <div className="anomaly-list">{items.map((item) => (
    <article className={'anomaly-card ' + (item.reviewStatus !== 'open' ? 'anomaly-resolved' : '')} key={item.transactionId}>
      <div className={'anomaly-icon ' + (item.severity === 'high' ? 'danger' : '')}><AlertTriangle size={19} /></div>
      <div className="anomaly-content"><div className="anomaly-title-line"><b>{item.title}</b><span className={'severity severity-' + item.severity}>{item.severity} priority</span></div>
        <p>{item.reason}</p><div className="anomaly-meta"><span>{item.merchant}</span><span>{niceDate(item.date)}</span><strong>{money(item.amountMinor, currency)}</strong></div>
        {item.reviewStatus === 'open' ? <div className="anomaly-actions"><button className="btn btn-outline btn-small" disabled={busyKey === item.transactionId + 'reviewed'} onClick={() => void reviewAnomaly(item.transactionId, 'reviewed')}><Check size={14} /> Mark reviewed</button><button className="text-action" disabled={busyKey === item.transactionId + 'dismissed'} onClick={() => void reviewAnomaly(item.transactionId, 'dismissed')}>Dismiss</button></div> : <div className="resolved-line"><Check size={14} /> {item.reviewStatus === 'reviewed' ? 'Reviewed' : 'Dismissed'} <button className="text-action" onClick={() => void reopenAnomaly(item.transactionId)}>Undo</button></div>}
      </div>
    </article>
  ))}</div> : <div className="empty-state compact-empty"><ShieldCheck size={23} /><b>Nothing to review</b><span>No flagged patterns at the moment. Import more transactions to improve the comparison.</span></div>;

  const pageContent = () => {
    if (!dashboard || !summary) return <div className="empty-state"><BarChart3 size={30} /><h3>Your spending dashboard is ready</h3><p>Import a CSV statement to calculate trends and uncover patterns.</p>{importButton()}</div>;

    if (page === 'overview') return <>
      <div className="page-heading"><div><div className="section-kicker">YOUR MONEY, AT A GLANCE</div><h1>Good to see you, {user.name.split(/\s+/)[0]} <span className="wave">✦</span></h1><p>Here is what your spending is telling you for {monthLabel}.</p></div><div className="heading-actions">{importButton()}<a className="btn btn-outline" href="/api/export.csv"><Download size={16} /> Export</a></div></div>
      <div className="metric-grid">
        <Metric label="Total spending" value={money(summary.currentSpendMinor, currency, true)} icon={Wallet} tone="purple" note={summary.monthChangePercent === null ? 'Compared with last month' : Math.abs(summary.monthChangePercent) + '% vs last month'} trend={summary.monthChangePercent === null ? 'neutral' : summary.monthChangePercent > 0 ? 'down' : 'up'} />
        <Metric label="Income tracked" value={money(summary.currentIncomeMinor, currency, true)} icon={TrendingUp} tone="green" note="Income in this month" />
        <Metric label="Recurring estimate" value={money(summary.recurringMonthlyMinor, currency, true)} icon={Repeat2} tone="blue" note={(dashboard.recurring.length || 0) + ' patterns detected'} />
        <Metric label="Needs your review" value={String(openAnomalies.length)} icon={AlertTriangle} tone="orange" note="Possible issues, not fraud verdicts" />
      </div>
      {summary.availableTransactions === 0 && <div className="callout callout-info"><FileUp size={19} /><div><b>Start with a CSV, not your bank login</b><span>Choose a statement export in CSV format. Your first import builds the baseline for trends, recurring estimates and anomaly checks.</span></div>{importButton(true)}</div>}
      <div className="dashboard-grid">
        <section className="panel trend-panel"><PanelHeader title="Spending trend" subtitle="Monthly outflow over the last six months" icon={BarChart3} /><div className="chart-summary"><div><span>Current month</span><strong>{money(summary.currentSpendMinor, currency)}</strong></div><span className={'change-pill ' + (summary.monthChangePercent !== null && summary.monthChangePercent > 0 ? 'change-negative' : 'change-positive')}>{summary.monthChangePercent === null ? 'Baseline building' : (summary.monthChangePercent > 0 ? '+' : '') + summary.monthChangePercent + '%'}<span> vs prior month</span></span></div>
          <div className="bar-chart" aria-label="Monthly spending bar chart">{dashboard.trend.map((item) => {
            const maxValue = Math.max(1, ...dashboard.trend.map((entry) => entry.amountMinor));
            const height = item.amountMinor === 0 ? 3 : Math.max(8, Math.round(item.amountMinor / maxValue * 100));
            return <div className="bar-column" key={item.month}><span className="bar-tooltip">{money(item.amountMinor, currency, true)}</span><div className="bar-track"><div className={'bar-fill ' + (item.month === summary.period ? 'bar-current' : '')} style={{ height: height + '%' }} /></div><small>{item.label}</small></div>;
          })}</div>
        </section>
        <section className="panel categories-panel"><PanelHeader title="Where it goes" subtitle="Top expense categories this month" icon={CircleDollarSign} />
          {dashboard.categories.length ? <div className="category-list">{dashboard.categories.map((item, index) => <div className="category-row" key={item.name}><div className="category-top"><span><i className={'category-dot dot-' + (index % 5)} />{item.name}</span><strong>{money(item.amountMinor, currency, true)}</strong></div><div className="progress-track"><div className={'progress-fill fill-' + (index % 5)} style={{ width: item.sharePercent + '%' }} /></div><small>{item.sharePercent}% of tracked spend</small></div>)}</div> : <div className="empty-inline">Category insights appear after transactions are imported.</div>}
        </section>
      </div>
      <div className="content-grid">
        <section className="panel recent-panel"><PanelHeader title="Recent transactions" subtitle={summary.transactionCount + ' transactions this month'} icon={ReceiptText} action={<button className="text-action" onClick={() => setPage('transactions')}>View all <ArrowRight size={14} /></button>} />{transactionTable(dashboard.recentTransactions)}</section>
        <section className="panel recurring-panel"><PanelHeader title="Coming up" subtitle="Next expected recurring payments" icon={CalendarClock} action={<button className="text-action" onClick={() => setPage('recurring')}>View all <ArrowRight size={14} /></button>} />
          {dashboard.recurring.length ? <div className="upcoming-list">{dashboard.recurring.slice(0, 4).map((item) => <div className="upcoming-row" key={item.id}><div className="merchant-icon recurring-icon"><Clock3 size={16} /></div><div className="upcoming-meta"><b>{item.merchant}</b><small>{item.cadence} · {niceDate(item.nextDate)}</small></div><strong>{money(item.amountMinor, currency)}</strong></div>)}</div> : <div className="empty-inline">Recurring payment estimates will appear once there is enough history.</div>}
          <div className="privacy-strip"><ShieldCheck size={15} /><span>Signals are estimates. Review before taking action.</span></div>
        </section>
      </div>
    </>;

    if (page === 'transactions') return <>
      <PageTitle kicker="YOUR LEDGER" title="Transactions" subtitle="Search your imported ledger and remove entries you no longer need." actions={<>{importButton(true)}<a className="btn btn-outline btn-small" href="/api/export.csv"><Download size={15} /> Export CSV</a></>} />
      <section className="panel table-panel"><div className="toolbar"><label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search merchant, category, description" /></label><label className="select-box"><Settings2 size={15} /><select value={direction} onChange={(event) => setDirection(event.target.value as typeof direction)}><option value="all">All activity</option><option value="expense">Expenses</option><option value="income">Income</option></select><ChevronDown size={14} /></label><span className="result-count">{filteredTransactions.length} results</span></div>{transactionTable(filteredTransactions, true)}</section>
    </>;

    if (page === 'recurring') return <>
      <PageTitle kicker="REPEATING SPEND" title="Recurring payments" subtitle="Estimated schedules based on merchant and date patterns. Confirm each one before relying on it." />
      <div className="recurring-summary-grid"><Metric label="Patterns found" value={String(dashboard.recurring.length)} icon={Repeat2} tone="blue" note="Possible or likely schedules" /><Metric label="Monthly estimate" value={money(summary.recurringMonthlyMinor, currency, true)} icon={CalendarClock} tone="purple" note="Approximate cost" /><Metric label="Annual estimate" value={money(dashboard.recurring.reduce((sum, item) => sum + item.totalAnnualMinor, 0), currency, true)} icon={CircleDollarSign} tone="green" note="If these patterns continue" /></div>
      {dashboard.recurring.length ? <div className="recurring-grid">{dashboard.recurring.map((item) => <article className="panel recurring-card" key={item.id}><div className="recurring-card-top"><span className="merchant-icon recurring-icon"><Repeat2 size={18} /></span><span className={'confidence confidence-' + item.confidence.toLowerCase()}>{item.confidence} pattern</span></div><h3>{item.merchant}</h3><div className="recurring-amount">{money(item.amountMinor, currency)}<span> / typical charge</span></div><div className="recurring-detail"><span>Cadence</span><b>{item.cadence}</b></div><div className="recurring-detail"><span>Next estimate</span><b>{niceDate(item.nextDate)}</b></div><div className="recurring-detail"><span>Occurrences</span><b>{item.occurrences}</b></div><div className="recurring-annual"><span>Estimated annual cost</span><b>{money(item.totalAnnualMinor, currency)}</b></div>{item.increased && <div className="callout callout-warning"><AlertTriangle size={15} /><span>Latest charge rose by {item.amountChangePercent}% from the prior one.</span></div>}</article>)}</div> : <EmptyPanel icon={Repeat2} title="Not enough repeating history yet" text="Import a wider date range to detect likely monthly, weekly or yearly charges." />}
    </>;

    if (page === 'insights') return <>
      <PageTitle kicker="REVIEW WITH CONTEXT" title="Insights & review" subtitle="Rule-based flags show their evidence. They are review prompts, not proof of fraud or mistakes." actions={<button className="btn btn-primary btn-small" onClick={() => void explainSpending()} disabled={aiBusy}>{aiBusy ? <LoaderCircle className="spin" size={15} /> : <Sparkles size={15} />} Explain my spending</button>} />
      <section className="ai-panel"><div className="ai-panel-symbol"><Sparkles size={21} /></div><div className="ai-panel-copy"><div className="section-kicker">OPTIONAL AI EXPLANATION</div><h3>Turn the totals into plain language</h3><p>Gemini is optional. The server sends aggregated monthly totals, category shares and counts — not raw transaction descriptions or exact transaction dates.</p>{aiResult && <div className="ai-result"><div className="ai-result-top"><span className="ai-provider"><Sparkles size={14} /> {aiResult.provider === 'gemini' ? 'Gemini explanation' : 'Rules-based explanation'}</span><button className="icon-button" aria-label="Close explanation" onClick={() => setAiResult(null)}><X size={15} /></button></div>{aiResult.text.split(/\n\n+/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}<small>{aiResult.disclaimer}</small></div>}</div></section>
      <div className="panel section-panel"><PanelHeader title="Patterns to review" subtitle={openAnomalies.length + ' open finding(s)'} icon={Activity} />{anomalyCards(dashboard.anomalies)}</div>
    </>;

    if (page === 'budgets') return <>
      <PageTitle kicker="PLAN YOUR MONTH" title="Category budgets" subtitle="Set a monthly cap and compare it with the expense transactions in your ledger." />
      <div className="budget-layout"><section className="panel budget-form-panel"><PanelHeader title="Create or update a budget" subtitle="One active limit per category" icon={Wallet} />
        <form className="budget-form" onSubmit={(event) => void saveBudget(event)}><label className="field"><span>Category</span><input value={budgetCategory} onChange={(event) => setBudgetCategory(event.target.value)} list="category-options" minLength={1} maxLength={48} required placeholder="e.g. Food & dining" /><datalist id="category-options">{(dashboard.categories.length ? dashboard.categories.map((item) => item.name) : ['Food & dining', 'Subscriptions', 'Transport', 'Groceries', 'Home & bills', 'Shopping']).map((item) => <option key={item} value={item} />)}</datalist></label><label className="field"><span>Monthly limit ({currency})</span><input type="number" value={budgetAmount} onChange={(event) => setBudgetAmount(event.target.value)} min="1" step="0.01" required placeholder="e.g. 5000" /></label><button type="submit" className="btn btn-primary btn-wide" disabled={busyKey === 'budget'}>{busyKey === 'budget' ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />} Save budget</button><p className="form-footnote">Saving a category again updates its existing limit.</p></form>
      </section><section className="panel budgets-panel"><PanelHeader title="Your monthly limits" subtitle="Usage is calculated from expense transactions only" icon={BarChart3} />{budgetCards(budgets)}{budgets.length > 0 && <div className="budget-delete-list">{budgets.map((budget) => <button key={budget.id} className="text-action" onClick={() => void deleteBudget(budget.id)}><Trash2 size={13} /> Remove {budget.category}</button>)}</div>}</section></div>
    </>;

    return <>
      <PageTitle kicker="CONTROL & PRIVACY" title="Account settings" subtitle="Understand what SpendLeak stores and control your workspace data." />
      <div className="settings-stack">
        <section className="panel account-panel"><PanelHeader title="Your account" subtitle="Session-protected personal workspace" icon={ShieldCheck} /><div className="account-detail"><span className="avatar">{initials(user.name)}</span><div><b>{user.name}</b><span>{user.email}</span></div><span className="secure-pill"><ShieldCheck size={14} /> Signed in</span></div><div className="settings-actions"><button className="btn btn-outline" onClick={() => void logout()}><LogOut size={16} /> Sign out</button></div></section>
        <section className="panel privacy-panel"><PanelHeader title="Privacy & data handling" subtitle="What this prototype does — and does not do" icon={ShieldCheck} /><div className="privacy-points"><div><Check size={17} /><span><b>No bank credentials</b><small>You upload a statement CSV manually. Never enter a bank password, PIN, or OTP.</small></span></div><div><Check size={17} /><span><b>Account-scoped records</b><small>Transactions, budgets, and review status are linked to your signed-in account.</small></span></div><div><Check size={17} /><span><b>Aggregate-only AI input</b><small>Optional explanations use summary metrics, category shares and counts instead of raw ledger lines.</small></span></div><div><AlertTriangle size={17} /><span><b>Demo deployment storage limitation</b><small>The free Render service uses ephemeral local storage. Data may be lost on restart or redeploy; use synthetic or redacted data only.</small></span></div></div></section>
        <section className="panel danger-panel"><PanelHeader title="Destructive actions" subtitle="These actions cannot be undone" icon={AlertTriangle} /><div className="danger-row"><div><b>Delete transaction data</b><p>Remove imported transactions and import history. Keep your account and budgets.</p></div><button className="btn btn-outline btn-danger" onClick={() => void clearData()}>Delete data</button></div><div className="danger-row"><div><b>Permanently delete account</b><p>Remove your profile, sessions and associated app data from the current database.</p></div><button className="btn btn-danger-solid" onClick={() => void deleteAccount()}>Delete account</button></div></section>
      </div>
    </>;
  };

  return (
    <div className="app-shell">
      {mobileNav && <button aria-label="Close navigation overlay" className="mobile-scrim" onClick={() => setMobileNav(false)} />}
      <aside className={'sidebar ' + (mobileNav ? 'sidebar-open' : '')}>
        <div className="brand-lockup"><span className="brand-symbol">S</span><span>spend<span className="brand-accent">leak</span></span></div>
        <div className="workspace-switcher"><span className="workspace-symbol">⌂</span><span><b>Personal workspace</b><small>Spending intelligence</small></span><ChevronDown size={15} /></div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="main-nav">{navItems.map(navButton)}</nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-note"><div className="sidebar-note-icon"><ShieldCheck size={16} /></div><b>Your data, your call</b><p>Import only what you choose. Never share bank credentials.</p><button onClick={() => setPage('settings')}>Privacy controls <ArrowRight size={13} /></button></div>
        <button className={'nav-item sidebar-settings ' + (page === 'settings' ? 'active' : '')} onClick={() => { setPage('settings'); setMobileNav(false); }}><Settings2 size={18} /><span>Settings</span></button>
        <div className="sidebar-user"><span className="avatar">{initials(user.name)}</span><div className="sidebar-user-meta"><b>{user.name}</b><small>{user.is_demo ? 'Synthetic demo workspace' : user.email}</small></div><button className="icon-button" title="Sign out" onClick={() => void logout()}><LogOut size={16} /></button></div>
      </aside>

      <div className="workspace">
        <header className="topbar"><div className="topbar-left"><button className="mobile-menu icon-button" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={20} /></button><span className="breadcrumb">Workspace <span>/</span> <b>{pageTitle}</b></span></div><div className="topbar-right"><span className="live-status"><i /> Local analysis active</span><span className="topbar-divider" /><span className="top-avatar">{initials(user.name)}</span></div></header>
        <main className="page-content">{pageContent()}</main>
        <footer className="app-footer"><span>SpendLeak · Spending intelligence</span><span><ShieldCheck size={13} /> Findings are estimates, not financial advice.</span></footer>
      </div>
      {notice && <div className={'toast toast-' + notice.kind} role="status" aria-live="polite"><span className="toast-dot" />{notice.message}<button onClick={() => setNotice(null)} aria-label="Dismiss notice"><X size={15} /></button></div>}
    </div>
  );
}

function Metric({ label, value, icon: Icon, tone, note, trend }: { label: string; value: string; icon: LucideIcon; tone: string; note: string; trend?: 'up' | 'down' | 'neutral' }) {
  return <article className="metric-card"><div className="metric-top"><span>{label}</span><span className={'metric-icon tone-' + tone}><Icon size={18} strokeWidth={1.8} /></span></div><strong className="metric-value">{value}</strong><div className="metric-note">{trend && <span className={'trend-arrow trend-' + trend}>{trend === 'up' ? <ArrowDownRight size={14} /> : trend === 'down' ? <ArrowUpRight size={14} /> : <Activity size={13} />}</span>}{note}</div></article>;
}

function PanelHeader({ title, subtitle, icon: Icon, action }: { title: string; subtitle: string; icon: LucideIcon; action?: React.ReactNode }) {
  return <div className="panel-header"><div className="panel-header-icon"><Icon size={17} /></div><div className="panel-heading-text"><h2>{title}</h2><p>{subtitle}</p></div>{action && <div className="panel-header-action">{action}</div>}</div>;
}

function PageTitle({ kicker, title, subtitle, actions }: { kicker: string; title: string; subtitle: string; actions?: React.ReactNode }) {
  return <div className="page-heading"><div><div className="section-kicker">{kicker}</div><h1>{title}</h1><p>{subtitle}</p></div>{actions && <div className="heading-actions">{actions}</div>}</div>;
}

function EmptyPanel({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return <section className="panel empty-state"><Icon size={28} /><h3>{title}</h3><p>{text}</p></section>;
}

export default App;
