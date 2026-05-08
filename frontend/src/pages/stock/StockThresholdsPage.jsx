import { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { getNodes } from '../../api/locationNode.api';
import {
  getStockThresholds,
  createStockThreshold,
  updateStockThreshold,
  bulkSaveThresholds,
} from '../../api/stock.api';
import { getErrorMessage } from '../../utils/helpers';

// ── Icons ─────────────────────────────────────────────────────────────────────
const SVG = {
  save:     'M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4',
  saveAll:  'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  search:   'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  refresh:  'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  store:    'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  x:        'M6 18L18 6M6 6l12 12',
  box:      'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  wand:     'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
  chevron:  'M19 9l-7 7-7-7',
  alert:    'M12 9v2m0 4h.01M5 20h14a2 2 0 001.732-3L13.732 5a2 2 0 00-3.464 0L3.268 17A2 2 0 005 20z',
};

function Icon({ d, className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
    </svg>
  );
}

// ── Defaults ──────────────────────────────────────────────────────────────────
const DEFAULTS = { stock_minimum: '10', stock_alert_threshold: '30', stock_maximum: '200', reorder_quantity: '0' };

// ── Status ────────────────────────────────────────────────────────────────────
const STATUS = {
  NONE: { label: 'Non configuré', short: '—',          dot: 'bg-zinc-500',    badge: 'bg-zinc-800 text-zinc-400 border border-zinc-700',          row: '' },
  OUT:  { label: 'Rupture',       short: 'Rupture',    dot: 'bg-red-500',     badge: 'bg-red-950 text-red-400 border border-red-800',              row: 'border-l-2 border-l-red-600' },
  LOW:  { label: 'Stock faible',  short: 'Faible',     dot: 'bg-amber-500',   badge: 'bg-amber-950 text-amber-400 border border-amber-800',        row: 'border-l-2 border-l-amber-500' },
  OK:   { label: 'Normal',        short: 'Normal',     dot: 'bg-emerald-500', badge: 'bg-emerald-950 text-emerald-400 border border-emerald-800',   row: 'border-l-2 border-l-emerald-600' },
  OVER: { label: 'Surstock',      short: 'Surstock',   dot: 'bg-blue-500',    badge: 'bg-blue-950 text-blue-400 border border-blue-800',           row: 'border-l-2 border-l-blue-500' },
};

function calcStatus(qty_available, local) {
  const min   = Number(local?.stock_minimum         ?? 0);
  const alert = Number(local?.stock_alert_threshold ?? 0);
  const max   = Number(local?.stock_maximum         ?? 0);
  const qty   = Number(qty_available ?? 0);
  if (!min && !alert && !max) return STATUS.NONE;
  if (max > 0 && qty > max)   return STATUS.OVER;
  if (qty <= min)              return STATUS.OUT;
  if (qty <= alert)            return STATUS.LOW;
  return STATUS.OK;
}

// ── Validation ────────────────────────────────────────────────────────────────
function validate(local) {
  const errs = {};
  const min   = Number(local.stock_minimum         ?? 0);
  const alert = Number(local.stock_alert_threshold ?? 0);
  const max   = Number(local.stock_maximum         ?? 0);
  const reo   = Number(local.reorder_quantity      ?? 0);
  if (min < 0)      errs.stock_minimum         = '≥ 0';
  if (alert < min)  errs.stock_alert_threshold  = `≥ min (${min})`;
  if (max <= alert) errs.stock_maximum          = `> alerte (${alert})`;
  if (reo < 0)      errs.reorder_quantity       = '≥ 0';
  return errs;
}

// ── Toggle ────────────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-all duration-200 ${
        checked ? 'bg-emerald-600 shadow-emerald-900/40 shadow' : 'bg-zinc-700'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  );
}

