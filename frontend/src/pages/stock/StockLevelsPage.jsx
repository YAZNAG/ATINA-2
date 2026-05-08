import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Package, Search, RefreshCw, AlertTriangle, TrendingDown,
  CheckCircle, ArrowUpCircle, Settings, X, ChevronDown,
} from 'lucide-react';
import { getStockLevels, adjustStockLevel, getMoveTypesList } from '../../api/stock.api';
import { getNodes } from '../../api/locationNode.api';

// ─── Status ──────────────────────────────────────────────────────────────────
const STATUS = {
  NONE: {
    label: 'Non configuré', dot: 'bg-slate-300',
    badge: 'bg-slate-100 text-slate-500 border border-slate-200',
    row: '',
  },
  OUT: {
    label: 'Rupture', dot: 'bg-red-500',
    badge: 'bg-red-100 text-red-700 border border-red-200',
    row: 'border-l-4 border-l-red-500 bg-red-50/60',
  },
  LOW: {
    label: 'Stock faible', dot: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-700 border border-amber-200',
    row: 'border-l-4 border-l-amber-400 bg-amber-50/50',
  },
  BACK: {
    label: 'Backcommande', dot: 'bg-purple-500',
    badge: 'bg-purple-100 text-purple-700 border border-purple-200',
    row: 'border-l-4 border-l-purple-400 bg-purple-50/40',
  },
  OK: {
    label: 'Normal', dot: 'bg-emerald-500',
    badge: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    row: 'border-l-4 border-l-emerald-400',
  },
  OVER: {
    label: 'Surstock', dot: 'bg-blue-500',
    badge: 'bg-blue-100 text-blue-700 border border-blue-200',
    row: 'border-l-4 border-l-blue-400 bg-blue-50/40',
  },
};

function calcStatus(row) {
  const { qty_available, qty_backordered, threshold_rule } = row;
  if (qty_backordered > 0) return 'BACK';
  if (!threshold_rule) return qty_available <= 0 ? 'OUT' : 'NONE';
  const { stock_minimum, stock_alert_threshold, stock_maximum } = threshold_rule;
  const min   = Number(stock_minimum ?? 0);
  const alert = Number(stock_alert_threshold ?? 0);
  const max   = Number(stock_maximum ?? 0);
  if (qty_available <= 0)     return 'OUT';
  if (qty_available < min)    return 'OUT';
  if (qty_available <= alert) return 'LOW';
  if (max > 0 && qty_available > max) return 'OVER';
  return 'OK';
}

// ─── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color }) {
  const colors = {
    slate:  'bg-slate-50  border-slate-200  text-slate-600',
    red:    'bg-red-50    border-red-200    text-red-600',
    amber:  'bg-amber-50  border-amber-200  text-amber-600',
    emerald:'bg-emerald-50 border-emerald-200 text-emerald-600',
    purple: 'bg-purple-50 border-purple-200 text-purple-600',
    blue:   'bg-blue-50   border-blue-200   text-blue-600',
  };
  return (
    <div className={`rounded-xl border p-4 flex items-center gap-3 ${colors[color]}`}>
      <Icon size={20} />
      <div>
        <p className="text-xs font-medium opacity-70">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </div>
  );
}

// ─── Qty Cell ────────────────────────────────────────────────────────────────
function QtyCell({ value, color = 'slate' }) {
  const colors = {
    slate:  'text-slate-700',
    red:    'text-red-600 font-semibold',
    amber:  'text-amber-600 font-semibold',
    emerald:'text-emerald-600 font-semibold',
    purple: 'text-purple-600 font-semibold',
    blue:   'text-blue-600 font-semibold',
  };
  return (
    <span className={`text-sm tabular-nums ${colors[color]}`}>
      {value.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })}
    </span>
  );
}

