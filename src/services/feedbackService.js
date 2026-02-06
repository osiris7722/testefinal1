import { supabase } from '../supabase';
import {
  formatDateYYYYMMDD,
  formatTimeHHMMSS,
  getDiaSemanaPt,
  startOfDay,
  endOfDay
} from '../utils/date';

const FEEDBACK_TABLE = 'feedback';

function nextLocalSuffixForMs(ms) {
  const key = 'feedback_id_ms_v1';
  const raw = localStorage.getItem(key);
  let state;
  try {
    state = raw ? JSON.parse(raw) : null;
  } catch {
    state = null;
  }
  const lastMs = state?.ms;
  const lastN = state?.n;

  let n = 0;
  if (typeof lastMs === 'number' && lastMs === ms && typeof lastN === 'number') {
    n = (lastN + 1) % 1000;
  }

  localStorage.setItem(key, JSON.stringify({ ms, n }));
  return n;
}

function generateNumericId(clientDate) {
  // 13 digits ms + 3 digits suffix => 16-digit numeric id.
  // Ex: 1700000000000 042
  const ms = clientDate.getTime();
  const suffix = nextLocalSuffixForMs(ms);
  return ms * 1000 + suffix;
}

async function safeCount(builder) {
  const { count, error } = await builder.select('id', { count: 'exact', head: true });
  if (error) throw error;
  return count || 0;
}

function baseQuery() {
  return supabase.from(FEEDBACK_TABLE);
}

export async function getLastFeedback() {
  const { data, error } = await baseQuery()
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = data?.[0];
  if (!row) return null;
  return { ...row, docId: row.row_id || row.id };
}

export async function getFeedbackById(docId) {
  if (!docId) return null;
  const { data, error } = await baseQuery().select('*').eq('row_id', docId).limit(1);
  if (error) throw error;
  const row = data?.[0];
  if (!row) return null;
  return { ...row, docId: row.row_id || row.id };
}

export async function getAvailableDates({ maxScan = 2000 } = {}) {
  const { data, error } = await baseQuery()
    .select('data')
    .order('created_at', { ascending: false })
    .limit(maxScan);
  if (error) throw error;
  const set = new Set();
  for (const row of data || []) {
    const dateStr = row?.data;
    if (typeof dateStr === 'string' && dateStr) set.add(dateStr);
  }
  return Array.from(set).sort();
}

function pctVariation(p1, p2) {
  const a = Number(p1 || 0);
  const b = Number(p2 || 0);
  if (a === 0) return b === 0 ? 0 : 100;
  return Math.round(((b - a) / a) * 100);
}

async function countsForRange(start, end) {
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const msQ = baseQuery()
    .eq('grau_satisfacao', 'muito_satisfeito')
    .gte('created_at', startIso)
    .lte('created_at', endIso);
  const sQ = baseQuery()
    .eq('grau_satisfacao', 'satisfeito')
    .gte('created_at', startIso)
    .lte('created_at', endIso);
  const iQ = baseQuery()
    .eq('grau_satisfacao', 'insatisfeito')
    .gte('created_at', startIso)
    .lte('created_at', endIso);
  const [ms, s, i] = await Promise.all([safeCount(msQ), safeCount(sQ), safeCount(iQ)]);
  return { muito_satisfeito: ms, satisfeito: s, insatisfeito: i, total: ms + s + i };
}

export async function comparePeriods(p1StartStr, p1EndStr, p2StartStr, p2EndStr) {
  const p1Start = startOfDay(new Date(p1StartStr));
  const p1End = endOfDay(new Date(p1EndStr));
  const p2Start = startOfDay(new Date(p2StartStr));
  const p2End = endOfDay(new Date(p2EndStr));

  const [periodo1, periodo2] = await Promise.all([
    countsForRange(p1Start, p1End),
    countsForRange(p2Start, p2End)
  ]);

  const variacao = {
    muito_satisfeito: pctVariation(periodo1.muito_satisfeito, periodo2.muito_satisfeito),
    satisfeito: pctVariation(periodo1.satisfeito, periodo2.satisfeito),
    insatisfeito: pctVariation(periodo1.insatisfeito, periodo2.insatisfeito),
    total: pctVariation(periodo1.total, periodo2.total)
  };

  return { periodo1, periodo2, variacao };
}

export async function submitFeedback(grau, { clientDate } = {}) {
  const now = clientDate instanceof Date ? clientDate : new Date();
  const payload = {
    id: generateNumericId(now),
    grau_satisfacao: grau,
    data: formatDateYYYYMMDD(now),
    hora: formatTimeHHMMSS(now),
    dia_semana: getDiaSemanaPt(now),
    created_at: now.toISOString(),
    client_timestamp: now.toISOString()
  };
  const { data, error } = await baseQuery().insert(payload).select('*').limit(1);
  if (error) throw error;
  const row = data?.[0];
  return row ? { ...row, docId: row.row_id || row.id } : { ...payload, docId: null };
}

export async function getPublicSummary() {
  const today = formatDateYYYYMMDD(new Date());
  const total = await safeCount(baseQuery());
  const msQ = baseQuery().eq('data', today).eq('grau_satisfacao', 'muito_satisfeito');
  const sQ = baseQuery().eq('data', today).eq('grau_satisfacao', 'satisfeito');
  const iQ = baseQuery().eq('data', today).eq('grau_satisfacao', 'insatisfeito');

  const todayCounts = {
    muito_satisfeito: await safeCount(msQ),
    satisfeito: await safeCount(sQ),
    insatisfeito: await safeCount(iQ)
  };
  const todayTotal =
    todayCounts.muito_satisfeito + todayCounts.satisfeito + todayCounts.insatisfeito;

  let lastId = null;
  try {
    const { data } = await baseQuery().select('row_id, id').order('created_at', { ascending: false }).limit(1);
    const row = data?.[0];
    lastId = row?.row_id || row?.id || null;
  } catch {
    lastId = null;
  }

  return {
    date: today,
    today: todayCounts,
    todayTotal,
    total,
    lastId
  };
}

export async function getTotalsAllTime() {
  const msQ = baseQuery().eq('grau_satisfacao', 'muito_satisfeito');
  const sQ = baseQuery().eq('grau_satisfacao', 'satisfeito');
  const iQ = baseQuery().eq('grau_satisfacao', 'insatisfeito');

  return {
    muito_satisfeito: await safeCount(msQ),
    satisfeito: await safeCount(sQ),
    insatisfeito: await safeCount(iQ),
    total: await safeCount(baseQuery())
  };
}

export async function getTotalsForDay(dateStr) {
  const msQ = baseQuery().eq('data', dateStr).eq('grau_satisfacao', 'muito_satisfeito');
  const sQ = baseQuery().eq('data', dateStr).eq('grau_satisfacao', 'satisfeito');
  const iQ = baseQuery().eq('data', dateStr).eq('grau_satisfacao', 'insatisfeito');

  return {
    muito_satisfeito: await safeCount(msQ),
    satisfeito: await safeCount(sQ),
    insatisfeito: await safeCount(iQ)
  };
}

export async function getTotalsForRange(startDateStr, endDateStr, grau) {
  const start = startOfDay(new Date(startDateStr));
  const end = endOfDay(new Date(endDateStr));
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  let q = baseQuery().gte('created_at', startIso).lte('created_at', endIso);
  if (grau) q = q.eq('grau_satisfacao', grau);
  return await safeCount(q);
}

export async function getRecentFeedback({ limit = 600 } = {}) {
  const { data, error } = await baseQuery()
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map((row) => ({ ...row, docId: row.row_id || row.id }));
}
