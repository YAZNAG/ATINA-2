import { useState, useEffect, useCallback, useMemo } from 'react';
import { getSellingRules, upsertSellingRule, updateSellingRule } from '../../api/stock.api';
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
  chevron:  'M19 9l-7 7-7-7',
  filter:   'M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z',
  check:    'M5 13l4 4L19 7',
  x:        'M6 18L18 6M6 6l12 12',
  clock:    'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  tag:      'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z',
  alert:    'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
};

// ─── Status logic ─────────────────────────────────────────────────────────────
function calcStatus(row) {
  const { qty_available, is_backorderable, backorder_limit, backordered_quantity } = row;
  if (!row.has_stock_level) return 'NO_LEVEL';
  if (qty_available > 0)    return 'AVAILABLE';
  if (!is_backorderable)    return 'OUT_NO_BACK';
  if (backorder_limit > 0 && backordered_quantity >= backorder_limit) return 'LIMIT_REACHED';
  return 'BACKORDER_OPEN';
}

const STATUS_CFG = {
  AVAILABLE:    { label: 'Disponible',         badge: 'bg-emerald-100 text-emerald-700 border border-emerald-200', dot: 'bg-emerald-500' },
  OUT_NO_BACK:  { label: 'Rupture',            badge: 'bg-red-100 text-red-700 border border-red-200',             dot: 'bg-red-500'     },
  BACKORDER_OPEN:{ label: 'Backorder autorisé',badge: 'bg-purple-100 text-purple-700 border border-purple-200',   dot: 'bg-purple-500'  },
  LIMIT_REACHED:{ label: 'Limite atteinte',    badge: 'bg-orange-100 text-orange-700 border border-orange-200',   dot: 'bg-orange-500'  },
  NO_LEVEL:     { label: 'Non configuré',      badge: 'bg-slate-100 text-slate-500 border border-slate-200',      dot: 'bg-slate-300'   },
};

// ─── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'ALL',           label: 'Tout' },
  { key: 'AVAILABLE',     label: 'Disponible' },
  { key: 'BACKORDER_OPEN',label: 'Backorder autorisé' },
  { key: 'OUT_NO_BACK',   label: 'Rupture' },
  { key: 'LIMIT_REACHED', label: 'Limite atteinte' },
  { key: 'NO_LEVEL',      label: 'Non configuré' },
];

