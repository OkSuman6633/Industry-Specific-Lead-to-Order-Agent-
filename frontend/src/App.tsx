import { useEffect, useState } from 'react';
import {
  CheckCircle2, ChevronDown, Edit3, ExternalLink, FileText,
  LayoutDashboard, LogOut, Menu, MessageSquare, Plus, RefreshCw,
  Search, Send, ShieldCheck, Sparkles, Trash2, UserPlus, Users, X,
  AlertTriangle, ArrowLeft, Globe
} from 'lucide-react';
import { api, getToken } from './lib/api';

type Lead = {
  id: string;
  customer_name: string;
  email?: string;
  phone?: string;
  message: string;
  status: string;
  urgency?: string;
  service_type?: string;
  address?: string;
  created_at: string;
  version: number;
  quotes?: any[];
  messages?: any[];
  web_research?: any[];
  missing_fields?: string[];
  facts?: any;
};

type Dashboard = {
  total_leads: number;
  new_leads: number;
  needs_information: number;
  qualified: number;
  quotes_pending: number;
  quotes_accepted: number;
  scheduled: number;
  closed: number;
  quotes_stats: Record<string, number>;
  recent_leads: Lead[];
  recent_activity: any[];
};

type FunnelData = {
  funnel: {
    leads_captured: number;
    leads_qualified: number;
    quotes_drafted: number;
    quotes_approved: number;
    quotes_accepted: number;
    appointments_confirmed: number;
  };
  financials: {
    total_quoted_pipeline_gbp: number;
    accepted_order_value_gbp: number;
  };
};

const fmt = (s: string) => {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return s;
  }
};

