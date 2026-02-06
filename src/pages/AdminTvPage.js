import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/admin.css';
import '../styles/tv.css';
import { supabase } from '../supabase';
import { getRecentFeedback, getTotalsAllTime, getTotalsForDay } from '../services/feedbackService';
import { formatDateYYYYMMDD } from '../utils/date';
import { useChart } from '../hooks/useChart';

const THEME_KEY = 'kiosk_theme';

function aggRecent(docs) {
  const byDate = new Map();
  for (const d of docs) {
    const data = d.data || d.data_str;
    if (!data) continue;
    const prev = byDate.get(data) || { ms: 0, s: 0, i: 0, total: 0 };
    if (d.grau_satisfacao === 'muito_satisfeito') prev.ms += 1;
    if (d.grau_satisfacao === 'satisfeito') prev.s += 1;
    if (d.grau_satisfacao === 'insatisfeito') prev.i += 1;
    prev.total += 1;
    byDate.set(data, prev);
  }
  const keys = Array.from(byDate.keys()).sort();
  return { keys, byDate };
}


export default function AdminTvPage() {
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'light');
  const [adminEmail, setAdminEmail] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const [clock, setClock] = useState(new Date());

  const [kpi, setKpi] = useState({ todayTotal: 0, total: 0, ms: 0, s: 0, i: 0 });
  const [trend, setTrend] = useState({ labels: [], totals: [] });

  const barRef = useRef(null);
  const pieRef = useRef(null);

  const barConfig = useMemo(() => {
    return {
      type: 'bar',
      data: {
        labels: trend.labels,
        datasets: [
          {
            label: 'Total por dia (amostra recente)',
            data: trend.totals,
            backgroundColor: '#667eea'
          }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    };
  }, [trend]);

  const pieConfig = useMemo(() => {
    return {
      type: 'doughnut',
      data: {
        labels: ['Muito Satisfeito', 'Satisfeito', 'Insatisfeito'],
        datasets: [
          {
            data: [kpi.ms, kpi.s, kpi.i],
            backgroundColor: ['#4caf50', '#2196f3', '#f44336']
          }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } }
      }
    };
  }, [kpi]);

  useChart(barRef, barConfig);
  useChart(pieRef, pieConfig);

  async function refresh() {
    const todayStr = formatDateYYYYMMDD(new Date());

    try {
      const [totalAll, todayCounts] = await Promise.all([
        getTotalsAllTime(),
        getTotalsForDay(todayStr)
      ]);

      setKpi({
        total: totalAll.total || 0,
        todayTotal:
          (todayCounts.muito_satisfeito || 0) +
          (todayCounts.satisfeito || 0) +
          (todayCounts.insatisfeito || 0),
        ms: todayCounts.muito_satisfeito || 0,
        s: todayCounts.satisfeito || 0,
        i: todayCounts.insatisfeito || 0
      });
    } catch {
      // ignore
    }

    try {
      const rows = await getRecentFeedback({ limit: 600 });
      const { keys, byDate } = aggRecent(rows);
      const lastKeys = keys.slice(-10);
      const totals = lastKeys.map((k) => byDate.get(k)?.total || 0);
      setTrend({ labels: lastKeys, totals });
    } catch {
      // ignore
    }
  }

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    document.body.classList.add('tv-body');
    return () => document.body.classList.remove('tv-body');
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

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
    refresh();
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="tv-wrap">
      <div className="tv-header">
        <div>
          <div className="tv-h1">Modo TV</div>
          <div className="tv-sub">Indicadores em tempo real</div>
        </div>

        <div className="tv-right">
          <div className="tv-clock">{clock.toLocaleTimeString()}</div>
          <div className="tv-admin" title={adminEmail}>
            {adminEmail || 'Admin'}
          </div>
          <button className="tv-btn" onClick={toggleTheme} title="Tema">
            {theme === 'dark' ? '☾' : '☀'}
          </button>
          <button className="tv-btn" onClick={toggleFullscreen} title="Ecrã inteiro">
            ⛶
          </button>
          <Link className="tv-btn tv-link" to="/admin_rocha/dashboard">
            Dashboard
          </Link>
        </div>
      </div>

      <div className="tv-main">
        <div className="tv-kpis">
          <div className="tv-kpi">
            <div className="k">Hoje</div>
            <div className="v">{kpi.todayTotal}</div>
            <div className="s">Total de registos</div>
          </div>
          <div className="tv-kpi">
            <div className="k">Histórico</div>
            <div className="v">{kpi.total}</div>
            <div className="s">Total acumulado</div>
          </div>
          <div className="tv-kpi">
            <div className="k">Muito Satisfeito</div>
            <div className="v">{kpi.ms}</div>
            <div className="s">Hoje</div>
          </div>
          <div className="tv-kpi">
            <div className="k">Insatisfeito</div>
            <div className="v">{kpi.i}</div>
            <div className="s">Hoje</div>
          </div>
        </div>

        <div className="tv-charts">
          <div className="tv-panel">
            <div className="tv-panel-title">Tendência (amostra recente)</div>
            <canvas ref={barRef} />
          </div>
          <div className="tv-panel">
            <div className="tv-panel-title">Distribuição (hoje)</div>
            <canvas ref={pieRef} />
          </div>
        </div>

        <div className="tv-footer">
          <div className={`tv-pill ${isOnline ? 'ok' : 'warn'}`}>{isOnline ? 'Online' : 'Offline'}</div>
          <div className="tv-note">Auto-refresh: 15s</div>
        </div>
      </div>
    </div>
  );
}
