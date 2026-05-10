import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { getOrdersMeta, getOrders, getOrder, getOrderTransitions, getOrderHistory, changeOrderStatus, cancelOrder } from '../../api/orders_mgmt.api';
import { getErrorMessage, formatDate } from '../../utils/helpers';

// ── Helpers ───────────────────────────────────────────────────────────────────
const ordId = (id) => 'ORD-' + (id ?? '').slice(0, 8).toUpperCase();

function elapsed(dateStr) {
  const d = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
  if (d === 0) return "Aujourd'hui";
  if (d === 1) return '1j';
  return `${d}j`;
}

function hexBadge(color, label) {
  const hex = color?.startsWith('#') ? color : '#64748b';
  return { backgroundColor: `${hex}18`, color: hex, border: `1px solid ${hex}40` };
}

const DAYS_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const DAYS_FULL  = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

// Compute the next calendar date matching day_of_week, starting from refDate
function nextSlotDate(day_of_week, refDateStr) {
  const ref  = refDateStr ? new Date(refDateStr) : new Date();
  const diff = (day_of_week - ref.getDay() + 7) % 7;
  const d    = new Date(ref);
  d.setDate(d.getDate() + diff);
  return d.toLocaleDateString('fr-MA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const SVG = {
  search:  'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  x:       'M6 18L18 6M6 6l12 12',
  check:   'M5 13l4 4L19 7',
  cancel:  'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
  truck:   'M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0',
  pin:     'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z',
  card:    'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  wallet:  'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  clock:   'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  box:     'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  history: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  node:    'M3 7l9-4 9 4-9 4-9-4zm0 5l9 4 9-4m-18 5l9 4 9-4',
  chevron: 'M9 5l7 7-7 7',
  down:    'M19 9l-7 7-7-7',
  filter:  'M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z',
};

function Icon({ d, className = 'w-4 h-4' }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} /></svg>;
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status, size = 'sm' }) {
  if (!status) return null;
  const hex = status.color?.startsWith('#') ? status.color : '#64748b';
  const cls = size === 'lg' ? 'px-3 py-1 text-sm font-bold rounded-lg' : 'px-2 py-0.5 text-xs font-semibold rounded-full';
  return (
    <span className={`inline-flex items-center gap-1.5 ${cls}`}
      style={{ backgroundColor: `${hex}20`, color: hex, border: `1px solid ${hex}40` }}>
      {size !== 'lg' && <span style={{ backgroundColor: hex }} className="w-1.5 h-1.5 rounded-full flex-shrink-0" />}
      {status.name_fr}
    </span>
  );
}