export default function App() {
  const [token, setToken] = useState<string | null>(getToken());
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Auth state
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [loginEmail, setLoginEmail] = useState('admin@example.com');
  const [loginPassword, setLoginPassword] = useState('ChangeMe123!');
  const [regFullName, setRegFullName] = useState('');
  const [regCompany, setRegCompany] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  // Navigation: Clean 3-tab layout focused on Query -> Web Search -> Quote -> Review
  const [page, setPage] = useState<'Overview' | 'Queries' | 'Quotations' | 'Query Details'>('Overview');
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // UI state
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mobile, setMobile] = useState(false);

  // New query capture form
  const [form, setForm] = useState({
    customer_name: '',
    email: '',
    phone: '',
    message: '',
    address: '',
    consent: true
  });

  // Interactive customer clarification dialogue state
  const [dialogueReply, setDialogueReply] = useState('');
  const [dialogueBusy, setDialogueBusy] = useState(false);

  // Human Review & Edit Quote modal state
  const [editingQuote, setEditingQuote] = useState<any>(null);
  const [editLineItems, setEditLineItems] = useState<any[]>([]);
  const [editNotes, setEditNotes] = useState('');
  const [editExclusions, setEditExclusions] = useState<string[]>([]);
  const [editIsVatExempt, setEditIsVatExempt] = useState(false);
  const [quoteBusy, setQuoteBusy] = useState(false);

  const refresh = async () => {
    try {
      const [d, f, l, qList, me] = await Promise.all([
        api<Dashboard>('/dashboard'),
        api<FunnelData>('/analytics/funnel'),
        api<Lead[]>('/leads'),
        api<any[]>('/quotes').catch(() => []),
        api<any>('/auth/me').catch(() => null)
      ]);
      setDash(d);
      setFunnel(f);
      setLeads(l);
      setQuotes(qList);
      if (me) setCurrentUser(me);
    } catch (e: any) {
      if (e.message?.includes('401') || e.message?.includes('Authentication') || e.message?.includes('expired') || e.message?.includes('Invalid')) {
        logout();
      } else {
        setError(e.message);
      }
    }
  };

  useEffect(() => {
    if (token) {
      refresh();
    }
  }, [token]);

  const login = async (e: any) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api<any>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      localStorage.setItem('bb_token', r.access_token);
      setToken(r.access_token);
      setCurrentUser(r.user);
      setNotice(`Welcome back, ${r.user?.name || 'User'}!`);
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const register = async (e: any) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api<any>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          full_name: regFullName,
          company_name: regCompany,
          email: regEmail,
          password: regPassword
        })
      });
      localStorage.setItem('bb_token', r.access_token);
      setToken(r.access_token);
      setCurrentUser(r.user);
      setNotice(`Account registered successfully for ${r.user?.company_name || 'your operations'}!`);
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('bb_token');
    setToken(null);
    setCurrentUser(null);
    setSelected(null);
    setPage('Overview');
  };

  const openLead = async (id: string) => {
    try {
      const data = await api<Lead>(`/leads/${id}`);
      setSelected(data);
      setPage('Query Details');
    } catch (e: any) {
      if (e.message?.includes('401') || e.message?.includes('Authentication') || e.message?.includes('expired') || e.message?.includes('Invalid')) {
        logout();
      } else {
        setError(e.message);
      }
    }
  };

  const submitQuery = async (e: any) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api<any>('/leads', {
        method: 'POST',
        body: JSON.stringify({
          customer_name: form.customer_name,
          email: form.email || undefined,
          phone: form.phone || undefined,
          message: form.message,
          address: form.address || undefined,
          channel: 'website',
          consent: form.consent
        })
      });
      setModal(false);
      setForm({ customer_name: '', email: '', phone: '', message: '', address: '', consent: true });
      setNotice('New customer query captured! AI understanding requirements…');
      await refresh();
      await openLead(res.lead_id);
    } catch (e: any) {
      if (e.message?.includes('401') || e.message?.includes('Authentication') || e.message?.includes('expired') || e.message?.includes('Invalid')) {
        logout();
      } else {
        setError(e.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const sendDialogueReply = async (e: any) => {
    e.preventDefault();
    if (!selected || !dialogueReply.trim()) return;
    setDialogueBusy(true);
    setError('');
    try {
      const res = await api<any>(`/leads/${selected.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message: dialogueReply.trim(), sender: 'customer' })
      });
      setDialogueReply('');
      if (res.is_complete) {
        setNotice('Customer requirements complete! AI performed web search and generated draft quotation for human review.');
      }
      await openLead(selected.id);
      await refresh();
    } catch (e: any) {
      if (e.message?.includes('401') || e.message?.includes('Authentication') || e.message?.includes('expired') || e.message?.includes('Invalid')) {
        logout();
      } else {
        setError(e.message);
      }
    } finally {
      setDialogueBusy(false);
    }
  };

  const draftWebQuoteForLead = async () => {
    if (!selected) return;
    setQuoteBusy(true);
    setError('');
    try {
      await api(`/leads/${selected.id}/quotes`, {
        method: 'POST',
        body: JSON.stringify({ quantity: 1, notes: 'Generated from live web research benchmarks' })
      });
      setNotice('Quotation generated from web search data. Sent for human review & edit.');
      await openLead(selected.id);
      await refresh();
    } catch (e: any) {
      if (e.message?.includes('401') || e.message?.includes('Authentication') || e.message?.includes('expired') || e.message?.includes('Invalid')) {
        logout();
      } else {
        setError(e.message);
      }
    } finally {
      setQuoteBusy(false);
    }
  };

  const openEditQuoteModal = (q: any) => {
    setEditingQuote(q);
    setEditLineItems(JSON.parse(JSON.stringify(q.line_items || [])));
    setEditNotes(q.notes || '');
    setEditExclusions(JSON.parse(JSON.stringify(q.exclusions || [])));
    setEditIsVatExempt(Boolean(q.is_vat_exempt));
  };

  const saveEditedQuote = async (e: any) => {
    e.preventDefault();
    if (!editingQuote) return;
    setQuoteBusy(true);
    setError('');
    try {
      await api(`/quotes/${editingQuote.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          line_items: editLineItems,
          notes: editNotes,
          exclusions: editExclusions,
          is_vat_exempt: editIsVatExempt
        })
      });
      setEditingQuote(null);
      setNotice('Quotation revised and saved. Line items, market rates, and exclusions updated.');
      if (selected) await openLead(selected.id);
      await refresh();
    } catch (e: any) {
      if (e.message?.includes('401') || e.message?.includes('Authentication') || e.message?.includes('expired') || e.message?.includes('Invalid')) {
        logout();
      } else {
        setError(e.message);
      }
    } finally {
      setQuoteBusy(false);
    }
  };

  const quoteAction = async (q: any, action: 'approve' | 'reject' | 'send') => {
    setQuoteBusy(true);
    setError('');
    try {
      let body: any = {};
      if (action === 'approve') body = { expected_generation: q.version };
      if (action === 'reject') body = { reason: 'Staff revised scope or customer declined' };
      if (action === 'send') body = { channel: 'website', simulate_failure: false };

      await api(`/quotes/${q.id}/${action}`, {
        method: 'POST',
        ...(Object.keys(body).length ? { body: JSON.stringify(body) } : {})
      });

      if (action === 'approve') setNotice('Quote approved by human reviewer.');
      if (action === 'reject') setNotice('Quote rejected.');
      if (action === 'send') setNotice('Quote dispatched to customer via verified channel.');

      if (selected) await openLead(selected.id);
      await refresh();
    } catch (e: any) {
      if (e.message?.includes('401') || e.message?.includes('Authentication') || e.message?.includes('expired') || e.message?.includes('Invalid')) {
        logout();
      } else {
        setError(e.message);
      }
    } finally {
      setQuoteBusy(false);
    }
  };

  // Line item helpers for Quote Editor
  const addLineItem = () => {
    setEditLineItems([
      ...editLineItems,
      {
        service: 'Additional Field Labor / Consumables',
        quantity: 1,
        unit_price: 50.0,
        vat_rate: 20.0,
        line_total: 50.0,
        notes: 'Human reviewer added item'
      }
    ]);
  };

  const removeLineItem = (index: number) => {
    setEditLineItems(editLineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: string, value: any) => {
    const updated = [...editLineItems];
    updated[index][field] = value;
    if (field === 'quantity' || field === 'unit_price') {
      const q = Number(updated[index].quantity) || 0;
      const u = Number(updated[index].unit_price) || 0;
      updated[index].line_total = Math.round(q * u * 100) / 100;
    }
    setEditLineItems(updated);
  };

  const computedSubtotal = editLineItems.reduce((acc, it) => acc + (Number(it.line_total) || (Number(it.quantity) * Number(it.unit_price)) || 0), 0);
  const computedVat = editIsVatExempt ? 0 : Math.round(computedSubtotal * 0.20 * 100) / 100;
  const computedTotal = Math.round((computedSubtotal + computedVat) * 100) / 100;

  // Filtered queries
  const filteredLeads = leads.filter(l => {
    const matchesSearch = query === '' ||
      l.customer_name?.toLowerCase().includes(query.toLowerCase()) ||
      l.message?.toLowerCase().includes(query.toLowerCase()) ||
      l.address?.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = statusFilter === 'all' || l.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Authentication View
  if (!token) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <div className="login-brand">
            <div className="brand-mark"><Sparkles size={22} /></div>
            <h1>Brilliant Brains</h1>
            <p>AI Service Intelligence, Web Benchmarks & Human-Reviewed Quotations</p>
          </div>

          <div className="segmented-control">
            <button
              type="button"
              className={`segmented-btn ${authMode === 'login' ? 'active' : ''}`}
              onClick={() => { setAuthMode('login'); setError(''); }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`segmented-btn ${authMode === 'register' ? 'active' : ''}`}
              onClick={() => { setAuthMode('register'); setError(''); }}
            >
              Register Workspace
            </button>
          </div>

          <div className="login-body">
            {authMode === 'login' ? (
              <form onSubmit={login}>
                <label>Email Address</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  placeholder="admin@example.com"
                  required
                />
                <label style={{ marginTop: '12px' }}>Password</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                <button className="primary full" disabled={busy}>
                  {busy ? 'Authenticating…' : 'Sign in to Console'}
                </button>
                {error && <div className="error">{error}</div>}

                <div style={{ marginTop: '16px', background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', color: '#475569' }}>
                  <b style={{ color: '#0f172a', display: 'block', marginBottom: '4px' }}>Demo Admin Account:</b>
                  Email: <span style={{ fontFamily: 'monospace', color: '#2563eb', fontWeight: 600 }}>admin@example.com</span><br />
                  Password: <span style={{ fontFamily: 'monospace', color: '#2563eb', fontWeight: 600 }}>ChangeMe123!</span>
                </div>
              </form>
            ) : (
              <form onSubmit={register}>
                <label>Full Name</label>
                <input
                  type="text"
                  value={regFullName}
                  onChange={e => setRegFullName(e.target.value)}
                  placeholder="Alex Morgan"
                  required
                />
                <label style={{ marginTop: '12px' }}>Company / Operations Name</label>
                <input
                  type="text"
                  value={regCompany}
                  onChange={e => setRegCompany(e.target.value)}
                  placeholder="Apex Facilities Group Ltd"
                  required
                />
                <label style={{ marginTop: '12px' }}>Work Email Address</label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={e => setRegEmail(e.target.value)}
                  placeholder="alex@apexfacilities.co.uk"
                  required
                />
                <label style={{ marginTop: '12px' }}>Set Secure Password (min 8 chars)</label>
                <input
                  type="password"
                  value={regPassword}
                  onChange={e => setRegPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={8}
                  required
                />
                <button className="primary full" disabled={busy}>
                  {busy ? 'Creating Workspace…' : 'Register & Launch Workspace'} <UserPlus size={16} />
                </button>
                {error && <div className="error">{error}</div>}
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Navigation Items: Clean, focused 3 tabs
  const navItems = [
    { name: 'Overview' as const, icon: LayoutDashboard },
    { name: 'Queries' as const, icon: MessageSquare, count: dash?.new_leads || 0 },
    { name: 'Quotations' as const, icon: FileText, count: dash?.quotes_pending || 0 }
  ];

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className={`sidebar ${mobile ? 'show' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><Sparkles size={20} /></div>
          <span>brilliant<span className="brand-light">brains</span></span>
          <button className="mobile-close" onClick={() => setMobile(false)}><X size={18} /></button>
        </div>

        <div className="workspace">
          <div className="workspace-icon">
            {(currentUser?.company_name || 'BB').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <b>{currentUser?.company_name || 'Workspace'}</b>
            <small>{currentUser?.name || 'Administrator'}</small>
          </div>
          <ChevronDown size={15} color="#94a3b8" />
        </div>

        <div className="nav-label">OPERATIONS WORKFLOW</div>
        <nav>
          {navItems.map(n => (
            <button
              key={n.name}
              className={`nav-item ${page === n.name ? 'active' : ''}`}
              onClick={() => { setPage(n.name); setSelected(null); setMobile(false); }}
            >
              <n.icon size={18} />
              {n.name}
              {Boolean(n.count && n.count > 0) && <span className="nav-count">{n.count}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon">
              <ShieldCheck size={16} /> Human Oversight Gate
            </div>
            <p>
              AI extracts requirements & researches web benchmarks. Quotations require human review & edit before approval.
            </p>
          </div>

          <button className="profile-btn" onClick={logout}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="avatar">
                {(currentUser?.name || 'US').slice(0, 2).toUpperCase()}
              </div>
              <div style={{ textAlign: 'left' }}>
                <b style={{ display: 'block', fontSize: '12px', color: '#f8fafc' }}>{currentUser?.name || 'User'}</b>
                <small style={{ fontSize: '10px', color: '#94a3b8' }}>Sign out</small>
              </div>
            </div>
            <LogOut size={15} color="#94a3b8" />
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <main className="main">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobile(true)}><Menu /></button>
          <div className="breadcrumb">
            {currentUser?.company_name || 'Workspace'} <span>/</span> <b>{page}</b>
          </div>
          <div className="topbar-actions">
            <button className="secondary" onClick={refresh} title="Refresh Live Data">
              <RefreshCw size={15} /> Refresh
            </button>
            <button className="primary" onClick={() => setModal(true)}>
              <Plus size={15} /> New Customer Query
            </button>
          </div>
        </header>

        {notice && (
          <div className="banner info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{notice}</span>
            <button onClick={() => setNotice('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}><X size={14} /></button>
          </div>
        )}
        {error && (
          <div className="banner error" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{error}</span>
            <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}><X size={14} /></button>
          </div>
        )}

        {/* PAGE 1: OVERVIEW */}
        {page === 'Overview' && (
          <div className="content">
            <div className="page-header" style={{ marginBottom: '20px' }}>
              <div>
                <h2>Operations Overview</h2>
                <p>Real-time customer enquiries, AI requirement clarification, web research, and quote reviews.</p>
              </div>
            </div>

            <div className="kpi-grid">
              <div className="kpi-card" onClick={() => setPage('Queries')} style={{ cursor: 'pointer' }}>
                <div className="kpi-top">
                  <span>Total Enquiries</span>
                  <MessageSquare size={17} />
                </div>
                <b>{dash?.total_leads || leads.length}</b>
                <small>{dash?.new_leads || 0} awaiting initial processing</small>
              </div>

              <div className="kpi-card" onClick={() => setPage('Queries')} style={{ cursor: 'pointer' }}>
                <div className="kpi-top">
                  <span>AI Clarification</span>
                  <Sparkles size={17} color="#3b82f6" />
                </div>
                <b>{dash?.needs_information || 0}</b>
                <small>Active multi-turn question flows</small>
              </div>

              <div className="kpi-card" onClick={() => setPage('Quotations')} style={{ cursor: 'pointer' }}>
                <div className="kpi-top">
                  <span>Quotes Awaiting Review</span>
                  <FileText size={17} color="#f59e0b" />
                </div>
                <b>{dash?.quotes_pending || quotes.filter(q => q.status === 'draft').length}</b>
                <small>Generated from web benchmarks</small>
              </div>

              <div className="kpi-card">
                <div className="kpi-top">
                  <span>Pipeline Quoted Value</span>
                  <Globe size={17} color="#10b981" />
                </div>
                <b>£{(funnel?.financials?.total_quoted_pipeline_gbp || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</b>
                <small>Human-verified quotes</small>
              </div>
            </div>

            {/* Workflow Pipeline Strip */}
            <div className="workflow-strip">
              <div className="workflow-badge-icon">
                <Sparkles size={22} />
              </div>
              <div className="workflow-strip-content">
                <b>End-to-End Autonomous Intelligence with Human Review Gate</b>
                <p>
                  1. Customer Enquiry → 2. AI Requirements Clarification → 3. Live UK Standards & Benchmarks Search → 4. Dynamic Quote Drafted → 5. Human Reviewer Approves / Edits.
                </p>
              </div>
            </div>

            {/* Recent Queries Table */}
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3>Recent Customer Queries</h3>
                  <small>Click any query to open dialogue, web research, and review quotation.</small>
                </div>
                <button className="secondary" onClick={() => setPage('Queries')}>View All Queries →</button>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Query Message</th>
                      <th>Inferred Service</th>
                      <th>Postcode</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.slice(0, 6).map(l => (
                      <tr key={l.id} onClick={() => openLead(l.id)} style={{ cursor: 'pointer' }}>
                        <td><b>{l.customer_name}</b></td>
                        <td style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {l.message}
                        </td>
                        <td><span className="badge info">{l.service_type || 'Analysing…'}</span></td>
                        <td>{l.address || '—'}</td>
                        <td><span className={`badge ${l.status}`}>{l.status.replace('_', ' ')}</span></td>
                        <td>{fmt(l.created_at)}</td>
                      </tr>
                    ))}
                    {leads.length === 0 && (
                      <tr><td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>No customer queries yet. Click "+ New Customer Query" to begin.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* PAGE 2: QUERIES (LEADS) */}
        {page === 'Queries' && (
          <div className="content">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2>Customer Queries & Enquiries</h2>
                <p>Inspect incoming requirements, review multi-turn AI clarification, and view web intelligence.</p>
              </div>
              <button className="primary" onClick={() => setModal(true)}>
                <Plus size={15} /> New Customer Query
              </button>
            </div>

            <div className="filters-bar" style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div className="search-box" style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 12px' }}>
                <Search size={16} color="#94a3b8" />
                <input
                  type="text"
                  placeholder="Search by customer name, query text, or postcode…"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  style={{ border: 'none', outline: 'none', marginLeft: '8px', width: '100%', fontSize: '13px' }}
                />
              </div>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', background: 'white' }}
              >
                <option value="all">All Statuses</option>
                <option value="new">New</option>
                <option value="needs_information">Needs Information</option>
                <option value="quote_pending">Quote Pending Review</option>
                <option value="approved">Approved</option>
                <option value="accepted">Accepted</option>
              </select>
            </div>

            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Customer Name</th>
                      <th>Enquiry Query</th>
                      <th>Service Requirement</th>
                      <th>Site Address</th>
                      <th>Status</th>
                      <th>Submitted</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.map(l => (
                      <tr key={l.id} onClick={() => openLead(l.id)} style={{ cursor: 'pointer' }}>
                        <td><b>{l.customer_name}</b><br /><small style={{ color: '#94a3b8' }}>{l.email || l.phone || 'Web enquiry'}</small></td>
                        <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {l.message}
                        </td>
                        <td><span className="badge info">{l.service_type || 'Analysing…'}</span></td>
                        <td>{l.address || 'Pending'}</td>
                        <td><span className={`badge ${l.status}`}>{l.status.replace('_', ' ')}</span></td>
                        <td>{fmt(l.created_at)}</td>
                        <td>
                          <button className="secondary" style={{ padding: '6px 10px', fontSize: '12px' }}>
                            Open Workspace →
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredLeads.length === 0 && (
                      <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No customer queries found matching current filter.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* PAGE 3: QUERY DETAILS (CORE WORKFLOW) */}
        {page === 'Query Details' && selected && (
          <div className="content">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <button className="secondary" onClick={() => setPage('Queries')} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ArrowLeft size={16} /> Back to Queries
              </button>
              <div>
                <h2 style={{ margin: 0 }}>{selected.customer_name}</h2>
                <small style={{ color: '#64748b' }}>Enquiry ID: {selected.id} · Submitted {fmt(selected.created_at)}</small>
              </div>
              <span className={`badge ${selected.status}`} style={{ marginLeft: 'auto', fontSize: '13px', padding: '6px 12px' }}>
                {selected.status.replace('_', ' ')}
              </span>
            </div>

            <div className="lead-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
              {/* Left Column: Requirements, Clarification Chat & Web Research */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Requirements Extraction Card */}
                <div className="card">
                  <div className="card-header">
                    <h3>
                      <Sparkles size={18} color="#2563eb" /> AI Requirements Understanding
                    </h3>
                    <span className="badge info">NLP Extraction</span>
                  </div>
                  <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <div style={{ background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <small style={{ color: '#64748b', display: 'block', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Service Required</small>
                      <b style={{ color: '#0f172a', fontSize: '13px', display: 'block', marginTop: '4px' }}>{selected.service_type || 'Pending Clarification'}</b>
                    </div>
                    <div style={{ background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <small style={{ color: '#64748b', display: 'block', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Site Postcode / Address</small>
                      <b style={{ color: '#0f172a', fontSize: '13px', display: 'block', marginTop: '4px' }}>{selected.address || 'Pending Customer Reply'}</b>
                    </div>
                    <div style={{ background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <small style={{ color: '#64748b', display: 'block', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Preferred Timing</small>
                      <b style={{ color: '#0f172a', fontSize: '13px', display: 'block', marginTop: '4px' }}>
                        {selected.facts?.preferred_timing || (selected.missing_fields?.includes('preferred_timing') ? 'Pending Date/Time' : 'Flexible / Standard')}
                      </b>
                    </div>
                  </div>
                  <div style={{ padding: '16px 20px' }}>
                    <small style={{ color: '#64748b', display: 'block', marginBottom: '6px', fontWeight: 600 }}>Original Customer Query:</small>
                    <div style={{ background: '#f1f5f9', padding: '12px 16px', borderRadius: '8px', fontSize: '13px', color: '#1e293b', border: '1px solid #e2e8f0', fontStyle: 'italic' }}>
                      "{selected.message}"
                    </div>
                  </div>
                </div>

                {/* Interactive Multi-Turn Customer Clarification Chat */}
                <div className="card">
                  <div className="card-header">
                    <h3>
                      <MessageSquare size={18} color="#059669" /> Interactive AI Clarification Flow
                    </h3>
                    <span className="badge" style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}>
                      {selected.messages?.length || 1} Turn(s)
                    </span>
                  </div>

                  <div className="chat-container">
                    {selected.messages && selected.messages.length > 0 ? (
                      selected.messages.map((m, idx) => (
                        <div
                          key={idx}
                          className={`chat-bubble ${m.sender === 'customer' ? 'customer' : 'ai'}`}
                        >
                          <div className="chat-bubble-top">
                            <b style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              {m.sender === 'customer' ? 'Customer' : <><Sparkles size={12} color="#2563eb" /> AI Assistant</>}
                            </b>
                            <small>{fmt(m.created_at)}</small>
                          </div>
                          <div style={{ color: '#1e293b', whiteSpace: 'pre-wrap', fontSize: '13px', marginTop: '2px' }}>{m.message}</div>
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                        No follow-up messages yet. Initial enquiry captured.
                      </div>
                    )}
                  </div>

                  <form onSubmit={sendDialogueReply} style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '10px', background: '#ffffff' }}>
                    <input
                      type="text"
                      placeholder="Simulate customer reply (e.g. 'We are located at 25 City Road, EC1V 1AF', or 'Next Tuesday morning')…"
                      value={dialogueReply}
                      onChange={e => setDialogueReply(e.target.value)}
                      disabled={dialogueBusy}
                      style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                    <button className="primary" disabled={dialogueBusy || !dialogueReply.trim()}>
                      {dialogueBusy ? 'AI Processing…' : 'Send Answer'} <Send size={15} />
                    </button>
                  </form>
                </div>

                {/* Live Web Research & Regulatory Standards Card */}
                <div className="card">
                  <div className="card-header">
                    <h3>
                      <Globe size={18} color="#2563eb" /> Live Web Search Intelligence & Standards
                    </h3>
                    <span className="badge info">Verified UK Sources</span>
                  </div>

                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', background: '#fafbfc' }}>
                    {selected.web_research && selected.web_research.length > 0 ? (
                      selected.web_research.map((res: any, idx: number) => (
                        <div key={idx} className="web-card-item">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                            <a
                              href={res.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontWeight: 700, color: '#2563eb', fontSize: '14px', display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
                            >
                              {res.title} <ExternalLink size={14} />
                            </a>
                            <span className="badge" style={{ background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe', fontSize: '11px', whiteSpace: 'nowrap' }}>
                              {res.source}
                            </span>
                          </div>

                          <div style={{ marginTop: '8px', fontSize: '13px', color: '#334155', lineHeight: 1.5 }}>
                            {res.relevance}
                          </div>

                          <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                            <div className="web-rate-tag">
                              Market Benchmark: {res.benchmark_rate}
                            </div>
                            {res.region_context && (
                              <div style={{ background: '#f1f5f9', color: '#475569', padding: '4px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: 500, border: '1px solid #e2e8f0' }}>
                                {res.region_context}
                              </div>
                            )}
                          </div>

                          {res.compliance_notes && (
                            <div style={{ marginTop: '10px', fontSize: '12px', color: '#475569', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '8px 12px' }}>
                              <b style={{ color: '#92400e' }}>Statutory Guidance:</b> {res.compliance_notes}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                        Web research will trigger automatically once customer requirements are verified.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Web-Generated Quotation & Human Review Console */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div className="card" style={{ border: '2px solid #e2e8f0' }}>
                  <div className="card-header" style={{ background: '#f8fafc' }}>
                    <h3 style={{ margin: 0 }}>
                      <FileText size={18} color="#2563eb" /> Web-Generated Quotation
                    </h3>
                    <span className="badge" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                      Dynamic Web Pricing
                    </span>
                  </div>

                  <div style={{ padding: '20px' }}>
                    {selected.quotes && selected.quotes.length > 0 ? (
                      selected.quotes.map((q: any) => (
                        <div key={q.id} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                            <div>
                              <b style={{ fontSize: '15px', color: '#0f172a' }}>Quote #{q.id.slice(0, 8)}</b>
                              <small style={{ display: 'block', color: '#64748b', marginTop: '2px' }}>Version {q.version} · Created {fmt(q.created_at)}</small>
                            </div>
                            <span className={`badge ${q.status}`} style={{ fontSize: '12px', padding: '4px 10px' }}>
                              {q.status === 'draft' ? 'Draft (Awaiting Review)' : q.status}
                            </span>
                          </div>

                          {/* Line items table */}
                          <div className="table-wrap">
                            <table style={{ fontSize: '13px' }}>
                              <thead>
                                <tr>
                                  <th>Item Description</th>
                                  <th>Qty</th>
                                  <th>Unit Price</th>
                                  <th>Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {q.line_items?.map((it: any, idx: number) => (
                                  <tr key={idx}>
                                    <td>
                                      <b>{it.service}</b>
                                      {it.notes && <small style={{ display: 'block', color: '#64748b', marginTop: '2px' }}>{it.notes}</small>}
                                    </td>
                                    <td>{it.quantity}</td>
                                    <td>£{(Number(it.unit_price) || 0).toFixed(2)}</td>
                                    <td><b>£{(Number(it.line_total) || 0).toFixed(2)}</b></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Totals Breakdown */}
                          <div className="totals-summary">
                            <div className="total-line">
                              <span>Subtotal (Net Ex VAT)</span>
                              <b>£{(Number(q.subtotal) || 0).toFixed(2)}</b>
                            </div>
                            <div className="total-line">
                              <span>UK VAT (20%{q.is_vat_exempt ? ' - Exempt' : ''})</span>
                              <b>£{(Number(q.vat) || 0).toFixed(2)}</b>
                            </div>
                            <div className="total-line grand">
                              <span>Total Payable GBP</span>
                              <b>£{(Number(q.total) || 0).toFixed(2)}</b>
                            </div>
                          </div>

                          {/* Exclusions */}
                          {q.exclusions && q.exclusions.length > 0 && (
                            <div style={{ fontSize: '12px', color: '#475569', background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                              <b style={{ color: '#0f172a', display: 'block', marginBottom: '4px' }}>Standard Exclusions & Statutory Guidance:</b>
                              <ul style={{ margin: '4px 0 0', paddingLeft: '18px', lineHeight: 1.6 }}>
                                {q.exclusions.map((ex: string, i: number) => (
                                  <li key={i}>{ex}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Human Review Actions */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '8px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                            <button
                              className="primary"
                              onClick={() => openEditQuoteModal(q)}
                              style={{ flex: 1, padding: '10px 14px' }}
                            >
                              <Edit3 size={15} /> Review & Edit Quote
                            </button>

                            {q.status === 'draft' && (
                              <button
                                className="secondary"
                                onClick={() => quoteAction(q, 'approve')}
                                disabled={quoteBusy}
                                style={{ background: '#ecfdf5', color: '#047857', borderColor: '#a7f3d0' }}
                              >
                                <CheckCircle2 size={15} /> Approve
                              </button>
                            )}

                            {q.status === 'approved' && (
                              <button
                                className="secondary"
                                onClick={() => quoteAction(q, 'send')}
                                disabled={quoteBusy}
                                style={{ background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' }}
                              >
                                <Send size={15} /> Send to Customer
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ textAlign: 'center', padding: '36px 20px', color: '#64748b' }}>
                        <p style={{ margin: '0 0 16px', fontSize: '14px' }}>No quotation drafted yet for this query.</p>
                        <button
                          className="primary"
                          onClick={draftWebQuoteForLead}
                          disabled={quoteBusy}
                        >
                          <Sparkles size={16} /> Generate Quote from Web Research
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PAGE 4: QUOTATIONS LIST */}
        {page === 'Quotations' && (
          <div className="content">
            <div className="page-header" style={{ marginBottom: '20px' }}>
              <div>
                <h2>Quotations & Human Review Console</h2>
                <p>All quotations generated from web research benchmarks awaiting human sign-off.</p>
              </div>
            </div>

            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Quote ID</th>
                      <th>Customer Enquiry</th>
                      <th>Items Breakdown</th>
                      <th>Net Subtotal</th>
                      <th>VAT</th>
                      <th>Total (GBP)</th>
                      <th>Status</th>
                      <th>Review Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotes.map(q => (
                      <tr key={q.id}>
                        <td><b>#{q.id.slice(0, 8)}</b><br /><small style={{ color: '#94a3b8' }}>v{q.version}</small></td>
                        <td>
                          <button
                            onClick={() => openLead(q.lead_id)}
                            style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: 0, fontWeight: 600, fontSize: '13px' }}
                          >
                            View Enquiry →
                          </button>
                        </td>
                        <td>
                          {q.line_items?.map((it: any, i: number) => (
                            <span key={i} style={{ display: 'block', fontSize: '12px' }}>
                              {it.quantity}x {it.service} (£{Number(it.unit_price).toFixed(2)})
                            </span>
                          ))}
                        </td>
                        <td>£{(Number(q.subtotal) || 0).toFixed(2)}</td>
                        <td>£{(Number(q.vat) || 0).toFixed(2)}</td>
                        <td><b style={{ color: '#2563eb' }}>£{(Number(q.total) || 0).toFixed(2)}</b></td>
                        <td><span className={`badge ${q.status}`}>{q.status}</span></td>
                        <td>
                          <button
                            className="secondary"
                            onClick={() => openEditQuoteModal(q)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '12px' }}
                          >
                            <Edit3 size={14} /> Review & Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                    {quotes.length === 0 && (
                      <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No quotations generated yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 1: NEW CUSTOMER QUERY */}
        {modal && (
          <div className="modal-backdrop">
            <div className="modal" style={{ maxWidth: '520px' }}>
              <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3>Submit New Customer Query</h3>
                <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
              </div>

              <form onSubmit={submitQuery} style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '20px' }}>
                <div>
                  <label>Customer Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rachel Green / Canary Wharf Logistics"
                    value={form.customer_name}
                    onChange={e => setForm({ ...form, customer_name: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label>Email Address</label>
                    <input
                      type="email"
                      placeholder="rachel@logistics.co.uk"
                      value={form.email}
                      onChange={e => setForm({ ...form, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label>Phone Number</label>
                    <input
                      type="tel"
                      placeholder="+44 20 7946 0958"
                      value={form.phone}
                      onChange={e => setForm({ ...form, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label>Service Query / Requirements *</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="e.g. We need urgent inspection of our chiller unit and routine maintenance for commercial building."
                    value={form.message}
                    onChange={e => setForm({ ...form, message: e.target.value })}
                  />
                </div>

                <div>
                  <label>Site Address or UK Postcode (optional - AI will clarify if missing)</label>
                  <input
                    type="text"
                    placeholder="e.g. 15 Finsbury Square, London, EC2A 1AE"
                    value={form.address}
                    onChange={e => setForm({ ...form, address: e.target.value })}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                  <button type="button" className="secondary" onClick={() => setModal(false)}>Cancel</button>
                  <button className="primary" disabled={busy}>
                    {busy ? 'Submitting…' : 'Submit Query'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: HUMAN REVIEW & EDIT QUOTATION */}
        {editingQuote && (
          <div className="modal-backdrop">
            <div className="modal" style={{ maxWidth: '780px', width: '90%' }}>
              <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
                <div>
                  <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Edit3 size={18} color="#2563eb" /> Human Review & Edit Quotation
                  </h3>
                  <small style={{ color: '#64748b' }}>Quote #{editingQuote.id.slice(0, 8)} · Adjust line items, market rates, and terms</small>
                </div>
                <button onClick={() => setEditingQuote(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
              </div>

              <form onSubmit={saveEditedQuote} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* Line Items Editor */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ margin: 0, fontWeight: 700 }}>Itemized Services & Pricing</label>
                    <button type="button" className="secondary" onClick={addLineItem} style={{ padding: '4px 10px', fontSize: '12px' }}>
                      <Plus size={14} /> Add Line Item
                    </button>
                  </div>

                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th style={{ width: '45%' }}>Service / Work Description</th>
                          <th style={{ width: '15%' }}>Qty</th>
                          <th style={{ width: '20%' }}>Unit Price (£)</th>
                          <th style={{ width: '15%' }}>Total (£)</th>
                          <th style={{ width: '5%' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {editLineItems.map((it, idx) => (
                          <tr key={idx}>
                            <td>
                              <input
                                type="text"
                                value={it.service}
                                onChange={e => updateLineItem(idx, 'service', e.target.value)}
                                style={{ width: '100%', padding: '6px', fontSize: '13px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                                required
                              />
                              <input
                                type="text"
                                placeholder="Citing notes (e.g. Checkatrade benchmark)"
                                value={it.notes || ''}
                                onChange={e => updateLineItem(idx, 'notes', e.target.value)}
                                style={{ width: '100%', padding: '4px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid #e2e8f0', marginTop: '4px', color: '#64748b' }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min={1}
                                max={100}
                                value={it.quantity}
                                onChange={e => updateLineItem(idx, 'quantity', e.target.value)}
                                style={{ width: '60px', padding: '6px', fontSize: '13px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                                required
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.01"
                                min={0}
                                value={it.unit_price}
                                onChange={e => updateLineItem(idx, 'unit_price', e.target.value)}
                                style={{ width: '90px', padding: '6px', fontSize: '13px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                                required
                              />
                            </td>
                            <td>
                              <b>£{(Number(it.line_total) || (Number(it.quantity) * Number(it.unit_price)) || 0).toFixed(2)}</b>
                            </td>
                            <td>
                              {editLineItems.length > 1 && (
                                <button type="button" onClick={() => removeLineItem(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Subtotal & Tax Recalculation Bar */}
                <div style={{ background: '#f8fafc', padding: '14px 18px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0, fontSize: '13px' }}>
                    <input
                      type="checkbox"
                      checked={editIsVatExempt}
                      onChange={e => setEditIsVatExempt(e.target.checked)}
                    />
                    VAT Exempt (Reverse Charge / Charities)
                  </label>

                  <div style={{ textAlign: 'right', display: 'flex', gap: '20px', alignItems: 'center' }}>
                    <div>
                      <small style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Subtotal</small>
                      <b>£{computedSubtotal.toFixed(2)}</b>
                    </div>
                    <div>
                      <small style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>VAT (20%)</small>
                      <b>£{computedVat.toFixed(2)}</b>
                    </div>
                    <div style={{ borderLeft: '1px solid #cbd5e1', paddingLeft: '16px' }}>
                      <small style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Total GBP</small>
                      <b style={{ color: '#2563eb', fontSize: '16px' }}>£{computedTotal.toFixed(2)}</b>
                    </div>
                  </div>
                </div>

                {/* Exclusions Editor */}
                <div>
                  <label>Standard Exclusions & Scope Conditions</label>
                  <textarea
                    rows={3}
                    value={editExclusions.join('\n')}
                    onChange={e => setEditExclusions(e.target.value.split('\n').filter(Boolean))}
                    placeholder="Enter each exclusion on a new line…"
                    style={{ width: '100%', padding: '8px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                {/* Staff Review Notes */}
                <div>
                  <label>Staff Review Remarks</label>
                  <input
                    type="text"
                    value={editNotes}
                    onChange={e => setEditNotes(e.target.value)}
                    placeholder="e.g. Verified with client facilities lead and matched against Checkatrade regional benchmark."
                    style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                  <button type="button" className="secondary" onClick={() => setEditingQuote(null)}>Cancel</button>
                  <button className="primary" disabled={quoteBusy}>
                    {quoteBusy ? 'Saving…' : 'Save Quotation Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
