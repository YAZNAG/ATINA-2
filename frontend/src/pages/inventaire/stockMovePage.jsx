import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Search, Download, Loader2, Package, ChevronDown, Check, X } from 'lucide-react';
import { getStockMovesPaginated, getMoveTypesList } from '../../api/stock.api';
import { getNodes } from '../../api/locationNode.api';
import { getSkus } from '../../api/catalog.api';

// ─── Helpers ────────────────────────────────────────────────────────────────

const N = (v) => Number(v ?? 0);

const formatDateTime = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).replace(',', '');
};

const MOVE_TYPE_STYLES = [
  { test: /r[ée]ception/i, className: 'bg-green-100 text-green-700' },
  { test: /vente|picking|livr/i, className: 'bg-blue-100 text-blue-700' },
  { test: /ajustement|correction/i, className: 'bg-amber-100 text-amber-700' },
  { test: /annulation|retour/i, className: 'bg-purple-100 text-purple-700' },
];
const getMoveTypeBadgeClass = (name) => {
  const match = MOVE_TYPE_STYLES.find((s) => s.test.test(name || ''));
  return match?.className ?? 'bg-gray-100 text-gray-700';
};

// ─── Badges ─────────────────────────────────────────────────────────────────

const TypeBadge = ({ name }) => (
  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getMoveTypeBadgeClass(name)}`}>
    {name ?? '—'}
  </span>
);

const DirectionBadge = ({ delta }) => {
  const isIn = N(delta) >= 0;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
      isIn ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
    }`}>
      {isIn ? 'IN' : 'OUT'}
    </span>
  );
};

// ─── Generic pill dropdown (node / période / type) ─────────────────────────

