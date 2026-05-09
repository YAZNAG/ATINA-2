import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getSellingRules, upsertSellingRule, updateSellingRule, bulkSaveSellingRules,
} from '../../api/stock.api';
import { getNodes } from '../../api/locationNode.api';

function Icon({ d, className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={d} />
    </svg>
  );
}

const PATHS = {
  package:  'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  search:   'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  refresh:  'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  save:     'M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4',
  edit:     'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  chevron:  'M19 9l-7 7-7-7',
  filter:   'M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z',
  check:    'M5 13l4 4L19 7',
  x:        'M6 18L18 6M6 6l12 12',
  clock:    'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  tag:      'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z',
  alert:    'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  download: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4',
  reset:    'M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6',
  calendar: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  pencil:   'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z',
  arrow:    'M17 8l4 4m0 0l-4 4m4-4H3',
};

const PAGE_SIZE_OPTIONS = [20, 50, 100];

function calcStatus({ qty_available, is_backorderable, backorder_limit, backordered_quantity, has_stock_level }) {
  if (!has_stock_level)                                                return 'NO_LEVEL';
  if (qty_available > 0)                                              return 'AVAILABLE';
  if (!is_backorderable)                                              return 'OUT_NO_BACK';
  if (backorder_limit > 0 && backordered_quantity >= backorder_limit) return 'LIMIT_REACHED';
  return 'BACKORDER_OPEN';
}

const STATUS_CFG = {
  AVAILABLE:      { label: 'Disponible',         badge: 'bg-emerald-100 text-emerald-700 border border-emerald-200', dot: 'bg-emerald-500' },
  OUT_NO_BACK:    { label: 'Rupture définitive',  badge: 'bg-red-100 text-red-700 border border-red-200',            dot: 'bg-red-500'     },
  BACKORDER_OPEN: { label: 'Backorder autorisé',  badge: 'bg-purple-100 text-purple-700 border border-purple-200',  dot: 'bg-purple-500'  },
  LIMIT_REACHED:  { label: 'Limite atteinte',     badge: 'bg-orange-100 text-orange-700 border border-orange-200',  dot: 'bg-orange-500'  },
  NO_LEVEL:       { label: 'Pas de stock enreg.', badge: 'bg-slate-100 text-slate-500 border border-slate-200',     dot: 'bg-slate-300'   },
};

const TABS = [
  { key: 'ALL',            label: 'Tout' },
  { key: 'AVAILABLE',      label: 'Disponible' },
  { key: 'BACKORDER_OPEN', label: 'Backorder' },
  { key: 'OUT_NO_BACK',    label: 'Rupture' },
  { key: 'LIMIT_REACHED',  label: 'Limite atteinte' },
  { key: 'NO_LEVEL',       label: 'Non configuré' },
];

function fmtDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function estimatedDate(restock_days) {
  const d = new Date();
  d.setDate(d.getDate() + Number(restock_days ?? 1));
  return d;
}

