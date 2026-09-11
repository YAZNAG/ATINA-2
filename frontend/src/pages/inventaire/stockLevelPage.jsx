import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, Download, ArrowUpDown, Loader2, ArrowRight, SlidersHorizontal, History,
  Settings2, AlertTriangle, PackageX, Plus, Minus, RefreshCw, FileText, Coins,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getStockLevels, adjustStockLevel, getMoveTypesList, getStockMoves, getStockCost } from '../../api/stock.api';
import { exportPdf } from '../../utils/pdfExport';
import { getReorderAlerts, getReorderThresholds } from '../../api/stockCounts.api';
import { getNodes } from '../../api/locationNode.api';
import { getSkus, getFamiliesList, getBrandsList } from '../../api/catalog.api';
import { useAuth } from '../../context/AuthContext';
import {
  N, fmtQty, fmtSigned, formatDate, formatDateTime, downloadCsv, asList, apiError, todayStamp, fmtMoney4,
} from './inventaireUtils';

// ─── Constantes ─────────────────────────────────────────────────────────────

const TABS = [
  { key: 'niveaux',    label: 'Vue niveaux' },
  { key: 'detail',     label: 'Détail SKU×Node' },
  { key: 'ajustement', label: 'Ajustement manuel' },
  { key: 'alertes',    label: 'Alertes rupture' },
];

// Statut d'un couple node × SKU. Le seuil est celui des règles de réappro
// (reorder_rules.reorder_point, règle active) — cf. US-113 / WF#8.
const STATUS_CONFIG = {
  ok:        { label: 'OK',        className: 'bg-green-100 text-green-700' },
  alerte:    { label: 'Alerte',    className: 'bg-amber-100 text-amber-700' },
  rupture:   { label: 'Rupture',   className: 'bg-red-100 text-red-700' },
  backorder: { label: 'Backorder', className: 'bg-purple-100 text-purple-700' },
};

const SEUIL_FILTERS = [
  { key: 'tous',      label: 'Tous' },
  { key: 'ok',        label: 'OK' },
  { key: 'alerte',    label: 'Alerte (≤ seuil)' },
  { key: 'rupture',   label: 'Rupture (≤ 0)' },
  { key: 'backorder', label: 'Backorder' },
];

const ALERT_FILTERS = [
  { key: '',        label: 'Tous' },
  { key: 'alerte',  label: 'Alerte (≤ seuil)' },
  { key: 'rupture', label: 'Rupture (≤ 0)' },
];

const ADJUST_REASONS = [
  'Stock initial',
  "Correction d'inventaire",
  'Casse',
  'Péremption',
  'Vol / perte',
  'Erreur de saisie',
  'Autre',
];

const statusOf = (row, rule) => {
  const avail = N(row.qty_available);
  if (avail <= 0) return 'rupture';
  if (rule?.is_active && avail <= N(rule.reorder_point)) return 'alerte';
  if (N(row.qty_backordered) > 0) return 'backorder';
  return 'ok';
};

const keyOf = (nodeId, skuId) => `${nodeId}_${skuId}`;

const MOVE_TYPE_STYLES = [
  { test: /r[ée]ception/i, className: 'bg-green-100 text-green-700' },
  { test: /vente|picking|livr|sortie/i, className: 'bg-blue-100 text-blue-700' },
  { test: /ajustement|correction/i, className: 'bg-amber-100 text-amber-700' },
  { test: /annulation|retour|r[ée]servation/i, className: 'bg-purple-100 text-purple-700' },
];
const moveBadgeClass = (name) => MOVE_TYPE_STYLES.find((s) => s.test.test(name || ''))?.className ?? 'bg-gray-100 text-gray-700';

// ─── Petits composants ──────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.ok;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${cfg.className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5" />
      {cfg.label}
    </span>
  );
};