// ─── Adjust Modal ────────────────────────────────────────────────────────────
function AdjustModal({ row, moveTypes, onClose, onSaved }) {
  const [qty, setQty]         = useState(String(row.qty_physical));
  const [typeId, setTypeId]   = useState('');
  const [ref, setRef]         = useState('');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  const article = row.sku?.article;

  const save = async () => {
    const parsed = Number(qty);
    if (isNaN(parsed) || parsed < 0) { setError('Quantité invalide'); return; }
    setSaving(true);
    setError('');
    try {
      await adjustStockLevel({
        node_id:      row.node_id,
        sku_id:       row.sku_id,
        qty_physical: parsed,
        move_type_id: typeId || undefined,
        reference:    ref || undefined,
      });
      onSaved();
    } catch (e) {
      setError(e.response?.data?.message ?? 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-slate-800">Ajustement de stock</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              {article?.name_fr} — {article?.sku_code}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Current vs new */}
          <div className="bg-slate-50 rounded-lg p-3 flex gap-6 text-sm">
            <div>
              <p className="text-slate-500 text-xs">Physique actuel</p>
              <p className="font-semibold text-slate-800">{row.qty_physical}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Réservé</p>
              <p className="font-semibold text-slate-700">{row.qty_reserved}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Disponible actuel</p>
              <p className="font-semibold text-emerald-600">{row.qty_available}</p>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">
              Nouvelle quantité physique
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {moveTypes.length > 0 && (
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">
                Type de mouvement
              </label>
              <select
                value={typeId}
                onChange={(e) => setTypeId(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              >
                <option value="">— Aucun —</option>
                {moveTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name_fr}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">
              Référence / motif
            </label>
            <input
              type="text"
              placeholder="Inventaire 05/2026..."
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Preview */}
          {!isNaN(Number(qty)) && Number(qty) >= 0 && (
            <div className="bg-emerald-50 rounded-lg p-3 text-sm border border-emerald-100">
              <span className="text-emerald-700">
                Nouveau disponible :{' '}
                <strong>{Math.max(0, Number(qty) - row.qty_reserved)}</strong>
                {Number(qty) !== row.qty_physical && (
                  <span className="text-slate-500 ml-2">
                    (delta: {Number(qty) - row.qty_physical > 0 ? '+' : ''}
                    {Number(qty) - row.qty_physical})
                  </span>
                )}
              </span>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={onClose}
            className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2 text-sm
                       hover:bg-slate-50 transition"
          >
            Annuler
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-sm
                       font-medium transition disabled:opacity-50"
          >
            {saving ? 'Sauvegarde…' : 'Confirmer l\'ajustement'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'ALL',  label: 'Tout' },
  { key: 'OUT',  label: 'Rupture' },
  { key: 'BACK', label: 'Backcommande' },
  { key: 'LOW',  label: 'Stock faible' },
  { key: 'OK',   label: 'Normal' },
  { key: 'OVER', label: 'Surstock' },
  { key: 'NONE', label: 'Non configuré' },
];

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function StockLevelsPage() {
  const [nodes, setNodes]         = useState([]);
  const [nodeId, setNodeId]       = useState('');
  const [rows, setRows]           = useState([]);
  const [moveTypes, setMoveTypes] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [search, setSearch]       = useState('');
  const [tab, setTab]             = useState('ALL');
  const [adjustRow, setAdjustRow] = useState(null);

  // Load nodes & move types once
  useEffect(() => {
    getNodes({ all: true }).then((r) => setNodes(r.data?.data ?? [])).catch(() => {});
    getMoveTypesList().then((r) => setMoveTypes(r.data?.data ?? [])).catch(() => {});
  }, []);

  const load = useCallback(async (nid = nodeId) => {
    if (!nid) return;
    setLoading(true);
    setError('');
    try {
      const res = await getStockLevels(nid);
      setRows(res.data?.data ?? []);
    } catch (e) {
      setError(e.response?.data?.message ?? 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [nodeId]);

  const handleNodeChange = (id) => {
    setNodeId(id);
    setRows([]);
    setSearch('');
    setTab('ALL');
    if (id) load(id);
  };

  // Computed rows with status
  const enriched = useMemo(
    () => rows.map((r) => ({ ...r, _status: calcStatus(r) })),
    [rows],
  );

  // Stats
  const stats = useMemo(() => ({
    total:  enriched.length,
    out:    enriched.filter((r) => r._status === 'OUT').length,
    low:    enriched.filter((r) => r._status === 'LOW').length,
    back:   enriched.filter((r) => r._status === 'BACK').length,
    ok:     enriched.filter((r) => r._status === 'OK').length,
    over:   enriched.filter((r) => r._status === 'OVER').length,
    none:   enriched.filter((r) => r._status === 'NONE').length,
  }), [enriched]);

  // Filter
  const filtered = useMemo(() => {
    let list = enriched;
    if (tab !== 'ALL') list = list.filter((r) => r._status === tab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) => {
        const a = r.sku?.article;
        return (
          a?.name_fr?.toLowerCase().includes(q) ||
          a?.sku_code?.toLowerCase().includes(q) ||
          a?.ean13?.toLowerCase().includes(q)
        );
      });
    }
    return list;
  }, [enriched, tab, search]);

  const tabCount = (key) => {
    if (key === 'ALL') return enriched.length;
    return enriched.filter((r) => r._status === key).length;
  };

  const getQtyColor = (row, field) => {
    if (field === 'qty_available') {
      if (row.qty_available <= 0)         return 'red';
      if (row._status === 'LOW')          return 'amber';
      if (row._status === 'OVER')         return 'blue';
      return 'emerald';
    }
    if (field === 'qty_backordered' && row.qty_backordered > 0) return 'purple';
    if (field === 'qty_incoming'    && row.qty_incoming    > 0) return 'blue';
    return 'slate';
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl px-6 py-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <Package size={20} className="text-emerald-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">Niveaux de stock</h1>
              <p className="text-sm text-slate-500">Suivi des quantités par entrepôt</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Node selector */}
            <div className="relative">
              <select
                value={nodeId}
                onChange={(e) => handleNodeChange(e.target.value)}
                className="appearance-none border border-slate-200 rounded-xl px-4 py-2 pr-8 text-sm
                           bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400
                           cursor-pointer"
              >
                <option value="">— Sélectionner un entrepôt —</option>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>{n.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {nodeId && (
              <button
                onClick={() => load()}
                disabled={loading}
                className="flex items-center gap-2 border border-slate-200 rounded-xl px-4 py-2 text-sm
                           text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                Actualiser
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {!nodeId && (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400">
          <Package size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Sélectionnez un entrepôt pour afficher les niveaux de stock</p>
        </div>
      )}

      {nodeId && !loading && rows.length > 0 && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <StatCard icon={Package}       label="Total articles" value={stats.total} color="slate"   />
            <StatCard icon={CheckCircle}   label="Normal"         value={stats.ok}    color="emerald" />
            <StatCard icon={AlertTriangle} label="Rupture"        value={stats.out}   color="red"     />
            <StatCard icon={TrendingDown}  label="Stock faible"   value={stats.low}   color="amber"   />
            <StatCard icon={ArrowUpCircle} label="Backcommande"   value={stats.back}  color="purple"  />
            <StatCard icon={ArrowUpCircle} label="Surstock"       value={stats.over}  color="blue"    />
          </div>

          {/* Search + Tabs */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex flex-col sm:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher un article..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg
                             focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>

              {/* Tabs */}
              <div className="flex gap-1 flex-wrap">
                {TABS.map((t) => {
                  const cnt = tabCount(t.key);
                  return (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                        tab === t.key
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {t.label}
                      {cnt > 0 && (
                        <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                          tab === t.key ? 'bg-white/20' : 'bg-slate-200'
                        }`}>{cnt}</span>
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
                    <th className="text-left px-4 py-3 font-medium">Article</th>
                    <th className="text-center px-3 py-3 font-medium">Physique</th>
                    <th className="text-center px-3 py-3 font-medium">Réservé</th>
                    <th className="text-center px-3 py-3 font-medium">Disponible</th>
                    <th className="text-center px-3 py-3 font-medium">Backcommande</th>
                    <th className="text-center px-3 py-3 font-medium">Attendu</th>
                    <th className="text-center px-3 py-3 font-medium">COD flottant</th>
                    <th className="text-center px-3 py-3 font-medium">Statut</th>
                    <th className="text-center px-3 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map((row) => {
                    const st  = STATUS[row._status];
                    const art = row.sku?.article;
                    const img = row.sku?.images?.[0]?.url ?? art?.images?.[0]?.url;
                    return (
                      <tr
                        key={row.sku_id}
                        className={`hover:bg-slate-50/80 transition-colors ${st.row}`}
                      >
                        {/* Article */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0">
                              {img
                                ? <img src={img} alt="" className="w-full h-full object-cover" />
                                : <div className="w-full h-full flex items-center justify-center text-slate-300">
                                    <Package size={14} />
                                  </div>
                              }
                            </div>
                            <div>
                              <p className="font-medium text-slate-800 text-sm leading-tight">
                                {art?.name_fr}
                              </p>
                              <p className="text-xs text-slate-400">
                                {art?.sku_code}
                                {art?.ean13 && <span className="ml-1 text-slate-300">· {art.ean13}</span>}
                              </p>
                              {art?.category && (
                                <p className="text-[11px] text-slate-400">{art.category.name_fr}</p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Quantities */}
                        <td className="px-3 py-3 text-center">
                          <QtyCell value={row.qty_physical} color="slate" />
                        </td>
                        <td className="px-3 py-3 text-center">
                          <QtyCell value={row.qty_reserved} color={row.qty_reserved > 0 ? 'amber' : 'slate'} />
                        </td>
                        <td className="px-3 py-3 text-center">
                          <QtyCell value={row.qty_available} color={getQtyColor(row, 'qty_available')} />
                        </td>
                        <td className="px-3 py-3 text-center">
                          <QtyCell value={row.qty_backordered} color={getQtyColor(row, 'qty_backordered')} />
                        </td>
                        <td className="px-3 py-3 text-center">
                          <QtyCell value={row.qty_incoming} color={getQtyColor(row, 'qty_incoming')} />
                        </td>
                        <td className="px-3 py-3 text-center">
                          <QtyCell value={row.qty_floating_cod} color="slate" />
                        </td>

                        {/* Status badge */}
                        <td className="px-3 py-3 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${st.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                            {st.label}
                          </span>
                        </td>

                        {/* Adjust */}
                        <td className="px-3 py-3 text-center">
                          <button
                            onClick={() => setAdjustRow(row)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs
                                       border border-slate-200 text-slate-600 hover:bg-slate-100 transition"
                          >
                            <Settings size={11} />
                            Ajuster
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filtered.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  <Package size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Aucun article trouvé</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400">
              {filtered.length} article{filtered.length !== 1 ? 's' : ''} affiché{filtered.length !== 1 ? 's' : ''}
              {rows.length !== filtered.length && ` sur ${rows.length}`}
            </div>
          </div>
        </>
      )}

      {loading && (
        <div className="flex items-center justify-center py-24">
          <RefreshCw size={28} className="animate-spin text-slate-300" />
        </div>
      )}

      {/* Adjust modal */}
      {adjustRow && (
        <AdjustModal
          row={adjustRow}
          moveTypes={moveTypes}
          onClose={() => setAdjustRow(null)}
          onSaved={() => { setAdjustRow(null); load(); }}
        />
      )}
    </div>
  );
}
