import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '../styles/kiosk.css';
import { getPublicSummary, submitFeedback } from '../services/feedbackService';
import { supabaseProjectId } from '../supabase';

const QUEUE_KEY = 'feedback_queue_v1';
const THEME_KEY = 'kiosk_theme';
const SOUND_KEY = 'kiosk_sound';

function isPermissionDenied(err) {
  const code = String(err?.code || '').toLowerCase();
  const status = Number(err?.status || err?.statusCode || 0);
  return (
    code.includes('permission-denied') ||
    code.includes('permission_denied') ||
    code.includes('42501') ||
    status === 401 ||
    status === 403
  );
}

function loadQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 880;
    o.connect(g);
    g.connect(ctx.destination);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
    o.start();
    o.stop(ctx.currentTime + 0.18);
    setTimeout(() => ctx.close(), 250);
  } catch {
    // ignore
  }
}

export default function KioskPage() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [message, setMessage] = useState({ kind: null, text: '' });
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState(null);
  const [queueCount, setQueueCount] = useState(() => loadQueue().length);

  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'light');
  const [soundOn, setSoundOn] = useState(() => (localStorage.getItem(SOUND_KEY) || '1') === '1');

  const messageTimer = useRef(null);

  const debugEnabled = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).get('debug') === '1';
    } catch {
      return false;
    }
  }, []);

  const statusText = useMemo(() => {
    if (isOnline) return queueCount > 0 ? `Online • ${queueCount} pendentes` : 'Online';
    return queueCount > 0 ? `Offline • ${queueCount} em fila` : 'Offline';
  }, [isOnline, queueCount]);

  const setTimedMessage = useCallback((kind, text, ms = 2500) => {
    setMessage({ kind, text });
    if (messageTimer.current) clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => setMessage({ kind: null, text: '' }), ms);
  }, []);

  const refreshSummary = useCallback(async () => {
    try {
      const s = await getPublicSummary();
      setSummary(s);
    } catch {
      // Não bloquear UI; apenas manter o último snapshot.
    }
  }, []);

  const flushQueue = useCallback(async () => {
    const q = loadQueue();
    if (q.length === 0) return;

    let changed = false;
    const remaining = [];

    for (const item of q) {
      try {
        const clientDate = item?.queuedAt ? new Date(item.queuedAt) : new Date();
        await submitFeedback(item.grau_satisfacao, { clientDate });
        changed = true;
      } catch (err) {
        if (isPermissionDenied(err)) {
          remaining.push(item);
          setTimedMessage(
            'error',
            'Os registos pendentes não podem ser enviados: policies do Supabase a bloquear. Atualiza as policies no Supabase.',
            7000
          );
          break;
        }
        remaining.push(item);
      }
    }

    if (changed) {
      saveQueue(remaining);
      setQueueCount(remaining.length);
    }
  }, [setTimedMessage]);

  async function handleSubmit(grau) {
    if (submitting) return;

    const clickTime = new Date();

    setSubmitting(true);
    try {
      if (soundOn) beep();

      if (!isOnline) {
        // `navigator.onLine` pode ser falso positivo (ex.: webviews). Tenta Supabase na mesma.
        try {
          await submitFeedback(grau, { clientDate: clickTime });
          setTimedMessage('loading', 'Registado. Será sincronizado quando houver ligação.', 3200);
          refreshSummary();
          return;
        } catch (err) {
          if (isPermissionDenied(err)) {
            setTimedMessage(
              'error',
              'Não foi possível registar: policies do Supabase a bloquear (permission-denied). Atualiza as policies no Supabase.',
              7000
            );
            return;
          }

          const q = loadQueue();
          q.push({ grau_satisfacao: grau, queuedAt: clickTime.toISOString() });
          saveQueue(q);
          setQueueCount(q.length);
          setTimedMessage('loading', 'Registado em modo offline. Será enviado quando voltar a internet.', 3200);
          return;
        }
      }

      // Tenta escrever direto no Firestore (funciona offline com persistence).
      await submitFeedback(grau, { clientDate: clickTime });
      setTimedMessage('success', 'Obrigado pelo seu feedback!');
      refreshSummary();
    } catch (err) {
      if (isPermissionDenied(err)) {
        setTimedMessage(
          'error',
          'Não foi possível registar: policies do Supabase a bloquear (permission-denied). Atualiza as policies no Supabase.',
          7000
        );
        return;
      }
      // Fallback: queue local (para casos sem persistence / erros transitórios).
      const q = loadQueue();
      q.push({ grau_satisfacao: grau, queuedAt: clickTime.toISOString() });
      saveQueue(q);
      setQueueCount(q.length);
      setTimedMessage('loading', 'Registado em modo offline. Será enviado quando voltar a internet.', 3200);
    } finally {
      setSubmitting(false);
    }
  }

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
  }

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    localStorage.setItem(SOUND_KEY, next ? '1' : '0');
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    document.body.classList.add('kiosk-body');
    return () => {
      document.body.classList.remove('kiosk-body');
    };
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
    refreshSummary();
    const t = setInterval(refreshSummary, 15000);
    return () => clearInterval(t);
  }, [refreshSummary]);

  useEffect(() => {
    // quando volta online, tenta reenviar fila
    if (isOnline) {
      flushQueue();
      refreshSummary();
    }
  }, [isOnline, flushQueue, refreshSummary]);

  useEffect(() => {
    setQueueCount(loadQueue().length);
  }, []);

  return (
    <>
      <div className="top-actions">
        <button className="icon-btn" onClick={toggleTheme} title="Tema">
          {theme === 'dark' ? '☾' : '☀'}
        </button>
        <button className="icon-btn" onClick={toggleSound} title="Som">
          {soundOn ? '🔊' : '🔇'}
        </button>
        <button className="icon-btn" onClick={toggleFullscreen} title="Ecrã inteiro">
          ⛶
        </button>
      </div>

      <div className="container">
        <div className="content">
          <h1>Avalie o Atendimento</h1>
          <p className="subtitle">Como foi sua experiência hoje?</p>

          <div className="status-row">
            <div className={`status-pill ${isOnline ? 'online' : 'offline'}`}>{statusText}</div>
          </div>

          {debugEnabled ? (
            <div style={{ marginTop: 10, padding: 10, border: '1px dashed var(--border)', borderRadius: 10, opacity: 0.95 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Debug</div>
              <div style={{ fontFamily: 'monospace', fontSize: 12, lineHeight: 1.4 }}>
                <div>host: {typeof window !== 'undefined' ? window.location.host : '—'}</div>
                <div>supabaseProjectId: {supabaseProjectId || '—'}</div>
                <div>db: supabase</div>
              </div>
            </div>
          ) : null}

          <div className="buttons-container">
            <button
              className={`feedback-btn very-satisfied ${submitting ? 'disabled' : ''}`}
              onClick={() => handleSubmit('muito_satisfeito')}
              disabled={submitting}
            >
              <span className="icon">😊</span>
              <span className="text">Muito Satisfeito</span>
            </button>

            <button
              className={`feedback-btn satisfied ${submitting ? 'disabled' : ''}`}
              onClick={() => handleSubmit('satisfeito')}
              disabled={submitting}
            >
              <span className="icon">🙂</span>
              <span className="text">Satisfeito</span>
            </button>

            <button
              className={`feedback-btn unsatisfied ${submitting ? 'disabled' : ''}`}
              onClick={() => handleSubmit('insatisfeito')}
              disabled={submitting}
            >
              <span className="icon">😞</span>
              <span className="text">Insatisfeito</span>
            </button>
          </div>

          {message.kind ? (
            <div className={`feedback-message ${message.kind}`}>{message.text}</div>
          ) : (
            <div className="feedback-message" style={{ opacity: 0.75 }}>
              &nbsp;
            </div>
          )}

          <div className="summary">
            <div className="summary-grid">
              <div className="summary-card">
                <div className="k">Hoje</div>
                <div className="v">{summary ? summary.todayTotal : '—'}</div>
                <div className="s">Registos</div>
              </div>
              <div className="summary-card">
                <div className="k">Muito Satisfeito</div>
                <div className="v">{summary ? summary.today.muito_satisfeito : '—'}</div>
                <div className="s">Hoje</div>
              </div>
              <div className="summary-card">
                <div className="k">Satisfeito</div>
                <div className="v">{summary ? summary.today.satisfeito : '—'}</div>
                <div className="s">Hoje</div>
              </div>
              <div className="summary-card">
                <div className="k">Insatisfeito</div>
                <div className="v">{summary ? summary.today.insatisfeito : '—'}</div>
                <div className="s">Hoje</div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14, color: 'var(--muted)', fontWeight: 800 }}>
            Total histórico: {summary ? summary.total : '—'}
          </div>
        </div>
      </div>
    </>
  );
}