const PillSelect = ({ placeholder, value, options, onChange, disabled, disabledPlaceholder }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClickOutside = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const current = options.find((o) => o.value === value);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 px-4 py-2.5 text-sm rounded-lg border whitespace-nowrap ${
          disabled
            ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
        }`}
      >
        {current?.dot && <span className={`w-2 h-2 rounded-full ${current.dot}`} />}
        <span>{disabled ? disabledPlaceholder : (current?.label ?? placeholder)}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && !disabled && (
        <div className="absolute z-20 mt-1 min-w-full w-max bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-72 overflow-y-auto">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 hover:bg-gray-50 ${
                o.value === value ? 'text-[#E10600] font-medium bg-red-50' : 'text-gray-700'
              }`}
            >
              {o.dot && <span className={`w-2 h-2 rounded-full ${o.dot}`} />}
              <span className="flex-1">{o.label}</span>
              {o.value === value && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── SKU real select (liste complète, filtrable) — désactivé tant qu'aucun nœud n'est choisi ───

const SkuRealSelect = ({ nodeId, value, onChange, disabled }) => {
  const [allSkus, setAllSkus] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const filterInputRef = useRef(null);

  useEffect(() => {
    const onClickOutside = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Charge la liste complète des SKUs pour le nœud sélectionné
  useEffect(() => {
    if (!nodeId) { setAllSkus([]); return; }
    setLoading(true);
    getSkus({ node_id: nodeId, all: true })
      .then(({ data }) => setAllSkus(data?.data ?? data ?? []))
      .catch(() => setAllSkus([]))
      .finally(() => setLoading(false));
  }, [nodeId]);

  useEffect(() => {
    if (open) setTimeout(() => filterInputRef.current?.focus(), 0);
    else setFilter('');
  }, [open]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return allSkus;
    return allSkus.filter((s) =>
      s.sku_code?.toLowerCase().includes(q) || s.name_fr?.toLowerCase().includes(q)
    );
  }, [allSkus, filter]);

  const selectSku = (skuItem) => {
    onChange(skuItem);
    setOpen(false);
  };

  return (
    <div className="relative flex-1 min-w-[260px]" ref={boxRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-2 rounded-lg px-4 py-2.5 text-sm border text-left ${
          disabled
            ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
        }`}
      >
        <span className={value ? 'text-gray-900 font-medium' : ''}>
          {disabled
            ? "Choisissez d'abord un nœud..."
            : value
              ? `${value.sku_code} — ${value.name_fr}`
              : 'Sélectionner un SKU...'}
        </span>
        <ChevronDown size={14} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && !disabled && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b">
            <input
              ref={filterInputRef}
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrer par code ou nom..."
              className="w-full rounded-md px-3 py-2 text-sm border border-gray-200 outline-none focus:ring-2 focus:ring-[#E10600] focus:border-[#E10600]"
            />
          </div>
          <div className="max-h-64 overflow-auto">
            {loading && (
              <div className="px-4 py-3 text-sm text-gray-400 flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Chargement...
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="px-4 py-3 text-sm text-gray-400">Aucun SKU trouvé.</div>
            )}
            {!loading && filtered.map((skuItem) => (
              <button
                type="button"
                key={skuItem.id}
                onClick={() => selectSku(skuItem)}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex flex-col ${
                  value?.id === skuItem.id ? 'bg-red-50' : ''
                }`}
              >
                <span className="font-medium text-gray-900">{skuItem.sku_code} — {skuItem.name_fr}</span>
                {skuItem.family?.name_fr && <span className="text-xs text-gray-400">{skuItem.family.name_fr}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Move detail drawer ─────────────────────────────────────────────────────

const StatusPill = ({ operation, name }) => {
  const isIn = operation === 'IN';
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
      isIn ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
    }`}>
      {name ?? (isIn ? 'Entrée' : 'Sortie')}
    </span>
  );
};

const DetailRow = ({ label, value }) => (
  <div className="flex items-center justify-between px-5 py-3.5 border-b last:border-0">
    <span className="text-sm text-gray-500">{label}</span>
    <span className="text-sm font-medium text-gray-900">{value ?? '—'}</span>
  </div>
);

const MoveDetailDrawer = ({ move, onClose }) => {
  if (!move) return null;

  const delta = N(move.qty_delta);
  const isIn = delta >= 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <div className="bg-white w-full max-w-md h-full overflow-y-auto shadow-xl animate-in slide-in-from-right">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b sticky top-0 bg-white z-10">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-poppins font-bold text-lg text-gray-900">Détail mouvement</h2>
              <StatusPill operation={move.move_type?.operation} name={move.move_type?.name_fr} />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {move.id?.slice(0, 8).toUpperCase() ?? move.reference} • {move.node?.code}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Delta circle */}
        <div className="flex justify-center py-8">
          <div className={`w-28 h-28 rounded-full flex items-center justify-center ${
            isIn ? 'bg-green-50' : 'bg-red-50'
          }`}>
            <span className={`text-2xl font-bold ${isIn ? 'text-green-600' : 'text-red-600'}`}>
              {delta > 0 ? `+${delta}` : delta}
            </span>
          </div>
        </div>

        {/* Main info */}
        <div className="mx-5 border rounded-xl overflow-hidden">
          <DetailRow label="Produit" value={move.sku?.name_fr} />
          <DetailRow label="SKU" value={move.sku?.sku_code} />
          <DetailRow label="Nœud" value={move.node?.code} />
          <DetailRow label="Date d'exécution" value={formatDateTime(move.created_at)} />
          <DetailRow label="Opérateur / Auteur" value={move.operator?.full_name ?? 'System'} />
        </div>

        {/* Traceability */}
        <div className="mx-5 mt-4 border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50">
            <span className="text-sm font-semibold text-gray-700">Traçabilité &amp; références</span>
          </div>
          <DetailRow label="Référence" value={move.reference} />
          <DetailRow label="Commande" value={move.order?.id ? move.order.id.slice(0, 8).toUpperCase() : null} />
          <DetailRow label="Lot" value={move.lot?.lot_number} />
        </div>

        {/* Reason */}
        <div className="mx-5 mt-4 mb-2 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5">
          <p className="text-xs font-semibold text-amber-700 mb-0.5">Raison</p>
          <p className="text-sm text-amber-800">{move.reason ?? 'Aucune raison enregistrée.'}</p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t mt-4">
          <span className="text-xs text-gray-400">Append-only log — non modifiable.</span>
          <button
            onClick={onClose}
            className="text-sm font-medium text-[#E10600] hover:underline"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main page ──────────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { value: 'tous',  label: 'Toutes périodes' },
  { value: 'today', label: "Aujourd'hui" },
  { value: '7d',    label: '7 derniers jours' },
];

export default function StockMovePage() {
  const [nodes, setNodes] = useState([]);
  const [moveTypes, setMoveTypes] = useState([]);

  const [nodeId, setNodeId] = useState('');
  const [sku, setSku] = useState(null);
  const [period, setPeriod] = useState('tous');
  const [typeFilter, setTypeFilter] = useState('');

  const [hasSearched, setHasSearched] = useState(false);
  const [moves, setMoves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedMove, setSelectedMove] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await getNodes();
        setNodes(data?.data ?? data ?? []);
      } catch { setNodes([]); }
    })();
    (async () => {
      try {
        const { data } = await getMoveTypesList();
        setMoveTypes(data?.data ?? data ?? []);
      } catch { setMoveTypes([]); }
    })();
  }, []);

  const nodeOptions = useMemo(() => [
    { value: '', label: 'Tous les nœuds', dot: 'bg-gray-400' },
    ...nodes.map((n) => ({ value: n.id, label: `${n.code} — ${n.name_fr}`, dot: 'bg-green-500' })),
  ], [nodes]);

  const typeOptions = useMemo(() => [
    { value: '', label: 'Tous types' },
    ...moveTypes.map((t) => ({ value: t.id, label: t.name_fr })),
  ], [moveTypes]);

  const handleNodeChange = (val) => {
    setNodeId(val);
    setSku(null);
    setHasSearched(false);
    setMoves([]);
  };

  const canSearch = !!nodeId && !!sku;

  // Le filtre période est traduit en date_from/date_to, envoyés au backend
  const periodToDates = (p) => {
    if (p === 'tous') return {};
    const now = new Date();
    if (p === 'today') {
      const start = new Date(now); start.setHours(0, 0, 0, 0);
      return { date_from: start.toISOString() };
    }
    if (p === '7d') {
      const start = new Date(now); start.setDate(now.getDate() - 7);
      return { date_from: start.toISOString() };
    }
    return {};
  };

  const fetchMoves = useCallback(async () => {
    if (!canSearch) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await getStockMovesPaginated({
        node_id: nodeId,
        sku_id: sku.id,
        move_type_id: typeFilter || undefined,
        limit: 200,
        ...periodToDates(period),
      });
      const list = data?.data ?? data;
      setMoves(Array.isArray(list) ? list : []);
      setHasSearched(true);
    } catch (err) {
      setError(err?.response?.data?.message || 'Erreur lors du chargement des mouvements.');
      setMoves([]);
      setHasSearched(true);
    } finally {
      setLoading(false);
    }
  }, [nodeId, sku, canSearch, period, typeFilter]);

  useEffect(() => {
    if (hasSearched) fetchMoves();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, typeFilter]);

  const currentNode = nodes.find((n) => n.id === nodeId);

  const handleExport = () => {
    const header = ['Type', 'Direction', 'Qté', 'Date & Heure', 'Réf.', 'Opérateur'];
    const lines = moves.map((m) => [
      m.move_type?.name_fr ?? '',
      N(m.qty_delta) >= 0 ? 'IN' : 'OUT',
      N(m.qty_delta),
      formatDateTime(m.created_at),
      m.reference ?? '',
      m.operator?.full_name ?? 'System',
    ]);
    const csv = [header, ...lines].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mouvements-${sku?.sku_code ?? 'stock'}-${currentNode?.code ?? ''}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-poppins font-bold text-2xl text-gray-900">Mouvements de Stock</h1>
        <button
          onClick={handleExport}
          disabled={!hasSearched || moves.length === 0}
          className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download size={16} />
          Exporter
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <PillSelect
          placeholder="Tous les nœuds"
          value={nodeId}
          options={nodeOptions}
          onChange={handleNodeChange}
        />

        <SkuRealSelect nodeId={nodeId} value={sku} onChange={setSku} disabled={!nodeId} />

        <button
          type="button"
          onClick={fetchMoves}
          disabled={!canSearch || loading}
          className="flex items-center gap-2 px-5 py-2.5 text-sm rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed bg-[#E10600] text-white hover:bg-[#c00500]"
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          Afficher les mouvements
        </button>

        <PillSelect
          placeholder="Toutes périodes"
          value={period}
          options={PERIOD_OPTIONS}
          onChange={setPeriod}
        />

        <PillSelect
          placeholder="Tous types"
          value={typeFilter}
          options={typeOptions}
          onChange={setTypeFilter}
        />
      </div>

      {/* Content */}
      {!hasSearched ? (
        <div className="border rounded-xl bg-white flex flex-col items-center justify-center text-center py-24 px-6">
          <span className="text-4xl mb-4">📦</span>
          <h2 className="font-poppins font-semibold text-gray-900 mb-2">Sélectionnez un nœud puis un SKU</h2>
          <p className="text-sm text-gray-400 max-w-md">
            Les mouvements de stock sont scopés au niveau du nœud : choisissez un nœud (dark store / entrepôt)
            puis un SKU pour consulter son historique de mouvements sur ce nœud uniquement.
          </p>
        </div>
      ) : (
        <>
          {!loading && !error && (
            <p className="text-sm text-gray-500 mb-3">
              {moves.length} mouvement{moves.length !== 1 ? 's' : ''} pour{' '}
              <span className="text-[#E10600] font-medium">{sku?.sku_code}</span> sur{' '}
              <span className="text-[#E10600] font-medium">{currentNode?.code}</span>
            </p>
          )}

          <div className="border rounded-xl overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-left border-b">
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Direction</th>
                  <th className="px-4 py-3 font-medium">Qté</th>
                  <th className="px-4 py-3 font-medium">Date &amp; Heure</th>
                  <th className="px-4 py-3 font-medium">Réf.</th>
                  <th className="px-4 py-3 font-medium">Opérateur</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                    <Loader2 className="inline animate-spin mr-2" size={16} /> Chargement...
                  </td></tr>
                )}
                {!loading && error && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-red-600">{error}</td></tr>
                )}
                {!loading && !error && moves.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">Aucun mouvement.</td></tr>
                )}
                {!loading && !error && moves.map((m) => (
                  <tr
                    key={m.id}
                    onClick={() => setSelectedMove(m)}
                    className="border-b last:border-0 hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-4 py-3"><TypeBadge name={m.move_type?.name_fr} /></td>
                    <td className="px-4 py-3"><DirectionBadge delta={m.qty_delta} /></td>
                    <td className={`px-4 py-3 font-semibold ${N(m.qty_delta) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {N(m.qty_delta) > 0 ? `+${N(m.qty_delta)}` : N(m.qty_delta)}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatDateTime(m.created_at)}</td>
                    <td className="px-4 py-3 text-[#E10600]">{m.reference ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{m.operator?.full_name ?? 'System'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-400 mt-3">Append-only log — non modifiable.</p>
        </>
      )}

      <MoveDetailDrawer move={selectedMove} onClose={() => setSelectedMove(null)} />
    </div>
  );
}