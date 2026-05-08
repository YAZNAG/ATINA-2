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
  save:    'M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4',
  check:   'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  search:  'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  refresh: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  store:   'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  x:       'M6 18L18 6M6 6l12 12',
  pencil:  'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  lock:    'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
  unlock:  'M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z',
  chevron: 'M19 9l-7 7-7-7',
  box:     'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  warn:    'M12 9v2m0 4h.01M5 20h14a2 2 0 001.732-3L13.732 5a2 2 0 00-3.464 0L3.268 17A2 2 0 005 20z',
  info:    'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  tag:     'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z',
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

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS = {
  NONE: {
    label: 'Non configuré', short: '—',
    dot: 'bg-slate-300', row: '',
    badge: 'bg-slate-100 text-slate-500 border border-slate-200',
    qty: 'text-slate-400',
  },
  OUT: {
    label: 'Rupture', short: 'Rupture',
    dot: 'bg-red-500', row: 'border-l-4 border-l-red-500 bg-red-50/60',
    badge: 'bg-red-100 text-red-700 border border-red-200',
    qty: 'text-red-600 font-bold',
  },
  LOW: {
    label: 'Stock faible', short: 'Faible',
    dot: 'bg-amber-500', row: 'border-l-4 border-l-amber-400 bg-amber-50/50',
    badge: 'bg-amber-100 text-amber-700 border border-amber-200',
    qty: 'text-amber-600 font-semibold',
  },
  OK: {
    label: 'Normal', short: 'Normal',
    dot: 'bg-emerald-500', row: 'border-l-4 border-l-emerald-400',
    badge: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    qty: 'text-emerald-700 font-semibold',
  },
  OVER: {
    label: 'Surstock', short: 'Surstock',
    dot: 'bg-blue-500', row: 'border-l-4 border-l-blue-400 bg-blue-50/40',
    badge: 'bg-blue-100 text-blue-700 border border-blue-200',
    qty: 'text-blue-600 font-semibold',
  },
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
  const errs  = {};
  const min   = Number(local.stock_minimum         ?? 0);
  const alert = Number(local.stock_alert_threshold ?? 0);
  const max   = Number(local.stock_maximum         ?? 0);
  const reo   = Number(local.reorder_quantity      ?? 0);
  if (min < 0)      errs.stock_minimum         = '≥ 0';
  if (alert < min)  errs.stock_alert_threshold  = `≥ ${min}`;
  if (max <= alert) errs.stock_maximum          = `> ${alert}`;
  if (reo < 0)      errs.reorder_quantity       = '≥ 0';
  return errs;
}

// ── Toggle ────────────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-all duration-200 ${
        checked ? 'bg-emerald-500' : 'bg-slate-200'
      } ${disabled ? 'opacity-60 cursor-default' : 'cursor-pointer'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  );
}

