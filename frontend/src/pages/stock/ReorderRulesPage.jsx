import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getReorderRules, getReorderRuleRefs,
  createReorderRule, updateReorderRule, bulkSaveReorderRules,
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
  alert:    'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  download: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4',
  truck:    'M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0zM13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0H3m18 0h-2',
  trend:    'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
  arrow:    'M17 8l4 4m0 0l-4 4m4-4H3',
  pencil:   'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z',
};

const PAGE_SIZE_OPTIONS = [20, 50, 100];

// ─── Status logic ─────────────────────────────────────────────────────────────
function calcStatus({ has_rule, has_stock_level, is_active, qty_available, safety_stock, reorder_point, max_stock }) {
  if (!has_rule)                                          return 'NO_RULE';
  if (!has_stock_level)                                   return 'NO_LEVEL';
  if (!is_active)                                         return 'INACTIVE';
  if (max_stock !== null && qty_available > max_stock)    return 'OVERSTOCK';
  if (qty_available <= safety_stock)                      return 'CRITICAL';
  if (qty_available <= reorder_point)                     return 'REORDER_NEEDED';
  return 'NORMAL';
}

const STATUS_CFG = {
  NORMAL:         { label: 'Stock normal',          badge: 'bg-emerald-100 text-emerald-700 border border-emerald-200', dot: 'bg-emerald-500' },
  REORDER_NEEDED: { label: 'Réappro. nécessaire',   badge: 'bg-orange-100 text-orange-700 border border-orange-200',   dot: 'bg-orange-500'  },
  CRITICAL:       { label: 'Critique — urgent',     badge: 'bg-red-100 text-red-700 border border-red-200',            dot: 'bg-red-500'     },
  OVERSTOCK:      { label: 'Surstock',              badge: 'bg-blue-100 text-blue-700 border border-blue-200',         dot: 'bg-blue-500'    },
  INACTIVE:       { label: 'Règle inactive',        badge: 'bg-slate-100 text-slate-400 border border-slate-200',      dot: 'bg-slate-300'   },
  NO_RULE:        { label: 'Non configuré',         badge: 'bg-slate-100 text-slate-400 border border-slate-200',      dot: 'bg-slate-300'   },
  NO_LEVEL:       { label: 'Pas de stock enreg.',   badge: 'bg-slate-100 text-slate-400 border border-slate-200',      dot: 'bg-slate-300'   },
};

const TABS = [
  { key: 'ALL',            label: 'Tout' },
  { key: 'CRITICAL',       label: 'Critique' },
  { key: 'REORDER_NEEDED', label: 'Réappro. nécessaire' },
  { key: 'OVERSTOCK',      label: 'Surstock' },
  { key: 'NORMAL',         label: 'Normal' },
  { key: 'NO_RULE',        label: 'Non configuré' },
];

