import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Search, Download, Plus, ArrowUpDown, X, Loader2, ArrowRight, ChevronDown } from 'lucide-react';
import { getStockLevels, applyStockMove, getMoveTypesList, getStockMoves } from '../../api/stock.api';
import { getNodes } from '../../api/locationNode.api';
import { getSkus } from '../../api/catalog.api';

// ─── Helpers ────────────────────────────────────────────────────────────────

const N = (v) => Number(v ?? 0);

const getStatus = (row) => {
  const avail = N(row.qty_available);
  const min = N(row.threshold_rule?.stock_minimum);
  if (avail <= 0) return 'rupture';
  if (N(row.qty_backordered) > 0) return 'backorder';
  if (min > 0 && avail <= min) return 'sous_securite';
  return 'ok';
};

const getAlertStatus = (row) => {
  const avail = N(row.qty_available);
  if (avail <= 0) return 'rupture';
  const min = row.threshold_rule?.stock_minimum;
  if (min !== null && min !== undefined && avail <= N(min)) return 'alerte';
  return null;
};

const STATUS_CONFIG = {
  ok:            { label: 'OK',            className: 'bg-green-100 text-green-700' },
  sous_securite: { label: 'Sous sécurité', className: 'bg-amber-100 text-amber-700' },
  rupture:       { label: 'Rupture',       className: 'bg-red-100 text-red-700' },
  backorder:     { label: 'Backorder',     className: 'bg-purple-100 text-purple-700' },
};

const ALERT_STATUS_CONFIG = {
  alerte:  { label: 'Alerte',  className: 'bg-amber-100 text-amber-700' },
  rupture: { label: 'Rupture', className: 'bg-red-100 text-red-700' },
};

const STATUS_TABS = [
  { key: 'tous',          label: 'Tous' },
  { key: 'ok',            label: 'OK' },
  { key: 'sous_securite', label: 'Sous sécurité' },
  { key: 'rupture',       label: 'Rupture' },
  { key: 'backorder',     label: 'Backorder' },
];

const ALERT_TABS = [
  { key: 'tous',    label: 'Tous' },
  { key: 'alerte',  label: 'Alerte (≤ seuil)' },
  { key: 'rupture', label: 'Rupture (≤ 0)' },
];

const formatDateTime = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).replace(',', '');
};

const formatDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
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

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.ok;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
};

const AlertStatusBadge = ({ status }) => {
  const cfg = ALERT_STATUS_CONFIG[status] ?? ALERT_STATUS_CONFIG.rupture;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${cfg.className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5" />
      {cfg.label}
    </span>
  );
};

