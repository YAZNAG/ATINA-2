import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Download, Loader2, X, ChevronLeft, ChevronRight, ArrowLeft, RefreshCw } from 'lucide-react';
import { getStockMovesPaginated, getStockMoveById, getMoveTypesList } from '../../api/stock.api';
import { getNodes } from '../../api/locationNode.api';
import { getSkus, getSku } from '../../api/catalog.api';
import {
  N, fmtQty, fmtSigned, formatDate, formatDateTime, downloadCsv, asList, apiError, todayStamp,
} from './inventaireUtils';

// Mouvements Stock — table APPEND-ONLY : lecture seule (US-045), jamais d'édition/suppression.

const TABS = [
  { key: 'liste',  label: 'Liste des mouvements' },
  { key: 'detail', label: 'Détail mouvement' },
];

const PERIOD_OPTIONS = [
  { value: 'tous',   label: 'Toutes périodes' },
  { value: 'today',  label: "Aujourd'hui" },
  { value: '7d',     label: '7 derniers jours' },
  { value: '30d',    label: '30 derniers jours' },
  { value: 'custom', label: 'Personnalisée' },
];

const PAGE_SIZE = 50;

const MOVE_TYPE_STYLES = [
  { test: /r[ée]ception/i, className: 'bg-green-100 text-green-700' },
  { test: /vente|picking|livr|sortie/i, className: 'bg-blue-100 text-blue-700' },
  { test: /ajustement|correction/i, className: 'bg-amber-100 text-amber-700' },
  { test: /annulation|retour|r[ée]servation/i, className: 'bg-purple-100 text-purple-700' },
];
const moveBadgeClass = (name) => MOVE_TYPE_STYLES.find((s) => s.test.test(name || ''))?.className ?? 'bg-gray-100 text-gray-700';

const TypeBadge = ({ name }) => (
  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${moveBadgeClass(name)}`}>{name ?? '—'}</span>
);

const DirectionBadge = ({ move }) => {
  const op = move.move_type?.operation;
  const delta = N(move.qty_delta);
  const label = op === 'NEUTRAL' || (delta === 0 && !op) ? 'NEUTRE' : delta >= 0 ? 'ENTRÉE' : 'SORTIE';
  const cls = label === 'NEUTRE' ? 'bg-gray-100 text-gray-600' : label === 'ENTRÉE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${cls}`}>{label}</span>;
};

const DetailRow = ({ label, value, children }) => (
  <div className="flex items-center justify-between gap-4 px-5 py-3 border-b last:border-0">
    <span className="text-sm text-gray-500">{label}</span>
    <span className="text-sm font-medium text-gray-900 text-right break-all">{children ?? value ?? '—'}</span>
  </div>
);

const selectCls = 'border rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:ring-2 focus:ring-[#E10600] focus:border-[#E10600] outline-none';

const periodToDates = (p, from, to) => {
  const now = new Date();
  if (p === 'today') { const s = new Date(now); s.setHours(0, 0, 0, 0); return { date_from: s.toISOString() }; }
  if (p === '7d') { const s = new Date(now); s.setDate(now.getDate() - 7); return { date_from: s.toISOString() }; }
  if (p === '30d') { const s = new Date(now); s.setDate(now.getDate() - 30); return { date_from: s.toISOString() }; }
  if (p === 'custom') return { ...(from ? { date_from: from } : {}), ...(to ? { date_to: to } : {}) };
  return {};
};

// ─── Filtre SKU (recherche serveur) ─────────────────────────────────────────