function exportCSV(rows) {
  const headers = [
    'SKU Code','EAN13','Nom FR','Nom AR','Catégorie',
    'Stock disponible','Vente en rupture','Limite commandes',
    'Qté en attente','Délai réappro. (j)','Date estimée dispo','Statut',
  ];
  const lines = rows.map((r) => {
    const art = r.sku?.article;
    const status = calcStatus(r);
    const estDate = (status === 'BACKORDER_OPEN') ? fmtDate(estimatedDate(r.estimated_restock_days)) : '';
    return [
      art?.sku_code ?? '',
      art?.ean13 ?? '',
      art?.name_fr ?? '',
      art?.name_ar ?? '',
      art?.category?.name_fr ?? '',
      r.qty_available,
      r.is_backorderable ? 'Oui' : 'Non',
      r.backorder_limit,
      r.backordered_quantity,
      r.estimated_restock_days,
      estDate,
      STATUS_CFG[status]?.label ?? '',
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });
  const csv  = [headers.join(','), ...lines].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'regles_vente.csv'; a.click();
  URL.revokeObjectURL(url);
}

// ─── Build diff between original row and draft ────────────────────────────────
function buildDiff(row, draft) {
  const changes = [];
  if (draft.is_backorderable !== row.is_backorderable)
    changes.push({
      field: 'Vente en rupture autorisée',
      before: row.is_backorderable ? 'Autorisé' : 'Non autorisé',
      after:  draft.is_backorderable ? 'Autorisé' : 'Non autorisé',
    });
  if (Number(draft.backorder_limit) !== row.backorder_limit)
    changes.push({
      field:  'Limite commandes en rupture',
      before: row.backorder_limit === 0 ? 'Illimité' : String(row.backorder_limit),
      after:  Number(draft.backorder_limit) === 0 ? 'Illimité' : draft.backorder_limit,
    });
  if (parseInt(draft.estimated_restock_days, 10) !== row.estimated_restock_days)
    changes.push({
      field:  'Délai de réapprovisionnement',
      before: `${row.estimated_restock_days} jour(s)`,
      after:  `${draft.estimated_restock_days} jour(s)`,
    });
  return changes;
}

// ─── Confirmation modal ───────────────────────────────────────────────────────
function ConfirmModal({ changes, onConfirm, onCancel, saving, error }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center">
              <Icon d={PATHS.save} className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-base">Récapitulatif des modifications</h2>
              <p className="text-xs text-slate-500">{changes.length} article{changes.length > 1 ? 's' : ''} modifié{changes.length > 1 ? 's' : ''}</p>
            </div>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition">
            <Icon d={PATHS.x} className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {changes.map(({ row, diff }) => {
            const art = row.sku?.article;
            const img = row.sku?.images?.[0]?.url ?? art?.images?.[0]?.url;
            return (
              <div key={row.sku_id} className="border border-slate-100 rounded-xl overflow-hidden">
                {/* Article header */}
                <div className="px-4 py-2.5 bg-slate-50 flex items-center gap-3 border-b border-slate-100">
                  <div className="w-8 h-8 rounded-lg bg-slate-200 overflow-hidden flex-shrink-0">
                    {img
                      ? <img src={img} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-slate-400"><Icon d={PATHS.package} className="w-3 h-3" /></div>
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 text-sm truncate">{art?.name_fr}</p>
                    <p className="text-xs text-slate-400">{art?.sku_code}{art?.ean13 && ` · ${art.ean13}`}</p>
                  </div>
                </div>
                {/* Diff table */}
                <div className="px-4 py-2">
                  {diff.map((c) => (
                    <div key={c.field} className="flex items-center gap-3 py-1.5 border-b border-slate-50 last:border-0">
                      <span className="text-xs text-slate-500 w-48 flex-shrink-0">{c.field}</span>
                      <span className="text-xs font-medium text-red-500 line-through">{c.before}</span>
                      <Icon d={PATHS.arrow} className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                      <span className="text-xs font-semibold text-emerald-600">{c.after}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        {error && <div className="mx-6 mb-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs">{error}</div>}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between flex-shrink-0">
          <button onClick={onCancel} disabled={saving}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition disabled:opacity-50">
            Continuer à modifier
          </button>
          <button onClick={onConfirm} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition disabled:opacity-50">
            <Icon d={saving ? PATHS.refresh : PATHS.check} className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
            {saving ? 'Sauvegarde en cours…' : `Valider les ${changes.length} modification${changes.length > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Row component ────────────────────────────────────────────────────────────
function RuleRow({ row, draft, onDraftChange, editMode }) {
  const defaultDraft = () => ({
    is_backorderable:       row.is_backorderable,
    backorder_limit:        String(row.backorder_limit),
    estimated_restock_days: String(row.estimated_restock_days),
  });
  const cur   = draft ?? defaultDraft();
  const dirty = draft !== null;

  const set = (field, val) =>
    onDraftChange({ ...(draft ?? defaultDraft()), [field]: val });

  const art      = row.sku?.article;
  const img      = row.sku?.images?.[0]?.url ?? art?.images?.[0]?.url;
  const curLimit = Number(cur.backorder_limit);

  const liveRow = {
    ...row,
    is_backorderable:       cur.is_backorderable,
    backorder_limit:        curLimit,
    estimated_restock_days: parseInt(cur.estimated_restock_days, 10),
  };
  const status = calcStatus(liveRow);
  const st     = STATUS_CFG[status];
  const estDate = status === 'BACKORDER_OPEN' ? estimatedDate(liveRow.estimated_restock_days) : null;

  const tdCls = 'px-3 py-3 text-center';

  return (
    <tr className={`hover:bg-slate-50/80 transition-colors ${dirty ? 'bg-purple-50/40 border-l-4 border-l-purple-400' : 'border-l-4 border-l-transparent'}`}>
      {/* Article */}
      <td className="px-4 py-3 min-w-[220px]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0">
            {img
              ? <img src={img} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-slate-300"><Icon d={PATHS.package} className="w-3.5 h-3.5" /></div>
            }
          </div>
          <div className="min-w-0">
            <p className="font-medium text-slate-800 text-sm leading-tight truncate">{art?.name_fr}</p>
            {art?.name_ar && <p className="text-xs text-slate-400 truncate" dir="rtl">{art.name_ar}</p>}
            <p className="text-xs text-slate-400">
              {art?.sku_code}
              {art?.ean13 && <span className="ml-1 text-slate-300">· {art.ean13}</span>}
            </p>
            {art?.category && <p className="text-[11px] text-slate-400">{art.category.name_fr}</p>}
          </div>
        </div>
      </td>

      {/* Stock disponible */}
      <td className={tdCls}>
        <span className={`text-sm font-semibold tabular-nums ${row.qty_available > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          {row.qty_available.toLocaleString('fr-FR')}
        </span>
        <p className="text-[10px] text-slate-400 mt-0.5">unités</p>
      </td>

      {/* Vente en rupture autorisée */}
      <td className={tdCls}>
        {editMode ? (
          <button
            onClick={() => set('is_backorderable', !cur.is_backorderable)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${cur.is_backorderable ? 'bg-purple-500' : 'bg-slate-300'}`}
            title={cur.is_backorderable ? 'Désactiver la vente en rupture' : 'Activer la vente en rupture'}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${cur.is_backorderable ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        ) : (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
            cur.is_backorderable
              ? 'bg-purple-50 text-purple-700 border-purple-200'
              : 'bg-slate-50 text-slate-500 border-slate-200'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cur.is_backorderable ? 'bg-purple-500' : 'bg-slate-300'}`} />
            {cur.is_backorderable ? 'Autorisé' : 'Non autorisé'}
          </span>
        )}
      </td>

      {/* Limite commandes en rupture */}
      <td className={tdCls}>
        {editMode ? (
          <div>
            <input type="number" min="0" step="1"
              value={cur.backorder_limit}
              onChange={(e) => set('backorder_limit', e.target.value)}
              disabled={!cur.is_backorderable}
              className="w-20 text-center border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 tabular-nums disabled:bg-slate-50 disabled:text-slate-300"
            />
            {curLimit === 0 && cur.is_backorderable && <p className="text-[10px] text-slate-400 mt-0.5">Illimité</p>}
          </div>
        ) : (
          <span className={`text-sm tabular-nums font-medium ${!cur.is_backorderable ? 'text-slate-300' : curLimit === 0 ? 'text-slate-400 italic' : 'text-slate-700'}`}>
            {!cur.is_backorderable ? '—' : curLimit === 0 ? 'Illimité' : curLimit}
          </span>
        )}
      </td>

      {/* Qté en attente de stock (readonly) */}
      <td className={tdCls}>
        <span className={`text-sm tabular-nums font-semibold ${row.backordered_quantity > 0 ? 'text-purple-600' : 'text-slate-400'}`}>
          {row.backordered_quantity.toLocaleString('fr-FR')}
        </span>
        {curLimit > 0 && row.backordered_quantity > 0 && (
          <div className="w-16 mx-auto mt-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500 rounded-full"
              style={{ width: `${Math.min(100, (row.backordered_quantity / curLimit) * 100)}%` }}
            />
          </div>
        )}
      </td>

      {/* Délai de réapprovisionnement */}
      <td className={tdCls}>
        {editMode ? (
          <div className="flex items-center justify-center gap-1">
            <input type="number" min="0" step="1"
              value={cur.estimated_restock_days}
              onChange={(e) => set('estimated_restock_days', e.target.value)}
              disabled={!cur.is_backorderable}
              className="w-16 text-center border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 tabular-nums disabled:bg-slate-50 disabled:text-slate-300"
            />
            <span className="text-xs text-slate-400">j</span>
          </div>
        ) : (
          <span className={`text-sm tabular-nums ${!cur.is_backorderable ? 'text-slate-300' : 'text-slate-700'}`}>
            {liveRow.estimated_restock_days} j
          </span>
        )}
      </td>

      {/* Date estimée de disponibilité */}
      <td className={`${tdCls} whitespace-nowrap`}>
        {status === 'AVAILABLE' ? (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
            <Icon d={PATHS.check} className="w-3.5 h-3.5" />En stock
          </span>
        ) : estDate ? (
          <span className="inline-flex items-center gap-1 text-xs text-purple-600 font-medium">
            <Icon d={PATHS.calendar} className="w-3.5 h-3.5" />{fmtDate(estDate)}
          </span>
        ) : (
          <span className="text-slate-300 text-xs">—</span>
        )}
      </td>

      {/* Statut de vente */}
      <td className={tdCls}>
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${st.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${st.dot}`} />
          {st.label}
        </span>
      </td>

      {/* Indicateur de modification */}
      <td className={tdCls}>
        {dirty ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 border border-purple-200">
            <Icon d={PATHS.pencil} className="w-3 h-3" />Modifié
          </span>
        ) : (
          <span className="text-slate-300 text-xs">—</span>
        )}
      </td>
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SellingRulesPage() {
  const [nodes, setNodes]             = useState([]);
  const [nodeId, setNodeId]           = useState('');
  const [rows, setRows]               = useState([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [drafts, setDrafts]           = useState({});
  const [editMode, setEditMode]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmSaving, setConfirmSaving] = useState(false);
  const [confirmError, setConfirmError]   = useState('');
  const [successMsg, setSuccessMsg]   = useState('');

  const [search, setSearch]           = useState('');
  const [tab, setTab]                 = useState('ALL');
  const [filterCat, setFilterCat]     = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage]               = useState(1);
  const [pageSize, setPageSize]       = useState(20);

  useEffect(() => {
    getNodes({ all: true }).then((r) => setNodes(r.data?.data ?? [])).catch(() => {});
  }, []);

  const load = useCallback(async (nid = nodeId) => {
    if (!nid) return;
    setLoading(true); setError('');
    try {
      const res = await getSellingRules({ node_id: nid });
      setRows(res.data?.data ?? []);
      setDrafts({}); setPage(1);
    } catch (e) {
      setError(e.response?.data?.message ?? e.message ?? 'Erreur de chargement');
    } finally { setLoading(false); }
  }, [nodeId]);

  const handleNodeChange = (id) => {
    setNodeId(id); setRows([]); setDrafts({});
    setSearch(''); setTab('ALL'); setFilterCat(''); setPage(1);
    setEditMode(false); setShowConfirm(false); setSuccessMsg('');
    if (id) load(id);
  };

  const handleActivateEdit = () => setEditMode(true);
  const handleCancelEdit   = () => { setEditMode(false); setDrafts({}); };

  const setDraft = (sku_id, val) =>
    setDrafts((prev) => ({ ...prev, [sku_id]: val }));

  // Categories
  const categories = useMemo(() => {
    const map = {};
    rows.forEach((r) => { const c = r.sku?.article?.category; if (c) map[c.id] = c; });
    return Object.values(map).sort((a, b) => a.name_fr.localeCompare(b.name_fr));
  }, [rows]);

  // Enriched rows with live draft values
  const enriched = useMemo(() => rows.map((r) => {
    const d = drafts[r.sku_id];
    const live = d ? {
      ...r,
      is_backorderable:       d.is_backorderable,
      backorder_limit:        Number(d.backorder_limit),
      estimated_restock_days: parseInt(d.estimated_restock_days, 10),
    } : r;
    return { ...live, _status: calcStatus(live) };
  }), [rows, drafts]);

  // Stats
  const stats = useMemo(() => ({
    total: enriched.length,
    avail: enriched.filter((r) => r._status === 'AVAILABLE').length,
    back:  enriched.filter((r) => r._status === 'BACKORDER_OPEN').length,
    out:   enriched.filter((r) => r._status === 'OUT_NO_BACK').length,
    limit: enriched.filter((r) => r._status === 'LIMIT_REACHED').length,
  }), [enriched]);

  // Filtered list
  const filtered = useMemo(() => {
    let list = enriched;
    if (tab !== 'ALL') list = list.filter((r) => r._status === tab);
    if (filterCat)     list = list.filter((r) => r.sku?.article?.category?.id === filterCat);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) => {
        const a = r.sku?.article;
        return a?.name_fr?.toLowerCase().includes(q)
          || a?.name_ar?.toLowerCase().includes(q)
          || a?.sku_code?.toLowerCase().includes(q)
          || a?.ean13?.toLowerCase().includes(q);
      });
    }
    return list;
  }, [enriched, tab, filterCat, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated  = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);
  const tabCount   = (key) => key === 'ALL' ? enriched.length : enriched.filter((r) => r._status === key).length;
  const dirtyCount = Object.values(drafts).filter(Boolean).length;

  // Changes to confirm (rows that have a diff vs original)
  const confirmChanges = useMemo(() =>
    enriched
      .filter((r) => drafts[r.sku_id] != null)
      .map((r) => ({ row: r, diff: buildDiff(rows.find((x) => x.sku_id === r.sku_id) ?? r, drafts[r.sku_id]) }))
      .filter((c) => c.diff.length > 0),
  [enriched, drafts, rows]);

  const handleSaveClick = () => {
    setConfirmError('');
    setShowConfirm(true);
  };

  const handleConfirmSave = async () => {
    const dirtyRows = enriched.filter((r) => drafts[r.sku_id] != null);
    if (!dirtyRows.length) return;
    setConfirmSaving(true); setConfirmError('');
    try {
      const payload = dirtyRows.map((r) => {
        const d = drafts[r.sku_id];
        return {
          node_id:                nodeId,
          sku_id:                 r.sku_id,
          is_backorderable:       d.is_backorderable,
          backorder_limit:        Number(d.backorder_limit),
          estimated_restock_days: parseInt(d.estimated_restock_days, 10),
        };
      });
      await bulkSaveSellingRules(payload);
      setSuccessMsg(`${dirtyRows.length} règle(s) de vente sauvegardée(s)`);
      setTimeout(() => setSuccessMsg(''), 5000);
      setShowConfirm(false);
      setEditMode(false);
      await load(nodeId);
    } catch (e) {
      setConfirmError(e.response?.data?.message ?? 'Erreur lors de la sauvegarde');
    } finally { setConfirmSaving(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {/* Confirmation modal */}
      {showConfirm && (
        <ConfirmModal
          changes={confirmChanges.length > 0 ? confirmChanges : enriched.filter((r) => drafts[r.sku_id] != null).map((r) => ({ row: r, diff: [{ field: 'Aucun changement détecté', before: '—', after: '—' }] }))}
          onConfirm={handleConfirmSave}
          onCancel={() => setShowConfirm(false)}
          saving={confirmSaving}
          error={confirmError}
        />
      )}

      {/* Header */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl px-6 py-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <Icon d={PATHS.tag} className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">Règles de vente</h1>
              <p className="text-sm text-slate-500">Gestion du backorder et des délais de réapprovisionnement par entrepôt × SKU</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Node selector */}
            <div className="relative">
              <select value={nodeId} onChange={(e) => handleNodeChange(e.target.value)}
                className="appearance-none border border-slate-200 rounded-xl px-4 py-2 pr-8 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-400 cursor-pointer">
                <option value="">— Sélectionner un entrepôt —</option>
                {nodes.map((n) => <option key={n.id} value={n.id}>{n.code} — {n.name_fr}</option>)}
              </select>
              <Icon d={PATHS.chevron} className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {nodeId && (
              <button onClick={() => load()} disabled={loading}
                className="flex items-center gap-2 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition disabled:opacity-50">
                <Icon d={PATHS.refresh} className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Actualiser
              </button>
            )}

            {rows.length > 0 && !editMode && (
              <button onClick={() => exportCSV(filtered)}
                className="flex items-center gap-2 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition">
                <Icon d={PATHS.download} className="w-3.5 h-3.5" />
                Export CSV
              </button>
            )}

            {/* Edit mode controls */}
            {rows.length > 0 && !editMode && (
              <button onClick={handleActivateEdit}
                className="flex items-center gap-2 bg-purple-600 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-purple-700 transition">
                <Icon d={PATHS.edit} className="w-3.5 h-3.5" />
                Modifier le tableau
              </button>
            )}

            {editMode && (
              <>
                <button onClick={handleCancelEdit}
                  className="flex items-center gap-2 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 transition">
                  <Icon d={PATHS.x} className="w-3.5 h-3.5" />
                  Annuler les modifications
                </button>
                {dirtyCount > 0 && (
                  <button onClick={handleSaveClick}
                    className="flex items-center gap-2 bg-purple-600 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-purple-700 transition">
                    <Icon d={PATHS.save} className="w-3.5 h-3.5" />
                    Sauvegarder ({dirtyCount})
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm">{error}</div>}
      {successMsg && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
          <Icon d={PATHS.check} className="w-4 h-4" />{successMsg}
        </div>
      )}

      {!nodeId && !loading && (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400">
          <Icon d={PATHS.tag} className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Sélectionnez un entrepôt pour gérer les règles de vente</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-24">
          <Icon d={PATHS.refresh} className="w-7 h-7 animate-spin text-slate-300" />
        </div>
      )}

      {/* Edit mode banner */}
      {editMode && rows.length > 0 && (
        <div className="mb-4 bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-purple-700">
            <Icon d={PATHS.pencil} className="w-4 h-4" />
            <strong>Mode modification activé</strong>
            {dirtyCount > 0
              ? <span>— <strong>{dirtyCount}</strong> ligne{dirtyCount > 1 ? 's' : ''} modifiée{dirtyCount > 1 ? 's' : ''}</span>
              : <span>— Modifiez les cellules dans le tableau</span>
            }
          </div>
          {dirtyCount > 0 && (
            <button onClick={handleSaveClick}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition">
              <Icon d={PATHS.save} className="w-3.5 h-3.5" />
              Sauvegarder les modifications ({dirtyCount})
            </button>
          )}
        </div>
      )}

      {nodeId && !loading && rows.length > 0 && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total articles',   value: stats.total, color: 'slate',   icon: PATHS.package },
              { label: 'En stock',         value: stats.avail, color: 'emerald', icon: PATHS.check   },
              { label: 'Backorder ouvert', value: stats.back,  color: 'purple',  icon: PATHS.clock   },
              { label: 'Rupture ferme',    value: stats.out,   color: 'red',     icon: PATHS.alert   },
            ].map(({ label, value, color, icon }) => {
              const C = {
                slate:   'bg-slate-50   border-slate-200   text-slate-600',
                emerald: 'bg-emerald-50 border-emerald-200 text-emerald-600',
                purple:  'bg-purple-50  border-purple-200  text-purple-600',
                red:     'bg-red-50     border-red-200     text-red-600',
              }[color];
              return (
                <div key={label} className={`rounded-xl border p-4 flex items-center gap-3 ${C}`}>
                  <Icon d={icon} className="w-5 h-5" />
                  <div>
                    <p className="text-xs font-medium opacity-70">{label}</p>
                    <p className="text-2xl font-bold tabular-nums">{value}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            {/* Toolbar */}
            <div className="px-4 py-3 border-b border-slate-100 flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Icon d={PATHS.search} className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" placeholder="Rechercher par nom, code SKU, EAN13 ou nom arabe…"
                    value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400" />
                </div>
                <button onClick={() => setShowFilters((v) => !v)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition ${showFilters || filterCat ? 'border-purple-300 bg-purple-50 text-purple-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  <Icon d={PATHS.filter} className="w-3.5 h-3.5" />
                  Filtres
                  {filterCat && <span className="bg-purple-600 text-white text-[10px] rounded-full px-1.5 py-0.5">1</span>}
                </button>
              </div>

              {showFilters && (
                <div className="flex flex-wrap gap-3 pb-1">
                  <div className="relative">
                    <select value={filterCat} onChange={(e) => { setFilterCat(e.target.value); setPage(1); }}
                      className="appearance-none border border-slate-200 rounded-lg px-3 py-1.5 pr-7 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-400">
                      <option value="">Toutes les catégories</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name_fr}</option>)}
                    </select>
                    <Icon d={PATHS.chevron} className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                  {filterCat && (
                    <button onClick={() => setFilterCat('')}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 transition">
                      Effacer les filtres
                    </button>
                  )}
                </div>
              )}

              {/* Tabs */}
              <div className="flex gap-1 flex-wrap">
                {TABS.map((t) => {
                  const cnt = tabCount(t.key);
                  return (
                    <button key={t.key} onClick={() => { setTab(t.key); setPage(1); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${tab === t.key ? 'bg-purple-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                      {t.label}
                      {cnt > 0 && (
                        <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${tab === t.key ? 'bg-white/20' : 'bg-slate-200'}`}>{cnt}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wide">
                    <th className="text-left px-4 py-3 font-semibold">
                      Article / SKU
                    </th>
                    <th className="text-center px-3 py-3 font-semibold">
                      Stock disponible
                      <div className="font-normal normal-case text-[10px] text-slate-400 tracking-normal">Qté en stock</div>
                    </th>
                    <th className="text-center px-3 py-3 font-semibold">
                      Vente en rupture
                      <div className="font-normal normal-case text-[10px] text-slate-400 tracking-normal">Autoriser sans stock ?</div>
                    </th>
                    <th className="text-center px-3 py-3 font-semibold">
                      Limite commandes
                      <div className="font-normal normal-case text-[10px] text-slate-400 tracking-normal">Max cmd. en attente (0=∞)</div>
                    </th>
                    <th className="text-center px-3 py-3 font-semibold">
                      Qté en attente
                      <div className="font-normal normal-case text-[10px] text-slate-400 tracking-normal">Cmds déjà en backorder</div>
                    </th>
                    <th className="text-center px-3 py-3 font-semibold">
                      Délai réappro.
                      <div className="font-normal normal-case text-[10px] text-slate-400 tracking-normal">Jours avant retour stock</div>
                    </th>
                    <th className="text-center px-3 py-3 font-semibold">
                      Dispo. estimée
                      <div className="font-normal normal-case text-[10px] text-slate-400 tracking-normal">Date de retour en stock</div>
                    </th>
                    <th className="text-center px-3 py-3 font-semibold">
                      Statut de vente
                    </th>
                    <th className="text-center px-3 py-3 font-semibold">
                      {editMode ? 'Modification' : ''}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paginated.map((row) => (
                    <RuleRow
                      key={row.sku_id}
                      row={row}
                      draft={drafts[row.sku_id] ?? null}
                      onDraftChange={(val) => setDraft(row.sku_id, val)}
                      editMode={editMode}
                    />
                  ))}
                </tbody>
              </table>

              {filtered.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  <Icon d={PATHS.tag} className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Aucun article trouvé</p>
                </div>
              )}
            </div>

            {/* Footer — pagination */}
            <div className="px-4 py-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span>
                  {filtered.length > 0
                    ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filtered.length)} sur ${filtered.length} article${filtered.length > 1 ? 's' : ''}`
                    : '0 article'}
                  {rows.length !== filtered.length && ` (${rows.length} au total)`}
                </span>
                <div className="flex items-center gap-1">
                  <span>Lignes par page :</span>
                  <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                    className="border border-slate-200 rounded-md px-1.5 py-0.5 text-xs focus:outline-none">
                    {PAGE_SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition">
                    ‹ Préc.
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let p;
                    if (totalPages <= 5)             p = i + 1;
                    else if (page <= 3)              p = i + 1;
                    else if (page >= totalPages - 2) p = totalPages - 4 + i;
                    else                             p = page - 2 + i;
                    return (
                      <button key={p} onClick={() => setPage(p)}
                        className={`w-7 h-7 rounded-lg text-xs font-medium transition ${page === p ? 'bg-purple-600 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                        {p}
                      </button>
                    );
                  })}
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition">
                    Suiv. ›
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