// ── Detail Panel ──────────────────────────────────────────────────────────────
function DetailPanel({ orderId, onClose, onStatusChanged }) {
  const [order, setOrder]           = useState(null);
  const [transitions, setTransitions] = useState([]);
  const [history, setHistory]       = useState([]);
  const [tab, setTab]               = useState('resume');
  const [loading, setLoading]       = useState(true);
  const [acting, setActing]         = useState(false);

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const [oRes, tRes, hRes] = await Promise.all([
        getOrder(orderId),
        getOrderTransitions(orderId),
        getOrderHistory(orderId),
      ]);
      setOrder(oRes.data?.data);
      setTransitions(tRes.data?.data ?? []);
      setHistory(hRes.data?.data ?? []);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, [orderId]);

  useEffect(() => { setTab('resume'); load(); }, [load]);

  const handleTransition = async (status_code, label) => {
    if (status_code === 'cancelled' && !window.confirm(`Annuler la commande ${ordId(orderId)} ?`)) return;
    setActing(true);
    try {
      await changeOrderStatus(orderId, status_code);
      toast.success(`${label} effectué`);
      await load();
      onStatusChanged?.();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setActing(false); }
  };

  const TABS = [
    { id: 'resume',    label: 'Résumé'    },
    { id: 'articles',  label: 'Articles'  },
    { id: 'creneau',   label: 'Créneau'   },
    { id: 'paiement',  label: 'Paiement'  },
    { id: 'historique',label: 'Historique'},
  ];

  const mainActions = transitions.filter(t => t.code !== 'cancelled');
  const cancelAction = transitions.find(t => t.code === 'cancelled');

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Panel header */}
      <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-gray-900 font-mono">{ordId(orderId)}</h2>
            {order && <StatusBadge status={order.status} size="lg" />}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{order?.customer?.name ?? '…'}</p>
        </div>
        <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <Icon d={SVG.x} className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 px-6 flex-shrink-0 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`py-3 px-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-all -mb-px ${
              tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}>{t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
        ) : !order ? (
          <div className="p-6 text-center text-gray-400 text-sm">Commande introuvable</div>
        ) : (
          <>
            {/* ── RÉSUMÉ ─────────────────────────────────────────────────── */}
            {tab === 'resume' && (
              <div className="p-6 space-y-6">
                {/* Client */}
                <section>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Client</p>
                  <p className="text-lg font-bold text-gray-900">{order.customer?.name}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{order.customer?.phone_country} {order.customer?.phone_number}</p>
                  <div className="flex gap-4 mt-2 text-sm">
                    <span className="text-violet-700 font-semibold">Wallet: {Number(order.customer?.wallet_balance ?? 0).toFixed(2)} MAD</span>
                    <span className="text-amber-600 font-semibold">Points: {order.customer?.points_balance ?? 0} pts</span>
                  </div>
                </section>

                {/* Address */}
                {order.address && (
                  <section className="border-t border-gray-50 pt-5">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Adresse de livraison</p>
                    <p className="text-sm font-semibold text-gray-800">
                      {order.address.street_number && `${order.address.street_number} `}{order.address.street_name}
                      {order.address.quartier && `, ${order.address.quartier}`}
                    </p>
                    <p className="text-sm text-gray-500">{order.address.city}{order.address.postal_code && `, ${order.address.postal_code}`}</p>
                    {order.address.delivery_notes && (
                      <p className="text-xs text-gray-400 mt-1 italic">Note: {order.address.delivery_notes}</p>
                    )}
                  </section>
                )}

                {/* Node */}
                <section className="border-t border-gray-50 pt-5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Node préparateur</p>
                  <div className="flex items-center gap-2">
                    <Icon d={SVG.node} className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-semibold text-gray-800">{order.node?.name_fr}</span>
                    <span className="text-xs font-mono text-gray-400">{order.node?.code}</span>
                  </div>
                </section>

                {/* Totaux */}
                <section className="border-t border-gray-50 pt-5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Totaux</p>
                  <div className="space-y-2 text-sm">
                    {[
                      { label: 'Sous-total HT',   value: Number(order.subtotal_ht).toFixed(2) + ' MAD', muted: true },
                      { label: 'TVA',             value: Number(order.vat_amount).toFixed(2) + ' MAD', muted: true },
                      { label: 'Frais de livraison', value: Number(order.delivery_fee).toFixed(2) + ' MAD', muted: true },
                      Number(order.discount_amount) > 0 && { label: 'Réduction promo', value: '-' + Number(order.discount_amount).toFixed(2) + ' MAD', red: true },
                      Number(order.wallet_used) > 0 && { label: 'Wallet utilisé', value: Number(order.wallet_used).toFixed(2) + ' MAD', muted: true },
                    ].filter(Boolean).map((row, i) => (
                      <div key={i} className="flex justify-between">
                        <span className="text-gray-500">{row.label}</span>
                        <span className={row.red ? 'text-red-600 font-semibold' : 'text-gray-700'}>{row.value}</span>
                      </div>
                    ))}
                    <div className="flex justify-between pt-2 border-t border-gray-100 font-bold text-base">
                      <span className="text-gray-900">Total TTC</span>
                      <span className="text-gray-900">{Number(order.total_ttc).toFixed(2)} MAD</span>
                    </div>
                  </div>
                </section>

                {order.notes && (
                  <section className="border-t border-gray-50 pt-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Notes</p>
                    <p className="text-sm text-gray-600 italic">{order.notes}</p>
                  </section>
                )}
              </div>
            )}

            {/* ── ARTICLES ───────────────────────────────────────────────── */}
            {tab === 'articles' && (
              <div className="p-6">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">{order.items?.length} article{order.items?.length !== 1 ? 's' : ''}</p>
                <div className="space-y-3">
                  {order.items?.map((item, i) => {
                    const name = item.sku?.article?.name_fr ?? `SKU-${item.sku_id?.slice(0,6)}`;
                    const code = item.sku?.article?.sku_code ?? '—';
                    const lineTotal = Number(item.qty) * Number(item.unit_price_sold);
                    return (
                      <div key={i} className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
                          <Icon d={SVG.box} className="w-5 h-5 text-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800 text-sm truncate">{name}</p>
                          <p className="text-[11px] font-mono text-gray-400">{code}</p>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-xs text-gray-500">Qté: <strong>{Number(item.qty)}</strong></span>
                            <span className="text-xs text-gray-500">{Number(item.unit_price_sold).toFixed(2)} MAD/u</span>
                            {item.discount_amount > 0 && <span className="text-xs text-red-500">-{item.discount_amount} MAD</span>}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-bold text-gray-900 text-sm">{lineTotal.toFixed(2)} MAD</p>
                          {item.status && <StatusBadge status={item.status} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── CRÉNEAU ────────────────────────────────────────────────── */}
            {tab === 'creneau' && (
              <div className="p-6">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Créneau de livraison</p>
                {order.confirmed_slot ? (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <Icon d={SVG.clock} className="w-6 h-6 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-blue-800 text-base">{order.confirmed_slot.name_fr}</p>
                        <p className="text-lg font-mono font-bold text-blue-700 mt-0.5">
                          {order.confirmed_slot.slot_start} – {order.confirmed_slot.slot_end}
                        </p>
                        <p className="text-sm text-blue-600 font-semibold capitalize mt-1">
                          {nextSlotDate(order.confirmed_slot.day_of_week, order.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-8">Aucun créneau confirmé</p>
                )}
                <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">Livraison</p>
                  <p className="text-sm font-semibold text-gray-800">{order.delivery_type?.name_fr}</p>
                </div>
              </div>
            )}

            {/* ── PAIEMENT ───────────────────────────────────────────────── */}
            {tab === 'paiement' && (
              <div className="p-6 space-y-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Paiements</p>
                {!order.payments?.length ? (
                  <p className="text-sm text-gray-400 text-center py-8">Aucun paiement enregistré</p>
                ) : order.payments.map((pay, i) => {
                  const hexPay = pay.status?.code === 'collected' ? '#10b981' : pay.status?.code === 'pending' ? '#f97316' : '#64748b';
                  return (
                    <div key={i} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Icon d={SVG.card} className="w-4 h-4 text-gray-400" />
                          <span className="font-semibold text-sm text-gray-800">{pay.payment_method?.name_fr ?? 'Inconnu'}</span>
                        </div>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: `${hexPay}18`, color: hexPay, border: `1px solid ${hexPay}40` }}>
                          {pay.status?.name_fr}
                        </span>
                      </div>
                      <p className="text-xl font-bold text-gray-900">{Number(pay.amount).toFixed(2)} {pay.currency}</p>
                      <p className="text-xs text-gray-400 mt-1">{formatDate(pay.created_at)}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── HISTORIQUE ─────────────────────────────────────────────── */}
            {tab === 'historique' && (
              <div className="p-6">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-5">
                  Historique — {history.length} événement{history.length !== 1 ? 's' : ''}
                </p>
                {history.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">Aucun historique disponible</p>
                ) : (
                  <div className="relative">
                    {/* Vertical line */}
                    <div className="absolute left-4 top-4 bottom-4 w-px bg-gray-200" />

                    <div className="space-y-0">
                      {history.map((entry, i) => {
                        const hex     = entry.status?.color?.startsWith('#') ? entry.status.color : '#64748b';
                        const isLast  = i === history.length - 1;
                        const isFirst = i === 0;
                        const d       = new Date(entry.created_at);
                        const date    = d.toLocaleDateString('fr-MA', { day: '2-digit', month: 'short', year: 'numeric' });
                        const time    = d.toLocaleTimeString('fr-MA', { hour: '2-digit', minute: '2-digit' });

                        return (
                          <div key={entry.id} className={`flex gap-4 ${!isLast ? 'pb-6' : ''}`}>
                            {/* Dot */}
                            <div className="relative z-10 flex-shrink-0">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center border-2 border-white"
                                style={{ backgroundColor: `${hex}20`, border: `2px solid ${hex}` }}>
                                {isLast
                                  ? <span style={{ backgroundColor: hex }} className="w-3 h-3 rounded-full" />
                                  : <Icon d={SVG.check} className="w-3.5 h-3.5" style={{ color: hex }} />
                                }
                              </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0 pt-0.5">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <span className="text-sm font-bold" style={{ color: hex }}>
                                    {entry.status?.name_fr}
                                  </span>
                                  {entry.note && (
                                    <p className="text-xs text-gray-500 mt-0.5 italic">{entry.note}</p>
                                  )}
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <p className="text-xs font-semibold text-gray-700">{time}</p>
                                  <p className="text-[11px] text-gray-400">{date}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Action buttons */}
      {!loading && order && !order.status?.is_terminal && (
        <div className="border-t border-gray-100 p-4 flex-shrink-0 space-y-2">
          {mainActions.length > 0 && (
            <div className="flex gap-2">
              {mainActions.map(t => (
                <button key={t.code} onClick={() => handleTransition(t.code, t.label)} disabled={acting}
                  className="flex-1 py-2.5 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-50 transition-colors">
                  {acting ? '…' : t.label}
                </button>
              ))}
            </div>
          )}
          {cancelAction && (
            <button onClick={() => handleTransition('cancelled', 'Annuler')} disabled={acting}
              className="w-full py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 border border-red-200 rounded-xl disabled:opacity-50 transition-colors">
              Annuler la commande
            </button>
          )}
        </div>
      )}
      {!loading && order?.status?.is_terminal && (
        <div className="border-t border-gray-100 p-4 flex-shrink-0">
          <div className="text-center py-2 text-sm text-gray-400">
            Statut terminal — aucune action possible
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function OrdersListPage() {
  const [orders, setOrders]   = useState([]);
  const [meta, setMeta]       = useState({ status_counts: [], nodes: [], delivery_types: [] });
  const [total, setTotal]     = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);

  // Filters
  const [search, setSearch]           = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [nodeFilter, setNodeFilter]   = useState('');
  const [typeFilter, setTypeFilter]   = useState('');

  // Load meta (status counts + nodes + delivery types)
  const loadMeta = useCallback(async () => {
    try { const r = await getOrdersMeta(); setMeta(r.data?.data ?? {}); }
    catch { /* ignore */ }
  }, []);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 25 };
      if (search)       params.search = search;
      if (statusFilter) params.status_code = statusFilter;
      if (nodeFilter)   params.node_id = nodeFilter;
      if (typeFilter)   params.delivery_type_code = typeFilter;
      const r = await getOrders(params);
      const d = r.data;
      setOrders(d?.data ?? []);
      setTotal(d?.pagination?.total ?? 0);
      setTotalPages(d?.pagination?.pages ?? 0);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, [page, search, statusFilter, nodeFilter, typeFilter]);

  useEffect(() => { loadMeta(); }, [loadMeta]);
  useEffect(() => { loadOrders(); }, [loadOrders]);

  const applySearch = (e) => { e?.preventDefault(); setPage(1); setSearch(searchInput); };
  const setStatusTab = (code) => { setStatusFilter(code); setPage(1); };

  // Status tabs — deduplicated by code
  const seenCodes = new Set();
  const statusTabs = [{ code: '', name_fr: 'Tous', color: '#6b7280', count: total }, ...(meta.status_counts ?? [])].filter(s => {
    if (seenCodes.has(s.code)) return false;
    seenCodes.add(s.code);
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 shadow-sm flex-shrink-0">
        <div className="px-6 pt-5 pb-0">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Commandes Client</h1>
            <span className="text-sm text-gray-400">{total} commande{total !== 1 ? 's' : ''}</span>
          </div>

          {/* Search + filters row */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <form onSubmit={applySearch} className="flex items-center gap-2 flex-1 min-w-[260px] max-w-sm">
              <div className="relative flex-1">
                <Icon d={SVG.search} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
                  placeholder="ID commande, client, téléphone..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
              </div>
              {search && <button type="button" onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }} className="p-2 text-gray-400 hover:text-gray-700 border border-gray-200 rounded-xl"><Icon d={SVG.x} /></button>}
            </form>

            {/* Delivery type filter */}
            <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[160px]">
              <option value="">Toutes livraisons</option>
              {(meta.delivery_types ?? []).map(d => <option key={d.id} value={d.code}>{d.name_fr}</option>)}
            </select>

            {/* Node filter */}
            <select value={nodeFilter} onChange={e => { setNodeFilter(e.target.value); setPage(1); }}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[160px]">
              <option value="">Tous les nœuds</option>
              {(meta.nodes ?? []).map(n => <option key={n.id} value={n.id}>{n.code}</option>)}
            </select>
          </div>

          {/* Status tabs */}
          <div className="flex gap-1 overflow-x-auto -mx-1 px-1 pb-0">
            {statusTabs.map(s => {
              const hex = s.color?.startsWith('#') ? s.color : '#6b7280';
              const isActive = statusFilter === s.code;
              return (
                <button key={s.code} onClick={() => setStatusTab(s.code)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold rounded-t-xl border-b-2 whitespace-nowrap transition-all -mb-px ${
                    isActive ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                  }`}>
                  {s.code && <span style={{ backgroundColor: hex }} className="w-2 h-2 rounded-full flex-shrink-0" />}
                  {s.name_fr}
                  {s.count > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                      {s.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Split view */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left: Order list ──────────────────────────────────────────── */}
        <div className={`flex flex-col overflow-hidden transition-all duration-300 ${selectedId ? 'w-[55%]' : 'w-full'}`}>
          {loading ? (
            <div className="flex items-center justify-center flex-1 py-24">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-3 py-24">
              <Icon d={SVG.box} className="w-12 h-12 text-gray-200" />
              <p className="text-gray-500 font-medium">Aucune commande</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-white border-b border-gray-100">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">ID Commande</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Client</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Créée</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
                    {!selectedId && <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Articles</th>}
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 bg-white">
                  {orders.map(o => {
                    const isSelected = o.id === selectedId;
                    return (
                      <tr key={o.id} onClick={() => setSelectedId(isSelected ? null : o.id)}
                        className={`cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 border-l-2 border-l-blue-500' : 'hover:bg-gray-50'}`}>
                        <td className="px-5 py-4">
                          <span className="font-mono text-sm font-semibold text-blue-600 hover:text-blue-800">{ordId(o.id)}</span>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-semibold text-gray-900 text-sm">{o.customer?.name}</p>
                          <p className="text-xs text-gray-400 font-mono">{o.customer?.phone_country} {o.customer?.phone_number}</p>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="text-xs text-gray-500">{elapsed(o.created_at)}</span>
                        </td>
                        <td className="px-4 py-4"><StatusBadge status={o.status} /></td>
                        {!selectedId && (
                          <td className="px-4 py-4 text-center">
                            <span className="text-sm font-bold text-gray-700">{o._count?.items ?? 0}</span>
                          </td>
                        )}
                        <td className="px-4 py-4 text-right">
                          <span className="font-bold text-gray-900">{Number(o.total_ttc).toFixed(2)} MAD</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-white sticky bottom-0">
                  <p className="text-xs text-gray-400">Page {page}/{totalPages} · {total} commandes</p>
                  <div className="flex gap-1">
                    <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page <= 1} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">←</button>
                    <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page >= totalPages} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">→</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right: Detail panel ───────────────────────────────────────── */}
        {selectedId && (
          <div className="w-[45%] border-l border-gray-200 flex flex-col overflow-hidden bg-white shadow-xl">
            <DetailPanel
              orderId={selectedId}
              onClose={() => setSelectedId(null)}
              onStatusChanged={() => { loadOrders(); loadMeta(); }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