const StatCard = ({ label, value, tone }) => {
  const tones = {
    default: 'bg-white border-gray-200 text-gray-900',
    green:   'bg-green-50 border-green-100 text-green-700',
    amber:   'bg-amber-50 border-amber-100 text-amber-700',
    blue:    'bg-blue-50 border-blue-100 text-blue-700',
    purple:  'bg-purple-50 border-purple-100 text-purple-700',
    red:     'bg-red-50 border-red-100 text-red-700',
  };
  return (
    <div className={`rounded-xl border px-4 py-4 text-center ${tones[tone] ?? tones.default}`}>
      <p className={`text-xs mb-1 ${tone ? '' : 'text-gray-400'}`}>{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
};

const DetailRow = ({ label, children }) => (
  <div className="flex items-center justify-between px-4 py-3 border-b last:border-0">
    <span className="text-sm text-gray-500">{label}</span>
    <span className="text-sm font-medium text-gray-900 text-right">{children}</span>
  </div>
);

const selectCls = 'border rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:ring-2 focus:ring-[#E10600] focus:border-[#E10600] outline-none';
const inputCls = 'w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-[#E10600] focus:border-[#E10600]';

// ─── Recherche SKU (combobox) ───────────────────────────────────────────────

const SkuCombobox = ({ value, onChange, disabled }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const boxRef = useRef(null);

  useEffect(() => {
    const onClickOutside = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const runSearch = useCallback((q) => {
    clearTimeout(debounceRef.current);
    if (!q || q.trim().length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await getSkus({ search: q.trim(), limit: 20, status: 'active' });
        setResults(asList(res));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  return (
    <div className="relative" ref={boxRef}>
      <input
        type="text"
        disabled={disabled}
        value={value ? `${value.sku_code} — ${value.name_fr}` : query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); if (value) onChange(null); runSearch(e.target.value); }}
        onFocus={() => setOpen(true)}
        onClick={() => { if (value && !disabled) { onChange(null); setOpen(true); } }}
        readOnly={!!value}
        placeholder="Code SKU, nom ou EAN (2 caractères min.)"
        className={`${inputCls} ${value ? 'bg-gray-50 cursor-pointer' : ''} disabled:bg-gray-100`}
      />
      {open && !value && query.trim().length >= 2 && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-auto">
          {loading && (
            <div className="px-4 py-3 text-sm text-gray-400 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Recherche...
            </div>
          )}
          {!loading && results.length === 0 && <div className="px-4 py-3 text-sm text-gray-400">Aucun SKU trouvé.</div>}
          {!loading && results.map((sku) => (
            <button
              type="button"
              key={sku.id}
              onClick={() => { onChange({ id: sku.id, sku_code: sku.sku_code, name_fr: sku.name_fr }); setQuery(''); setOpen(false); setResults([]); }}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex flex-col"
            >
              <span className="font-medium text-gray-900">{sku.sku_code} — {sku.name_fr}</span>
              {sku.sku_family?.name_fr && <span className="text-xs text-gray-400">{sku.sku_family.name_fr}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Onglet « Détail SKU×Node » ─────────────────────────────────────────────

function DetailTab({ row, rule, nodes, rows, onPick, onAdjust, navigate }) {
  const [moves, setMoves] = useState([]);
  const [movesLoading, setMovesLoading] = useState(false);
  const [movesError, setMovesError] = useState('');
  const [pickNode, setPickNode] = useState(row?.node_id || '');
  const [cost, setCost] = useState(null);
  const [costLoading, setCostLoading] = useState(false);
  const [costError, setCostError] = useState('');

  useEffect(() => { if (row) setPickNode(row.node_id); }, [row]);

  // Valorisation (US-047) : CUMP courant, valeur du stock, historique sku_cost_snapshots
  useEffect(() => {
    if (!row) { setCost(null); return undefined; }
    let cancelled = false;
    (async () => {
      setCostLoading(true);
      setCostError('');
      try {
        const res = await getStockCost(row.node_id, row.sku_id, 10);
        if (!cancelled) setCost(res?.data?.data ?? null);
      } catch (err) {
        if (!cancelled) { setCost(null); setCostError(apiError(err, 'Valorisation indisponible.')); }
      } finally {
        if (!cancelled) setCostLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [row]);

  useEffect(() => {
    if (!row) return undefined;
    let cancelled = false;
    (async () => {
      setMovesLoading(true);
      setMovesError('');
      try {
        const res = await getStockMoves({ node_id: row.node_id, sku_id: row.sku_id, limit: 10 });
        if (!cancelled) setMoves(asList(res));
      } catch (err) {
        if (!cancelled) setMovesError(apiError(err, 'Erreur lors du chargement des mouvements.'));
      } finally {
        if (!cancelled) setMovesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [row]);

  const nodeRows = useMemo(() => rows.filter((r) => r.node_id === pickNode), [rows, pickNode]);

  const picker = (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <select value={pickNode} onChange={(e) => setPickNode(e.target.value)} className={selectCls}>
        <option value="">Choisir un node...</option>
        {nodes.map((n) => <option key={n.id} value={n.id}>{n.code} — {n.name_fr}</option>)}
      </select>
      <select
        value={row && row.node_id === pickNode ? row.sku_id : ''}
        onChange={(e) => { const r = nodeRows.find((x) => x.sku_id === e.target.value); if (r) onPick(r); }}
        disabled={!pickNode}
        className={`${selectCls} min-w-[280px] disabled:bg-gray-100`}
      >
        <option value="">{pickNode ? `Choisir un SKU (${nodeRows.length})...` : "Choisissez d'abord un node"}</option>
        {nodeRows.map((r) => <option key={r.sku_id} value={r.sku_id}>{r.sku?.sku_code} — {r.sku?.name_fr}</option>)}
      </select>
    </div>
  );

  if (!row) {
    return (
      <>
        {picker}
        <div className="border rounded-xl bg-white py-20 text-center text-gray-400 text-sm">
          Sélectionnez un couple node × SKU ci-dessus ou cliquez sur une ligne de la « Vue niveaux ».
        </div>
      </>
    );
  }

  const s = row.sku;
  const lastMove = moves[0];

  return (
    <>
      {picker}
      <div className="bg-white border rounded-xl p-5 mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-poppins font-bold text-lg text-gray-900">{s?.name_fr ?? '—'}</h2>
            <StatusBadge status={row._status} />
          </div>
          {s?.name_ar && <p className="text-sm text-gray-500" dir="rtl">{s.name_ar}</p>}
          <p className="text-sm text-gray-400 mt-1">
            {s?.sku_code ?? '—'} • <span className="text-[#E10600] font-medium">{row._node?.code ?? '—'}</span> • {s?.family?.name_fr ?? '—'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => onAdjust(row)} className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-[#E10600] text-white font-medium hover:bg-[#c00500]">
            <SlidersHorizontal size={15} /> Ajuster
          </button>
          <button
            onClick={() => navigate(`/stock/moves?node_id=${row.node_id}&sku_id=${row.sku_id}`)}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            <History size={15} /> Voir les mouvements
          </button>
          <button
            onClick={() => navigate(`/stock/reorder-rules?node_id=${row.node_id}&sku_id=${row.sku_id}`)}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            <Settings2 size={15} /> Paramètres réappro
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        <StatCard label="Physique" value={fmtQty(row.qty_physical)} />
        <StatCard label="Réservé" value={fmtQty(row.qty_reserved)} tone="amber" />
        <StatCard label="Disponible" value={fmtQty(row.qty_available)} tone={N(row.qty_available) <= 0 ? 'red' : 'green'} />
        <StatCard label="Backorder" value={fmtQty(row.qty_backordered)} tone="purple" />
        <StatCard label="Entrant" value={fmtQty(row.qty_incoming)} tone="blue" />
        <StatCard label="COD flottant" value={fmtQty(row.qty_floating_cod)} />
      </div>

      <div className="border rounded-xl overflow-hidden bg-white mb-4">
        <div className="px-4 py-3 border-b bg-gray-50 text-sm font-semibold text-gray-700 flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2"><Coins size={15} /> Valorisation (CUMP)</span>
          {cost && (
            <span className="text-xs font-normal text-gray-500">
              Méthode : <strong>{cost.costing_method === 'FIFO' ? 'FIFO (lots)' : 'CUMP'}</strong>
              {cost.costing_method_source === 'defaut' ? ' (par défaut, aucune règle de réappro)' : ' (règle de réappro)'}
            </span>
          )}
        </div>
        {costLoading && <div className="px-4 py-6 text-sm text-gray-400"><Loader2 className="inline animate-spin mr-2" size={14} />Chargement...</div>}
        {!costLoading && costError && <div className="px-4 py-6 text-sm text-red-600">{costError}</div>}
        {!costLoading && !costError && cost && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 lg:divide-x">
            <div className="p-4 grid grid-cols-2 lg:grid-cols-1 gap-3">
              <StatCard label="CUMP courant (MAD / unité)" value={cost.cump == null ? '—' : fmtMoney4(cost.cump)} tone="blue" />
              <StatCard label="Valeur du stock (physique × CUMP)" value={cost.stock_value == null ? '—' : `${fmtMoney4(cost.stock_value, 2)} MAD`} tone="green" />
              <p className="text-xs text-gray-400 col-span-2 lg:col-span-1">
                {cost.cump_source === 'snapshot' && `Dernier recalcul : ${formatDateTime(cost.cump_computed_at)}`}
                {cost.cump_source === 'lots' && 'Aucun snapshot CUMP : coût moyen pondéré des lots en stock.'}
                {!cost.cump_source && 'Aucune réception valorisée pour ce couple.'}
              </p>
            </div>
            <div className="lg:col-span-2 p-4">
              <p className="text-xs font-semibold text-gray-500 mb-2">Historique CUMP (sku_cost_snapshots) — lecture seule</p>
              {cost.snapshots.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Aucun snapshot : le CUMP est recalculé à chaque réception de bon de commande.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-400 text-left"><th className="py-1">Date</th><th className="py-1 text-right">CUMP</th><th className="py-1 text-right">Qté reçue</th><th className="py-1 text-right">Coût lot</th><th className="py-1">Origine</th></tr>
                  </thead>
                  <tbody>
                    {cost.snapshots.map((sn) => (
                      <tr key={sn.id} className="border-t">
                        <td className="py-1.5 text-gray-500">{formatDateTime(sn.computed_at)}</td>
                        <td className="py-1.5 text-right font-semibold text-gray-800">{fmtMoney4(sn.cump)}</td>
                        <td className="py-1.5 text-right text-green-600">{sn.move ? fmtSigned(sn.move.qty_delta) : '—'}</td>
                        <td className="py-1.5 text-right text-gray-600">{sn.move?.cost_unit != null ? fmtMoney4(sn.move.cost_unit) : '—'}</td>
                        <td className="py-1.5">
                          {sn.move?.po ? (
                            <button type="button" onClick={() => navigate(`/purchasing/purchase-orders?tab=detail&id=${sn.move.po.id}`)} className="text-[#E10600] hover:underline font-mono">
                              {sn.move.po.reference}
                            </button>
                          ) : (sn.move?.reference ?? '—')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border rounded-xl overflow-hidden bg-white">
          <div className="px-4 py-3 border-b bg-gray-50 text-sm font-semibold text-gray-700">Seuils (règle de réappro)</div>
          {rule ? (
            <>
              <DetailRow label="Stock de sécurité">{fmtQty(rule.safety_stock)}</DetailRow>
              <DetailRow label="Point de réappro (seuil d'alerte)"><span className="text-amber-600">{fmtQty(rule.reorder_point)}</span></DetailRow>
              <DetailRow label="Quantité économique (EOQ)">{fmtQty(rule.economic_qty)}</DetailRow>
              <DetailRow label="Stock maximum">{rule.max_stock != null ? fmtQty(rule.max_stock) : 'Pas de plafond'}</DetailRow>
              <DetailRow label="Délai fournisseur">{rule.lead_time_days ?? '—'} j</DetailRow>
              <DetailRow label="Règle">{rule.is_active ? 'Active' : <span className="text-gray-400">Inactive (ignorée par les alertes)</span>}</DetailRow>
            </>
          ) : (
            <div className="px-4 py-6 text-sm text-gray-400 italic">
              Aucune règle de réappro pour ce couple : seule la rupture (disponible ≤ 0) est signalée.
            </div>
          )}
          <DetailRow label="Dernier comptage">{formatDate(row.last_counted_at)}</DetailRow>
          <DetailRow label="Mise à jour">{formatDateTime(row.updated_at)}</DetailRow>
        </div>

        <div className="border rounded-xl overflow-hidden bg-white">
          <div className="px-4 py-3 border-b bg-gray-50 text-sm font-semibold text-gray-700 flex items-center justify-between">
            <span>Dernier mouvement</span>
            <span className="text-xs font-normal text-gray-400">Append-only — lecture seule</span>
          </div>
          {movesLoading && <div className="px-4 py-6 text-sm text-gray-400"><Loader2 className="inline animate-spin mr-2" size={14} />Chargement...</div>}
          {!movesLoading && movesError && <div className="px-4 py-6 text-sm text-red-600">{movesError}</div>}
          {!movesLoading && !movesError && !lastMove && <div className="px-4 py-6 text-sm text-gray-400">Aucun mouvement enregistré.</div>}
          {!movesLoading && !movesError && lastMove && (
            <>
              <DetailRow label="Type">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${moveBadgeClass(lastMove.move_type?.name_fr)}`}>{lastMove.move_type?.name_fr ?? '—'}</span>
              </DetailRow>
              <DetailRow label="Quantité"><span className={N(lastMove.qty_delta) >= 0 ? 'text-green-600' : 'text-red-600'}>{fmtSigned(lastMove.qty_delta)}</span></DetailRow>
              <DetailRow label="Date">{formatDateTime(lastMove.created_at)}</DetailRow>
              <DetailRow label="Référence">{lastMove.reference ?? '—'}</DetailRow>
              <DetailRow label="Opérateur">{lastMove.operator?.full_name ?? 'Système'}</DetailRow>
              {moves.length > 1 && (
                <div className="px-4 py-3">
                  <p className="text-xs text-gray-400 mb-2">{moves.length} derniers mouvements</p>
                  <table className="w-full text-xs">
                    <tbody>
                      {moves.map((m) => (
                        <tr key={m.id} className="border-t">
                          <td className="py-1.5 text-gray-500">{formatDateTime(m.created_at)}</td>
                          <td className="py-1.5 text-gray-700">{m.move_type?.name_fr ?? '—'}</td>
                          <td className={`py-1.5 text-right font-semibold ${N(m.qty_delta) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmtSigned(m.qty_delta)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Onglet « Ajustement manuel » ───────────────────────────────────────────
// Utilise POST /stock/levels/adjust (contrat : qty_physical = NOUVELLE valeur
// absolue, move_type_id, reference ≤ 100 car.). Le motif est porté par `reference`.

function AdjustTab({ nodes, initial, canManage, onDone, navigate }) {
  const [nodeId, setNodeId] = useState(initial?.node_id || '');
  const [sku, setSku] = useState(initial?.sku || null);
  const [direction, setDirection] = useState('in');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  const [level, setLevel] = useState(null); // { qty_physical, qty_reserved } | null
  const [levelLoading, setLevelLoading] = useState(false);
  const [moveTypes, setMoveTypes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (initial) { setNodeId(initial.node_id || ''); setSku(initial.sku || null); setResult(null); }
  }, [initial]);

  useEffect(() => {
    getMoveTypesList().then((res) => setMoveTypes(asList(res))).catch(() => setMoveTypes([]));
  }, []);

  const loadLevel = useCallback(async () => {
    if (!nodeId || !sku) { setLevel(null); return null; }
    setLevelLoading(true);
    try {
      const list = asList(await getStockLevels({ node_id: nodeId, sku_id: sku.id }));
      const found = list.find((l) => l.sku_id === sku.id) || null;
      const lv = { qty_physical: N(found?.qty_physical), qty_reserved: N(found?.qty_reserved), exists: !!found };
      setLevel(lv);
      return lv;
    } catch (err) {
      setError(apiError(err, 'Impossible de lire le niveau de stock actuel.'));
      setLevel(null);
      return null;
    } finally {
      setLevelLoading(false);
    }
  }, [nodeId, sku]);

  useEffect(() => { loadLevel(); }, [loadLevel]);

  const q = Number(qty);
  const qtyValid = qty !== '' && Number.isFinite(q) && q > 0;
  const before = level ? level.qty_physical : null;
  const after = before !== null && qtyValid ? Math.round((before + (direction === 'in' ? q : -q)) * 1000) / 1000 : null;
  const availAfter = after !== null ? Math.max(0, after - N(level?.qty_reserved)) : null;
  const motif = reason === 'Autre' ? detail.trim() : [reason, detail.trim()].filter(Boolean).join(' — ');

  const moveTypeFor = (dir) => moveTypes.find((m) => m.code === (dir === 'in' ? 'adjustment_in' : 'adjustment_out'));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);
    if (!nodeId) return setError('Sélectionnez un node.');
    if (!sku) return setError('Sélectionnez un SKU.');
    if (!qtyValid) return setError('La quantité doit être un nombre strictement positif.');
    if (!reason) return setError('Le motif est obligatoire.');
    if (reason === 'Autre' && !detail.trim()) return setError('Précisez le motif (champ « Détail »).');
    const mt = moveTypeFor(direction);
    if (!mt) return setError("Type de mouvement d'ajustement introuvable (référentiel move_types : adjustment_in / adjustment_out).");

    setSaving(true);
    try {
      // Relit le stock juste avant l'envoi : l'ajustement porte sur le delta saisi
      const fresh = await loadLevel();
      if (!fresh) { setSaving(false); return; }
      const newQty = Math.round((fresh.qty_physical + (direction === 'in' ? q : -q)) * 1000) / 1000;
      if (newQty < 0) {
        setError(`Sortie impossible : le stock physique actuel est de ${fmtQty(fresh.qty_physical)}.`);
        setSaving(false);
        return;
      }
      const res = await adjustStockLevel({
        node_id: nodeId,
        sku_id: sku.id,
        qty_physical: newQty,
        move_type_id: mt.id,
        reference: motif.slice(0, 100),
      });
      const data = res?.data?.data ?? {};
      setResult({ before: fresh.qty_physical, after: N(data.level?.qty_physical ?? newQty), delta: N(data.qty_delta ?? newQty - fresh.qty_physical), node_id: nodeId, sku });
      toast.success('Ajustement enregistré (mouvement de stock créé)');
      setQty('');
      setDetail('');
      setReason('');
      loadLevel();
      onDone?.();
    } catch (err) {
      setError(apiError(err, "Erreur lors de l'ajustement."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <form onSubmit={submit} className="lg:col-span-2 bg-white border rounded-xl p-6 space-y-5">
        {!canManage && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Lecture seule : la permission « stock.manage » est requise pour ajuster un stock.
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Node <span className="text-[#E10600]">*</span></label>
            <select value={nodeId} onChange={(e) => setNodeId(e.target.value)} disabled={!canManage} className={`${inputCls} disabled:bg-gray-100`}>
              <option value="">Sélectionnez un node...</option>
              {nodes.map((n) => <option key={n.id} value={n.id}>{n.code} — {n.name_fr}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">SKU <span className="text-[#E10600]">*</span></label>
            <SkuCombobox value={sku} onChange={setSku} disabled={!canManage} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Sens <span className="text-[#E10600]">*</span></label>
            <div className="flex gap-2">
              {[
                { key: 'in', label: 'Entrée (+)', icon: Plus, on: 'bg-green-600 text-white border-green-600' },
                { key: 'out', label: 'Sortie (−)', icon: Minus, on: 'bg-red-600 text-white border-red-600' },
              ].map((d) => (
                <button
                  key={d.key}
                  type="button"
                  disabled={!canManage}
                  onClick={() => setDirection(d.key)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border ${direction === d.key ? d.on : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                >
                  <d.icon size={15} /> {d.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Quantité <span className="text-[#E10600]">*</span></label>
            <input type="number" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} disabled={!canManage} placeholder="ex. 12" className={`${inputCls} disabled:bg-gray-100`} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Motif <span className="text-[#E10600]">*</span></label>
            <select value={reason} onChange={(e) => setReason(e.target.value)} disabled={!canManage} className={`${inputCls} disabled:bg-gray-100`}>
              <option value="">Choisir un motif...</option>
              {ADJUST_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Détail {reason === 'Autre' && <span className="text-[#E10600]">*</span>}</label>
            <input type="text" maxLength={80} value={detail} onChange={(e) => setDetail(e.target.value)} disabled={!canManage} placeholder="Précision (facultatif)" className={`${inputCls} disabled:bg-gray-100`} />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center justify-end gap-3 pt-2 border-t">
          <button
            type="submit"
            disabled={saving || !canManage}
            className="px-5 py-2.5 text-sm rounded-lg bg-[#E10600] text-white font-semibold hover:bg-[#c00500] disabled:opacity-60 flex items-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Valider ajustement
          </button>
        </div>
      </form>

      <div className="space-y-4">
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50 text-sm font-semibold text-gray-700 flex items-center justify-between">
            <span>Aperçu</span>
            {levelLoading && <Loader2 size={14} className="animate-spin text-gray-400" />}
          </div>
          <DetailRow label="Qté physique avant">{before !== null ? fmtQty(before) : '—'}</DetailRow>
          <DetailRow label="Mouvement">
            {qtyValid ? <span className={direction === 'in' ? 'text-green-600' : 'text-red-600'}>{direction === 'in' ? '+' : '−'}{fmtQty(q)}</span> : '—'}
          </DetailRow>
          <DetailRow label="Qté physique après">
            {after !== null ? <span className={after < 0 ? 'text-red-600' : ''}>{fmtQty(after)}</span> : '—'}
          </DetailRow>
          <DetailRow label="Réservé">{level ? fmtQty(level.qty_reserved) : '—'}</DetailRow>
          <DetailRow label="Disponible après">{availAfter !== null ? fmtQty(availAfter) : '—'}</DetailRow>
          <DetailRow label="Motif enregistré"><span className="text-xs">{motif || '—'}</span></DetailRow>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">
          L'ajustement crée un mouvement de stock (stock_moves, append-only, type « Ajustement entrée / sortie »)
          et met à jour stock_levels (qty_available = qty_physical − qty_reserved).
        </p>
        {result && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
            <p className="font-semibold mb-1">Ajustement enregistré</p>
            <p>{result.sku?.sku_code} : {fmtQty(result.before)} → {fmtQty(result.after)} ({fmtSigned(result.delta)})</p>
            <button
              type="button"
              onClick={() => navigate(`/stock/moves?node_id=${result.node_id}&sku_id=${result.sku?.id}`)}
              className="mt-2 inline-flex items-center gap-1 text-[#E10600] font-medium hover:underline"
            >
              Voir le mouvement <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Onglet « Alertes rupture » (lecture seule, US-113) ─────────────────────

function AlertsTab({ nodes, initialNode, navigate }) {
  const [nodeId, setNodeId] = useState(initialNode || '');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getReorderAlerts({ ...(nodeId ? { node_id: nodeId } : {}) });
      setRows(asList(res));
    } catch (err) {
      setError(apiError(err, 'Erreur lors du chargement des alertes.'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [nodeId]);

  useEffect(() => { load(); }, [load]);

  const ruptureCount = rows.filter((r) => r.alert_status === 'rupture').length;
  const alerteCount = rows.filter((r) => r.alert_status === 'alerte').length;

  const filtered = useMemo(() => {
    let list = rows;
    if (status) list = list.filter((r) => r.alert_status === status);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((r) => r.sku?.sku_code?.toLowerCase().includes(q) || r.sku?.name_fr?.toLowerCase().includes(q));
    return list;
  }, [rows, status, search]);

  const EXPORT_HEADERS = ['Statut', 'Node', 'SKU', 'Nom', 'Famille', 'Physique', 'Réservé', 'Disponible', 'Stock sécurité', 'Point réappro', 'Couverture %', 'Entrant'];
  const exportRows = () => filtered.map((r) => [
    r.alert_status === 'rupture' ? 'Rupture' : 'Alerte', r.node?.code, r.sku?.sku_code, r.sku?.name_fr, r.sku?.family?.name_fr,
    r.qty_physical, r.qty_reserved, r.qty_available,
    r.has_rule ? r.safety_stock : 'Aucune règle', r.has_rule ? r.reorder_point : 'Aucune règle',
    r.coverage_pct ?? '', r.qty_incoming,
  ]);

  const exportCsv = () => {
    downloadCsv(`alertes-rupture-${todayStamp()}.csv`, EXPORT_HEADERS, exportRows());
  };

  const [pdfBusy, setPdfBusy] = useState(false);
  const exportAlertsPdf = async () => {
    setPdfBusy(true);
    try {
      const node = nodes.find((n) => n.id === nodeId);
      await exportPdf({
        title: 'Alertes rupture — Niveaux de stock',
        subtitle: `${ruptureCount} rupture(s) (disponible ≤ 0) · ${alerteCount} alerte(s) (disponible ≤ point de réappro)`,
        filters: [
          ['Node', node ? `${node.code} — ${node.name_fr}` : 'Tous les nodes'],
          ['Statut', ALERT_FILTERS.find((t) => t.key === status)?.label ?? 'Tous'],
          ['Recherche', search.trim()],
        ],
        sections: [{ headers: EXPORT_HEADERS, rows: exportRows(), align: { 5: 'right', 6: 'right', 7: 'right', 8: 'right', 9: 'right', 10: 'right', 11: 'right' } }],
        orientation: 'landscape',
        filename: `alertes-rupture-${todayStamp()}.pdf`,
      });
    } catch (err) {
      toast.error(apiError(err, "Erreur lors de l'export PDF."));
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select value={nodeId} onChange={(e) => setNodeId(e.target.value)} className={selectCls}>
          <option value="">Tous les nodes</option>
          {nodes.map((n) => <option key={n.id} value={n.id}>{n.code} — {n.name_fr}</option>)}
        </select>
        <div className="flex gap-2">
          {ALERT_FILTERS.map((t) => (
            <button
              key={t.key || 'all'}
              onClick={() => setStatus(t.key)}
              className={`px-3 py-2 text-sm rounded-lg font-medium ${status === t.key ? 'bg-[#E10600] text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="SKU code ou nom..." className="pl-9 pr-3 py-2 border rounded-lg text-sm w-56 focus:ring-2 focus:ring-[#E10600] outline-none" />
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700"><PackageX size={14} /> {ruptureCount} rupture(s)</span>
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-700"><AlertTriangle size={14} /> {alerteCount} alerte(s)</span>
          <button onClick={load} title="Rafraîchir" className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"><RefreshCw size={15} /></button>
          <button onClick={exportCsv} disabled={!filtered.length} className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            <Download size={15} /> Exporter
          </button>
          <button onClick={exportAlertsPdf} disabled={pdfBusy || loading} className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            {pdfBusy ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />} Exporter PDF
          </button>
        </div>
      </div>

      <div className="border rounded-xl overflow-x-auto bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-left border-b">
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 font-medium">Node</th>
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium">Nom</th>
              <th className="px-4 py-3 font-medium text-right">Physique</th>
              <th className="px-4 py-3 font-medium text-right">Réservé</th>
              <th className="px-4 py-3 font-medium text-right">Disponible</th>
              <th className="px-4 py-3 font-medium text-right">Stock sécurité</th>
              <th className="px-4 py-3 font-medium text-right">Point réappro</th>
              <th className="px-4 py-3 font-medium text-right">Couverture</th>
              <th className="px-4 py-3 font-medium text-right">Entrant</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={12} className="px-4 py-10 text-center text-gray-400"><Loader2 className="inline animate-spin mr-2" size={16} />Chargement...</td></tr>}
            {!loading && error && <tr><td colSpan={12} className="px-4 py-10 text-center text-red-600">{error}</td></tr>}
            {!loading && !error && filtered.length === 0 && (
              <tr><td colSpan={12} className="px-4 py-10 text-center text-gray-400">Aucun SKU en alerte ou en rupture pour ces filtres.</td></tr>
            )}
            {!loading && !error && filtered.map((r) => (
              <tr key={keyOf(r.node_id, r.sku_id)} className={`border-b last:border-0 ${r.alert_status === 'rupture' ? 'bg-red-50/70' : 'bg-amber-50/70'}`}>
                <td className="px-4 py-3"><StatusBadge status={r.alert_status} /></td>
                <td className="px-4 py-3 font-medium text-[#E10600]">{r.node?.code}</td>
                <td className="px-4 py-3 text-gray-600">{r.sku?.sku_code}</td>
                <td className="px-4 py-3 text-gray-900">{r.sku?.name_fr}</td>
                <td className="px-4 py-3 text-right">{fmtQty(r.qty_physical)}</td>
                <td className="px-4 py-3 text-right text-amber-600">{fmtQty(r.qty_reserved)}</td>
                <td className={`px-4 py-3 text-right font-semibold ${r.alert_status === 'rupture' ? 'text-red-700' : 'text-amber-700'}`}>{fmtQty(r.qty_available)}</td>
                <td className="px-4 py-3 text-right">{r.has_rule ? fmtQty(r.safety_stock) : <span className="italic text-gray-400">—</span>}</td>
                <td className="px-4 py-3 text-right">{r.has_rule ? fmtQty(r.reorder_point) : <span className="italic text-gray-400">Aucune règle</span>}</td>
                <td className="px-4 py-3 text-right">{r.coverage_pct != null ? `${r.coverage_pct} %` : '—'}</td>
                <td className="px-4 py-3 text-right text-blue-600">{fmtQty(r.qty_incoming)}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => navigate(`/stock/reorder-rules?node_id=${r.node_id}&sku_id=${r.sku_id}`)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-[#E10600] text-white font-medium hover:bg-[#c00500] whitespace-nowrap"
                  >
                    Aller au réappro <ArrowRight size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 mt-3">
        Lecture seule — aucun ajustement ni mouvement ici. Rupture : disponible ≤ 0 (rouge) • Alerte : disponible ≤ point de réappro d'une règle active (ambre).
        Un SKU sans règle n'apparaît qu'en rupture. Couverture = disponible / point de réappro.
      </p>
    </>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function StockLevelsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('stock.manage');

  const urlSku = searchParams.get('sku_id');
  const urlNode = searchParams.get('node_id');
  const initialTab = TABS.some((t) => t.key === searchParams.get('tab'))
    ? searchParams.get('tab')
    : (urlSku && urlNode ? 'detail' : 'niveaux');
  const [activeTab, setActiveTab] = useState(initialTab);
  const [nodeFilter, setNodeFilter] = useState(searchParams.get('node_id') || '');
  const [familyFilter, setFamilyFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [brandSkuIds, setBrandSkuIds] = useState(null); // Set | null
  const [seuilFilter, setSeuilFilter] = useState(searchParams.get('seuil') || 'tous');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: 'available', dir: 'asc' });

  const [rows, setRows] = useState([]);
  const [rules, setRules] = useState({});
  const [nodes, setNodes] = useState([]);
  const [families, setFamilies] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedKey, setSelectedKey] = useState(urlSku && urlNode ? keyOf(urlNode, urlSku) : null);
  const [adjustInitial, setAdjustInitial] = useState(null);

  useEffect(() => {
    getNodes({ limit: 500 }).then((res) => setNodes(asList(res))).catch(() => setNodes([]));
    getFamiliesList().then((res) => setFamilies(asList(res))).catch(() => setFamilies([]));
    getBrandsList().then((res) => setBrands(asList(res))).catch(() => setBrands([]));
  }, []);

  const fetchLevels = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (nodeFilter) params.node_id = nodeFilter;
      if (familyFilter) params.sku_family_id = familyFilter;
      const [levelsRes, rulesRes] = await Promise.all([
        getStockLevels(params),
        getReorderThresholds(nodeFilter ? { node_id: nodeFilter } : {}).catch(() => null),
      ]);
      setRows(asList(levelsRes));
      setRules(Object.fromEntries(asList(rulesRes).map((r) => [keyOf(r.node_id, r.sku_id), r])));
    } catch (err) {
      setError(apiError(err, 'Erreur lors du chargement des niveaux de stock.'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [nodeFilter, familyFilter]);

  useEffect(() => { fetchLevels(); }, [fetchLevels]);

  // Filtre marque : stock_levels ne porte pas la marque → on récupère les SKU de la marque
  useEffect(() => {
    if (!brandFilter) { setBrandSkuIds(null); return; }
    let cancelled = false;
    getSkus({ brand_id: brandFilter, limit: 10000 })
      .then((res) => { if (!cancelled) setBrandSkuIds(new Set(asList(res).map((s) => s.id))); })
      .catch(() => { if (!cancelled) setBrandSkuIds(new Set()); });
    return () => { cancelled = true; };
  }, [brandFilter]);

  const nodesById = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);

  const familyOptions = useMemo(() => {
    if (families.length) return families;
    const map = new Map();
    rows.forEach((r) => { if (r.sku?.family) map.set(r.sku.family.id, r.sku.family); });
    return Array.from(map.values());
  }, [families, rows]);

  const enriched = useMemo(() => rows.map((r) => {
    const rule = rules[keyOf(r.node_id, r.sku_id)] || null;
    return { ...r, _rule: rule, _status: statusOf(r, rule), _node: nodesById[r.node_id] };
  }), [rows, rules, nodesById]);

  const filtered = useMemo(() => {
    let list = enriched;
    if (brandSkuIds) list = list.filter((r) => brandSkuIds.has(r.sku_id));
    if (seuilFilter !== 'tous') list = list.filter((r) => r._status === seuilFilter);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((r) => r.sku?.sku_code?.toLowerCase().includes(q) || r.sku?.name_fr?.toLowerCase().includes(q) || r.sku?.ean13?.includes(q));
    const val = (r) => ({
      physical: N(r.qty_physical), reserved: N(r.qty_reserved), available: N(r.qty_available),
      backordered: N(r.qty_backordered), incoming: N(r.qty_incoming), cod: N(r.qty_floating_cod),
    }[sort.key] ?? N(r.qty_available));
    return [...list].sort((a, b) => (sort.dir === 'asc' ? val(a) - val(b) : val(b) - val(a)));
  }, [enriched, brandSkuIds, seuilFilter, search, sort]);

  const selectedRow = useMemo(
    () => (selectedKey ? enriched.find((r) => keyOf(r.node_id, r.sku_id) === selectedKey) || null : null),
    [enriched, selectedKey],
  );

  const toggleSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  const openDetail = (row) => { setSelectedKey(keyOf(row.node_id, row.sku_id)); setActiveTab('detail'); };
  const openAdjust = (row) => {
    setAdjustInitial(row
      ? { node_id: row.node_id, sku: { id: row.sku_id, sku_code: row.sku?.sku_code, name_fr: row.sku?.name_fr } }
      : { node_id: nodeFilter || '', sku: null });
    setActiveTab('ajustement');
  };

  const exportLevels = () => {
    downloadCsv(`niveaux-de-stock-${todayStamp()}.csv`,
      ['Node', 'SKU', 'Nom', 'Famille', 'Physique', 'Réservé', 'Disponible', 'Backorder', 'Entrant', 'COD flottant', 'Point réappro', 'Stock sécurité', 'Statut', 'Dernier comptage'],
      filtered.map((r) => [
        r._node?.code ?? '', r.sku?.sku_code, r.sku?.name_fr, r.sku?.family?.name_fr,
        N(r.qty_physical), N(r.qty_reserved), N(r.qty_available), N(r.qty_backordered), N(r.qty_incoming), N(r.qty_floating_cod),
        r._rule ? N(r._rule.reorder_point) : '', r._rule ? N(r._rule.safety_stock) : '',
        STATUS_CONFIG[r._status]?.label, formatDate(r.last_counted_at),
      ]));
  };

  const SortTh = ({ k, children }) => (
    <th className="px-3 py-3 font-medium cursor-pointer select-none text-right" onClick={() => toggleSort(k)}>
      <span className="inline-flex items-center gap-1">{children} <ArrowUpDown size={12} className={sort.key === k ? 'text-[#E10600]' : ''} /></span>
    </th>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-poppins font-bold text-2xl text-gray-900">Niveaux de stock</h1>
          <p className="text-sm text-gray-500 mt-1">Maille node × SKU — qty_available = qty_physical − qty_reserved.</p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'niveaux' && (
            <button onClick={exportLevels} disabled={!filtered.length} className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              <Download size={16} /> Exporter
            </button>
          )}
          {canManage && activeTab !== 'ajustement' && activeTab !== 'alertes' && (
            <button onClick={() => openAdjust(activeTab === 'detail' ? selectedRow : null)} className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-[#E10600] text-white font-medium hover:bg-[#c00500]">
              <SlidersHorizontal size={16} /> Ajuster stock
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-6 border-b border-gray-200 mb-4 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`pb-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${activeTab === t.key ? 'border-[#E10600] text-[#E10600]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'niveaux' && (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <select value={nodeFilter} onChange={(e) => setNodeFilter(e.target.value)} className={selectCls}>
              <option value="">Tous les nodes</option>
              {nodes.map((n) => <option key={n.id} value={n.id}>{n.code} — {n.name_fr}</option>)}
            </select>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="SKU code, nom ou EAN..." className="pl-9 pr-3 py-2 border rounded-lg text-sm w-60 focus:ring-2 focus:ring-[#E10600] outline-none" />
            </div>
            <select value={familyFilter} onChange={(e) => setFamilyFilter(e.target.value)} className={selectCls}>
              <option value="">Toutes familles</option>
              {familyOptions.map((f) => <option key={f.id} value={f.id}>{f.name_fr}</option>)}
            </select>
            <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} className={selectCls}>
              <option value="">Toutes marques</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name_fr}</option>)}
            </select>
            <div className="flex flex-wrap gap-2 ml-auto">
              {SEUIL_FILTERS.map((t) => (
                <button key={t.key} onClick={() => setSeuilFilter(t.key)} className={`px-3 py-2 text-sm rounded-lg font-medium ${seuilFilter === t.key ? 'bg-[#E10600] text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border rounded-xl overflow-x-auto bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-left border-b">
                  <th className="px-3 py-3 font-medium">Node</th>
                  <th className="px-3 py-3 font-medium">SKU</th>
                  <th className="px-3 py-3 font-medium">Nom</th>
                  <th className="px-3 py-3 font-medium">Famille</th>
                  <SortTh k="physical">Physique</SortTh>
                  <SortTh k="reserved">Réservé</SortTh>
                  <SortTh k="available">Disponible</SortTh>
                  <SortTh k="backordered">Backorder</SortTh>
                  <SortTh k="incoming">Entrant</SortTh>
                  <SortTh k="cod">COD flottant</SortTh>
                  <th className="px-3 py-3 font-medium text-right">Seuil réappro</th>
                  <th className="px-3 py-3 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={12} className="px-4 py-10 text-center text-gray-400"><Loader2 className="inline animate-spin mr-2" size={16} />Chargement...</td></tr>}
                {!loading && error && <tr><td colSpan={12} className="px-4 py-10 text-center text-red-600">{error}</td></tr>}
                {!loading && !error && filtered.length === 0 && <tr><td colSpan={12} className="px-4 py-10 text-center text-gray-400">Aucun niveau de stock pour ces filtres.</td></tr>}
                {!loading && !error && filtered.map((r) => (
                  <tr key={keyOf(r.node_id, r.sku_id)} onClick={() => openDetail(r)} className="border-b last:border-0 hover:bg-gray-50 cursor-pointer">
                    <td className="px-3 py-3 font-medium text-[#E10600]">{r._node?.code ?? '—'}</td>
                    <td className="px-3 py-3 text-gray-600">{r.sku?.sku_code ?? '—'}</td>
                    <td className="px-3 py-3 text-gray-900">{r.sku?.name_fr ?? '—'}</td>
                    <td className="px-3 py-3 text-gray-500">{r.sku?.family?.name_fr ?? '—'}</td>
                    <td className="px-3 py-3 text-right text-gray-700">{fmtQty(r.qty_physical)}</td>
                    <td className="px-3 py-3 text-right text-amber-600">{fmtQty(r.qty_reserved)}</td>
                    <td className="px-3 py-3 text-right font-semibold text-gray-900">{fmtQty(r.qty_available)}</td>
                    <td className="px-3 py-3 text-right text-purple-600">{fmtQty(r.qty_backordered)}</td>
                    <td className="px-3 py-3 text-right text-blue-600">{fmtQty(r.qty_incoming)}</td>
                    <td className="px-3 py-3 text-right text-gray-600">{fmtQty(r.qty_floating_cod)}</td>
                    <td className="px-3 py-3 text-right text-gray-700">{r._rule ? fmtQty(r._rule.reorder_point) : <span className="italic text-gray-400">—</span>}</td>
                    <td className="px-3 py-3"><StatusBadge status={r._status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && !error && (
            <p className="text-xs text-gray-400 mt-3">{filtered.length} ligne(s) • Clic sur une ligne → Détail SKU×Node • Seuil = point de réappro de la règle active (Paramètres Stock).</p>
          )}
        </>
      )}

      {activeTab === 'detail' && (
        <DetailTab
          row={selectedRow}
          rule={selectedRow?._rule}
          nodes={nodes}
          rows={enriched}
          onPick={openDetail}
          onAdjust={openAdjust}
          navigate={navigate}
        />
      )}

      {activeTab === 'ajustement' && (
        <AdjustTab nodes={nodes} initial={adjustInitial} canManage={canManage} onDone={fetchLevels} navigate={navigate} />
      )}

      {activeTab === 'alertes' && (
        <AlertsTab nodes={nodes} initialNode={nodeFilter} navigate={navigate} />
      )}
    </div>
  );
}