function exportCSV(rows) {
  const headers = [
    'SKU Code','EAN13','Nom FR','Nom AR','Catégorie','Stock disponible',
    'Stock de sécurité','Seuil réappro.','Qté de commande','Stock max','Délai fournisseur (j)',
    'Méthode valorisation','Fournisseur préféré','Règle active','Statut',
  ];
  const lines = rows.map((r) => {
    const art = r.sku?.article;
    return [
      art?.sku_code ?? '',
      art?.ean13 ?? '',
      art?.name_fr ?? '',
      art?.name_ar ?? '',
      art?.category?.name_fr ?? '',
      r.qty_available,
      r.safety_stock,
      r.reorder_point,
      r.economic_qty,
      r.max_stock ?? '∞',
      r.lead_time_days,
      r.costing_method?.code ?? '',
      r.preferred_supplier?.name_fr ?? '',
      r.is_active ? 'Oui' : 'Non',
      STATUS_CFG[calcStatus(r)]?.label ?? '',
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });
  const csv  = [headers.join(','), ...lines].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'regles_reapprovisionnement.csv'; a.click();
  URL.revokeObjectURL(url);
}

// ─── Build diff for confirmation modal ────────────────────────────────────────
function buildDiff(row, draft, costingMethods, suppliers) {
  const changes = [];
  if (Number(draft.safety_stock) !== row.safety_stock)
    changes.push({ field: 'Stock de sécurité', before: String(row.safety_stock), after: draft.safety_stock });
  if (Number(draft.reorder_point) !== row.reorder_point)
    changes.push({ field: 'Seuil de réapprovisionnement', before: String(row.reorder_point), after: draft.reorder_point });
  if (Number(draft.economic_qty) !== row.economic_qty)
    changes.push({ field: 'Quantité de commande optimale', before: String(row.economic_qty), after: draft.economic_qty });
  const draftMax = draft.max_stock === '' ? null : Number(draft.max_stock);
  if (draftMax !== row.max_stock)
    changes.push({ field: 'Stock maximum', before: row.max_stock == null ? '∞ (illimité)' : String(row.max_stock), after: draftMax == null ? '∞ (illimité)' : String(draftMax) });
  if (parseInt(draft.lead_time_days, 10) !== row.lead_time_days)
    changes.push({ field: 'Délai fournisseur', before: `${row.lead_time_days} jour(s)`, after: `${draft.lead_time_days} jour(s)` });
  if (draft.costing_method_id !== row.costing_method_id) {
    const fromM = costingMethods.find((m) => m.id === row.costing_method_id);
    const toM   = costingMethods.find((m) => m.id === draft.costing_method_id);
    changes.push({ field: 'Méthode de valorisation', before: fromM?.code ?? '—', after: toM?.code ?? '—' });
  }
  const draftSuppId = draft.preferred_supplier_id || null;
  if (draftSuppId !== row.preferred_supplier_id) {
    const fromS = suppliers.find((s) => s.id === row.preferred_supplier_id);
    const toS   = suppliers.find((s) => s.id === draftSuppId);
    changes.push({ field: 'Fournisseur préféré', before: fromS?.name_fr ?? '— Aucun —', after: toS?.name_fr ?? '— Aucun —' });
  }
  if (draft.is_active !== row.is_active)
    changes.push({ field: 'Règle active', before: row.is_active ? 'Oui' : 'Non', after: draft.is_active ? 'Oui' : 'Non' });
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
            <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
              <Icon d={PATHS.save} className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-base">Récapitulatif des modifications</h2>
              <p className="text-xs text-slate-500">{changes.length} article{changes.length > 1 ? 's' : ''} modifié{changes.length > 1 ? 's' : ''} — vérifiez avant de valider</p>
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
                <div className="px-4 py-2">
                  {diff.map((c) => (
                    <div key={c.field} className="flex items-center gap-3 py-1.5 border-b border-slate-50 last:border-0">
                      <span className="text-xs text-slate-500 w-52 flex-shrink-0">{c.field}</span>
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

        {error && <div className="mx-6 mb-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs">{error}</div>}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between flex-shrink-0">
          <button onClick={onCancel} disabled={saving}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition disabled:opacity-50">
            Continuer à modifier
          </button>
          <button onClick={onConfirm} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50">
            <Icon d={saving ? PATHS.refresh : PATHS.check} className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
            {saving ? 'Sauvegarde en cours…' : `Valider les ${changes.length} modification${changes.length > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Row component ────────────────────────────────────────────────────────────
function RuleRow({ row, draft, onDraftChange, editMode, costingMethods, suppliers }) {
  const defaultDraft = () => ({
    safety_stock:          String(row.safety_stock),
    reorder_point:         String(row.reorder_point),
    economic_qty:          String(row.economic_qty),
    max_stock:             row.max_stock !== null ? String(row.max_stock) : '',
    lead_time_days:        String(row.lead_time_days),
    costing_method_id:     row.costing_method_id ?? (costingMethods[0]?.id ?? ''),
    preferred_supplier_id: row.preferred_supplier_id ?? '',
    is_active:             row.is_active,
  });

  const cur   = draft ?? defaultDraft();
  const dirty = draft !== null;

  const set = (field, val) =>
    onDraftChange({ ...(draft ?? defaultDraft()), [field]: val });

  const art = row.sku?.article;
  const img = row.sku?.images?.[0]?.url ?? art?.images?.[0]?.url;

  const liveRow = {
    ...row,
    safety_stock:  Number(cur.safety_stock),
    reorder_point: Number(cur.reorder_point),
    max_stock:     cur.max_stock === '' ? null : Number(cur.max_stock),
    is_active:     cur.is_active,
  };
  const status = calcStatus(liveRow);
  const st     = STATUS_CFG[status];

  const inp = 'w-20 text-center border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 tabular-nums';
  const sel = 'border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white text-slate-700 max-w-[130px] truncate';
  const tdCls = 'px-3 py-3 text-center';

  const currentCostingMethod  = costingMethods.find((m) => m.id === cur.costing_method_id);
  const currentSupplier       = suppliers.find((s) => s.id === cur.preferred_supplier_id);

  return (
    <tr className={`hover:bg-slate-50/80 transition-colors ${dirty ? 'bg-indigo-50/40 border-l-4 border-l-indigo-400' : 'border-l-4 border-l-transparent'}`}>
      {/* Article / SKU */}
      <td className="px-4 py-3 min-w-[200px]">
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
            <p className="text-xs text-slate-400">{art?.sku_code}{art?.ean13 && <span className="ml-1 text-slate-300">· {art.ean13}</span>}</p>
            {art?.category && <p className="text-[11px] text-indigo-400">{art.category.name_fr}</p>}
          </div>
        </div>
      </td>

      {/* Stock disponible (readonly) */}
      <td className={tdCls}>
        <span className={`text-sm font-bold tabular-nums ${
          status === 'CRITICAL' ? 'text-red-600' :
          status === 'REORDER_NEEDED' ? 'text-orange-600' :
          status === 'OVERSTOCK' ? 'text-blue-600' : 'text-emerald-600'
        }`}>{row.qty_available.toLocaleString('fr-FR')}</span>
        <p className="text-[10px] text-slate-400 mt-0.5">unités</p>
      </td>

      {/* Stock de sécurité */}
      <td className={tdCls}>
        {editMode
          ? <input type="number" min="0" step="1" value={cur.safety_stock} onChange={(e) => set('safety_stock', e.target.value)} className={inp} />
          : <span className="text-sm font-medium tabular-nums text-slate-700">{row.safety_stock.toLocaleString('fr-FR')}</span>
        }
      </td>

      {/* Seuil de réapprovisionnement */}
      <td className={tdCls}>
        {editMode
          ? <input type="number" min="0" step="1" value={cur.reorder_point} onChange={(e) => set('reorder_point', e.target.value)} className={inp} />
          : <span className="text-sm font-medium tabular-nums text-slate-700">{row.reorder_point.toLocaleString('fr-FR')}</span>
        }
      </td>

      {/* Quantité de commande optimale */}
      <td className={tdCls}>
        {editMode
          ? <input type="number" min="0" step="1" value={cur.economic_qty} onChange={(e) => set('economic_qty', e.target.value)} className={inp} />
          : <span className="text-sm font-medium tabular-nums text-slate-700">{row.economic_qty.toLocaleString('fr-FR')}</span>
        }
      </td>

      {/* Stock maximum */}
      <td className={tdCls}>
        {editMode ? (
          <input type="number" min="0" step="1" value={cur.max_stock} placeholder="∞"
            onChange={(e) => set('max_stock', e.target.value)}
            className={`${inp} placeholder:text-slate-300`} />
        ) : (
          <span className={`text-sm tabular-nums font-medium ${row.max_stock == null ? 'text-slate-400 italic' : 'text-slate-700'}`}>
            {row.max_stock == null ? '∞' : row.max_stock.toLocaleString('fr-FR')}
          </span>
        )}
      </td>

      {/* Délai fournisseur */}
      <td className={tdCls}>
        {editMode ? (
          <div className="flex items-center justify-center gap-1">
            <input type="number" min="0" step="1" value={cur.lead_time_days}
              onChange={(e) => set('lead_time_days', e.target.value)}
              className="w-14 text-center border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 tabular-nums" />
            <span className="text-xs text-slate-400">j</span>
          </div>
        ) : (
          <span className="text-sm tabular-nums text-slate-700">{row.lead_time_days} j</span>
        )}
      </td>

      {/* Méthode de valorisation */}
      <td className={tdCls}>
        {editMode ? (
          <select value={cur.costing_method_id} onChange={(e) => set('costing_method_id', e.target.value)} className={sel}>
            {costingMethods.map((m) => <option key={m.id} value={m.id}>{m.code}</option>)}
          </select>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-medium">
            {currentCostingMethod?.code ?? row.costing_method?.code ?? '—'}
          </span>
        )}
      </td>

      {/* Fournisseur préféré */}
      <td className={tdCls}>
        {editMode ? (
          <select value={cur.preferred_supplier_id} onChange={(e) => set('preferred_supplier_id', e.target.value)} className={sel}>
            <option value="">— Aucun —</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name_fr}</option>)}
          </select>
        ) : (
          <span className="text-sm text-slate-600">
            {currentSupplier?.name_fr ?? row.preferred_supplier?.name_fr ?? <span className="text-slate-300 italic">Aucun</span>}
          </span>
        )}
      </td>

      {/* Règle active */}
      <td className={tdCls}>
        {editMode ? (
          <button onClick={() => set('is_active', !cur.is_active)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${cur.is_active ? 'bg-indigo-500' : 'bg-slate-300'}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${cur.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        ) : (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
            cur.is_active ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-50 text-slate-500 border-slate-200'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cur.is_active ? 'bg-indigo-500' : 'bg-slate-300'}`} />
            {cur.is_active ? 'Active' : 'Inactive'}
          </span>
        )}
      </td>

      {/* Statut de stock */}
      <td className={tdCls}>
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${st.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${st.dot}`} />
          {st.label}
        </span>
      </td>

      {/* Indicateur de modification */}
      <td className={tdCls}>
        {dirty ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 border border-indigo-200">
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
export default function ReorderRulesPage() {
  const [nodes, setNodes]               = useState([]);
  const [nodeId, setNodeId]             = useState('');
  const [rows, setRows]                 = useState([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [costingMethods, setCostingMethods] = useState([]);
  const [suppliers, setSuppliers]       = useState([]);
  const [drafts, setDrafts]             = useState({});
  const [editMode, setEditMode]         = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [confirmSaving, setConfirmSaving] = useState(false);
  const [confirmError, setConfirmError]   = useState('');
  const [successMsg, setSuccessMsg]     = useState('');

  const [search, setSearch]             = useState('');
  const [tab, setTab]                   = useState('ALL');
  const [filterCat, setFilterCat]       = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [showFilters, setShowFilters]   = useState(false);
  const [page, setPage]                 = useState(1);
  const [pageSize, setPageSize]         = useState(20);

  useEffect(() => {
    Promise.all([
      getNodes({ all: true }),
      getReorderRuleRefs(),
    ]).then(([nodesRes, refsRes]) => {
      setNodes(nodesRes.data?.data ?? []);
      const refs = refsRes.data?.data ?? {};
      setCostingMethods(refs.costing_methods ?? []);
      setSuppliers(refs.suppliers ?? []);
    }).catch(() => {});
  }, []);

  const load = useCallback(async (nid = nodeId) => {
    if (!nid) return;
    setLoading(true); setError('');
    try {
      const res = await getReorderRules({ node_id: nid });
      setRows(res.data?.data ?? []);
      setDrafts({}); setPage(1);
    } catch (e) {
      setError(e.response?.data?.message ?? e.message ?? 'Erreur de chargement');
    } finally { setLoading(false); }
  }, [nodeId]);

  const handleNodeChange = (id) => {
    setNodeId(id); setRows([]); setDrafts({});
    setSearch(''); setTab('ALL'); setFilterCat(''); setFilterSupplier(''); setPage(1);
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

  // Enriched rows
  const enriched = useMemo(() => rows.map((r) => {
    const d = drafts[r.sku_id];
    const live = d ? {
      ...r,
      safety_stock:  Number(d.safety_stock),
      reorder_point: Number(d.reorder_point),
      max_stock:     d.max_stock === '' ? null : Number(d.max_stock),
      is_active:     d.is_active,
    } : r;
    return { ...live, _status: calcStatus(live) };
  }), [rows, drafts]);

  // Stats
  const stats = useMemo(() => ({
    total:    enriched.length,
    critical: enriched.filter((r) => r._status === 'CRITICAL').length,
    reorder:  enriched.filter((r) => r._status === 'REORDER_NEEDED').length,
    over:     enriched.filter((r) => r._status === 'OVERSTOCK').length,
    normal:   enriched.filter((r) => r._status === 'NORMAL').length,
  }), [enriched]);

  // Filtered list
  const filtered = useMemo(() => {
    let list = enriched;
    if (tab !== 'ALL')     list = list.filter((r) => r._status === tab);
    if (filterCat)         list = list.filter((r) => r.sku?.article?.category?.id === filterCat);
    if (filterSupplier)    list = list.filter((r) => r.preferred_supplier_id === filterSupplier);
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
  }, [enriched, tab, filterCat, filterSupplier, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated  = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);
  const tabCount   = (key) => key === 'ALL' ? enriched.length : enriched.filter((r) => r._status === key).length;
  const dirtyCount = Object.values(drafts).filter(Boolean).length;

  // Changes for confirmation modal
  const confirmChanges = useMemo(() =>
    enriched
      .filter((r) => drafts[r.sku_id] != null)
      .map((r) => ({
        row:  r,
        diff: buildDiff(rows.find((x) => x.sku_id === r.sku_id) ?? r, drafts[r.sku_id], costingMethods, suppliers),
      }))
      .filter((c) => c.diff.length > 0),
  [enriched, drafts, rows, costingMethods, suppliers]);

  const handleSaveClick = () => { setConfirmError(''); setShowConfirm(true); };

  const handleConfirmSave = async () => {
    const dirtyRows = enriched.filter((r) => drafts[r.sku_id] != null);
    if (!dirtyRows.length) return;
    setConfirmSaving(true); setConfirmError('');
    try {
      const payload = dirtyRows.map((r) => {
        const d = drafts[r.sku_id];
        return {
          node_id:               nodeId,
          sku_id:                r.sku_id,
          safety_stock:          Number(d.safety_stock),
          reorder_point:         Number(d.reorder_point),
          economic_qty:          Number(d.economic_qty),
          max_stock:             d.max_stock === '' ? null : Number(d.max_stock),
          lead_time_days:        parseInt(d.lead_time_days, 10),
          costing_method_id:     d.costing_method_id,
          preferred_supplier_id: d.preferred_supplier_id || null,
          is_active:             d.is_active,
        };
      });
      await bulkSaveReorderRules(payload);
      setSuccessMsg(`${dirtyRows.length} règle(s) de réapprovisionnement sauvegardée(s)`);
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
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
              <Icon d={PATHS.truck} className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">Règles de réapprovisionnement</h1>
              <p className="text-sm text-slate-500">Seuils de stock, fournisseurs et méthodes de valorisation par entrepôt × SKU</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <select value={nodeId} onChange={(e) => handleNodeChange(e.target.value)}
                className="appearance-none border border-slate-200 rounded-xl px-4 py-2 pr-8 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer">
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

            {rows.length > 0 && !editMode && (
              <button onClick={handleActivateEdit}
                className="flex items-center gap-2 bg-indigo-600 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-indigo-700 transition">
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
                    className="flex items-center gap-2 bg-indigo-600 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-indigo-700 transition">
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
          <Icon d={PATHS.truck} className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Sélectionnez un entrepôt pour gérer les règles de réapprovisionnement</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-24">
          <Icon d={PATHS.refresh} className="w-7 h-7 animate-spin text-slate-300" />
        </div>
      )}

      {/* Edit mode banner */}
      {editMode && rows.length > 0 && (
        <div className="mb-4 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-indigo-700">
            <Icon d={PATHS.pencil} className="w-4 h-4" />
            <strong>Mode modification activé</strong>
            {dirtyCount > 0
              ? <span>— <strong>{dirtyCount}</strong> ligne{dirtyCount > 1 ? 's' : ''} modifiée{dirtyCount > 1 ? 's' : ''}</span>
              : <span>— Cliquez sur une cellule pour modifier sa valeur</span>
            }
          </div>
          {dirtyCount > 0 && (
            <button onClick={handleSaveClick}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition">
              <Icon d={PATHS.save} className="w-3.5 h-3.5" />
              Sauvegarder les modifications ({dirtyCount})
            </button>
          )}
        </div>
      )}

      {nodeId && !loading && rows.length > 0 && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
            {[
              { label: 'Total',            value: stats.total,    color: 'slate',   icon: PATHS.package },
              { label: 'Critique',         value: stats.critical, color: 'red',     icon: PATHS.alert   },
              { label: 'Réappro. urgent',  value: stats.reorder,  color: 'orange',  icon: PATHS.truck   },
              { label: 'Surstock',         value: stats.over,     color: 'blue',    icon: PATHS.trend   },
              { label: 'Normal',           value: stats.normal,   color: 'emerald', icon: PATHS.check   },
            ].map(({ label, value, color, icon }) => {
              const C = {
                slate:   'bg-slate-50   border-slate-200   text-slate-600',
                red:     'bg-red-50     border-red-200     text-red-600',
                orange:  'bg-orange-50  border-orange-200  text-orange-600',
                blue:    'bg-blue-50    border-blue-200    text-blue-600',
                emerald: 'bg-emerald-50 border-emerald-200 text-emerald-600',
              }[color];
              return (
                <div key={label} className={`rounded-xl border p-3 flex items-center gap-3 ${C}`}>
                  <Icon d={icon} className="w-4 h-4" />
                  <div>
                    <p className="text-xs font-medium opacity-70">{label}</p>
                    <p className="text-xl font-bold tabular-nums">{value}</p>
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
                    className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
                <button onClick={() => setShowFilters((v) => !v)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition ${showFilters || filterCat || filterSupplier ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  <Icon d={PATHS.filter} className="w-3.5 h-3.5" />
                  Filtres
                  {(filterCat || filterSupplier) && <span className="bg-indigo-600 text-white text-[10px] rounded-full px-1.5 py-0.5">{[filterCat, filterSupplier].filter(Boolean).length}</span>}
                </button>
              </div>

              {showFilters && (
                <div className="flex flex-wrap gap-3 pb-1">
                  <select value={filterCat} onChange={(e) => { setFilterCat(e.target.value); setPage(1); }}
                    className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                    <option value="">Toutes les catégories</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name_fr}</option>)}
                  </select>
                  <select value={filterSupplier} onChange={(e) => { setFilterSupplier(e.target.value); setPage(1); }}
                    className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                    <option value="">Tous les fournisseurs</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name_fr}</option>)}
                  </select>
                  {(filterCat || filterSupplier) && (
                    <button onClick={() => { setFilterCat(''); setFilterSupplier(''); }}
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
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${tab === t.key ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                      {t.label}
                      {cnt > 0 && <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${tab === t.key ? 'bg-white/20' : 'bg-slate-200'}`}>{cnt}</span>}
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
                    <th className="text-left px-4 py-3 font-semibold">Article / SKU</th>
                    <th className="text-center px-3 py-3 font-semibold">
                      Stock disponible
                      <div className="font-normal normal-case text-[10px] text-slate-400 tracking-normal">Qté en stock actuelle</div>
                    </th>
                    <th className="text-center px-3 py-3 font-semibold">
                      Stock de sécurité
                      <div className="font-normal normal-case text-[10px] text-slate-400 tracking-normal">Seuil critique absolu</div>
                    </th>
                    <th className="text-center px-3 py-3 font-semibold">
                      Seuil de réappro.
                      <div className="font-normal normal-case text-[10px] text-slate-400 tracking-normal">Niveau déclenchant la commande</div>
                    </th>
                    <th className="text-center px-3 py-3 font-semibold">
                      Qté de commande
                      <div className="font-normal normal-case text-[10px] text-slate-400 tracking-normal">Quantité optimale à commander</div>
                    </th>
                    <th className="text-center px-3 py-3 font-semibold">
                      Stock maximum
                      <div className="font-normal normal-case text-[10px] text-slate-400 tracking-normal">Limite supérieure (vide = ∞)</div>
                    </th>
                    <th className="text-center px-3 py-3 font-semibold">
                      Délai fournisseur
                      <div className="font-normal normal-case text-[10px] text-slate-400 tracking-normal">Jours pour recevoir la commande</div>
                    </th>
                    <th className="text-center px-3 py-3 font-semibold">
                      Valorisation
                      <div className="font-normal normal-case text-[10px] text-slate-400 tracking-normal">FIFO / LIFO / Prix moyen…</div>
                    </th>
                    <th className="text-center px-3 py-3 font-semibold">
                      Fournisseur préféré
                      <div className="font-normal normal-case text-[10px] text-slate-400 tracking-normal">Par défaut pour ce SKU</div>
                    </th>
                    <th className="text-center px-3 py-3 font-semibold">
                      Règle active
                      <div className="font-normal normal-case text-[10px] text-slate-400 tracking-normal">Activer / désactiver</div>
                    </th>
                    <th className="text-center px-3 py-3 font-semibold">Statut de stock</th>
                    <th className="text-center px-3 py-3 font-semibold">{editMode ? 'Modification' : ''}</th>
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
                      costingMethods={costingMethods}
                      suppliers={suppliers}
                    />
                  ))}
                </tbody>
              </table>

              {filtered.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  <Icon d={PATHS.truck} className="w-8 h-8 mx-auto mb-2 opacity-30" />
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
                        className={`w-7 h-7 rounded-lg text-xs font-medium transition ${page === p ? 'bg-indigo-600 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
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
