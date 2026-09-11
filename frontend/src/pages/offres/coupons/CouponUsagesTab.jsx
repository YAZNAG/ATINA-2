import { useCallback, useEffect, useState } from 'react';
import { Download, Loader2, X } from 'lucide-react';
import Modal from '../../../components/Modal';
import { getCouponRedemptions, getCouponRedemptionOrder } from '../../../api/coupons.api';
import { apiError, exportCsv, formatDate, money, Notice } from './offresUi';

const PAGE_SIZE = 20;
const EMPTY_FILTERS = { code: '', customer: '', node_id: '', status: '', date_from: '', date_to: '' };

function StatusPill({ row }) {
  const cls = row.is_cancelled
    ? 'bg-red-50 text-red-600'
    : row.status_code === 'delivered' ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-600';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>{row.status_label ?? row.status_code}</span>;
}

function typeValue(row) {
  if (row.promo_type === 'PERCENTAGE') return `${row.promo_value} %`;
  if (row.promo_type === 'FREE_SHIPPING') return 'Livraison offerte';
  return money(row.promo_value);
}

/** Détail de commande en lecture seule (US-115 : clic sur une ligne). */
function OrderReadOnlyModal({ orderId, onClose }) {
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!orderId) return;
    setOrder(null); setError(null);
    getCouponRedemptionOrder(orderId)
      .then(({ data }) => setOrder(data.data))
      .catch((err) => setError(apiError(err)));
  }, [orderId]);
  return (
    <Modal open={!!orderId} onClose={onClose} title={order ? `Commande ${order.order_number}` : 'Commande'} subtitle="Lecture seule" size="lg"
      footer={<button type="button" className="btn-secondary" onClick={onClose}>Fermer</button>}>
      {error && <Notice tone="red">{error}</Notice>}
      {!order && !error && <div className="flex items-center gap-2 text-sm text-neutral-500"><Loader2 size={16} className="animate-spin" /> Chargement…</div>}
      {order && (
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div><span className="block text-xs text-neutral-400">Date</span>{formatDate(order.created_at)}</div>
            <div><span className="block text-xs text-neutral-400">Client</span>{order.customer_name}<span className="block text-xs text-neutral-500">{order.customer_phone}</span></div>
            <div><span className="block text-xs text-neutral-400">Node</span>{order.node_name ?? '—'}</div>
            <div><span className="block text-xs text-neutral-400">Statut</span><StatusPill row={order} /></div>
            <div><span className="block text-xs text-neutral-400">Code</span><span className="font-mono">{order.code}</span> · {typeValue(order)}</div>
            <div><span className="block text-xs text-neutral-400">Remise appliquée (figée)</span><span className="font-semibold text-red-600">{money(order.discount_amount)}</span></div>
            <div><span className="block text-xs text-neutral-400">Frais de livraison</span>{money(order.delivery_fee)}</div>
            <div><span className="block text-xs text-neutral-400">Total TTC</span><span className="font-semibold">{money(order.total_ttc)}</span></div>
          </div>
          {order.cancelled_reason && <Notice tone="red">Motif d'annulation : {order.cancelled_reason}</Notice>}
          <div className="overflow-hidden rounded-lg border border-neutral-200">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-3 py-2 text-left">Article</th>
                  <th className="px-3 py-2 text-right">Qté</th>
                  <th className="px-3 py-2 text-right">Prix unitaire</th>
                  <th className="px-3 py-2 text-right">Remise ligne</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {order.items.length === 0 && <tr><td colSpan={4} className="px-3 py-4 text-center text-neutral-400">Aucune ligne.</td></tr>}
                {order.items.map((it) => (
                  <tr key={it.id}>
                    <td className="px-3 py-2">
                      {it.label} {it.is_pack && <span className="ml-1 rounded bg-neutral-100 px-1.5 text-xs">Pack</span>}
                      {it.is_flash && <span className="ml-1 rounded bg-red-50 px-1.5 text-xs text-red-600">Flash</span>}
                      {it.sku_code && <span className="block text-xs text-neutral-400">{it.sku_code}</span>}
                    </td>
                    <td className="px-3 py-2 text-right">{it.qty}</td>
                    <td className="px-3 py-2 text-right">{money(it.unit_price_sold)}</td>
                    <td className="px-3 py-2 text-right">{money(it.discount_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}

/**
 * Onglet « Utilisations (suivi) » — US-115 : lecture seule, une ligne = une commande ayant utilisé un code
 * (orders.promotion_id). Remise affichée = orders.discount_amount figée à la commande.
 */
export default function CouponUsagesTab({ lookups, prefilter, onClearPrefilter }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, pages: 0 });
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);
  const [openOrder, setOpenOrder] = useState(null);

  const params = useCallback(() => {
    const p = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) p[k] = v; });
    if (prefilter?.promotion_id) { p.promotion_id = prefilter.promotion_id; delete p.code; }
    return p;
  }, [filters, prefilter]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data } = await getCouponRedemptions({ ...params(), page, limit: PAGE_SIZE });
      setRows(data.data ?? []);
      setPagination(data.pagination ?? { total: 0, pages: 0 });
      setTotals(data.totals ?? null);
    } catch (err) {
      setError(apiError(err, 'Erreur de chargement'));
    } finally { setLoading(false); }
  }, [params, page]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => { setPage(1); }, [filters, prefilter]);

  const setF = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  async function handleExport() {
    setExporting(true);
    try {
      const { data } = await getCouponRedemptions({ ...params(), all: true });
      const list = data.data ?? [];
      exportCsv(
        `utilisations-codes-promo-${new Date().toISOString().slice(0, 10)}.csv`,
        ['Date', 'Client', 'Téléphone', 'N° commande', 'Code', 'Type', 'Valeur', 'Remise appliquée (MAD)', 'Total commande (MAD)', 'Node', 'Statut'],
        list.map((r) => [
          formatDate(r.created_at), r.customer_name, r.customer_phone, r.order_number, r.code,
          r.promo_type_label ?? r.promo_type, r.promo_value, r.discount_amount.toFixed(2), r.total_ttc.toFixed(2),
          r.node_name, r.status_label,
        ]),
      );
    } catch (err) {
      setError(apiError(err, 'Export impossible'));
    } finally { setExporting(false); }
  }

  const nodes = lookups?.nodes ?? [];
  const statuses = lookups?.order_statuses ?? [];

  return (
    <div className="space-y-4">
      <Notice tone="zinc">
        Suivi en lecture seule, alimenté par les commandes. La remise affichée est celle figée au moment de la commande.
        Les commandes annulées restent listées (le compteur d'utilisations du code, lui, est décrémenté à l'annulation).
      </Notice>

      {prefilter?.promotion_id && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-sm text-red-700">
            Filtré sur le code <strong className="font-mono">{prefilter.code}</strong>
            <button type="button" onClick={onClearPrefilter} title="Retirer le filtre"><X size={14} /></button>
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {!prefilter?.promotion_id && (
          <input className="form-input" placeholder="Code…" value={filters.code} onChange={(e) => setF('code', e.target.value)} />
        )}
        <input className="form-input" placeholder="Client (nom / tél.)…" value={filters.customer} onChange={(e) => setF('customer', e.target.value)} />
        <select className="form-select" value={filters.node_id} onChange={(e) => setF('node_id', e.target.value)}>
          <option value="">Tous les nodes</option>
          {nodes.map((n) => <option key={n.id} value={n.id}>{n.name_fr}</option>)}
        </select>
        <select className="form-select" value={filters.status} onChange={(e) => setF('status', e.target.value)}>
          <option value="">Tous les statuts</option>
          {statuses.map((s) => <option key={s.id} value={s.code}>{s.name_fr}</option>)}
        </select>
        <input type="date" className="form-input" title="Du" value={filters.date_from} onChange={(e) => setF('date_from', e.target.value)} />
        <input type="date" className="form-input" title="Au" value={filters.date_to} onChange={(e) => setF('date_to', e.target.value)} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <div className="rounded-lg border border-neutral-200 bg-white px-4 py-2">
            <p className="text-xs text-neutral-500">Commandes</p>
            <p className="text-lg font-semibold text-neutral-900">{totals?.orders_count ?? 0}</p>
          </div>
          <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-2">
            <p className="text-xs text-red-700">Total des remises accordées</p>
            <p className="text-lg font-semibold text-red-700">{money(totals?.total_discount ?? 0)}</p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white px-4 py-2">
            <p className="text-xs text-neutral-500">dont commandes annulées / retournées</p>
            <p className="text-lg font-semibold text-neutral-700">{money(totals?.cancelled_discount ?? 0)} <span className="text-xs font-normal">({totals?.cancelled_count ?? 0})</span></p>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={() => { setFilters(EMPTY_FILTERS); onClearPrefilter?.(); }}>Réinitialiser</button>
          <button type="button" className="btn-secondary" disabled={exporting || !pagination.total} onClick={handleExport}>
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Exporter
          </button>
        </div>
      </div>

      <div className="table-wrap overflow-x-auto">
        <table className="w-full min-w-[980px]">
          <thead>
            <tr>
              <th className="table-th">Date</th>
              <th className="table-th">Client</th>
              <th className="table-th">N° commande</th>
              <th className="table-th">Code</th>
              <th className="table-th">Type / valeur</th>
              <th className="table-th text-right">Remise appliquée</th>
              <th className="table-th text-right">Total commande</th>
              <th className="table-th">Node</th>
              <th className="table-th">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={9} className="table-td py-10 text-center text-neutral-400">Chargement…</td></tr>
            ) : error ? (
              <tr><td colSpan={9} className="table-td py-10 text-center text-red-600">{error}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={9} className="table-td py-10 text-center text-neutral-400">Aucune commande n'a utilisé de code promo sur ce périmètre.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.order_id} className={`cursor-pointer hover:bg-neutral-50 ${r.is_cancelled ? 'opacity-70' : ''}`} onClick={() => setOpenOrder(r.order_id)}>
                <td className="table-td whitespace-nowrap text-xs">{formatDate(r.created_at)}</td>
                <td className="table-td">{r.customer_name ?? '—'}<span className="block text-xs text-neutral-400">{r.customer_phone}</span></td>
                <td className="table-td font-medium text-red-600">{r.order_number}</td>
                <td className="table-td font-mono">{r.code}</td>
                <td className="table-td text-xs">{r.promo_type_label ?? r.promo_type}<span className="block text-neutral-500">{typeValue(r)}</span></td>
                <td className={`table-td text-right font-medium ${r.is_cancelled ? 'text-neutral-400 line-through' : 'text-red-600'}`}>{money(r.discount_amount)}</td>
                <td className="table-td text-right">{money(r.total_ttc)}</td>
                <td className="table-td">{r.node_name ?? '—'}</td>
                <td className="table-td"><StatusPill row={r} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination.pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Précédent</button>
          <span className="text-neutral-500">Page {page} / {pagination.pages}</span>
          <button type="button" className="btn-secondary" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}>Suivant</button>
        </div>
      )}

      <OrderReadOnlyModal orderId={openOrder} onClose={() => setOpenOrder(null)} />
    </div>
  );
}