// ── NumInput ──────────────────────────────────────────────────────────────────
function NumInput({ value, onChange, error, placeholder = '0', accent = 'red' }) {
  const colors = {
    red:   'focus:border-red-500   focus:ring-red-500/20',
    amber: 'focus:border-amber-500 focus:ring-amber-500/20',
    blue:  'focus:border-blue-500  focus:ring-blue-500/20',
  };
  return (
    <div className="relative group">
      <input
        type="number"
        min="0"
        step="1"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-[72px] text-center bg-zinc-900 text-zinc-100 text-xs px-1.5 py-1.5 rounded-lg border ring-0 focus:ring-2 outline-none transition-all ${
          error
            ? 'border-red-500 ring-red-500/20 ring-2'
            : `border-zinc-700 ${colors[accent]}`
        }`}
      />
      {error && (
        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-red-400 text-[9px] whitespace-nowrap font-medium">
          {error}
        </div>
      )}
    </div>
  );
}

// ── QtyBadge ─────────────────────────────────────────────────────────────────
function QtyBadge({ value, warn = false }) {
  const n = Number(value ?? 0);
  return (
    <span className={`font-mono font-semibold text-xs tabular-nums ${
      n <= 0 ? 'text-zinc-600' : warn ? 'text-amber-400' : 'text-zinc-200'
    }`}>
      {n}
    </span>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, icon }) {
  const colors = {
    white:   'text-white',
    red:     'text-red-400',
    amber:   'text-amber-400',
    emerald: 'text-emerald-400',
    blue:    'text-blue-400',
    zinc:    'text-zinc-400',
  };
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 flex items-center gap-4 min-w-0">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
        color === 'red' ? 'bg-red-950 border border-red-800' :
        color === 'amber' ? 'bg-amber-950 border border-amber-800' :
        color === 'emerald' ? 'bg-emerald-950 border border-emerald-800' :
        color === 'blue' ? 'bg-blue-950 border border-blue-800' :
        'bg-zinc-800 border border-zinc-700'
      }`}>
        <Icon d={icon} className={`w-4 h-4 ${colors[color]}`} />
      </div>
      <div className="min-w-0">
        <div className={`text-2xl font-bold tabular-nums ${colors[color]}`}>{value}</div>
        <div className="text-zinc-500 text-xs mt-0.5 truncate">{label}</div>
      </div>
    </div>
  );
}

// ── Status filter tabs ────────────────────────────────────────────────────────
const STATUS_TABS = [
  { code: 'ALL',  label: 'Tous' },
  { code: 'OUT',  label: 'Rupture',      cls: 'data-[active]:bg-red-600' },
  { code: 'LOW',  label: 'Stock faible', cls: 'data-[active]:bg-amber-600' },
  { code: 'OK',   label: 'Normal',       cls: 'data-[active]:bg-emerald-700' },
  { code: 'OVER', label: 'Surstock',     cls: 'data-[active]:bg-blue-700' },
  { code: 'NONE', label: 'Non configuré' },
];