const CountPill = ({ count, label, tone }) => {
  const tones = {
    red:   'bg-red-100 text-red-700',
    amber: 'bg-amber-100 text-amber-700',
  };
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${tones[tone]}`}>
      {count} {label}
    </span>
  );
};

// ─── SKU search combobox ───────────────────────────────────────────────────

const SkuCombobox = ({ value, onChange }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const boxRef = useRef(null);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const runSearch = useCallback((q) => {
    clearTimeout(debounceRef.current);
    if (!q || q.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await getSkus({ search: q.trim(), limit: 20 });
        setResults(data?.data ?? data ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  const handleInputChange = (e) => {
    const q = e.target.value;
    setQuery(q);
    setOpen(true);
    if (value) onChange(null);
    runSearch(q);
  };

  const selectSku = (sku) => {
    onChange(sku);
    setQuery('');
    setOpen(false);
    setResults([]);
  };

  return (
    <div className="relative" ref={boxRef}>
      <input
        type="text"
        value={value ? `${value.sku_code} — ${value.name_fr}` : query}
        onChange={handleInputChange}
        onFocus={() => setOpen(true)}
        readOnly={!!value}
        placeholder="Sélectionnez un SKU..."
        className={`w-full rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#E10600] focus:border-[#E10600] border ${
          value ? 'bg-gray-50 text-gray-900 border-gray-200 cursor-pointer' : 'bg-gray-100 border-gray-200 text-gray-700'
        }`}
        onClick={() => {
          if (value) {
            onChange(null);
            setOpen(true);
          }
        }}
      />
      {open && !value && (query.trim().length >= 2) && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-auto">
          {loading && (
            <div className="px-4 py-3 text-sm text-gray-400 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Recherche...
            </div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-4 py-3 text-sm text-gray-400">Aucun SKU trouvé.</div>
          )}
          {!loading && results.map((sku) => (
            <button
              type="button"
              key={sku.id}
              onClick={() => selectSku(sku)}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex flex-col"
            >
              <span className="font-medium text-gray-900">{sku.sku_code} — {sku.name_fr}</span>
              {sku.family?.name_fr && <span className="text-xs text-gray-400">{sku.family.name_fr}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Manual adjustment modal ───────────────────────────────────────────────

const AdjustModal = ({ nodes, defaultNodeId, initialSku, onClose, onSaved }) => {
  const [nodeId, setNodeId] = useState(defaultNodeId || '');
  const [sku, setSku] = useState(initialSku || null);
  const [moveTypes, setMoveTypes] = useState([]);
  const [moveTypeId, setMoveTypeId] = useState('');
  const [qtyDelta, setQtyDelta] = useState('');
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data } = await getMoveTypesList();
        const list = data?.data ?? data ?? [];
        setMoveTypes(list);
        const adjustment = list.find((m) => m.code === 'ADJUSTMENT' || /ajustement/i.test(m.name_fr));
        setMoveTypeId(adjustment?.id ?? list[0]?.id ?? '');
      } catch {
        setMoveTypes([]);
      }
    })();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (!nodeId) return setError('Sélectionnez un entrepôt.');
    if (!sku) return setError('Sélectionnez un SKU.');
    if (!moveTypeId) return setError('Sélectionnez un type de mouvement.');
    const delta = Number(qtyDelta);
    if (isNaN(delta) || delta === 0) return setError('Quantité invalide (ex: -5 ou +10).');

    setSaving(true);
    try {
      await applyStockMove({
        node_id: nodeId,
        sku_id: sku.id,
        qty_delta: delta,
        move_type_id: moveTypeId,
        reference: reference || undefined,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || 'Erreur lors de l’ajustement.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b">
          <h2 className="font-poppins font-bold text-lg text-gray-900">Ajustement Manuel</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={submit} className="px-6 py-5 space-y-5">
          {nodes.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1.5">Entrepôt</label>
              <select
                value={nodeId}
                onChange={(e) => setNodeId(e.target.value)}
                className="w-full bg-gray-100 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-[#E10600] focus:border-[#E10600]"
              >
                <option value="">Sélectionnez un entrepôt...</option>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>{n.code} — {n.name_fr}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1.5">SKU</label>
            <SkuCombobox value={sku} onChange={setSku} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1.5">Type de mouvement</label>
              <div className="relative">
                <select
                  value={moveTypeId}
                  onChange={(e) => setMoveTypeId(e.target.value)}
                  className="w-full appearance-none bg-white border border-[#E10600] rounded-lg pl-4 pr-9 py-3 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-[#E10600]"
                >
                  {moveTypes.length === 0 && <option value="">Ajustement (+/-)</option>}
                  {moveTypes.map((m) => (
                    <option key={m.id} value={m.id}>{m.name_fr}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1.5">Quantité</label>
              <input
                type="number"
                step="any"
                value={qtyDelta}
                onChange={(e) => setQtyDelta(e.target.value)}
                placeholder="ex: -5 ou +10"
                className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-[#E10600] focus:border-[#E10600]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1.5">Motif détaillé</label>
            <textarea
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Raison de l'ajustement..."
              rows={3}
              className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-[#E10600] focus:border-[#E10600] resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>

        <div className="flex justify-end items-center gap-6 px-6 py-4 border-t bg-gray-50">
          <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 font-medium">
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="px-5 py-2.5 text-sm rounded-lg bg-[#E10600] text-white font-semibold hover:bg-[#c00500] disabled:opacity-60 flex items-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Valider l'ajustement
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Stat card (drawer) ─────────────────────────────────────────────────────

const StatCard = ({ label, value, tone }) => {
  const tones = {
    default: 'bg-white border-gray-200 text-gray-900',
    green:   'bg-green-50 border-green-100 text-green-700',
    amber:   'bg-amber-50 border-amber-100 text-amber-700',
    blue:    'bg-blue-50 border-blue-100 text-blue-700',
  };
  return (
    <div className={`rounded-xl border px-4 py-4 text-center ${tones[tone] ?? tones.default}`}>
      <p className={`text-xs mb-1 ${tone ? '' : 'text-gray-400'}`}>{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
};

const DetailRow = ({ label, children }) => (
  <div className="flex items-center justify-between px-4 py-3.5 border-b last:border-0">
    <span className="text-sm text-gray-500">{label}</span>
    <span className="text-sm font-medium text-gray-900">{children}</span>
  </div>
);

// ─── Stock level detail drawer ─────────────────────────────────────────────

const StockLevelDrawer = ({ row, onClose, onAdjust }) => {
  const [tab, setTab] = useState('detail'); // 'detail' | 'moves'
  const [moves, setMoves] = useState([]);
  const [movesLoading, setMovesLoading] = useState(false);
  const [movesError, setMovesError] = useState('');

  const s = row.sku;
  const min = row.threshold_rule?.stock_minimum;
  const alertThreshold = row.threshold_rule?.stock_alert_threshold;

  useEffect(() => {
    if (tab !== 'moves') return;
    let cancelled = false;
    (async () => {
      setMovesLoading(true);
      setMovesError('');
      try {
        const { data } = await getStockMoves({ node_id: row.node_id, sku_id: row.sku_id });
        const list = data?.data ?? data;
        if (!cancelled) setMoves(Array.isArray(list) ? list : []);
      } catch (err) {
        if (!cancelled) setMovesError(err?.response?.data?.message || 'Erreur lors du chargement des mouvements.');
      } finally {
        if (!cancelled) setMovesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tab, row.node_id, row.sku_id]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md h-full shadow-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b bg-gray-50">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-poppins font-bold text-lg text-gray-900">{s?.name_fr ?? '—'}</h2>
              <StatusBadge status={row._status} />
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            {s?.sku_code ?? '—'} • <span className="text-[#E10600] font-medium">{row._node?.code ?? '—'}</span> • {s?.family?.name_fr ?? '—'}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-6 px-6 border-b">
          {[
            { key: 'detail', label: 'Détail & seuils' },
            { key: 'moves',  label: `Mouvements${moves.length ? ` (${moves.length})` : ''}` },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.key ? 'border-[#E10600] text-[#E10600]' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === 'detail' ? (
            <>
              <div className="grid grid-cols-4 gap-3 mb-6">
                <StatCard label="Physique"   value={N(row.qty_physical)} />
                <StatCard label="Disponible" value={N(row.qty_available)} tone="green" />
                <StatCard label="Réservé"    value={N(row.qty_reserved)} tone="amber" />
                <StatCard label="Backorder"  value={N(row.qty_backordered)} tone="blue" />
              </div>

              <div>
                <h3 className="font-poppins font-semibold text-sm text-gray-900 mb-2">Seuils & alertes</h3>
                <div className="border rounded-xl overflow-hidden">
                  <DetailRow label="Stock sécurité">
                    {min !== null && min !== undefined ? N(min) : <span className="italic text-gray-400 font-normal">Aucune règle</span>}
                  </DetailRow>
                  <DetailRow label="Point réappro">
                    {alertThreshold !== null && alertThreshold !== undefined
                      ? N(alertThreshold)
                      : <span className="italic text-gray-400 font-normal">Aucune règle</span>}
                  </DetailRow>
                  <DetailRow label="Entrant (incoming)">
                    <span className="text-blue-600">{N(row.qty_incoming)}</span>
                  </DetailRow>
                  <DetailRow label="Dernier comptage">{formatDate(row.last_counted_at)}</DetailRow>
                  <DetailRow label="Statut"><StatusBadge status={row._status} /></DetailRow>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-3">
                Mouvements de <span className="text-[#E10600] font-medium">{s?.sku_code}</span> sur le nœud{' '}
                <span className="text-[#E10600] font-medium">{row._node?.code}</span> uniquement.
              </p>

              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-left border-b">
                      <th className="px-3 py-2.5 font-medium">Type</th>
                      <th className="px-3 py-2.5 font-medium">Qté</th>
                      <th className="px-3 py-2.5 font-medium">Date &amp; heure</th>
                      <th className="px-3 py-2.5 font-medium">Réf.</th>
                      <th className="px-3 py-2.5 font-medium">Opérateur</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movesLoading && (
                      <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400">
                        <Loader2 className="inline animate-spin mr-2" size={14} /> Chargement...
                      </td></tr>
                    )}
                    {!movesLoading && movesError && (
                      <tr><td colSpan={5} className="px-3 py-8 text-center text-red-600">{movesError}</td></tr>
                    )}
                    {!movesLoading && !movesError && moves.length === 0 && (
                      <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400">Aucun mouvement.</td></tr>
                    )}
                    {!movesLoading && !movesError && moves.map((m) => (
                      <tr key={m.id} className="border-b last:border-0">
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getMoveTypeBadgeClass(m.move_type?.name_fr)}`}>
                            {m.move_type?.name_fr ?? '—'}
                          </span>
                        </td>
                        <td className={`px-3 py-2.5 font-semibold ${N(m.qty_delta) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {N(m.qty_delta) > 0 ? `+${N(m.qty_delta)}` : N(m.qty_delta)}
                        </td>
                        <td className="px-3 py-2.5 text-gray-500">{formatDateTime(m.created_at)}</td>
                        <td className="px-3 py-2.5 text-[#E10600]">{m.reference ?? '—'}</td>
                        <td className="px-3 py-2.5 text-gray-700">{m.operator?.full_name ?? 'System'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-3">Append-only log — non modifiable.</p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center px-6 py-4 border-t bg-gray-50">
          <button
            onClick={() => onAdjust(row)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm rounded-lg bg-[#E10600] text-white font-semibold hover:bg-[#c00500]"
          >
            Ajustement manuel
          </button>
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 font-medium">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main page ──────────────────────────────────────────────────────────────

export default function StockLevelsPage({ onGoToReappro } = {}) {
  const [activeTab, setActiveTab] = useState('niveaux'); // 'niveaux' | 'alertes'
  const [statusFilter, setStatusFilter] = useState('tous');
  const [alertFilter, setAlertFilter] = useState('tous'); // 'tous' | 'alerte' | 'rupture'
  const [nodeFilter, setNodeFilter] = useState('');
  const [familyFilter, setFamilyFilter] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: 'available', dir: 'asc' });
  const [rows, setRows] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustInitialSku, setAdjustInitialSku] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);

  const nodesById = useMemo(
    () => Object.fromEntries(nodes.map((n) => [n.id, n])),
    [nodes]
  );

  const fetchNodes = useCallback(async () => {
    try {
      const { data } = await getNodes();
      setNodes(data?.data ?? data ?? []);
    } catch {
      setNodes([]);
    }
  }, []);

  const fetchLevels = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (nodeFilter) params.node_id = nodeFilter;
      if (familyFilter) params.sku_family_id = familyFilter;
      const { data } = await getStockLevels(params);
      setRows(data?.data ?? data ?? []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Erreur lors du chargement des niveaux de stock.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [nodeFilter, familyFilter]);

  useEffect(() => { fetchNodes(); }, [fetchNodes]);
  useEffect(() => { fetchLevels(); }, [fetchLevels]);

  const families = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      const f = r.sku?.family;
      if (f) map.set(f.id, f);
    });
    return Array.from(map.values());
  }, [rows]);

  const enriched = useMemo(
    () => rows.map((r) => ({
      ...r,
      _status: getStatus(r),
      _alertStatus: getAlertStatus(r),
      _node: nodesById[r.node_id],
    })),
    [rows, nodesById]
  );

  const alertRows = useMemo(
    () => enriched.filter((r) => r._alertStatus === 'rupture' || r._alertStatus === 'alerte'),
    [enriched]
  );

  const ruptureCount = useMemo(() => alertRows.filter((r) => r._alertStatus === 'rupture').length, [alertRows]);
  const alerteCount = useMemo(() => alertRows.filter((r) => r._alertStatus === 'alerte').length, [alertRows]);

  const filtered = useMemo(() => {
    if (activeTab === 'alertes') {
      let list = alertRows;
      if (alertFilter !== 'tous') {
        list = list.filter((r) => r._alertStatus === alertFilter);
      }
      return list;
    }

    let list = enriched;
    if (statusFilter !== 'tous') {
      list = list.filter((r) => r._status === statusFilter);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((r) => {
        const s = r.sku;
        return s?.sku_code?.toLowerCase().includes(q) || s?.name_fr?.toLowerCase().includes(q);
      });
    }

    return list;
  }, [enriched, alertRows, activeTab, statusFilter, alertFilter, search]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      let av, bv;
      switch (sort.key) {
        case 'physical':  av = N(a.qty_physical);  bv = N(b.qty_physical);  break;
        case 'reserved':  av = N(a.qty_reserved);  bv = N(b.qty_reserved);  break;
        case 'available':
        default:          av = N(a.qty_available); bv = N(b.qty_available); break;
      }
      return sort.dir === 'asc' ? av - bv : bv - av;
    });
    return list;
  }, [filtered, sort]);

  const toggleSort = (key) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  };

  const handleExport = () => {
    const isAlertTab = activeTab === 'alertes';
    const header = isAlertTab
      ? ['Statut', 'Node', 'SKU', 'Nom', 'Famille', 'Physique', 'Réservé', 'Disponible', 'Point réappro']
      : ['Node', 'SKU', 'Nom', 'Famille', 'Physique', 'Réservé', 'Disponible', 'Statut'];

    const lines = sorted.map((r) => {
      const min = r.threshold_rule?.stock_minimum;
      const reappro = min !== null && min !== undefined ? N(min) : 'Aucune règle active';
      return isAlertTab
        ? [
            ALERT_STATUS_CONFIG[r._alertStatus]?.label ?? '',
            r._node?.code ?? '',
            r.sku?.sku_code ?? '',
            r.sku?.name_fr ?? '',
            r.sku?.family?.name_fr ?? '',
            N(r.qty_physical),
            N(r.qty_reserved),
            N(r.qty_available),
            reappro,
          ]
        : [
            r._node?.code ?? '',
            r.sku?.sku_code ?? '',
            r.sku?.name_fr ?? '',
            r.sku?.family?.name_fr ?? '',
            N(r.qty_physical),
            N(r.qty_reserved),
            N(r.qty_available),
            STATUS_CONFIG[r._status]?.label ?? '',
          ];
    });

    const csv = [header, ...lines].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = isAlertTab ? 'alertes-rupture.csv' : 'niveaux-de-stock.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const goToReappro = (row) => {
    if (onGoToReappro) onGoToReappro(row);
  };

  const openAdjustFromDrawer = (row) => {
    setAdjustInitialSku(row.sku ? { id: row.sku_id, sku_code: row.sku.sku_code, name_fr: row.sku.name_fr, family: row.sku.family } : null);
    setSelectedRow(null);
    setShowAdjust(true);
  };

  const openAdjustFromHeader = () => {
    setAdjustInitialSku(null);
    setShowAdjust(true);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-poppins font-bold text-2xl text-gray-900">Niveaux de stock</h1>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            <Download size={16} />
            Exporter
          </button>
          {activeTab === 'niveaux' && (
            <button
              onClick={openAdjustFromHeader}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-[#E10600] text-white font-medium hover:bg-[#c00500]"
            >
              <Plus size={16} />
              Ajustement manuel
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-gray-200 mb-4">
        {[
          { key: 'niveaux', label: 'Vue niveaux' },
          { key: 'alertes', label: 'Alertes rupture' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`pb-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === t.key
                ? 'border-[#E10600] text-[#E10600]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      {activeTab === 'niveaux' ? (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <select
            value={nodeFilter}
            onChange={(e) => setNodeFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm text-gray-700 focus:ring-2 focus:ring-[#E10600] focus:border-[#E10600] outline-none"
          >
            <option value="">Tous les nœuds</option>
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>{n.code} — {n.name_fr}</option>
            ))}
          </select>

          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="SKU code ou nom..."
              className="pl-9 pr-3 py-2 border rounded-lg text-sm w-64 focus:ring-2 focus:ring-[#E10600] focus:border-[#E10600] outline-none"
            />
          </div>

          <select
            value={familyFilter}
            onChange={(e) => setFamilyFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm text-gray-700 focus:ring-2 focus:ring-[#E10600] focus:border-[#E10600] outline-none"
          >
            <option value="">Toutes familles</option>
            {families.map((f) => (
              <option key={f.id} value={f.id}>{f.name_fr}</option>
            ))}
          </select>

          <div className="flex gap-2 ml-auto">
            {STATUS_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setStatusFilter(t.key)}
                className={`px-3 py-2 text-sm rounded-lg font-medium transition-colors ${
                  statusFilter === t.key
                    ? 'bg-[#E10600] text-white'
                    : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <select
            value={nodeFilter}
            onChange={(e) => setNodeFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm text-gray-700 focus:ring-2 focus:ring-[#E10600] focus:border-[#E10600] outline-none"
          >
            <option value="">Tous les nœuds</option>
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>{n.code} — {n.name_fr}</option>
            ))}
          </select>

          <div className="flex gap-2">
            {ALERT_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setAlertFilter(t.key)}
                className={`px-3 py-2 text-sm rounded-lg font-medium transition-colors ${
                  alertFilter === t.key
                    ? 'bg-[#E10600] text-white'
                    : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <CountPill count={ruptureCount} label="ruptures" tone="red" />
            <CountPill count={alerteCount} label="alerte" tone="amber" />
            <span className="text-sm text-gray-400 italic">Lecture seule — aucun ajustement ici</span>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="border rounded-xl overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-left border-b">
              {activeTab === 'alertes' && <th className="px-4 py-3 font-medium">Statut</th>}
              <th className="px-4 py-3 font-medium">Node</th>
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium">Nom</th>
              <th className="px-4 py-3 font-medium">Famille</th>
              <th className="px-4 py-3 font-medium cursor-pointer select-none" onClick={() => toggleSort('physical')}>
                <span className="inline-flex items-center gap-1">Physique <ArrowUpDown size={12} /></span>
              </th>
              <th className="px-4 py-3 font-medium cursor-pointer select-none" onClick={() => toggleSort('reserved')}>
                <span className="inline-flex items-center gap-1">Réservé <ArrowUpDown size={12} /></span>
              </th>
              <th className="px-4 py-3 font-medium cursor-pointer select-none" onClick={() => toggleSort('available')}>
                <span className="inline-flex items-center gap-1">Disponible <ArrowUpDown size={12} /></span>
              </th>
              {activeTab === 'alertes' ? (
                <>
                  <th className="px-4 py-3 font-medium">Point réappro</th>
                  <th className="px-4 py-3 font-medium"></th>
                </>
              ) : (
                <th className="px-4 py-3 font-medium">Statut</th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={activeTab === 'alertes' ? 9 : 8} className="px-4 py-10 text-center text-gray-400">
                <Loader2 className="inline animate-spin mr-2" size={16} /> Chargement...
              </td></tr>
            )}
            {!loading && error && (
              <tr><td colSpan={activeTab === 'alertes' ? 9 : 8} className="px-4 py-10 text-center text-red-600">{error}</td></tr>
            )}
            {!loading && !error && sorted.length === 0 && (
              <tr><td colSpan={activeTab === 'alertes' ? 9 : 8} className="px-4 py-10 text-center text-gray-400">Aucun résultat.</td></tr>
            )}
            {!loading && !error && sorted.map((r) => {
              const s = r.sku;
              const min = r.threshold_rule?.stock_minimum;
              const hasRule = min !== null && min !== undefined;
              return (
                <tr
                  key={`${r.node_id}-${r.sku_id}`}
                  className="border-b last:border-0 hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedRow(r)}
                >
                  {activeTab === 'alertes' && (
                    <td className="px-4 py-3"><AlertStatusBadge status={r._alertStatus} /></td>
                  )}
                  <td className="px-4 py-3 font-medium text-[#E10600]">{r._node?.code ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{s?.sku_code ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-900">{s?.name_fr ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{s?.family?.name_fr ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{N(r.qty_physical)}</td>
                  <td className="px-4 py-3 text-amber-600">{N(r.qty_reserved)}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{N(r.qty_available)}</td>
                  {activeTab === 'alertes' ? (
                    <>
                      <td className="px-4 py-3 text-gray-700">
                        {hasRule ? N(min) : <span className="italic text-gray-400">Aucune règle active</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); goToReappro(r); }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-[#E10600] text-white font-medium hover:bg-[#c00500]"
                        >
                          Aller au réappro <ArrowRight size={14} />
                        </button>
                      </td>
                    </>
                  ) : (
                    <td className="px-4 py-3"><StatusBadge status={r._status} /></td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {activeTab === 'alertes' && (
        <p className="text-xs text-gray-400 mt-3">
          qty_available = qty_physical – qty_reserved • Alerte : qty_available ≤ point de réappro • Rupture : qty_available ≤ 0 • Le paramétrage des règles se fait dans Paramètres Stock (Réappro).
        </p>
      )}

      {selectedRow && (
        <StockLevelDrawer
          row={selectedRow}
          onClose={() => setSelectedRow(null)}
          onAdjust={openAdjustFromDrawer}
        />
      )}

      {showAdjust && (
        <AdjustModal
          nodes={nodes}
          defaultNodeId={nodeFilter}
          initialSku={adjustInitialSku}
          onClose={() => setShowAdjust(false)}
          onSaved={fetchLevels}
        />
      )}
    </div>
  );
}