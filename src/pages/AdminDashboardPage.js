import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/admin.css';
import {
  comparePeriods,
  getAvailableDates,
  getLastFeedback,
  getTotalsAllTime,
  getTotalsForDay
} from '../services/feedbackService';
import { supabase, supabaseProjectId } from '../supabase';
import { exportCsv, exportTxt, exportXlsx } from '../services/exportService';
import { formatDateYYYYMMDD } from '../utils/date';
import { useChart } from '../hooks/useChart';

const THEME_KEY = 'kiosk_theme';

function pct(part, total) {
  if (!total) return '0%';
  return `${Math.round((part / total) * 100)}%`;
}

export default function AdminDashboardPage() {
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'light');
  const [adminEmail, setAdminEmail] = useState('');

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  const [sysNow, setSysNow] = useState(new Date());
  const [sysLast, setSysLast] = useState(null);

  const todayStr = useMemo(() => formatDateYYYYMMDD(new Date()), []);
  const [dayStr, setDayStr] = useState(todayStr);

  const [totals, setTotals] = useState(null);
  const [dayTotals, setDayTotals] = useState(null);

  const [availableDates, setAvailableDates] = useState([]);
  const [temporalDate, setTemporalDate] = useState('');
  const effectiveTemporalDate = temporalDate || todayStr;
  const [temporalTotals, setTemporalTotals] = useState(null);

  const [comp, setComp] = useState({
    p1Start: todayStr,
    p1End: todayStr,
    p2Start: todayStr,
    p2End: todayStr
  });
  const [compData, setCompData] = useState(null);

  const pieRef = useRef(null);
  const barRef = useRef(null);
  const comparisonRef = useRef(null);

  const [histId, setHistId] = useState('');
  const [histFrom, setHistFrom] = useState(todayStr);
  const [histTo, setHistTo] = useState(todayStr);
  const [histGrau, setHistGrau] = useState('');
  const [history, setHistory] = useState([]);
  const [histLoading, setHistLoading] = useState(false);
  const [histPage, setHistPage] = useState(1);
  const [histHasPrev, setHistHasPrev] = useState(false);
  const [histHasNext, setHistHasNext] = useState(false);

  const [exportFrom, setExportFrom] = useState(todayStr);
  const [exportTo, setExportTo] = useState(todayStr);

  const pieConfig = useMemo(() => {
    const ms = totals?.muito_satisfeito ?? 0;
    const s = totals?.satisfeito ?? 0;
    const i = totals?.insatisfeito ?? 0;
    return {
      type: 'doughnut',
      data: {
        labels: ['Muito Satisfeito', 'Satisfeito', 'Insatisfeito'],
        datasets: [
          {
            data: [ms, s, i],
            backgroundColor: ['#4caf50', '#2196f3', '#f44336']
          }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } }
      }
    };
  }, [totals]);

  const barConfig = useMemo(() => {
    const ms = dayTotals?.muito_satisfeito ?? 0;
    const s = dayTotals?.satisfeito ?? 0;
    const i = dayTotals?.insatisfeito ?? 0;
    return {
      type: 'bar',
      data: {
        labels: ['Muito Satisfeito', 'Satisfeito', 'Insatisfeito'],
        datasets: [
          {
            label: dayStr,
            data: [ms, s, i],
            backgroundColor: ['#4caf50', '#2196f3', '#f44336']
          }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    };
  }, [dayTotals, dayStr]);

  const comparisonConfig = useMemo(() => {
    const p1 = compData?.periodo1 || { muito_satisfeito: 0, satisfeito: 0, insatisfeito: 0 };
    const p2 = compData?.periodo2 || { muito_satisfeito: 0, satisfeito: 0, insatisfeito: 0 };
    return {
      type: 'bar',
      data: {
        labels: ['Muito Satisfeito', 'Satisfeito', 'Insatisfeito'],
        datasets: [
          {
            label: 'Período 1',
            data: [p1.muito_satisfeito, p1.satisfeito, p1.insatisfeito],
            backgroundColor: 'rgba(102, 126, 234, 0.7)'
          },
          {
            label: 'Período 2',
            data: [p2.muito_satisfeito, p2.satisfeito, p2.insatisfeito],
            backgroundColor: 'rgba(118, 75, 162, 0.7)'
          }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } },
        scales: { y: { beginAtZero: true } }
      }
    };
  }, [compData]);

  useChart(pieRef, pieConfig);
  useChart(barRef, barConfig);
  useChart(comparisonRef, comparisonConfig);

  const refresh = useCallback(async () => {
    try {
      const [t, d] = await Promise.all([getTotalsAllTime(), getTotalsForDay(dayStr)]);
      setTotals(t);
      setDayTotals(d);
      const last = await getLastFeedback().catch(() => null);
      setSysLast(last);
      setLastRefresh(new Date());
    } catch {
      // ignore
    }
  }, [dayStr]);

  const refreshTemporal = useCallback(async () => {
    try {
      const d = await getTotalsForDay(effectiveTemporalDate);
      setTemporalTotals(d);
    } catch {
      setTemporalTotals(null);
    }
  }, [effectiveTemporalDate]);

  const refreshDates = useCallback(async () => {
    try {
      const dates = await getAvailableDates({ maxScan: 2000 });
      setAvailableDates(dates);
    } catch {
      setAvailableDates([]);
    }
  }, []);

  const runComparison = useCallback(async () => {
    try {
      const res = await comparePeriods(comp.p1Start, comp.p1End, comp.p2Start, comp.p2End);
      setCompData(res);
    } catch {
      setCompData(null);
    }
  }, [comp]);

  function satisfactionLabel(v) {
    if (v === 'muito_satisfeito') return 'Muito Satisfeito';
    if (v === 'satisfeito') return 'Satisfeito';
    if (v === 'insatisfeito') return 'Insatisfeito';
    return v || '—';
  }

  async function loadHistoryPage({ direction } = { direction: 'reset' }) {
    setHistLoading(true);
    try {
      const idQueryRaw = String(histId || '').trim();
      if (idQueryRaw) {
        const maybeNumber = Number(idQueryRaw);
        let q = supabase.from('feedback').select('*');
        if (Number.isFinite(maybeNumber) && maybeNumber > 0) {
          q = q.eq('id', maybeNumber);
        } else {
          q = q.eq('id', idQueryRaw);
        }

        const { data, error } = await q.limit(10);
        if (error) throw error;
        const rows = (data || []).map((row) => ({ ...row, docId: row.row_id || row.id }));
        setHistory(rows);
        setHistPage(1);
        setHistHasPrev(false);
        setHistHasNext(false);
        return;
      }
      const pageSize = 50;
      let newPage = 1;
      if (direction === 'next') newPage = histPage + 1;
      else if (direction === 'prev') newPage = Math.max(1, histPage - 1);

      let q = supabase
        .from('feedback')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .gte('data', histFrom)
        .lte('data', histTo);

      if (histGrau) q = q.eq('grau_satisfacao', histGrau);

      const offset = (newPage - 1) * pageSize;
      const { data, count, error } = await q.range(offset, offset + pageSize - 1);
      if (error) throw error;

      const rows = (data || []).map((row) => ({ ...row, docId: row.row_id || row.id }));
      setHistory(rows);
      setHistPage(newPage);
      setHistHasPrev(newPage > 1);
      setHistHasNext(offset + pageSize < (count || 0));
    } catch {
      setHistory([]);
      setHistPage(1);
      setHistHasPrev(false);
      setHistHasNext(false);
    } finally {
      setHistLoading(false);
    }
  }

  async function exportRange(type) {
    const { data, error } = await supabase
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false })
      .gte('data', exportFrom)
      .lte('data', exportTo)
      .limit(5000);
    if (error) throw error;
    const rows = (data || []).map((row) => ({ ...row, docId: row.row_id || row.id }));

    const nameBase = `feedback_${exportFrom}_${exportTo}`;
    if (type === 'csv') exportCsv(`${nameBase}.csv`, rows);
    if (type === 'txt') exportTxt(`${nameBase}.txt`, rows);
    if (type === 'xlsx') exportXlsx(`${nameBase}.xlsx`, rows);
  }

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  useEffect(() => {
    document.body.classList.add('dashboard-body');
    return () => document.body.classList.remove('dashboard-body');
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAdminEmail(session?.user?.email || '');
    });
    return () => sub?.subscription?.unsubscribe();
  }, []);

  useEffect(() => {
    const t = setInterval(() => setSysNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    refreshDates();
  }, [refreshDates]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    refreshTemporal();
  }, [refreshTemporal]);

  useEffect(() => {
    loadHistoryPage({ direction: 'reset' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [histId, histFrom, histTo, histGrau]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => {
      refresh();
      refreshTemporal();
      runComparison();
      loadHistoryPage({ direction: 'reset' });
    }, 20000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, refresh, refreshTemporal, runComparison, histId, histFrom, histTo, histGrau]);

  const totalAll = totals?.total ?? 0;
  const temporalTotal = temporalTotals
    ? (temporalTotals.muito_satisfeito || 0) + (temporalTotals.satisfeito || 0) + (temporalTotals.insatisfeito || 0)
    : 0;

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div>
          <h1>Painel de Administração</h1>
          <div style={{ opacity: 0.9, fontWeight: 800 }}>
            {lastRefresh
              ? `Atualizado: ${lastRefresh.toLocaleDateString()} ${lastRefresh.toLocaleTimeString()}`
              : '—'}
          </div>
        </div>

        <div className="header-actions">
          <button className="theme-toggle" onClick={toggleTheme} title="Tema">
            {theme === 'dark' ? '☾' : '☀'}
          </button>

          <Link className="logout-btn" to="/admin_rocha/tv">
            Modo TV
          </Link>

          <div className="admin-ident" title={adminEmail}>
            <span className="admin-dot" />
            <span className="admin-email">{adminEmail || 'Admin'}</span>
          </div>

          <button className="logout-btn" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <div className="dashboard-content">
        <section className="system-section">
          <h2>Sistema</h2>
          <div className="system-grid">
            <div className="system-card">
              <div className="k">Hora</div>
              <div className="v">{sysNow.toLocaleTimeString()}</div>
              <div className="s">{sysNow.toLocaleDateString()}</div>
            </div>
            <div className="system-card">
              <div className="k">Conectividade</div>
              <div className="v">{isOnline ? 'Online' : 'Offline'}</div>
              <div className="s">`navigator.onLine`</div>
            </div>
            <div className="system-card">
              <div className="k">Supabase</div>
              <div className="v">{supabaseProjectId || '—'}</div>
              <div className="s">DB online</div>
            </div>
            <div className="system-card">
              <div className="k">Último registo</div>
              <div className="v">{sysLast?.id ?? '—'}</div>
              <div className="s">
                {sysLast?.data ? `${sysLast.data} ${sysLast.hora || ''}`.trim() : '—'}
                {sysLast?.docId ? ` · ${String(sysLast.docId).slice(0, 8)}` : ''}
              </div>
            </div>
          </div>

          <div className="system-actions">
            <label className="toggle">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Auto-refresh
            </label>
            <button className="secondary-btn" onClick={refresh}>
              Atualizar agora
            </button>
          </div>
        </section>

        <section className="temporal-section">
          <h2>Análise Temporal</h2>
          <div className="temporal-controls">
            <button
              className={`temporal-btn ${temporalDate ? '' : 'active'}`}
              onClick={() => setTemporalDate('')}
            >
              Hoje
            </button>
            <div className="date-filter">
              <label>Filtrar por dia:</label>
              <select value={temporalDate} onChange={(e) => setTemporalDate(e.target.value)}>
                <option value="">Selecione uma data</option>
                {availableDates
                  .slice()
                  .reverse()
                  .map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <div className="temporal-stats">
            <div className="temporal-stat-item">
              <h4>😊 Muito Satisfeito</h4>
              <p>{temporalTotals ? temporalTotals.muito_satisfeito : '—'}</p>
            </div>
            <div className="temporal-stat-item">
              <h4>🙂 Satisfeito</h4>
              <p>{temporalTotals ? temporalTotals.satisfeito : '—'}</p>
            </div>
            <div className="temporal-stat-item">
              <h4>😞 Insatisfeito</h4>
              <p>{temporalTotals ? temporalTotals.insatisfeito : '—'}</p>
            </div>
            <div className="temporal-stat-item">
              <h4>📊 Total do Dia</h4>
              <p>{temporalTotals ? temporalTotal : '—'}</p>
            </div>
          </div>
        </section>

        <section>
          <h2>Estatísticas</h2>
          <div className="stats-grid">
            <div className="stat-card purple">
              <div className="stat-icon">📊</div>
              <div className="stat-info">
                <h3>Total de Feedbacks</h3>
                <div className="stat-number">{totals ? totals.total : '—'}</div>
                <div className="stat-percent">Histórico</div>
              </div>
            </div>
            <div className="stat-card green">
              <div className="stat-icon">😊</div>
              <div className="stat-info">
                <h3>Muito Satisfeito</h3>
                <div className="stat-number">{totals ? totals.muito_satisfeito : '—'}</div>
                <div className="stat-percent">
                  {totals ? pct(totals.muito_satisfeito, totalAll) : '—'}
                </div>
              </div>
            </div>
            <div className="stat-card blue">
              <div className="stat-icon">🙂</div>
              <div className="stat-info">
                <h3>Satisfeito</h3>
                <div className="stat-number">{totals ? totals.satisfeito : '—'}</div>
                <div className="stat-percent">{totals ? pct(totals.satisfeito, totalAll) : '—'}</div>
              </div>
            </div>
            <div className="stat-card red">
              <div className="stat-icon">😞</div>
              <div className="stat-info">
                <h3>Insatisfeito</h3>
                <div className="stat-number">{totals ? totals.insatisfeito : '—'}</div>
                <div className="stat-percent">
                  {totals ? pct(totals.insatisfeito, totalAll) : '—'}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2>Gráficos</h2>
          <div className="charts-grid">
            <div className="chart-container">
              <h3>Distribuição (Histórico)</h3>
              <canvas ref={pieRef} />
            </div>
            <div className="chart-container">
              <h3>Dia selecionado</h3>
              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <input
                  type="date"
                  value={dayStr}
                  onChange={(e) => setDayStr(e.target.value)}
                  style={{ padding: 10, borderRadius: 8, border: '2px solid var(--border)' }}
                />
              </div>
              <canvas ref={barRef} />
            </div>
          </div>
        </section>

        <section className="comparison-section">
          <h2>Comparação entre Períodos</h2>
          <div className="comparison-controls">
            <div className="period-group">
              <h4>Período 1</h4>
              <div className="date-range-compact">
                <div className="date-input-group">
                  <label>ID</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={comp.p1Start}
                    onChange={(e) => setComp((c) => ({ ...c, p1Start: e.target.value }))}
                  />
                </div>
                <div className="date-input-group">
                  <label>Até:</label>
                  <input
                    type="date"
                    value={comp.p1End}
                    onChange={(e) => setComp((c) => ({ ...c, p1End: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="period-group">
              <h4>Período 2</h4>
              <div className="date-range-compact">
                <div className="date-input-group">
                  <label>De:</label>
                  <input
                    type="date"
                    value={comp.p2Start}
                    onChange={(e) => setComp((c) => ({ ...c, p2Start: e.target.value }))}
                  />
                </div>
                <div className="date-input-group">
                  <label>Até:</label>
                  <input
                    type="date"
                    value={comp.p2End}
                    onChange={(e) => setComp((c) => ({ ...c, p2End: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          </div>
          <button className="comparison-btn" onClick={runComparison}>
            📊 Comparar Períodos
          </button>

          {compData ? (
            <div className="comparison-results">
              <div className="comparison-grid">
                <div className="comparison-item">
                  <h4>Muito Satisfeito</h4>
                  <div className="comparison-values">
                    <div className="comp-value">
                      <span className="label">Período 1:</span>
                      <span>{compData.periodo1.muito_satisfeito}</span>
                    </div>
                    <div className="comp-value">
                      <span className="label">Período 2:</span>
                      <span>{compData.periodo2.muito_satisfeito}</span>
                    </div>
                    <div className={`comp-value variation ${compData.variacao.muito_satisfeito > 0 ? 'positive' : compData.variacao.muito_satisfeito < 0 ? 'negative' : 'neutral'}`}>
                      {(compData.variacao.muito_satisfeito > 0 ? '↑ ' : compData.variacao.muito_satisfeito < 0 ? '↓ ' : '') +
                        Math.abs(compData.variacao.muito_satisfeito) +
                        '% de variação'}
                    </div>
                  </div>
                </div>
                <div className="comparison-item">
                  <h4>Satisfeito</h4>
                  <div className="comparison-values">
                    <div className="comp-value">
                      <span className="label">Período 1:</span>
                      <span>{compData.periodo1.satisfeito}</span>
                    </div>
                    <div className="comp-value">
                      <span className="label">Período 2:</span>
                      <span>{compData.periodo2.satisfeito}</span>
                    </div>
                    <div className={`comp-value variation ${compData.variacao.satisfeito > 0 ? 'positive' : compData.variacao.satisfeito < 0 ? 'negative' : 'neutral'}`}>
                      {(compData.variacao.satisfeito > 0 ? '↑ ' : compData.variacao.satisfeito < 0 ? '↓ ' : '') +
                        Math.abs(compData.variacao.satisfeito) +
                        '% de variação'}
                    </div>
                  </div>
                </div>
                <div className="comparison-item">
                  <h4>Insatisfeito</h4>
                  <div className="comparison-values">
                    <div className="comp-value">
                      <span className="label">Período 1:</span>
                      <span>{compData.periodo1.insatisfeito}</span>
                    </div>
                    <div className="comp-value">
                      <span className="label">Período 2:</span>
                      <span>{compData.periodo2.insatisfeito}</span>
                    </div>
                    <div className={`comp-value variation ${compData.variacao.insatisfeito > 0 ? 'positive' : compData.variacao.insatisfeito < 0 ? 'negative' : 'neutral'}`}>
                      {(compData.variacao.insatisfeito > 0 ? '↑ ' : compData.variacao.insatisfeito < 0 ? '↓ ' : '') +
                        Math.abs(compData.variacao.insatisfeito) +
                        '% de variação'}
                    </div>
                  </div>
                </div>
              </div>
              <div className="chart-container" style={{ marginTop: 14 }}>
                <h3>Gráfico Comparativo</h3>
                <canvas ref={comparisonRef} />
              </div>
            </div>
          ) : null}
        </section>

        <section className="export-section">
          <h2>Exportação de Dados</h2>
          <div className="export-controls">
            <div className="date-range">
              <div className="date-input-group">
                <label>Data Início:</label>
                <input type="date" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} />
              </div>
              <div className="date-input-group">
                <label>Data Fim:</label>
                <input type="date" value={exportTo} onChange={(e) => setExportTo(e.target.value)} />
              </div>
            </div>
            <div className="export-buttons">
              <button className="export-btn csv" onClick={() => exportRange('xlsx')}>
                📊 Exportar Excel (XLSX)
              </button>
              <button className="export-btn csv" onClick={() => exportRange('csv')}>
                🧾 Exportar CSV
              </button>
              <button className="export-btn txt" onClick={() => exportRange('txt')}>
                📄 Exportar TXT
              </button>
            </div>
          </div>
        </section>

        <section>
          <h2>Histórico</h2>
          <div className="history-controls">
            <div className="history-filters">
              <div className="date-input-group">
                <label>ID (Firestore)</label>
                <input
                  type="text"
                  value={histId}
                  onChange={(e) => setHistId(e.target.value)}
                  placeholder="Ex: A1b2C3d4..."
                />
              </div>
              <div className="date-input-group">
                <label>Satisfação</label>
                <select value={histGrau} onChange={(e) => setHistGrau(e.target.value)}>
                  <option value="">Todas</option>
                  <option value="muito_satisfeito">Muito Satisfeito</option>
                  <option value="satisfeito">Satisfeito</option>
                  <option value="insatisfeito">Insatisfeito</option>
                </select>
              </div>
              <div className="date-input-group">
                <label>De:</label>
                <input type="date" value={histFrom} onChange={(e) => setHistFrom(e.target.value)} />
              </div>
              <div className="date-input-group">
                <label>Até:</label>
                <input type="date" value={histTo} onChange={(e) => setHistTo(e.target.value)} />
              </div>
            </div>

            <div className="history-actions">
              <button className="comparison-btn" onClick={() => loadHistoryPage({ direction: 'reset' })}>
                Aplicar filtros
              </button>
              <button
                className="secondary-btn"
                onClick={() => {
                  setHistId('');
                  setHistGrau('');
                  setHistFrom(todayStr);
                  setHistTo(todayStr);
                }}
              >
                Limpar
              </button>
            </div>

            <div style={{ marginTop: 16, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid var(--border)' }}>ID</th>
                    <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid var(--border)' }}>Satisfação</th>
                    <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid var(--border)' }}>Data</th>
                    <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid var(--border)' }}>Hora</th>
                    <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid var(--border)' }}>Dia da Semana</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((r) => (
                    <tr key={r.id}>
                      <td style={{ padding: 10, borderBottom: '1px solid var(--border)', fontFamily: 'monospace' }}>
                        {r.id}
                      </td>
                      <td style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
                        <span className={`satisfaction-badge ${r.grau_satisfacao || ''}`}>
                          {satisfactionLabel(r.grau_satisfacao)}
                        </span>
                      </td>
                      <td style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>{r.data}</td>
                      <td style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>{r.hora}</td>
                      <td style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>{r.dia_semana}</td>
                    </tr>
                  ))}
                  {history.length === 0 && !histLoading ? (
                    <tr>
                      <td colSpan={6} style={{ padding: 14, color: 'var(--muted)', fontWeight: 800 }}>
                        Sem resultados.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="pagination">
              <button
                disabled={histLoading || !histHasPrev}
                onClick={() => loadHistoryPage({ direction: 'prev' })}
              >
                ← Anterior
              </button>
              <span>Página {histPage}</span>
              <button
                disabled={histLoading || !histHasNext}
                onClick={() => loadHistoryPage({ direction: 'next' })}
              >
                Próxima →
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
