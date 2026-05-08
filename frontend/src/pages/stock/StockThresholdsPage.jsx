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
  save:    'M17 16v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2M9 12l3 3 3-3M12 3v12',
  search:  'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  refresh: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  store:   'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  filter:  'M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z',
  x:       'M6 18L18 6M6 6l12 12',
};

function Icon({ d, className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
    </svg>
  );
}

// ── Status calc ───────────────────────────────────────────────────────────────

function calcStatus(row) {
  const rule = row.threshold_rule ?? row._local;
  if (!rule || (!rule.stock_minimum && !rule.stock_maximum && !rule.stock_alert_threshold))
    return { code: 'NONE',   label: 'Non configuré', cls: 'bg-zinc-700 text-zinc-300' };
  const qty   = Number(row.qty_available ?? 0);
  const min   = Number(rule.stock_minimum ?? 0);
  const alert = Number(rule.stock_alert_threshold ?? 0);
  const max   = Number(rule.stock_maximum ?? 0);
  if (max > 0 && qty > max) return { code: 'OVER',  label: 'Surstock',    cls: 'bg-blue-500/20  text-blue-300  border border-blue-500/30' };
  if (qty <= min)            return { code: 'OUT',   label: 'Rupture',     cls: 'bg-red-500/20   text-red-300   border border-red-500/30'  };
  if (qty <= alert)          return { code: 'LOW',   label: 'Stock faible',cls: 'bg-amber-500/20 text-amber-300 border border-amber-500/30' };
  return                            { code: 'OK',    label: 'Normal',      cls: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' };
}

// ── Validation ────────────────────────────────────────────────────────────────

function validateRow(local) {
  const errs = {};
  const min   = Number(local.stock_minimum         ?? 0);
  const alert = Number(local.stock_alert_threshold ?? 0);
  const max   = Number(local.stock_maximum         ?? 0);
  const reorder = Number(local.reorder_quantity    ?? 0);
  if (min < 0)       errs.stock_minimum         = '≥ 0';
  if (alert < min)   errs.stock_alert_threshold  = `≥ min (${min})`;
  if (max <= alert)  errs.stock_maximum          = `> alerte (${alert})`;
  if (reorder < 0)   errs.reorder_quantity       = '≥ 0';
  return errs;
}

const EMPTY_LOCAL = { stock_minimum: '', stock_alert_threshold: '', stock_maximum: '', reorder_quantity: '', auto_restock_enabled: false };

// ── InlineInput ───────────────────────────────────────────────────────────────

function InlineInput({ value, onChange, error, type = 'number', className = '' }) {
  return (
    <div className="relative">
      <input
        type={type}
        min={type === 'number' ? '0' : undefined}
        step={type === 'number' ? '1' : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-20 bg-zinc-800 text-zinc-100 text-xs px-2 py-1 rounded border ${
          error ? 'border-red-500' : 'border-zinc-700 focus:border-red-500'
        } outline-none transition-colors ${className}`}
      />
      {error && (
        <div className="absolute top-full left-0 mt-0.5 text-red-400 text-[10px] whitespace-nowrap z-10">
          {error}
        </div>
      )}
    </div>
  );
}

// ── ToggleSwitch ──────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        checked ? 'bg-red-600' : 'bg-zinc-700'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

// ── Qty cell ──────────────────────────────────────────────────────────────────

function QtyCell({ value }) {
  const n = Number(value ?? 0);
  return <span className={`font-mono text-xs ${n <= 0 ? 'text-zinc-500' : 'text-zinc-200'}`}>{n}</span>;
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { code: 'ALL',  label: 'Tous' },
  { code: 'OUT',  label: 'Rupture' },
  { code: 'LOW',  label: 'Stock faible' },
  { code: 'OK',   label: 'Normal' },
  { code: 'OVER', label: 'Surstock' },
  { code: 'NONE', label: 'Non configuré' },
];

export default function StockThresholdsPage() {
  const [nodes, setNodes]           = useState([]);
  const [selectedNode, setSelectedNode] = useState('');
  const [rawRows, setRawRows]       = useState([]);   // data from API
  const [locals, setLocals]         = useState({});   // { sku_id: { ...fields, dirty } }
  const [errors, setErrors]         = useState({});   // { sku_id: { field: msg } }
  const [loadingNodes, setLoadingNodes] = useState(true);
  const [loadingRows, setLoadingRows]   = useState(false);
  const [saving, setSaving]         = useState({});   // { sku_id: bool }
  const [savingAll, setSavingAll]   = useState(false);
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Load nodes
  useEffect(() => {
    (async () => {
      try {
        const res = await getNodes({ all: true, is_active: true });
        setNodes(res.data?.data ?? []);
      } catch (e) {
        toast.error(getErrorMessage(e));
      } finally {
        setLoadingNodes(false);
      }
    })();
  }, []);

  // Load rows for selected node
  const loadRows = useCallback(async (node_id) => {
    if (!node_id) return;
    setLoadingRows(true);
    setLocals({});
    setErrors({});
    try {
      const res = await getStockThresholds(node_id);
      const data = res.data?.data ?? [];
      setRawRows(data);
      // Init locals from existing threshold_rule
      const init = {};
      data.forEach((row) => {
        const r = row.threshold_rule;
        init[row.sku_id] = {
          stock_minimum:         r ? String(Number(r.stock_minimum))         : '',
          stock_alert_threshold: r ? String(Number(r.stock_alert_threshold)) : '',
          stock_maximum:         r ? String(Number(r.stock_maximum))         : '',
          reorder_quantity:      r ? String(Number(r.reorder_quantity))      : '',
          auto_restock_enabled:  r ? r.auto_restock_enabled                  : false,
          is_active:             r ? r.is_active                             : true,
          dirty: false,
        };
      });
      setLocals(init);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setLoadingRows(false);
    }
  }, []);

  useEffect(() => { loadRows(selectedNode); }, [selectedNode, loadRows]);

  // Update a local field
  const setField = useCallback((sku_id, field, value) => {
    setLocals((prev) => {
      const updated = { ...prev, [sku_id]: { ...(prev[sku_id] ?? EMPTY_LOCAL), [field]: value, dirty: true } };
      // Validate
      const errs = validateRow(updated[sku_id]);
      setErrors((e) => ({ ...e, [sku_id]: errs }));
      return updated;
    });
  }, []);

  // Save one row
  const saveRow = useCallback(async (row) => {
    const local = locals[row.sku_id];
    if (!local) return;
    const errs = validateRow(local);
    if (Object.keys(errs).length) {
      setErrors((e) => ({ ...e, [row.sku_id]: errs }));
      toast.error('Corrigez les erreurs avant de sauvegarder');
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
    setSaving((s) => ({ ...s, [row.sku_id]: true }));
    try {
      const rule = row.threshold_rule;
      let saved;
      if (rule?.id) {
        const res = await updateStockThreshold(rule.id, payload);
        saved = res.data?.data;
      } else {
        const res = await createStockThreshold({ node_id: selectedNode, sku_id: row.sku_id, ...payload });
        saved = res.data?.data;
      }
      // Update rawRows
      setRawRows((prev) => prev.map((r) => r.sku_id === row.sku_id ? { ...r, threshold_rule: saved } : r));
      setLocals((prev) => ({ ...prev, [row.sku_id]: { ...prev[row.sku_id], dirty: false } }));
      setErrors((e) => { const n = { ...e }; delete n[row.sku_id]; return n; });
      toast.success('Seuils sauvegardés');
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving((s) => ({ ...s, [row.sku_id]: false }));
    }
  }, [locals, selectedNode]);

  // Save all dirty rows
  const saveAll = useCallback(async () => {
    const dirtyRows = rawRows.filter((r) => locals[r.sku_id]?.dirty);
    if (!dirtyRows.length) return;

    // Validate all
    let hasErrors = false;
    const newErrors = { ...errors };
    dirtyRows.forEach((r) => {
      const errs = validateRow(locals[r.sku_id]);
      if (Object.keys(errs).length) { newErrors[r.sku_id] = errs; hasErrors = true; }
    });
    if (hasErrors) { setErrors(newErrors); toast.error('Corrigez les erreurs avant de sauvegarder'); return; }

    setSavingAll(true);
    try {
      const rows = dirtyRows.map((r) => {
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
      await bulkSaveThresholds(selectedNode, rows);
      toast.success(`${rows.length} règle(s) sauvegardée(s)`);
      await loadRows(selectedNode);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSavingAll(false);
    }
  }, [rawRows, locals, errors, selectedNode, loadRows]);

  // Derived rows with status
  const rowsWithStatus = useMemo(() => rawRows.map((r) => {
    const local = locals[r.sku_id];
    const rule  = r.threshold_rule;
    const merged = {
      stock_minimum:         local?.stock_minimum         ?? (rule ? Number(rule.stock_minimum)         : 0),
      stock_alert_threshold: local?.stock_alert_threshold ?? (rule ? Number(rule.stock_alert_threshold) : 0),
      stock_maximum:         local?.stock_maximum         ?? (rule ? Number(rule.stock_maximum)         : 0),
    };
    return { ...r, _local: merged, status: calcStatus({ ...r, threshold_rule: merged }) };
  }), [rawRows, locals]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    let out = rowsWithStatus;
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter((r) => {
        const art = r.sku?.article;
        return (
          (art?.sku_code  ?? '').toLowerCase().includes(q) ||
          (art?.name_fr   ?? '').toLowerCase().includes(q) ||
          (art?.name_ar   ?? '').toLowerCase().includes(q) ||
          (art?.ean13     ?? '').toLowerCase().includes(q)
        );
      });
    }
    if (statusFilter !== 'ALL') out = out.filter((r) => r.status.code === statusFilter);
    return out;
  }, [rowsWithStatus, search, statusFilter]);

  const dirtyCount = useMemo(() => rawRows.filter((r) => locals[r.sku_id]?.dirty).length, [rawRows, locals]);

  const stats = useMemo(() => {
    const total   = rawRows.length;
    const config  = rawRows.filter((r) => r.threshold_rule !== null || locals[r.sku_id]?.dirty).length;
    const rupture = rowsWithStatus.filter((r) => r.status.code === 'OUT').length;
    const faible  = rowsWithStatus.filter((r) => r.status.code === 'LOW').length;
    return { total, config, rupture, faible };
  }, [rawRows, rowsWithStatus, locals]);

  const selectedNodeObj = nodes.find((n) => n.id === selectedNode);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="border-b border-zinc-800/60 bg-zinc-950 sticky top-0 z-20">
        <div className="px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-white">Seuils de stock par entrepôt</h1>
              <p className="text-zinc-400 text-sm mt-0.5">
                Configurez les seuils min / alerte / max pour chaque article par entrepôt
              </p>
            </div>
            {dirtyCount > 0 && (
              <button
                onClick={saveAll}
                disabled={savingAll}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
              >
                <Icon d={SVG.save} className="w-4 h-4" />
                {savingAll ? 'Sauvegarde…' : `Sauvegarder tout (${dirtyCount})`}
              </button>
            )}
          </div>

          {/* Node selector */}
          <div className="mt-4 flex items-center gap-3">
            <Icon d={SVG.store} className="w-5 h-5 text-zinc-400 flex-shrink-0" />
            {loadingNodes ? (
              <div className="h-9 w-64 bg-zinc-800 rounded-xl animate-pulse" />
            ) : (
              <select
                value={selectedNode}
                onChange={(e) => setSelectedNode(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-xl px-3 py-2 text-sm min-w-[280px] outline-none focus:border-red-500 transition-colors"
              >
                <option value="">— Sélectionner un entrepôt —</option>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.code} — {n.name_fr}
                  </option>
                ))}
              </select>
            )}
            {selectedNode && !loadingRows && (
              <button
                onClick={() => loadRows(selectedNode)}
                className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
                title="Actualiser"
              >
                <Icon d={SVG.refresh} className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Stats bar */}
        {selectedNode && !loadingRows && rawRows.length > 0 && (
          <div className="px-6 pb-3 flex items-center gap-6 text-xs text-zinc-400">
            <span><span className="text-white font-semibold">{stats.total}</span> articles</span>
            <span><span className="text-emerald-400 font-semibold">{stats.config}</span> configurés</span>
            <span><span className="text-red-400 font-semibold">{stats.rupture}</span> ruptures</span>
            <span><span className="text-amber-400 font-semibold">{stats.faible}</span> stock faible</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-6 py-4">

        {/* Empty state — no node selected */}
        {!selectedNode && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center mb-4">
              <Icon d={SVG.store} className="w-8 h-8 text-zinc-600" />
            </div>
            <p className="text-zinc-400 font-medium">Sélectionnez un entrepôt pour voir les articles</p>
            <p className="text-zinc-600 text-sm mt-1">Les seuils de stock s'affichent par entrepôt</p>
          </div>
        )}

        {/* Loading */}
        {selectedNode && loadingRows && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" />
          </div>
        )}

        {/* No articles */}
        {selectedNode && !loadingRows && rawRows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-zinc-400 font-medium">Aucun article en stock dans cet entrepôt</p>
            <p className="text-zinc-600 text-sm mt-1">
              Les articles apparaissent lorsqu'ils ont un niveau de stock enregistré pour {selectedNodeObj?.name_fr}
            </p>
          </div>
        )}

        {/* Filters + Table */}
        {selectedNode && !loadingRows && rawRows.length > 0 && (
          <>
            {/* Filters */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              {/* Search */}
              <div className="relative">
                <Icon d={SVG.search} className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="SKU, nom, EAN…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 rounded-xl pl-9 pr-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-red-500 transition-colors w-52"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                    <Icon d={SVG.x} className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Status filter */}
              <div className="flex items-center gap-1 bg-zinc-900 rounded-xl p-1 border border-zinc-800">
                {STATUS_FILTERS.map((f) => (
                  <button
                    key={f.code}
                    onClick={() => setStatusFilter(f.code)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      statusFilter === f.code
                        ? 'bg-red-600 text-white'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                    }`}
                  >
                    {f.label}
                    {f.code !== 'ALL' && (
                      <span className="ml-1 text-[10px] opacity-70">
                        ({rowsWithStatus.filter((r) => r.status.code === f.code).length})
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {filteredRows.length !== rawRows.length && (
                <span className="text-xs text-zinc-500">{filteredRows.length} / {rawRows.length} articles</span>
              )}
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-2xl border border-zinc-800">
              <table className="w-full text-xs min-w-[1100px]">
                <thead className="sticky top-0 z-10 bg-zinc-900">
                  <tr className="border-b border-zinc-700">
                    <th className="px-3 py-3 text-left text-zinc-400 font-medium w-10">Img</th>
                    <th className="px-3 py-3 text-left text-zinc-400 font-medium">SKU / Article</th>
                    <th className="px-3 py-3 text-right text-zinc-400 font-medium">Physique</th>
                    <th className="px-3 py-3 text-right text-zinc-400 font-medium">Réservé</th>
                    <th className="px-3 py-3 text-right text-zinc-400 font-medium">Dispo</th>
                    <th className="px-3 py-3 text-right text-zinc-400 font-medium">Entrant</th>
                    <th className="px-3 py-3 text-center text-zinc-400 font-medium border-l border-zinc-700">Min</th>
                    <th className="px-3 py-3 text-center text-zinc-400 font-medium">Alerte</th>
                    <th className="px-3 py-3 text-center text-zinc-400 font-medium">Max</th>
                    <th className="px-3 py-3 text-center text-zinc-400 font-medium">Réappro</th>
                    <th className="px-3 py-3 text-center text-zinc-400 font-medium">Auto</th>
                    <th className="px-3 py-3 text-center text-zinc-400 font-medium border-l border-zinc-700">Statut</th>
                    <th className="px-3 py-3 text-center text-zinc-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, idx) => {
                    const art     = row.sku?.article;
                    const imgUrl  = art?.images?.[0]?.image_path ?? row.sku?.images?.[0]?.url ?? null;
                    const local   = locals[row.sku_id] ?? EMPTY_LOCAL;
                    const rowErrs = errors[row.sku_id] ?? {};
                    const isDirty = !!local.dirty;
                    const isSaving = !!saving[row.sku_id];

                    return (
                      <tr
                        key={row.sku_id}
                        className={`border-b border-zinc-800/60 transition-colors ${
                          isDirty ? 'bg-zinc-900/80' : idx % 2 === 0 ? 'bg-zinc-950' : 'bg-zinc-900/30'
                        } hover:bg-zinc-800/40`}
                      >
                        {/* Image */}
                        <td className="px-3 py-2">
                          {imgUrl ? (
                            <img src={imgUrl} alt="" className="w-8 h-8 rounded-lg object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-600 font-bold text-[10px]">
                              {(art?.sku_code ?? '?').slice(0, 2).toUpperCase()}
                            </div>
                          )}
                        </td>

                        {/* Article info */}
                        <td className="px-3 py-2 max-w-[220px]">
                          <div className="font-mono text-zinc-200 font-semibold truncate">{art?.sku_code ?? '—'}</div>
                          <div className="text-zinc-400 truncate">{art?.name_fr ?? '—'}</div>
                          {art?.ean13 && <div className="text-zinc-600 font-mono">{art.ean13}</div>}
                          {art?.family && <div className="text-zinc-600 truncate">{art.family.name_fr}</div>}
                        </td>

                        {/* Stock quantities */}
                        <td className="px-3 py-2 text-right"><QtyCell value={row.qty_physical} /></td>
                        <td className="px-3 py-2 text-right"><QtyCell value={row.qty_reserved} /></td>
                        <td className="px-3 py-2 text-right"><QtyCell value={row.qty_available} /></td>
                        <td className="px-3 py-2 text-right"><QtyCell value={row.qty_incoming} /></td>

                        {/* Editable thresholds */}
                        <td className="px-2 py-2 text-center border-l border-zinc-800">
                          <InlineInput
                            value={local.stock_minimum}
                            onChange={(v) => setField(row.sku_id, 'stock_minimum', v)}
                            error={rowErrs.stock_minimum}
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <InlineInput
                            value={local.stock_alert_threshold}
                            onChange={(v) => setField(row.sku_id, 'stock_alert_threshold', v)}
                            error={rowErrs.stock_alert_threshold}
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <InlineInput
                            value={local.stock_maximum}
                            onChange={(v) => setField(row.sku_id, 'stock_maximum', v)}
                            error={rowErrs.stock_maximum}
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <InlineInput
                            value={local.reorder_quantity}
                            onChange={(v) => setField(row.sku_id, 'reorder_quantity', v)}
                            error={rowErrs.reorder_quantity}
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <Toggle
                            checked={!!local.auto_restock_enabled}
                            onChange={(v) => setField(row.sku_id, 'auto_restock_enabled', v)}
                          />
                        </td>

                        {/* Status badge */}
                        <td className="px-3 py-2 text-center border-l border-zinc-800">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${row.status.cls}`}>
                            {row.status.label}
                          </span>
                        </td>

                        {/* Save action */}
                        <td className="px-3 py-2 text-center">
                          {isDirty && (
                            <button
                              onClick={() => saveRow(row)}
                              disabled={isSaving}
                              className="flex items-center gap-1 mx-auto bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors"
                            >
                              <Icon d={SVG.save} className="w-3 h-3" />
                              {isSaving ? '…' : 'Sauv.'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredRows.length === 0 && (
                <div className="text-center py-10 text-zinc-500">
                  Aucun article ne correspond aux filtres sélectionnés
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="mt-4 flex items-center gap-4 flex-wrap text-[11px] text-zinc-500">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Rupture : stock dispo ≤ minimum</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />Stock faible : stock dispo ≤ seuil alerte</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Normal : entre alerte et maximum</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />Surstock : stock dispo &gt; maximum</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