// ─── Row component (inline editing) ──────────────────────────────────────────
function RuleRow({ row, nodeId, onSaved }) {
  const [draft, setDraft]     = useState(null);
  const [saving, setSaving]   = useState(false);
  const [saveErr, setSaveErr] = useState('');

  const cur = draft ?? {
    is_backorderable:     row.is_backorderable,
    backorder_limit:      String(row.backorder_limit),
    estimated_restock_days: String(row.estimated_restock_days),
  };

  const dirty = draft !== null;

  const set = (field, val) => {
    setSaveErr('');
    setDraft((d) => ({
      ...(d ?? {
        is_backorderable:     row.is_backorderable,
        backorder_limit:      String(row.backorder_limit),
        estimated_restock_days: String(row.estimated_restock_days),
      }),
      [field]: val,
    }));
  };

  const cancel = () => { setDraft(null); setSaveErr(''); };

  const save = async () => {
    setSaving(true);
    setSaveErr('');
    try {
      const payload = {
        node_id:              nodeId,
        sku_id:               row.sku_id,
        is_backorderable:     cur.is_backorderable,
        backorder_limit:      Number(cur.backorder_limit),
        estimated_restock_days: parseInt(cur.estimated_restock_days, 10),
      };
      if (row.rule_id) {
        await updateSellingRule(row.rule_id, payload);
      } else {
        await upsertSellingRule(payload);
      }
      setDraft(null);
      onSaved();
    } catch (e) {
      setSaveErr(e.response?.data?.message ?? 'Erreur de sauvegarde');
    } finally { setSaving(false); }
  };

  const art    = row.sku?.article;
  const img    = row.sku?.images?.[0]?.url ?? art?.images?.[0]?.url;
  const status = calcStatus({ ...row, ...cur, backorder_limit: Number(cur.backorder_limit), is_backorderable: cur.is_backorderable });
  const st     = STATUS_CFG[status];

  return (
    <tr className={`hover:bg-slate-50/80 transition-colors ${dirty ? 'bg-blue-50/40 border-l-4 border-l-blue-400' : ''}`}>
      {/* Article */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0">
            {img
              ? <img src={img} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-slate-300"><Icon d={PATHS.package} className="w-3.5 h-3.5" /></div>
            }
          </div>
          <div>
            <p className="font-medium text-slate-800 text-sm leading-tight">{art?.name_fr}</p>
            <p className="text-xs text-slate-400">{art?.sku_code}{art?.ean13 && <span className="ml-1 text-slate-300">· {art.ean13}</span>}</p>
            {art?.category && <p className="text-[11px] text-slate-400">{art.category.name_fr}</p>}
          </div>
        </div>
      </td>

      {/* qty_available */}
      <td className="px-3 py-3 text-center">
        <span className={`text-sm font-semibold tabular-nums ${row.qty_available > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          {row.qty_available.toLocaleString('fr-FR')}
        </span>
      </td>

      {/* is_backorderable toggle */}
      <td className="px-3 py-3 text-center">
        <button
          onClick={() => set('is_backorderable', !cur.is_backorderable)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${cur.is_backorderable ? 'bg-purple-500' : 'bg-slate-300'}`}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${cur.is_backorderable ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
        </button>
      </td>

      {/* backorder_limit */}
      <td className="px-3 py-3 text-center">
        <input
          type="number"
          min="0"
          step="1"
          value={cur.backorder_limit}
          onChange={(e) => set('backorder_limit', e.target.value)}
          className="w-20 text-center border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 tabular-nums"
        />
        {Number(cur.backorder_limit) === 0 && (
          <p className="text-[10px] text-slate-400 mt-0.5">illimité</p>
        )}
      </td>

      {/* backordered_quantity (readonly) */}
      <td className="px-3 py-3 text-center">
        <span className={`text-sm tabular-nums font-semibold ${row.backordered_quantity > 0 ? 'text-purple-600' : 'text-slate-400'}`}>
          {row.backordered_quantity.toLocaleString('fr-FR')}
        </span>
        {Number(cur.backorder_limit) > 0 && row.backordered_quantity > 0 && (
          <div className="w-16 mx-auto mt-1 h-1 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500 rounded-full"
              style={{ width: `${Math.min(100, (row.backordered_quantity / Number(cur.backorder_limit)) * 100)}%` }}
            />
          </div>
        )}
      </td>

      {/* estimated_restock_days */}
      <td className="px-3 py-3 text-center">
        <div className="flex items-center justify-center gap-1">
          <input
            type="number"
            min="0"
            step="1"
            value={cur.estimated_restock_days}
            onChange={(e) => set('estimated_restock_days', e.target.value)}
            className="w-16 text-center border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 tabular-nums"
          />
          <span className="text-xs text-slate-400">j</span>
        </div>
      </td>

      {/* Status */}
      <td className="px-3 py-3 text-center">
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${st.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
          {st.label}
        </span>
      </td>

      {/* Actions */}
      <td className="px-3 py-3 text-center">
        {dirty ? (
          <div className="flex items-center justify-center gap-1">
            <button onClick={save} disabled={saving} title="Enregistrer"
              className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50">
              <Icon d={PATHS.save} className="w-3.5 h-3.5" />
            </button>
            <button onClick={cancel} title="Annuler"
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 transition">
              <Icon d={PATHS.x} className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        )}
        {saveErr && <p className="text-[10px] text-red-500 mt-1 max-w-[120px] mx-auto">{saveErr}</p>}
      </td>
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SellingRulesPage() {
  const [nodes, setNodes]   = useState([]);
  const [nodeId, setNodeId] = useState('');
  const [rows, setRows]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const [search, setSearch]         = useState('');
  const [tab, setTab]               = useState('ALL');
  const [filterCat, setFilterCat]   = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    getNodes({ all: true }).then((r) => setNodes(r.data?.data ?? [])).catch(() => {});
  }, []);

  const load = useCallback(async (nid = nodeId) => {
    if (!nid) return;
    setLoading(true);
    setError('');
    try {
      const res = await getSellingRules({ node_id: nid });
      setRows(res.data?.data ?? []);
    } catch (e) {
      console.error('[SellingRules] load error:', e);
      setError(
        e.response?.data?.message
          ?? (e.response ? `Erreur ${e.response.status}` : null)
          ?? e.message ?? 'Erreur de chargement',
      );
    } finally { setLoading(false); }
  }, [nodeId]);

  const handleNodeChange = (id) => {
    setNodeId(id);
    setRows([]);
    setSearch('');
    setTab('ALL');
    setFilterCat('');
    if (id) load(id);
  };

  // Categories for filter
  const categories = useMemo(() => {
    const map = {};
    rows.forEach((r) => {
      const cat = r.sku?.article?.category;
      if (cat) map[cat.id] = cat;
    });
    return Object.values(map).sort((a, b) => a.name_fr.localeCompare(b.name_fr));
  }, [rows]);

  // Enrich with status
  const enriched = useMemo(() => rows.map((r) => ({ ...r, _status: calcStatus(r) })), [rows]);

  // Stats
  const stats = useMemo(() => ({
    total:   enriched.length,
    avail:   enriched.filter((r) => r._status === 'AVAILABLE').length,
    back:    enriched.filter((r) => r._status === 'BACKORDER_OPEN').length,
    out:     enriched.filter((r) => r._status === 'OUT_NO_BACK').length,
    limit:   enriched.filter((r) => r._status === 'LIMIT_REACHED').length,
  }), [enriched]);

  // Filtered list
  const filtered = useMemo(() => {
    let list = enriched;
    if (tab !== 'ALL')  list = list.filter((r) => r._status === tab);
    if (filterCat)      list = list.filter((r) => r.sku?.article?.category?.id === filterCat);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) => {
        const a = r.sku?.article;
        return a?.name_fr?.toLowerCase().includes(q)
          || a?.sku_code?.toLowerCase().includes(q)
          || a?.ean13?.toLowerCase().includes(q);
      });
    }
    return list;
  }, [enriched, tab, filterCat, search]);

  const tabCount = (key) => key === 'ALL' ? enriched.length : enriched.filter((r) => r._status === key).length;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl px-6 py-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <Icon d={PATHS.tag} className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">Règles de vente</h1>
              <p className="text-sm text-slate-500">Backorder & délais par entrepôt × SKU</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
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
          </div>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm">{error}</div>}

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

      {nodeId && !loading && rows.length > 0 && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total articles', value: stats.total,  color: 'slate',   icon: PATHS.package },
              { label: 'Disponibles',    value: stats.avail,  color: 'emerald', icon: PATHS.check   },
              { label: 'Backorder ouvert',value: stats.back,  color: 'purple',  icon: PATHS.clock   },
              { label: 'Rupture ferme',  value: stats.out,    color: 'red',     icon: PATHS.alert   },
            ].map(({ label, value, color, icon }) => {
              const C = {
                slate:   'bg-slate-50  border-slate-200  text-slate-600',
                emerald: 'bg-emerald-50 border-emerald-200 text-emerald-600',
                purple:  'bg-purple-50 border-purple-200 text-purple-600',
                red:     'bg-red-50    border-red-200    text-red-600',
              }[color];
              return (
                <div key={label} className={`rounded-xl border p-4 flex items-center gap-3 ${C}`}>
                  <Icon d={icon} className="w-5 h-5" />
                  <div>
                    <p className="text-xs font-medium opacity-70">{label}</p>
                    <p className="text-2xl font-bold">{value}</p>
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
                  <input type="text" placeholder="Rechercher un article..." value={search} onChange={(e) => setSearch(e.target.value)}
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
                    <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}
                      className="appearance-none border border-slate-200 rounded-lg px-3 py-1.5 pr-7 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-400">
                      <option value="">Toutes catégories</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name_fr}</option>)}
                    </select>
                    <Icon d={PATHS.chevron} className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                  {filterCat && (
                    <button onClick={() => setFilterCat('')}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 transition">
                      Effacer filtres
                    </button>
                  )}
                </div>
              )}

              {/* Tabs */}
              <div className="flex gap-1 flex-wrap">
                {TABS.map((t) => {
                  const cnt = tabCount(t.key);
                  return (
                    <button key={t.key} onClick={() => setTab(t.key)}
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

            {/* Hint */}
            <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-600 flex items-center gap-2">
              <Icon d={PATHS.check} className="w-3.5 h-3.5" />
              Modifiez directement les champs dans le tableau — un bouton d'enregistrement apparaîtra sur chaque ligne modifiée.
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wide">
                    <th className="text-left px-4 py-3 font-medium">Article</th>
                    <th className="text-center px-3 py-3 font-medium">Dispo</th>
                    <th className="text-center px-3 py-3 font-medium">Backorder</th>
                    <th className="text-center px-3 py-3 font-medium">Limite</th>
                    <th className="text-center px-3 py-3 font-medium">En backorder</th>
                    <th className="text-center px-3 py-3 font-medium">Délai réappr.</th>
                    <th className="text-center px-3 py-3 font-medium">Statut vente</th>
                    <th className="text-center px-3 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map((row) => (
                    <RuleRow key={row.sku_id} row={row} nodeId={nodeId} onSaved={() => load()} />
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

            {/* Footer */}
            <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400">
              {filtered.length} article{filtered.length !== 1 ? 's' : ''} affiché{filtered.length !== 1 ? 's' : ''}
              {rows.length !== filtered.length && ` sur ${rows.length}`}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