// ── NumInput (edit mode) ──────────────────────────────────────────────────────
function NumInput({ value, onChange, error, placeholder, accent }) {
  const ring = accent === 'red'   ? 'focus:border-red-400 focus:ring-red-200'
             : accent === 'amber' ? 'focus:border-amber-400 focus:ring-amber-200'
             : accent === 'blue'  ? 'focus:border-blue-400 focus:ring-blue-200'
             :                      'focus:border-slate-400 focus:ring-slate-200';
  return (
    <div className="relative">
      <input
        type="number"
        min="0"
        step="1"
        placeholder={placeholder ?? '0'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-[70px] text-center bg-white text-slate-800 text-sm px-1.5 py-1.5 rounded-lg border ring-2 ring-transparent outline-none transition-all font-medium ${
          error
            ? 'border-red-400 ring-red-200 bg-red-50'
            : `border-slate-300 ${ring}`
        }`}
      />
      {error && (
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-red-500 text-[9px] whitespace-nowrap font-semibold">
          {error}
        </div>
      )}
    </div>
  );
}

// ── NumDisplay (read mode) ────────────────────────────────────────────────────
function NumDisplay({ value, accent }) {
  const n = Number(value ?? 0);
  const color = accent === 'red'   ? 'text-red-600 bg-red-50 border-red-100'
              : accent === 'amber' ? 'text-amber-600 bg-amber-50 border-amber-100'
              : accent === 'blue'  ? 'text-blue-600 bg-blue-50 border-blue-100'
              :                      'text-slate-600 bg-slate-50 border-slate-200';
  return (
    <span className={`inline-block w-[70px] text-center text-sm font-bold rounded-lg border px-2 py-1.5 tabular-nums ${color}`}>
      {n}
    </span>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, accent, icon, sub }) {
  const styles = {
    slate:   { card: 'bg-white border-slate-200',      icon: 'bg-slate-100 text-slate-500',  val: 'text-slate-800'  },
    red:     { card: 'bg-red-50 border-red-200',        icon: 'bg-red-100 text-red-600',      val: 'text-red-700'    },
    amber:   { card: 'bg-amber-50 border-amber-200',   icon: 'bg-amber-100 text-amber-600',  val: 'text-amber-700'  },
    emerald: { card: 'bg-emerald-50 border-emerald-200', icon: 'bg-emerald-100 text-emerald-600', val: 'text-emerald-700' },
    blue:    { card: 'bg-blue-50 border-blue-200',      icon: 'bg-blue-100 text-blue-600',    val: 'text-blue-700'   },
  };
  const s = styles[accent] ?? styles.slate;
  return (
    <div className={`${s.card} border rounded-2xl px-4 py-4 flex items-center gap-3 shadow-sm`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${s.icon}`}>
        <Icon d={icon} className="w-5 h-5" />
      </div>
      <div>
        <div className={`text-2xl font-extrabold tabular-nums leading-none ${s.val}`}>{value}</div>
        <div className="text-slate-500 text-xs mt-1 leading-tight">{label}</div>
        {sub && <div className="text-slate-400 text-[10px] mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

// ── Status filter tabs ────────────────────────────────────────────────────────
const TABS = [
  { code: 'ALL',  label: 'Tous',         active: 'bg-slate-700 text-white'   },
  { code: 'OUT',  label: 'Rupture',      active: 'bg-red-600 text-white'     },
  { code: 'LOW',  label: 'Stock faible', active: 'bg-amber-500 text-white'   },
  { code: 'OK',   label: 'Normal',       active: 'bg-emerald-600 text-white' },
  { code: 'OVER', label: 'Surstock',     active: 'bg-blue-600 text-white'    },
  { code: 'NONE', label: 'Non config.',  active: 'bg-slate-400 text-white'   },
];

// ══════════════════════════════════════════════════════════════════════════════
export default function StockThresholdsPage() {
  const [nodes,       setNodes]       = useState([]);
  const [selNode,     setSelNode]     = useState('');
  const [rawRows,     setRawRows]     = useState([]);
  const [locals,      setLocals]      = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [loadNodes,   setLoadNodes]   = useState(true);
  const [loadRows,    setLoadRows]    = useState(false);
  const [savingId,    setSavingId]    = useState(null);
  const [savingAll,   setSavingAll]   = useState(false);
  const [search,      setSearch]      = useState('');
  const [tabFilter,   setTabFilter]   = useState('ALL');
  const [editMode,    setEditMode]    = useState(false); // ← mode édition

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

  // ── Load articles ───────────────────────────────────────────────────────────
  const fetchRows = useCallback(async (node_id) => {
    if (!node_id) return;
    setLoadRows(true);
    setLocals({});
    setFieldErrors({});
    setEditMode(false);
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

  // ── Cancel edit mode ────────────────────────────────────────────────────────
  const cancelEdit = useCallback(() => {
    // Revert dirty rows from saved threshold_rule
    setLocals((prev) => {
      const next = { ...prev };
      rawRows.forEach((row) => {
        if (next[row.sku_id]?.dirty) {
          const r = row.threshold_rule;
          next[row.sku_id] = {
            stock_minimum:         r ? String(Number(r.stock_minimum))         : DEFAULTS.stock_minimum,
            stock_alert_threshold: r ? String(Number(r.stock_alert_threshold)) : DEFAULTS.stock_alert_threshold,
            stock_maximum:         r ? String(Number(r.stock_maximum))         : DEFAULTS.stock_maximum,
            reorder_quantity:      r ? String(Number(r.reorder_quantity))      : DEFAULTS.reorder_quantity,
            auto_restock_enabled:  r ? r.auto_restock_enabled                  : false,
            is_active:             r ? r.is_active                             : true,
            dirty: false,
          };
        }
      });
      return next;
    });
    setFieldErrors({});
    setEditMode(false);
  }, [rawRows]);

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
      toast.success('Seuils sauvegardés');
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setSavingId(null); }
  }, [locals, selNode]);

  // ── Save all ─────────────────────────────────────────────────────────────────
  const saveAll = useCallback(async () => {
    const dirty = rawRows.filter((r) => locals[r.sku_id]?.dirty);
    if (!dirty.length) { toast('Aucune modification à sauvegarder', { icon: 'ℹ️' }); return; }
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
      setEditMode(false);
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setSavingAll(false); }
  }, [rawRows, locals, fieldErrors, selNode, fetchRows]);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const rowsComputed = useMemo(() => rawRows.map((r) => ({
    ...r,
    status: calcStatus(r.qty_available, locals[r.sku_id]),
  })), [rawRows, locals]);

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

  const dirtyCount = useMemo(
    () => rawRows.filter((r) => locals[r.sku_id]?.dirty).length,
    [rawRows, locals]
  );

  const stats = useMemo(() => ({
    total:      rawRows.length,
    configured: rawRows.filter((r) => r.threshold_rule !== null).length,
    rupture:    rowsComputed.filter((r) => r.status === STATUS.OUT).length,
    faible:     rowsComputed.filter((r) => r.status === STATUS.LOW).length,
    surstock:   rowsComputed.filter((r) => r.status === STATUS.OVER).length,
  }), [rawRows, rowsComputed]);

  const selNodeObj = nodes.find((n) => n.id === selNode);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">

      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="px-6 py-4">

          {/* Title + actions */}
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-700 rounded-xl flex items-center justify-center shadow-md shadow-red-200 flex-shrink-0">
                <Icon d={SVG.tag} className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">Seuils de stock</h1>
                <p className="text-slate-400 text-xs mt-0.5">Paramétrage min · alerte · max par entrepôt</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Refresh */}
              {selNode && !loadRows && (
                <button
                  onClick={() => fetchRows(selNode)}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                  title="Actualiser"
                >
                  <Icon d={SVG.refresh} className="w-4 h-4" />
                </button>
              )}

              {/* Edit mode toggle */}
              {selNode && !loadRows && rawRows.length > 0 && !editMode && (
                <button
                  onClick={() => setEditMode(true)}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow shadow-red-200"
                >
                  <Icon d={SVG.pencil} className="w-4 h-4" />
                  Modifier les seuils
                </button>
              )}

              {/* Edit mode: cancel + save all */}
              {editMode && (
                <>
                  <button
                    onClick={cancelEdit}
                    className="flex items-center gap-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                  >
                    <Icon d={SVG.x} className="w-4 h-4" />
                    Annuler
                  </button>
                  <button
                    onClick={saveAll}
                    disabled={savingAll}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow shadow-emerald-200"
                  >
                    <Icon d={SVG.check} className="w-4 h-4" />
                    {savingAll ? 'Sauvegarde…' : dirtyCount > 0 ? `Sauvegarder (${dirtyCount})` : 'Sauvegarder tout'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Node selector */}
          <div className="flex items-center gap-3">
            <Icon d={SVG.store} className="w-4 h-4 text-slate-400 flex-shrink-0" />
            {loadNodes ? (
              <div className="h-9 w-72 bg-slate-100 rounded-xl animate-pulse" />
            ) : (
              <div className="relative">
                <select
                  value={selNode}
                  onChange={(e) => setSelNode(e.target.value)}
                  className="appearance-none bg-white border border-slate-300 hover:border-slate-400 text-slate-800 rounded-xl pl-4 pr-9 py-2 text-sm min-w-[300px] outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all shadow-sm cursor-pointer"
                >
                  <option value="">— Sélectionner un entrepôt —</option>
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>{n.code} — {n.name_fr}</option>
                  ))}
                </select>
                <Icon d={SVG.chevron} className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}
            {selNodeObj && (
              <span className="text-sm font-medium text-slate-500">{selNodeObj.name_fr}</span>
            )}

            {/* Edit mode banner */}
            {editMode && (
              <div className="ml-4 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5">
                <Icon d={SVG.unlock} className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <span className="text-amber-700 text-xs font-semibold">Mode édition activé — modifiez les seuils puis sauvegardez</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Empty — no node ────────────────────────────────────────────────────── */}
      {!selNode && (
        <div className="flex flex-col items-center justify-center py-32 text-center px-6">
          <div className="w-20 h-20 bg-white border-2 border-dashed border-slate-200 rounded-3xl flex items-center justify-center mb-5 shadow-sm">
            <Icon d={SVG.store} className="w-10 h-10 text-slate-300" />
          </div>
          <h2 className="text-slate-600 font-semibold text-lg mb-1">Sélectionnez un entrepôt</h2>
          <p className="text-slate-400 text-sm max-w-xs">
            Choisissez un entrepôt pour visualiser et configurer les seuils de stock de tous ses articles.
          </p>
        </div>
      )}

      {/* ── Loading ────────────────────────────────────────────────────────────── */}
      {selNode && loadRows && (
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200 border-t-red-600" />
          <p className="text-slate-400 text-sm">Chargement des articles…</p>
        </div>
      )}

      {/* ── No articles ────────────────────────────────────────────────────────── */}
      {selNode && !loadRows && rawRows.length === 0 && (
        <div className="flex flex-col items-center justify-center py-32 text-center px-6">
          <div className="w-16 h-16 bg-white border border-slate-200 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
            <Icon d={SVG.warn} className="w-8 h-8 text-slate-300" />
          </div>
          <p className="text-slate-600 font-medium">Aucun article trouvé</p>
          <p className="text-slate-400 text-sm mt-1">Vérifiez que des articles actifs existent dans le catalogue.</p>
        </div>
      )}

      {/* ── Main content ───────────────────────────────────────────────────────── */}
      {selNode && !loadRows && rawRows.length > 0 && (
        <div className="px-6 py-5 space-y-5">

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard label="Total articles"   value={stats.total}      accent="slate"   icon={SVG.box} />
            <StatCard label="Configurés"       value={stats.configured} accent="emerald" icon={SVG.check} />
            <StatCard label="Ruptures"         value={stats.rupture}    accent="red"     icon={SVG.warn} />
            <StatCard label="Stock faible"     value={stats.faible}     accent="amber"   icon={SVG.warn} />
            <StatCard label="Surstock"         value={stats.surstock}   accent="blue"    icon={SVG.info} />
          </div>

          {/* Filters bar */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative flex-shrink-0">
              <Icon d={SVG.search} className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Rechercher SKU, nom, EAN…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-white border border-slate-300 rounded-xl pl-9 pr-8 py-2 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all shadow-sm w-60"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors">
                  <Icon d={SVG.x} className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Status tabs */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
              {TABS.map((t) => {
                const cnt  = t.code === 'ALL' ? rowsComputed.length : rowsComputed.filter((r) => r.status === STATUS[t.code]).length;
                const isOn = tabFilter === t.code;
                return (
                  <button
                    key={t.code}
                    onClick={() => setTabFilter(t.code)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isOn ? `${t.active} shadow-sm` : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    {t.code !== 'ALL' && STATUS[t.code] && (
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS[t.code].dot}`} />
                    )}
                    {t.label}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isOn ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>
                      {cnt}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Dirty indicator */}
            {editMode && dirtyCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                {dirtyCount} modification{dirtyCount > 1 ? 's' : ''} non sauvegardée{dirtyCount > 1 ? 's' : ''}
              </div>
            )}

            {/* Read-only hint */}
            {!editMode && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400 ml-auto">
                <Icon d={SVG.lock} className="w-3.5 h-3.5" />
                <span>Lecture seule — cliquez <strong className="text-slate-600">Modifier les seuils</strong> pour éditer</span>
              </div>
            )}
          </div>

          {/* Default values info */}
          {editMode && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 text-xs text-blue-700">
              <Icon d={SVG.info} className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <span>
                Valeurs par défaut appliquées :
                <strong className="mx-1">Min = 10</strong>·
                <strong className="mx-1">Alerte = 30</strong>·
                <strong className="mx-1">Max = 200</strong>
                — Modifiez les champs puis cliquez <strong> Sauvegarder</strong>.
              </span>
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1080px]">

                {/* Double header */}
                <thead>
                  {/* Group row */}
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="pl-4 pr-2 py-2.5 w-12" />
                    <th className="px-4 py-2.5 text-left text-slate-500 font-medium text-xs min-w-[200px]">ARTICLE</th>
                    <th colSpan={4} className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500 border-x border-slate-200 bg-slate-50/80">
                      STOCK ACTUEL
                    </th>
                    <th colSpan={4} className={`px-4 py-2.5 text-center text-xs font-semibold border-r border-slate-200 ${editMode ? 'text-red-600 bg-red-50' : 'text-slate-600 bg-slate-50'}`}>
                      {editMode ? '✎  SEUILS ÉDITABLES' : 'SEUILS CONFIGURÉS'}
                    </th>
                    <th className="px-4 py-2.5 text-center text-xs font-medium text-slate-400 border-r border-slate-200">AUTO</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500 border-r border-slate-200">STATUT</th>
                    <th className="px-4 py-2.5 text-center text-xs font-medium text-slate-400 pr-4">ACTION</th>
                  </tr>

                  {/* Sub-labels */}
                  <tr className="bg-white border-b-2 border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="pl-4 pr-2 py-2" />
                    <th className="px-4 py-2 text-left">SKU · Nom · Famille</th>
                    <th className="px-3 py-2 text-right text-slate-400 border-l border-slate-100">Phys.</th>
                    <th className="px-3 py-2 text-right text-slate-400">Rés.</th>
                    <th className="px-3 py-2 text-right text-slate-400">Dispo</th>
                    <th className="px-3 py-2 text-right text-slate-400 border-r border-slate-200">Entr.</th>
                    <th className="px-3 py-2 text-center text-red-500">Min</th>
                    <th className="px-3 py-2 text-center text-amber-500">Alerte</th>
                    <th className="px-3 py-2 text-center text-blue-500">Max</th>
                    <th className="px-3 py-2 text-center text-slate-400 border-r border-slate-200">Réappro</th>
                    <th className="px-3 py-2 text-center border-r border-slate-200" />
                    <th className="px-3 py-2 text-center border-r border-slate-200" />
                    <th className="px-3 py-2 text-center pr-4" />
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filtered.map((row) => {
                    const art     = row.sku?.article;
                    const imgUrl  = art?.images?.[0]?.image_path ?? row.sku?.images?.[0]?.url ?? null;
                    const local   = locals[row.sku_id] ?? {};
                    const errs    = fieldErrors[row.sku_id] ?? {};
                    const isDirty = !!local.dirty;
                    const isSav   = savingId === row.sku_id;
                    const st      = row.status;
                    const hasRule = !!row.threshold_rule;

                    return (
                      <tr
                        key={row.sku_id}
                        className={`${st.row} transition-all ${
                          isDirty ? 'bg-amber-50/70' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        {/* Image */}
                        <td className="pl-4 pr-2 py-3">
                          {imgUrl ? (
                            <img src={imgUrl} alt="" className="w-10 h-10 rounded-xl object-cover border border-slate-200 shadow-sm flex-shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-200 flex items-center justify-center text-slate-500 font-bold text-[11px] flex-shrink-0 shadow-sm">
                              {(art?.sku_code ?? '?').slice(0, 2).toUpperCase()}
                            </div>
                          )}
                        </td>

                        {/* Article info */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-mono text-slate-800 font-bold tracking-tight text-sm">{art?.sku_code ?? '—'}</span>
                            {hasRule && !isDirty && (
                              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">✓ Configuré</span>
                            )}
                            {!hasRule && !isDirty && (
                              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">Défauts</span>
                            )}
                            {isDirty && (
                              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">● Modifié</span>
                            )}
                          </div>
                          <div className="text-slate-600 text-sm truncate max-w-[180px] font-medium">{art?.name_fr ?? '—'}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {art?.ean13 && <span className="font-mono text-slate-400 text-[10px]">{art.ean13}</span>}
                            {art?.family && <span className="text-slate-400 text-[10px] truncate">{art.family.name_fr}</span>}
                          </div>
                        </td>

                        {/* Stock quantities */}
                        <td className="px-3 py-3 text-right border-l border-slate-100">
                          <span className="font-mono text-sm text-slate-500 tabular-nums">{Number(row.qty_physical ?? 0)}</span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className="font-mono text-sm text-slate-500 tabular-nums">{Number(row.qty_reserved ?? 0)}</span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className={`font-mono text-sm tabular-nums font-semibold ${st.qty}`}>{Number(row.qty_available ?? 0)}</span>
                        </td>
                        <td className="px-3 py-3 text-right border-r border-slate-200">
                          <span className="font-mono text-sm text-slate-400 tabular-nums">{Number(row.qty_incoming ?? 0)}</span>
                        </td>

                        {/* Seuils */}
                        <td className="px-2 py-3 text-center">
                          {editMode
                            ? <NumInput value={local.stock_minimum ?? DEFAULTS.stock_minimum} onChange={(v) => setField(row.sku_id, 'stock_minimum', v)} error={errs.stock_minimum} placeholder="10" accent="red" />
                            : <NumDisplay value={local.stock_minimum ?? DEFAULTS.stock_minimum} accent="red" />
                          }
                        </td>
                        <td className="px-2 py-3 text-center">
                          {editMode
                            ? <NumInput value={local.stock_alert_threshold ?? DEFAULTS.stock_alert_threshold} onChange={(v) => setField(row.sku_id, 'stock_alert_threshold', v)} error={errs.stock_alert_threshold} placeholder="30" accent="amber" />
                            : <NumDisplay value={local.stock_alert_threshold ?? DEFAULTS.stock_alert_threshold} accent="amber" />
                          }
                        </td>
                        <td className="px-2 py-3 text-center">
                          {editMode
                            ? <NumInput value={local.stock_maximum ?? DEFAULTS.stock_maximum} onChange={(v) => setField(row.sku_id, 'stock_maximum', v)} error={errs.stock_maximum} placeholder="200" accent="blue" />
                            : <NumDisplay value={local.stock_maximum ?? DEFAULTS.stock_maximum} accent="blue" />
                          }
                        </td>
                        <td className="px-2 py-3 text-center border-r border-slate-200">
                          {editMode
                            ? <NumInput value={local.reorder_quantity ?? '0'} onChange={(v) => setField(row.sku_id, 'reorder_quantity', v)} error={errs.reorder_quantity} placeholder="0" />
                            : <NumDisplay value={local.reorder_quantity ?? '0'} />
                          }
                        </td>

                        {/* Auto toggle */}
                        <td className="px-3 py-3 text-center border-r border-slate-200">
                          <Toggle
                            checked={!!local.auto_restock_enabled}
                            onChange={(v) => editMode && setField(row.sku_id, 'auto_restock_enabled', v)}
                            disabled={!editMode}
                          />
                        </td>

                        {/* Status badge */}
                        <td className="px-3 py-3 text-center border-r border-slate-200">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${st.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${st.dot} flex-shrink-0`} />
                            {st.short}
                          </span>
                        </td>

                        {/* Save button */}
                        <td className="px-3 py-3 text-center pr-4">
                          {editMode && isDirty ? (
                            <button
                              onClick={() => saveRow(row)}
                              disabled={isSav}
                              className="flex items-center gap-1 mx-auto bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all shadow-sm whitespace-nowrap"
                            >
                              <Icon d={SVG.save} className="w-3 h-3" />
                              {isSav ? '…' : 'Sauv.'}
                            </button>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filtered.length === 0 && (
                <div className="text-center py-14 text-slate-400">
                  <Icon d={SVG.search} className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Aucun article ne correspond aux filtres</p>
                </div>
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-5 flex-wrap text-xs text-slate-400 px-1 pb-4">
            {Object.entries(STATUS).filter(([k]) => k !== 'NONE').map(([k, s]) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
                <span>{s.label}</span>
              </span>
            ))}
            <span className="flex items-center gap-1.5 ml-auto">
              <span className="w-2.5 h-2.5 rounded bg-amber-400" />
              <span>Ligne modifiée non sauvegardée</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
