import { useState, useEffect, useCallback, useMemo } from 'react';
import { getStockMoves, getStockMoveStats, getMoveTypesList } from '../../api/stock.api';
import { getNodes } from '../../api/locationNode.api';

function Icon({ d, className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={d} />
    </svg>
  );
}

const PATHS = {
  list:     'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  search:   'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  refresh:  'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  chevron:  'M19 9l-7 7-7-7',
  filter:   'M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z',
  download: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4',
  package:  'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  arrow_up: 'M5 10l7-7m0 0l7 7m-7-7v18',
  arrow_dn: 'M19 14l-7 7m0 0l-7-7m7 7V3',
  minus:    'M20 12H4',
  check:    'M5 13l4 4L19 7',
};

function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function exportCSV(rows) {
  const headers = ['Date/Heure','Entrepôt','Code SKU','Article','Type de mouvement','Opération','Quantité','Référence','Motif','Lot'];
  const lines = rows.map((m) => {
    const art = m.sku?.article;
    const qty = Number(m.qty_delta);
    return [
      fmtDateTime(m.created_at),
      m.node?.name_fr ?? '',
      art?.sku_code ?? '',
      art?.name_fr ?? '',
      m.move_type?.name_fr ?? '',
      m.move_type?.operation ?? '',
      qty > 0 ? `+${qty}` : String(qty),
      m.reference ?? '',
      m.reason ?? '',
      m.lot?.lot_number ?? '',
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });
  const csv  = [headers.join(','), ...lines].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'mouvements_stock.csv'; a.click();
  URL.revokeObjectURL(url);
}

const OP_CFG = {
  IN:      { label: 'Entrée',  bg: 'bg-emerald-100 text-emerald-700 border border-emerald-200', dot: 'bg-emerald-500', icon: PATHS.arrow_up },
  OUT:     { label: 'Sortie',  bg: 'bg-red-100 text-red-700 border border-red-200',             dot: 'bg-red-500',     icon: PATHS.arrow_dn },
  NEUTRAL: { label: 'Neutre',  bg: 'bg-slate-100 text-slate-600 border border-slate-200',       dot: 'bg-slate-400',   icon: PATHS.minus    },
};

const PAGE_SIZES = [20, 50, 100];

export default function StockMovesPage() {
  const [nodes, setNodes]           = useState([]);
  const [moveTypes, setMoveTypes]   = useState([]);
  const [nodeId, setNodeId]         = useState('');
  const [data, setData]             = useState([]);
  const [total, setTotal]           = useState(0);
  const [pages, setPages]           = useState(1);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [stats, setStats]           = useState(null);

  const [search, setSearch]         = useState('');
  const [filterMoveType, setFilterMoveType] = useState('');
  const [filterOp, setFilterOp]     = useState('');
  const [dateFrom, setDateFrom]     = useState('');
  const [dateTo, setDateTo]         = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage]             = useState(1);
  const [pageSize, setPageSize]     = useState(20);

  useEffect(() => {
    Promise.all([getNodes({ all: true }), getMoveTypesList()])
      .then(([n, mt]) => {
        setNodes(n.data?.data ?? []);
        setMoveTypes(mt.data?.data ?? []);
      }).catch(() => {});
  }, []);

  const load = useCallback(async (overrides = {}) => {
    const nid = overrides.nodeId ?? nodeId;
    const pg  = overrides.page   ?? page;
    const ps  = overrides.pageSize ?? pageSize;
    setLoading(true); setError('');
    try {
      const params = { page: pg, limit: ps };
      if (nid)            params.node_id      = nid;
      if (filterMoveType) params.move_type_id = filterMoveType;
      if (filterOp)       params.operation    = filterOp;
      if (dateFrom)       params.date_from    = dateFrom;
      if (dateTo)         params.date_to      = dateTo + 'T23:59:59';

      const res = await getStockMoves(params);
      const d = res.data?.data ?? {};
      setData(d.data ?? []);
      setTotal(d.total ?? 0);
      setPages(d.pages ?? 1);

      if (nid) {
        const statsRes = await getStockMoveStats(nid);
        setStats(statsRes.data?.data ?? null);
      }
    } catch (e) {
      setError(e.response?.data?.message ?? 'Erreur de chargement');
    } finally { setLoading(false); }
  }, [nodeId, page, pageSize, filterMoveType, filterOp, dateFrom, dateTo]);

  useEffect(() => { load(); }, []);

  const handleNodeChange = (id) => {
    setNodeId(id); setPage(1);
    load({ nodeId: id, page: 1 });
  };
  const handleSearch = (e) => { setSearch(e.target.value); };
  const applyFilters = () => { setPage(1); load({ page: 1 }); };
  const clearFilters = () => {
    setFilterMoveType(''); setFilterOp(''); setDateFrom(''); setDateTo('');
    setPage(1); setTimeout(() => load({ page: 1 }), 0);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((m) => {
      const a = m.sku?.article;
      return a?.name_fr?.toLowerCase().includes(q)
        || a?.sku_code?.toLowerCase().includes(q)
        || a?.ean13?.toLowerCase().includes(q)
        || m.reference?.toLowerCase().includes(q)
        || m.reason?.toLowerCase().includes(q);
    });
  }, [data, search]);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl px-6 py-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Icon d={PATHS.list} className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">Journal des mouvements de stock</h1>
              <p className="text-sm text-slate-500">Historique complet — lecture seule — append only</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <select value={nodeId} onChange={(e) => handleNodeChange(e.target.value)}
                className="appearance-none border border-slate-200 rounded-xl px-4 py-2 pr-8 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer">
                <option value="">— Tous les entrepôts —</option>
                {nodes.map((n) => <option key={n.id} value={n.id}>{n.code} — {n.name_fr}</option>)}
              </select>
              <Icon d={PATHS.chevron} className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
            <button onClick={() => load()} disabled={loading}
              className="flex items-center gap-2 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition disabled:opacity-50">
              <Icon d={PATHS.refresh} className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
            {data.length > 0 && (
              <button onClick={() => exportCSV(data)}
                className="flex items-center gap-2 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition">
                <Icon d={PATHS.download} className="w-3.5 h-3.5" />
                Export CSV
              </button>
            )}
          </div>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm">{error}</div>}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total mouvements',    value: stats.total,       color: 'slate',   icon: PATHS.list     },
            { label: "Aujourd'hui",         value: stats.today_count, color: 'blue',    icon: PATHS.check    },
            { label: 'Entrées (IN)',         value: stats.in_count,    color: 'emerald', icon: PATHS.arrow_up },
            { label: 'Sorties (OUT)',        value: stats.out_count,   color: 'red',     icon: PATHS.arrow_dn },
          ].map(({ label, value, color, icon }) => {
            const C = {
              slate:   'bg-slate-50   border-slate-200   text-slate-600',
              blue:    'bg-blue-50    border-blue-200    text-blue-600',
              emerald: 'bg-emerald-50 border-emerald-200 text-emerald-600',
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
      )}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {/* Toolbar */}
        <div className="px-4 py-3 border-b border-slate-100 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Icon d={PATHS.search} className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Rechercher par article, code SKU, référence, motif…"
                value={search} onChange={handleSearch}
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <button onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition ${showFilters || filterMoveType || filterOp || dateFrom || dateTo ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              <Icon d={PATHS.filter} className="w-3.5 h-3.5" />
              Filtres
              {(filterMoveType || filterOp || dateFrom || dateTo) && (
                <span className="bg-blue-600 text-white text-[10px] rounded-full px-1.5 py-0.5">
                  {[filterMoveType, filterOp, dateFrom, dateTo].filter(Boolean).length}
                </span>
              )}
            </button>
          </div>

          {showFilters && (
            <div className="flex flex-wrap gap-3 pb-1 items-end">
              {/* Type de mouvement */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Type de mouvement</label>
                <select value={filterMoveType} onChange={(e) => setFilterMoveType(e.target.value)}
                  className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400">
                  <option value="">Tous les types</option>
                  {moveTypes.map((mt) => <option key={mt.id} value={mt.id}>{mt.name_fr}</option>)}
                </select>
              </div>
              {/* Opération */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Sens du mouvement</label>
                <select value={filterOp} onChange={(e) => setFilterOp(e.target.value)}
                  className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400">
                  <option value="">Tous</option>
                  <option value="IN">Entrées seulement</option>
                  <option value="OUT">Sorties seulement</option>
                  <option value="NEUTRAL">Neutres seulement</option>
                </select>
              </div>
              {/* Date de */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Date de début</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                  className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              {/* Date à */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Date de fin</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                  className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <button onClick={applyFilters}
                className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition">
                Appliquer
              </button>
              {(filterMoveType || filterOp || dateFrom || dateTo) && (
                <button onClick={clearFilters}
                  className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs hover:bg-red-50 transition">
                  Effacer les filtres
                </button>
              )}
            </div>
          )}
        </div>

        {/* Notice */}
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-600 flex items-center gap-2">
          <Icon d={PATHS.list} className="w-3.5 h-3.5 flex-shrink-0" />
          Journal immuable — les mouvements ne peuvent pas être modifiés ou supprimés. Toute correction se fait par un nouveau mouvement d'ajustement.
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Icon d={PATHS.refresh} className="w-7 h-7 animate-spin text-slate-300" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-3 font-semibold">
                    Date / Heure
                    <div className="font-normal normal-case text-[10px] text-slate-400 tracking-normal">Horodatage du mouvement</div>
                  </th>
                  <th className="text-left px-3 py-3 font-semibold">
                    Entrepôt
                    <div className="font-normal normal-case text-[10px] text-slate-400 tracking-normal">Nœud logistique</div>
                  </th>
                  <th className="text-left px-3 py-3 font-semibold">
                    Article / SKU
                    <div className="font-normal normal-case text-[10px] text-slate-400 tracking-normal">Produit concerné</div>
                  </th>
                  <th className="text-center px-3 py-3 font-semibold">
                    Type de mouvement
                    <div className="font-normal normal-case text-[10px] text-slate-400 tracking-normal">Catégorie de l'opération</div>
                  </th>
                  <th className="text-center px-3 py-3 font-semibold">
                    Quantité
                    <div className="font-normal normal-case text-[10px] text-slate-400 tracking-normal">+ entrée / − sortie</div>
                  </th>
                  <th className="text-left px-3 py-3 font-semibold">
                    Référence / Motif
                    <div className="font-normal normal-case text-[10px] text-slate-400 tracking-normal">Contexte de l'opération</div>
                  </th>
                  <th className="text-center px-3 py-3 font-semibold">
                    Lot FIFO
                    <div className="font-normal normal-case text-[10px] text-slate-400 tracking-normal">Lot associé</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((m) => {
                  const art   = m.sku?.article;
                  const img   = m.sku?.images?.[0]?.url ?? art?.images?.[0]?.url;
                  const op    = m.move_type?.operation ?? 'NEUTRAL';
                  const opCfg = OP_CFG[op] ?? OP_CFG.NEUTRAL;
                  const qty   = Number(m.qty_delta);
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Date */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-sm font-medium text-slate-700">{new Date(m.created_at).toLocaleDateString('fr-FR')}</p>
                        <p className="text-xs text-slate-400">{new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
                      </td>
                      {/* Entrepôt */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-medium">{m.node?.code ?? '—'}</span>
                        <p className="text-xs text-slate-400 mt-0.5">{m.node?.name_fr}</p>
                      </td>
                      {/* Article */}
                      <td className="px-3 py-3 min-w-[180px]">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-md bg-slate-100 overflow-hidden flex-shrink-0">
                            {img
                              ? <img src={img} alt="" className="w-full h-full object-cover" />
                              : <div className="w-full h-full flex items-center justify-center text-slate-300"><Icon d={PATHS.package} className="w-3 h-3" /></div>
                            }
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{art?.name_fr ?? '—'}</p>
                            <p className="text-xs text-slate-400">{art?.sku_code}</p>
                          </div>
                        </div>
                      </td>
                      {/* Type + opération */}
                      <td className="px-3 py-3 text-center">
                        <div>
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${opCfg.bg}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${opCfg.dot}`} />
                            {m.move_type?.name_fr ?? opCfg.label}
                          </span>
                          {m.move_type?.color && (
                            <div className="mt-0.5 text-[10px] text-slate-400">{opCfg.label}</div>
                          )}
                        </div>
                      </td>
                      {/* Quantité */}
                      <td className="px-3 py-3 text-center">
                        <span className={`text-base font-bold tabular-nums ${qty > 0 ? 'text-emerald-600' : qty < 0 ? 'text-red-600' : 'text-slate-500'}`}>
                          {qty > 0 ? `+${qty.toLocaleString('fr-FR')}` : qty.toLocaleString('fr-FR')}
                        </span>
                      </td>
                      {/* Référence / Motif */}
                      <td className="px-3 py-3 max-w-[180px]">
                        {m.reference && <p className="text-xs font-medium text-slate-700 truncate">{m.reference}</p>}
                        {m.reason    && <p className="text-xs text-slate-400 truncate">{m.reason}</p>}
                        {!m.reference && !m.reason && <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      {/* Lot */}
                      <td className="px-3 py-3 text-center">
                        {m.lot?.lot_number
                          ? <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-xs font-medium border border-indigo-200">{m.lot.lot_number}</span>
                          : <span className="text-slate-300 text-xs">—</span>
                        }
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="text-center py-16 text-slate-400">
                      <Icon d={PATHS.list} className="w-10 h-10 mx-auto mb-3 opacity-20" />
                      <p className="font-medium">Aucun mouvement trouvé</p>
                      <p className="text-xs mt-1">Sélectionnez un entrepôt ou modifiez les filtres</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer — pagination serveur */}
        <div className="px-4 py-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>
              {total > 0
                ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} sur ${total} mouvement${total > 1 ? 's' : ''}`
                : '0 mouvement'}
            </span>
            <div className="flex items-center gap-1">
              <span>Lignes par page :</span>
              <select value={pageSize} onChange={(e) => { const s = Number(e.target.value); setPageSize(s); setPage(1); load({ page: 1, pageSize: s }); }}
                className="border border-slate-200 rounded-md px-1.5 py-0.5 text-xs focus:outline-none">
                {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {pages > 1 && (
            <div className="flex items-center gap-1">
              <button onClick={() => { const p = Math.max(1, page - 1); setPage(p); load({ page: p }); }} disabled={page === 1}
                className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition">
                ‹ Préc.
              </button>
              {Array.from({ length: Math.min(5, pages) }, (_, i) => {
                let p;
                if (pages <= 5)          p = i + 1;
                else if (page <= 3)      p = i + 1;
                else if (page >= pages - 2) p = pages - 4 + i;
                else                     p = page - 2 + i;
                return (
                  <button key={p} onClick={() => { setPage(p); load({ page: p }); }}
                    className={`w-7 h-7 rounded-lg text-xs font-medium transition ${page === p ? 'bg-blue-600 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    {p}
                  </button>
                );
              })}
              <button onClick={() => { const p = Math.min(pages, page + 1); setPage(p); load({ page: p }); }} disabled={page === pages}
                className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition">
                Suiv. ›
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