const SkuFilter = ({ value, onChange }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    const onClickOutside = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const search = (q) => {
    setQuery(q);
    setOpen(true);
    clearTimeout(debounceRef.current);
    if (q.trim().length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try { setResults(asList(await getSkus({ search: q.trim(), limit: 20 }))); }
      catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
  };

  if (value) {
    return (
      <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E10600] bg-red-50 text-sm text-gray-800">
        {value.sku_code} — {value.name_fr}
        <button type="button" onClick={() => onChange(null)} className="text-gray-400 hover:text-gray-700"><X size={14} /></button>
      </span>
    );
  }

  return (
    <div className="relative" ref={boxRef}>
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input value={query} onChange={(e) => search(e.target.value)} onFocus={() => setOpen(true)} placeholder="Filtrer par SKU (code, nom, EAN)..." className="pl-9 pr-3 py-2 border rounded-lg text-sm w-64 focus:ring-2 focus:ring-[#E10600] outline-none" />
      {open && query.trim().length >= 2 && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-auto">
          {loading && <div className="px-4 py-3 text-sm text-gray-400"><Loader2 size={14} className="inline animate-spin mr-2" />Recherche...</div>}
          {!loading && results.length === 0 && <div className="px-4 py-3 text-sm text-gray-400">Aucun SKU trouvé.</div>}
          {!loading && results.map((s) => (
            <button key={s.id} type="button" onClick={() => { onChange({ id: s.id, sku_code: s.sku_code, name_fr: s.name_fr }); setQuery(''); setOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50">
              <span className="font-medium text-gray-900">{s.sku_code}</span> — {s.name_fr}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Onglet « Détail mouvement » ────────────────────────────────────────────

function MoveDetail({ moveId, onBack }) {
  const [move, setMove] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!moveId) { setMove(null); return undefined; }
    let cancelled = false;
    setLoading(true);
    setError('');
    getStockMoveById(moveId)
      .then((res) => { if (!cancelled) setMove(res?.data?.data ?? null); })
      .catch((err) => { if (!cancelled) setError(apiError(err, 'Mouvement introuvable.')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [moveId]);

  if (!moveId) {
    return <div className="border rounded-xl bg-white py-20 text-center text-sm text-gray-400">Sélectionnez un mouvement dans la « Liste des mouvements ».</div>;
  }
  if (loading) return <div className="py-16 text-center text-gray-400"><Loader2 className="inline animate-spin mr-2" size={16} />Chargement...</div>;
  if (error) return <div className="py-16 text-center text-red-600">{error}</div>;
  if (!move) return null;

  const delta = N(move.qty_delta);
  const meta = move.metadata && typeof move.metadata === 'object' ? move.metadata : null;

  return (
    <div>
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"><ArrowLeft size={15} /> Retour à la liste</button>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white border rounded-xl p-6 flex flex-col items-center justify-center text-center">
          <TypeBadge name={move.move_type?.name_fr} />
          <div className={`mt-4 w-28 h-28 rounded-full flex items-center justify-center ${delta > 0 ? 'bg-green-50' : delta < 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
            <span className={`text-2xl font-bold ${delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-gray-500'}`}>{fmtSigned(delta)}</span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 w-full">
            <div className="rounded-lg border px-3 py-3">
              <p className="text-xs text-gray-400">Stock avant</p>
              <p className="text-lg font-bold text-gray-900">{move.qty_before != null ? fmtQty(move.qty_before) : '—'}</p>
            </div>
            <div className="rounded-lg border px-3 py-3">
              <p className="text-xs text-gray-400">Stock après</p>
              <p className="text-lg font-bold text-gray-900">{move.qty_after != null ? fmtQty(move.qty_after) : '—'}</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {move.balance_source === 'metadata' ? 'Valeurs enregistrées avec le mouvement'
              : move.balance_source === 'reconstitue' ? 'Solde physique reconstitué depuis le stock actuel et les mouvements postérieurs'
                : 'Solde non disponible'}
          </p>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b bg-gray-50 text-sm font-semibold text-gray-700">Mouvement</div>
            <DetailRow label="Identifiant" value={move.id} />
            <DetailRow label="Produit">{move.sku?.name_fr}{move.sku?.name_ar && <span className="block text-xs text-gray-400" dir="rtl">{move.sku.name_ar}</span>}</DetailRow>
            <DetailRow label="SKU" value={move.sku?.sku_code} />
            <DetailRow label="Node" value={move.node ? `${move.node.code} — ${move.node.name_fr}` : null} />
            <DetailRow label="Type"><TypeBadge name={move.move_type?.name_fr} /> <DirectionBadge move={move} /></DetailRow>
            <DetailRow label="Date" value={formatDateTime(move.created_at)} />
            <DetailRow label="Opérateur / auteur" value={move.operator?.full_name ?? 'Système'} />
          </div>

          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b bg-gray-50 text-sm font-semibold text-gray-700">Traçabilité (source, référence, lot)</div>
            <DetailRow label="Source" value={move.source?.label} />
            <DetailRow label="Référence source" value={move.source?.reference ?? move.reference} />
            <DetailRow label="Référence / motif saisi" value={move.reference} />
            <DetailRow label="Commande" value={move.order?.id ? move.order.id.slice(0, 8).toUpperCase() : null} />
            <DetailRow label="Lot" value={move.lot?.lot_number ?? (move.lot ? move.lot.id.slice(0, 8).toUpperCase() : null)} />
            {move.lot && (
              <>
                <DetailRow label="DLC du lot" value={formatDate(move.lot.expiry_date)} />
                <DetailRow label="Coût unitaire du lot" value={move.lot.cost_unit != null ? `${fmtQty(move.lot.cost_unit)} MAD` : null} />
                <DetailRow label="Qté lot (initiale / restante)" value={`${fmtQty(move.lot.qty_initial)} / ${fmtQty(move.lot.qty_remaining)}`} />
              </>
            )}
            {meta?.source === 'stock_count' && (
              <DetailRow label="Comptage" value={`théorique ${fmtQty(meta.qty_theoretical)} / compté ${fmtQty(meta.qty_counted)}`} />
            )}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5">
            <p className="text-xs font-semibold text-amber-700 mb-0.5">Raison</p>
            <p className="text-sm text-amber-800">{move.reason ?? 'Aucune raison enregistrée.'}</p>
          </div>
          <p className="text-xs text-gray-400">Journal append-only — ce mouvement n'est ni modifiable ni supprimable. Toute correction passe par un nouvel ajustement.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function StockMovePage() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('liste');
  const [nodes, setNodes] = useState([]);
  const [moveTypes, setMoveTypes] = useState([]);

  const [nodeId, setNodeId] = useState(searchParams.get('node_id') || '');
  const [sku, setSku] = useState(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [period, setPeriod] = useState('tous');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  const [moves, setMoves] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [selectedId, setSelectedId] = useState(searchParams.get('move_id') || null);

  useEffect(() => {
    getNodes({ limit: 500 }).then((res) => setNodes(asList(res))).catch(() => setNodes([]));
    getMoveTypesList().then((res) => setMoveTypes(asList(res))).catch(() => setMoveTypes([]));
    const skuId = searchParams.get('sku_id');
    if (skuId) {
      getSku(skuId)
        .then((res) => { const s = res?.data?.data; setSku(s ? { id: s.id, sku_code: s.sku_code, name_fr: s.name_fr } : { id: skuId, sku_code: 'SKU', name_fr: skuId.slice(0, 8) }); })
        .catch(() => setSku({ id: skuId, sku_code: 'SKU', name_fr: skuId.slice(0, 8) }));
    }
    if (searchParams.get('move_id')) setActiveTab('detail');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filters = useMemo(() => ({
    ...(nodeId ? { node_id: nodeId } : {}),
    ...(sku ? { sku_id: sku.id } : {}),
    ...(typeFilter ? { move_type_id: typeFilter } : {}),
    ...periodToDates(period, dateFrom, dateTo),
  }), [nodeId, sku, typeFilter, period, dateFrom, dateTo]);

  // Attend la résolution du SKU passé en URL avant la première recherche
  const waitingSku = !!searchParams.get('sku_id') && !sku;

  const fetchMoves = useCallback(async () => {
    if (waitingSku) return;
    setLoading(true);
    setError('');
    try {
      const res = await getStockMovesPaginated({ ...filters, page, limit: PAGE_SIZE });
      setMoves(asList(res));
      setPagination({ total: res?.data?.total ?? res?.data?.pagination?.total ?? 0, pages: res?.data?.pages ?? res?.data?.pagination?.pages ?? 1 });
    } catch (err) {
      setError(apiError(err, 'Erreur lors du chargement des mouvements.'));
      setMoves([]);
    } finally {
      setLoading(false);
    }
  }, [filters, page, waitingSku]);

  useEffect(() => { fetchMoves(); }, [fetchMoves]);
  useEffect(() => { setPage(1); }, [filters]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await getStockMovesPaginated({ ...filters, page: 1, limit: 5000 });
      const list = asList(res);
      downloadCsv(`mouvements-stock-${todayStamp()}.csv`,
        ['Date', 'Type', 'Sens', 'Node', 'SKU', 'Nom', 'Qté', 'Lot', 'Référence', 'Raison', 'Opérateur'],
        list.map((m) => [
          formatDateTime(m.created_at), m.move_type?.name_fr ?? '', N(m.qty_delta) > 0 ? 'Entrée' : N(m.qty_delta) < 0 ? 'Sortie' : 'Neutre',
          m.node?.code ?? '', m.sku?.sku_code ?? '', m.sku?.name_fr ?? '', N(m.qty_delta), m.lot?.lot_number ?? '',
          m.reference ?? '', m.reason ?? '', m.operator?.full_name ?? 'Système',
        ]));
    } catch (err) {
      setError(apiError(err, "Erreur lors de l'export."));
    } finally {
      setExporting(false);
    }
  };

  const openDetail = (m) => { setSelectedId(m.id); setActiveTab('detail'); };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-poppins font-bold text-2xl text-gray-900">Mouvements de stock</h1>
          <p className="text-sm text-gray-500 mt-1">Historique append-only : lecture seule, aucune modification ni suppression possible.</p>
        </div>
        {activeTab === 'liste' && (
          <button onClick={handleExport} disabled={exporting || !pagination.total} className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Exporter
          </button>
        )}
      </div>

      <div className="flex gap-6 border-b border-gray-200 mb-4">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} className={`pb-3 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === t.key ? 'border-[#E10600] text-[#E10600]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'liste' ? (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <select value={nodeId} onChange={(e) => setNodeId(e.target.value)} className={selectCls}>
              <option value="">Tous les nodes</option>
              {nodes.map((n) => <option key={n.id} value={n.id}>{n.code} — {n.name_fr}</option>)}
            </select>
            <SkuFilter value={sku} onChange={setSku} />
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={selectCls}>
              <option value="">Tous types</option>
              {moveTypes.map((t) => <option key={t.id} value={t.id}>{t.name_fr}</option>)}
            </select>
            <select value={period} onChange={(e) => setPeriod(e.target.value)} className={selectCls}>
              {PERIOD_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            {period === 'custom' && (
              <>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={selectCls} aria-label="Du" />
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={selectCls} aria-label="Au" />
              </>
            )}
            <button onClick={fetchMoves} title="Rafraîchir" className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"><RefreshCw size={15} /></button>
          </div>

          <div className="border rounded-xl overflow-x-auto bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-left border-b">
                  <th className="px-4 py-3 font-medium">Date &amp; heure</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Sens</th>
                  <th className="px-4 py-3 font-medium">Node</th>
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium text-right">Qté</th>
                  <th className="px-4 py-3 font-medium">Lot</th>
                  <th className="px-4 py-3 font-medium">Référence</th>
                  <th className="px-4 py-3 font-medium">Auteur</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400"><Loader2 className="inline animate-spin mr-2" size={16} />Chargement...</td></tr>}
                {!loading && error && <tr><td colSpan={9} className="px-4 py-10 text-center text-red-600">{error}</td></tr>}
                {!loading && !error && moves.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">Aucun mouvement pour ces filtres.</td></tr>}
                {!loading && !error && moves.map((m) => (
                  <tr key={m.id} onClick={() => openDetail(m)} className="border-b last:border-0 hover:bg-gray-50 cursor-pointer">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDateTime(m.created_at)}</td>
                    <td className="px-4 py-3"><TypeBadge name={m.move_type?.name_fr} /></td>
                    <td className="px-4 py-3"><DirectionBadge move={m} /></td>
                    <td className="px-4 py-3 font-medium text-[#E10600]">{m.node?.code ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-700"><span className="font-medium">{m.sku?.sku_code}</span><span className="block text-xs text-gray-400 truncate max-w-[220px]">{m.sku?.name_fr}</span></td>
                    <td className={`px-4 py-3 text-right font-semibold ${N(m.qty_delta) > 0 ? 'text-green-600' : N(m.qty_delta) < 0 ? 'text-red-600' : 'text-gray-500'}`}>{fmtSigned(m.qty_delta)}</td>
                    <td className="px-4 py-3 text-gray-600">{m.lot?.lot_number ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-700 truncate max-w-[200px]">{m.reference ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{m.operator?.full_name ?? 'Système'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-3 text-sm text-gray-500">
            <span>{pagination.total} mouvement(s) • append-only, non modifiable</span>
            {pagination.pages > 1 && (
              <div className="flex items-center gap-2">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="p-1.5 rounded border disabled:opacity-40"><ChevronLeft size={16} /></button>
                <span>Page {page} / {pagination.pages}</span>
                <button disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)} className="p-1.5 rounded border disabled:opacity-40"><ChevronRight size={16} /></button>
              </div>
            )}
          </div>
        </>
      ) : (
        <MoveDetail moveId={selectedId} onBack={() => setActiveTab('liste')} />
      )}
    </div>
  );
}