// ── Page ──────────────────────────────────────────────────────────────────────
export default function StockThresholdsPage() {
  const [nodes,        setNodes]        = useState([]);
  const [selNode,      setSelNode]      = useState('');
  const [rawRows,      setRawRows]      = useState([]);
  const [locals,       setLocals]       = useState({});   // sku_id → { fields, dirty }
  const [fieldErrors,  setFieldErrors]  = useState({});   // sku_id → { field: msg }
  const [loadNodes,    setLoadNodes]    = useState(true);
  const [loadRows,     setLoadRows]     = useState(false);
  const [savingId,     setSavingId]     = useState(null); // sku_id being saved
  const [savingAll,    setSavingAll]    = useState(false);
  const [search,       setSearch]       = useState('');
  const [tabFilter,    setTabFilter]    = useState('ALL');

  // ── Load nodes ──────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await getNodes({ all: true, is_active: true });
        setNodes(res.data?.data ?? []);
      } catch (e) { toast.error(getErrorMessage(e)); }
      finally { setLoadNodes(false); }
    })();
  }, []);

  // ── Load articles for node ──────────────────────────────────────────────────
  const fetchRows = useCallback(async (node_id) => {
    if (!node_id) return;
    setLoadRows(true);
    setLocals({});
    setFieldErrors({});
    try {
      const res  = await getStockThresholds(node_id);
      const data = res.data?.data ?? [];
      setRawRows(data);
      const init = {};
      data.forEach((row) => {
        const r = row.threshold_rule;
        init[row.sku_id] = {
          stock_minimum:         r ? String(Number(r.stock_minimum))         : DEFAULTS.stock_minimum,
          stock_alert_threshold: r ? String(Number(r.stock_alert_threshold)) : DEFAULTS.stock_alert_threshold,
          stock_maximum:         r ? String(Number(r.stock_maximum))         : DEFAULTS.stock_maximum,
          reorder_quantity:      r ? String(Number(r.reorder_quantity))      : DEFAULTS.reorder_quantity,
          auto_restock_enabled:  r ? r.auto_restock_enabled                  : false,
          is_active:             r ? r.is_active                             : true,
          dirty: false,
        };
      });
      setLocals(init);
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setLoadRows(false); }
  }, []);

  useEffect(() => { fetchRows(selNode); }, [selNode, fetchRows]);

  // ── Field update ────────────────────────────────────────────────────────────
  const setField = useCallback((sku_id, field, value) => {
    setLocals((prev) => {
      const next = { ...prev, [sku_id]: { ...(prev[sku_id] ?? {}), [field]: value, dirty: true } };
      setFieldErrors((e) => ({ ...e, [sku_id]: validate(next[sku_id]) }));
      return next;
    });
  }, []);

  // ── Save one row ─────────────────────────────────────────────────────────────
  const saveRow = useCallback(async (row) => {
    const local = locals[row.sku_id];
    if (!local) return;
    const errs = validate(local);
    if (Object.keys(errs).length) {
      setFieldErrors((e) => ({ ...e, [row.sku_id]: errs }));
      toast.error('Corrigez les erreurs de saisie');
      return;
    }
    const payload = {
      stock_minimum:         Number(local.stock_minimum),
      stock_alert_threshold: Number(local.stock_alert_threshold),
      stock_maximum:         Number(local.stock_maximum),
      reorder_quantity:      Number(local.reorder_quantity || 0),
      auto_restock_enabled:  local.auto_restock_enabled,
      is_active:             local.is_active,
    };
    setSavingId(row.sku_id);
    try {
      const rule = row.threshold_rule;
      let saved;
      if (rule?.id) {
        saved = (await updateStockThreshold(rule.id, payload)).data?.data;
      } else {
        saved = (await createStockThreshold({ node_id: selNode, sku_id: row.sku_id, ...payload })).data?.data;
      }
      setRawRows((prev) => prev.map((r) => r.sku_id === row.sku_id ? { ...r, threshold_rule: saved } : r));
      setLocals((prev) => ({ ...prev, [row.sku_id]: { ...prev[row.sku_id], dirty: false } }));
      setFieldErrors((e) => { const n = { ...e }; delete n[row.sku_id]; return n; });
      toast.success(`Seuils de ${row.sku?.article?.sku_code ?? 'l\'article'} sauvegardés`);
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setSavingId(null); }
  }, [locals, selNode]);

  // ── Save all dirty ───────────────────────────────────────────────────────────
  const saveAll = useCallback(async () => {
    const dirty = rawRows.filter((r) => locals[r.sku_id]?.dirty);
    if (!dirty.length) return;
    let hasErr = false;
    const newErr = { ...fieldErrors };
    dirty.forEach((r) => {
      const e = validate(locals[r.sku_id]);
      if (Object.keys(e).length) { newErr[r.sku_id] = e; hasErr = true; }
    });
    if (hasErr) { setFieldErrors(newErr); toast.error('Corrigez les erreurs avant de sauvegarder'); return; }
    setSavingAll(true);
    try {
      const rows = dirty.map((r) => {
        const l = locals[r.sku_id];
        return {
          sku_id:               r.sku_id,
          stock_minimum:         Number(l.stock_minimum),
          stock_alert_threshold: Number(l.stock_alert_threshold),
          stock_maximum:         Number(l.stock_maximum),
          reorder_quantity:      Number(l.reorder_quantity || 0),
          auto_restock_enabled:  l.auto_restock_enabled,
          is_active:             l.is_active,
        };
      });
      await bulkSaveThresholds(selNode, rows);
      toast.success(`${rows.length} règle(s) sauvegardée(s)`);
      await fetchRows(selNode);
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setSavingAll(false); }
  }, [rawRows, locals, fieldErrors, selNode, fetchRows]);

  // ── Derived data ─────────────────────────────────────────────────────────────
  const rowsComputed = useMemo(() => rawRows.map((r) => {
    const l = locals[r.sku_id];
    return { ...r, status: calcStatus(r.qty_available, l) };
  }), [rawRows, locals]);

  const filtered = useMemo(() => {
    let out = rowsComputed;
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter((r) => {
        const a = r.sku?.article;
        return [a?.sku_code, a?.name_fr, a?.name_ar, a?.ean13].some((s) => (s ?? '').toLowerCase().includes(q));
      });
    }
    if (tabFilter !== 'ALL') out = out.filter((r) => r.status === STATUS[tabFilter]);
    return out;
  }, [rowsComputed, search, tabFilter]);

  const dirtyCount = useMemo(() => rawRows.filter((r) => locals[r.sku_id]?.dirty).length, [rawRows, locals]);

  const stats = useMemo(() => ({
    total:     rawRows.length,
    configured:rawRows.filter((r) => r.threshold_rule !== null).length,
    rupture:   rowsComputed.filter((r) => r.status === STATUS.OUT).length,
    faible:    rowsComputed.filter((r) => r.status === STATUS.LOW).length,
    surstock:  rowsComputed.filter((r) => r.status === STATUS.OVER).length,
  }), [rawRows, rowsComputed]);

  const selNodeObj = nodes.find((n) => n.id === selNode);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">

      {/* ── Sticky header ───────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-zinc-950/95 backdrop-blur border-b border-zinc-800/60">
        <div className="px-6 pt-5 pb-4">

          {/* Title row */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-red-800 rounded-xl flex items-center justify-center shadow-lg shadow-red-900/40 flex-shrink-0">
                <Icon d={SVG.box} className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white tracking-tight">Seuils de stock</h1>
                <p className="text-zinc-500 text-xs mt-0.5">Paramétrage par entrepôt · min / alerte / max</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {selNode && !loadRows && (
                <button
                  onClick={() => fetchRows(selNode)}
                  className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-xl transition-colors"
                  title="Actualiser"
                >
                  <Icon d={SVG.refresh} className="w-4 h-4" />
                </button>
              )}
              {dirtyCount > 0 && (
                <button
                  onClick={saveAll}
                  disabled={savingAll}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow shadow-red-900/40"
                >
                  <Icon d={SVG.saveAll} className="w-4 h-4" />
                  {savingAll ? 'Sauvegarde…' : `Sauvegarder tout (${dirtyCount})`}
                </button>
              )}
            </div>
          </div>

          {/* Node selector */}
          <div className="flex items-center gap-3">
            <Icon d={SVG.store} className="w-4 h-4 text-zinc-500 flex-shrink-0" />
            {loadNodes ? (
              <div className="h-9 w-72 bg-zinc-800 rounded-xl animate-pulse" />
            ) : (
              <div className="relative">
                <select
                  value={selNode}
                  onChange={(e) => setSelNode(e.target.value)}
                  className="appearance-none bg-zinc-800/80 border border-zinc-700 hover:border-zinc-600 text-zinc-100 rounded-xl pl-4 pr-9 py-2 text-sm min-w-[300px] outline-none focus:border-red-500 transition-colors cursor-pointer"
                >
                  <option value="">— Sélectionner un entrepôt —</option>
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>{n.code} — {n.name_fr}</option>
                  ))}
                </select>
                <Icon d={SVG.chevron} className="w-4 h-4 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}
            {selNodeObj && (
              <span className="text-xs text-zinc-500 hidden sm:block">
                {selNodeObj.name_ar && <span className="text-zinc-600 ml-1">· {selNodeObj.name_ar}</span>}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Empty — no node ─────────────────────────────────────────────────── */}
      {!selNode && (
        <div className="flex flex-col items-center justify-center py-32 text-center px-6">
          <div className="w-20 h-20 bg-zinc-900 border border-zinc-800 rounded-3xl flex items-center justify-center mb-5 shadow-xl">
            <Icon d={SVG.store} className="w-10 h-10 text-zinc-700" />
          </div>
          <h2 className="text-zinc-300 font-semibold text-lg mb-1">Sélectionnez un entrepôt</h2>
          <p className="text-zinc-600 text-sm max-w-xs">
            Choisissez un entrepôt ci-dessus pour configurer les seuils de stock de tous ses articles.
          </p>
        </div>
      )}

      {/* ── Loading ──────────────────────────────────────────────────────────── */}
      {selNode && loadRows && (
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-zinc-700 border-t-red-600" />
          <p className="text-zinc-500 text-sm">Chargement des articles…</p>
        </div>
      )}

      {/* ── No articles ──────────────────────────────────────────────────────── */}
      {selNode && !loadRows && rawRows.length === 0 && (
        <div className="flex flex-col items-center justify-center py-32 text-center px-6">
          <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center mb-4">
            <Icon d={SVG.alert} className="w-8 h-8 text-zinc-600" />
          </div>
          <p className="text-zinc-400 font-medium">Aucun article trouvé</p>
          <p className="text-zinc-600 text-sm mt-1">Vérifiez que des articles actifs existent dans le catalogue.</p>
        </div>
      )}

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      {selNode && !loadRows && rawRows.length > 0 && (
        <div className="px-6 py-5 space-y-5">

          {/* Stats cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard label="Total articles"  value={stats.total}      color="white"   icon={SVG.box} />
            <StatCard label="Configurés"      value={stats.configured} color="emerald" icon={SVG.saveAll} />
            <StatCard label="Ruptures"        value={stats.rupture}    color="red"     icon={SVG.alert} />
            <StatCard label="Stock faible"    value={stats.faible}     color="amber"   icon={SVG.alert} />
            <StatCard label="Surstock"        value={stats.surstock}   color="blue"    icon={SVG.alert} />
          </div>

          {/* Filters bar */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative flex-shrink-0">
              <Icon d={SVG.search} className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Rechercher SKU, nom, EAN…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl pl-9 pr-8 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-red-500 transition-colors w-64"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors">
                  <Icon d={SVG.x} className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Status tabs */}
            <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
              {STATUS_TABS.map((t) => {
                const count = t.code === 'ALL' ? rowsComputed.length : rowsComputed.filter((r) => r.status === STATUS[t.code]).length;
                const isActive = tabFilter === t.code;
                return (
                  <button
                    key={t.code}
                    onClick={() => setTabFilter(t.code)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? t.code === 'OUT'  ? 'bg-red-600 text-white shadow'
                        : t.code === 'LOW'  ? 'bg-amber-600 text-white shadow'
                        : t.code === 'OK'   ? 'bg-emerald-700 text-white shadow'
                        : t.code === 'OVER' ? 'bg-blue-700 text-white shadow'
                        : 'bg-zinc-700 text-white shadow'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                    }`}
                  >
                    {t.code !== 'ALL' && STATUS[t.code] && (
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS[t.code].dot}`} />
                    )}
                    {t.label}
                    <span className={`text-[10px] px-1 rounded ${isActive ? 'bg-white/20' : 'bg-zinc-800 text-zinc-500'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {dirtyCount > 0 && (
              <span className="ml-auto text-xs text-amber-400 font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                {dirtyCount} modification{dirtyCount > 1 ? 's' : ''} non sauvegardée{dirtyCount > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Defaults legend */}
          <div className="flex items-center gap-2 text-[11px] text-zinc-600 px-1">
            <Icon d={SVG.wand} className="w-3.5 h-3.5 text-zinc-600" />
            <span>Valeurs par défaut pré-remplies · Min : <strong className="text-zinc-400">10</strong> · Alerte : <strong className="text-zinc-400">30</strong> · Max : <strong className="text-zinc-400">200</strong> — modifiez et sauvegardez pour appliquer.</span>
          </div>

          {/* Table */}
          <div className="rounded-2xl border border-zinc-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[1080px]">

                {/* Head */}
                <thead>
                  <tr className="bg-zinc-900 border-b border-zinc-800">
                    <th className="pl-4 pr-2 py-3 text-left w-10" />
                    <th className="px-3 py-3 text-left text-zinc-400 font-semibold min-w-[200px]">Article</th>
                    {/* Stock */}
                    <th colSpan={4} className="px-3 py-2 text-center text-zinc-500 font-medium border-x border-zinc-800/60 bg-zinc-800/30">
                      <span className="flex items-center justify-center gap-1">Stock actuel</span>
                    </th>
                    {/* Seuils */}
                    <th colSpan={4} className="px-3 py-2 text-center text-zinc-400 font-semibold bg-zinc-800/60">
                      <span className="flex items-center justify-center gap-1">
                        <Icon d={SVG.wand} className="w-3 h-3" />
                        Seuils configurables
                      </span>
                    </th>
                    <th className="px-3 py-2 text-center text-zinc-500 font-medium border-l border-zinc-800/60">Auto</th>
                    <th className="px-3 py-2 text-center text-zinc-400 font-semibold border-l border-zinc-800/60">Statut</th>
                    <th className="px-3 py-2 text-center text-zinc-400 font-semibold border-l border-zinc-800/60 pr-4">Sauv.</th>
                  </tr>
                  <tr className="bg-zinc-900/50 border-b border-zinc-800/40 text-[10px] text-zinc-600 uppercase tracking-wide">
                    <th className="pl-4 pr-2 py-1.5" />
                    <th className="px-3 py-1.5 text-left">SKU · Nom · Famille</th>
                    <th className="px-3 py-1.5 text-right border-l border-zinc-800/40">Physique</th>
                    <th className="px-3 py-1.5 text-right">Réservé</th>
                    <th className="px-3 py-1.5 text-right">Dispo</th>
                    <th className="px-3 py-1.5 text-right border-r border-zinc-800/40">Entrant</th>
                    <th className="px-3 py-1.5 text-center text-red-500">Min</th>
                    <th className="px-3 py-1.5 text-center text-amber-500">Alerte</th>
                    <th className="px-3 py-1.5 text-center text-blue-500">Max</th>
                    <th className="px-3 py-1.5 text-center border-r border-zinc-800/40">Réappro</th>
                    <th className="px-3 py-1.5 text-center border-r border-zinc-800/40" />
                    <th className="px-3 py-1.5 text-center border-r border-zinc-800/40" />
                    <th className="px-3 py-1.5 text-center pr-4" />
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-800/50">
                  {filtered.map((row) => {
                    const art      = row.sku?.article;
                    const imgUrl   = art?.images?.[0]?.image_path ?? row.sku?.images?.[0]?.url ?? null;
                    const local    = locals[row.sku_id] ?? {};
                    const errs     = fieldErrors[row.sku_id] ?? {};
                    const isDirty  = !!local.dirty;
                    const isSaving = savingId === row.sku_id;
                    const st       = row.status;
                    const hasRule  = !!row.threshold_rule;

                    return (
                      <tr
                        key={row.sku_id}
                        className={`${st.row} transition-colors group ${isDirty ? 'bg-zinc-900/70' : 'hover:bg-zinc-900/50'}`}
                      >
                        {/* Image */}
                        <td className="pl-4 pr-2 py-2.5">
                          {imgUrl ? (
                            <img src={imgUrl} alt="" className="w-9 h-9 rounded-xl object-cover border border-zinc-700 flex-shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-600 font-bold text-[10px] flex-shrink-0">
                              {(art?.sku_code ?? '?').slice(0, 2).toUpperCase()}
                            </div>
                          )}
                        </td>

                        {/* Article info */}
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-mono text-zinc-200 font-bold tracking-tight">{art?.sku_code ?? '—'}</span>
                            {!hasRule && !isDirty && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] bg-zinc-800 text-zinc-500 border border-zinc-700">Défauts</span>
                            )}
                            {isDirty && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-950 text-amber-400 border border-amber-800">Modifié</span>
                            )}
                            {hasRule && !isDirty && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-950 text-emerald-500 border border-emerald-800">Configuré</span>
                            )}
                          </div>
                          <div className="text-zinc-400 truncate max-w-[180px]">{art?.name_fr ?? '—'}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {art?.ean13 && <span className="font-mono text-zinc-600 text-[10px]">{art.ean13}</span>}
                            {art?.family && <span className="text-zinc-600 text-[10px] truncate">{art.family.name_fr}</span>}
                          </div>
                        </td>

                        {/* Stock quantities */}
                        <td className="px-3 py-2.5 text-right border-l border-zinc-800/40">
                          <QtyBadge value={row.qty_physical} />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <QtyBadge value={row.qty_reserved} warn={Number(row.qty_reserved) > 0} />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <QtyBadge value={row.qty_available} />
                        </td>
                        <td className="px-3 py-2.5 text-right border-r border-zinc-800/40">
                          <QtyBadge value={row.qty_incoming} />
                        </td>

                        {/* ── Editable seuils ── */}
                        <td className="px-2 py-2.5 text-center">
                          <NumInput
                            value={local.stock_minimum ?? DEFAULTS.stock_minimum}
                            onChange={(v) => setField(row.sku_id, 'stock_minimum', v)}
                            error={errs.stock_minimum}
                            placeholder="10"
                            accent="red"
                          />
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <NumInput
                            value={local.stock_alert_threshold ?? DEFAULTS.stock_alert_threshold}
                            onChange={(v) => setField(row.sku_id, 'stock_alert_threshold', v)}
                            error={errs.stock_alert_threshold}
                            placeholder="30"
                            accent="amber"
                          />
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <NumInput
                            value={local.stock_maximum ?? DEFAULTS.stock_maximum}
                            onChange={(v) => setField(row.sku_id, 'stock_maximum', v)}
                            error={errs.stock_maximum}
                            placeholder="200"
                            accent="blue"
                          />
                        </td>
                        <td className="px-2 py-2.5 text-center border-r border-zinc-800/40">
                          <NumInput
                            value={local.reorder_quantity ?? '0'}
                            onChange={(v) => setField(row.sku_id, 'reorder_quantity', v)}
                            error={errs.reorder_quantity}
                            placeholder="0"
                          />
                        </td>

                        {/* Auto restock */}
                        <td className="px-3 py-2.5 text-center border-r border-zinc-800/40">
                          <Toggle
                            checked={!!local.auto_restock_enabled}
                            onChange={(v) => setField(row.sku_id, 'auto_restock_enabled', v)}
                          />
                        </td>

                        {/* Status badge */}
                        <td className="px-3 py-2.5 text-center border-r border-zinc-800/40">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap ${st.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${st.dot} flex-shrink-0`} />
                            {st.short}
                          </span>
                        </td>

                        {/* Save button */}
                        <td className="px-3 py-2.5 text-center pr-4">
                          {isDirty ? (
                            <button
                              onClick={() => saveRow(row)}
                              disabled={isSaving}
                              className="flex items-center gap-1 mx-auto bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all shadow shadow-red-900/30 whitespace-nowrap"
                            >
                              <Icon d={SVG.save} className="w-3 h-3" />
                              {isSaving ? '…' : 'Sauv.'}
                            </button>
                          ) : (
                            <span className="text-zinc-700 text-[10px]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filtered.length === 0 && (
                <div className="text-center py-12 text-zinc-600">
                  <Icon d={SVG.search} className="w-8 h-8 mx-auto mb-3 opacity-40" />
                  <p>Aucun article ne correspond aux filtres</p>
                </div>
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-5 flex-wrap text-[11px] text-zinc-600 px-1 pb-2">
            {Object.entries(STATUS).filter(([k]) => k !== 'NONE').map(([k, s]) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                <span className="text-zinc-500">{s.label}</span>
              </span>
            ))}
            <span className="flex items-center gap-1.5 ml-auto">
              <span className="w-2 h-2 rounded bg-amber-500" />
              <span className="text-zinc-500">Ligne modifiée non sauvegardée</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
