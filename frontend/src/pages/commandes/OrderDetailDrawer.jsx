import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, Ban, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, CreditCard,
  Download, Loader2, MapPin, Package, Pencil, Truck, User, X, Zap,
} from 'lucide-react';

import {
  cancelOrder, changeOrderStatus, collectOrderPayment, getCancelPreview, getOrder,
  getOrderHistory, getOrderSlots, getOrderTransitions, updateOrder, updateOrderItem, updateOrderSlot,
} from '../../api/orders_mgmt.api';
import { getCustomerAddresses } from '../../api/checkout.api';
import { downloadCsv } from './csv';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const unwrap = (r) => r?.data?.data ?? r?.data ?? r;
const errMsg = (err, fallback) => err?.response?.data?.message || fallback;
const money = (v) => `${Number(v ?? 0).toFixed(2)} MAD`;
const lc = (v) => String(v ?? '').toLowerCase();

function formatDateTime(value) {
  if (!value) return '–';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function dateKey(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function dateHeading(key) {
  if (!key) return 'Date inconnue';
  const d = new Date(`${key}T00:00:00`);
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function slotRange(slot) {
  if (!slot) return '–';
  return `${slot.slot_start ?? ''}–${slot.slot_end ?? ''}`;
}

function slotLabel(slot) {
  if (!slot) return 'Aucun créneau';
  const d = dateKey(slot.specific_date);
  const date = d ? new Date(`${d}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' }) : '';
  return `${date} · ${slotRange(slot)}${slot.name_fr ? ` (${slot.name_fr})` : ''}`;
}

function addressLabel(a) {
  if (!a) return null;
  return [
    [a.street_number, a.street_name].filter(Boolean).join(' '),
    a.quartier,
    a.city_ref?.name_fr || a.city,
    a.postal_code,
  ].filter(Boolean).join(', ');
}

const PREF_TONE = {
  preferred: 'bg-blue-50 text-blue-600',
  confirmed: 'bg-emerald-50 text-emerald-600',
  rejected: 'bg-rose-50 text-rose-600',
  expired: 'bg-gray-100 text-gray-500',
};
const PREF_LABEL = { preferred: 'Souhaité', confirmed: 'Confirmé', rejected: 'Rejeté', expired: 'Expiré' };

const PAY_TONE = {
  pending: 'bg-amber-50 text-amber-600',
  collected: 'bg-emerald-50 text-emerald-600',
  failed: 'bg-rose-50 text-rose-600',
  refunded: 'bg-gray-100 text-gray-500',
};

function Badge({ tone = 'bg-gray-100 text-gray-600', children }) {
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${tone}`}>{children}</span>;
}

function Section({ title, icon: Icon, children, action }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          {Icon && <Icon size={15} className="text-red-600" />}{title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }) {
  return <div className="rounded-lg border border-dashed border-gray-200 bg-white p-4 text-center text-sm text-gray-500">{children}</div>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet Détail
// ─────────────────────────────────────────────────────────────────────────────
const LINE_EDITABLE = ['pending', 'awaiting_stock', 'confirmed', 'picking'];

function DetailTab({ order, transitions, busy, onChangeStatus, onAskCancel, onSaveOrder, onSaveItem }) {
  const code = lc(order.status?.code);
  const closed = ['delivered', 'cancelled', 'returned'].includes(code);
  const [editAddress, setEditAddress] = useState(false);
  const [addresses, setAddresses] = useState([]);
  const [addressId, setAddressId] = useState(order.address_id || '');
  const [notes, setNotes] = useState(order.notes || '');
  const [editNotes, setEditNotes] = useState(false);
  const [editLine, setEditLine] = useState(null); // { id, qty, reason }

  useEffect(() => { setNotes(order.notes || ''); setAddressId(order.address_id || ''); }, [order]);

  useEffect(() => {
    if (!editAddress || !order.customer?.id) return;
    getCustomerAddresses(order.customer.id).then((r) => setAddresses(unwrap(r) || [])).catch(() => setAddresses([]));
  }, [editAddress, order.customer?.id]);

  const items = order.items || [];
  const activeItems = items.filter((i) => lc(i.status?.code) !== 'cancelled');
  const isHome = !['pickup', 'in_store'].includes(lc(order.delivery_type?.code));

  return (
    <div className="space-y-4 p-4">
      <Section title="Client" icon={User}>
        <div className="flex items-start justify-between gap-3 text-sm">
          <div>
            <div className="font-medium text-gray-800">{order.customer?.name || '–'}</div>
            <div className="text-gray-500">{order.customer?.phone_country}{order.customer?.phone_number}</div>
          </div>
          {order.customer?.id && (
            <Link to={`/customers/${order.customer.id}`} className="text-xs font-medium text-red-600 hover:underline">Fiche client</Link>
          )}
        </div>
      </Section>

      <Section title="Nœud & livraison" icon={MapPin}
        action={!closed && isHome && !editAddress && (
          <button type="button" onClick={() => setEditAddress(true)} className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"><Pencil size={12} /> Modifier l'adresse</button>
        )}
      >
        <dl className="grid grid-cols-3 gap-y-2 text-sm">
          <dt className="text-gray-500">Nœud</dt>
          <dd className="col-span-2 text-gray-800">{order.node?.name_fr || '–'} {order.node?.code ? <span className="text-xs text-gray-400">({order.node.code})</span> : null}</dd>
          <dt className="text-gray-500">Mode</dt>
          <dd className="col-span-2 text-gray-800">{order.delivery_type?.name_fr || order.delivery_type?.code || '–'}</dd>
          <dt className="text-gray-500">Adresse</dt>
          <dd className="col-span-2 text-gray-800">
            {!editAddress && (addressLabel(order.address) || <span className="text-gray-400">Aucune (retrait)</span>)}
            {!editAddress && order.address?.delivery_notes && <div className="text-xs text-gray-500">Note : {order.address.delivery_notes}</div>}
            {editAddress && (
              <div className="space-y-2">
                <select value={addressId} onChange={(e) => setAddressId(e.target.value)} className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm">
                  <option value="">— Choisir une adresse du client —</option>
                  {addresses.map((a) => <option key={a.id} value={a.id}>{a.label ? `${a.label} — ` : ''}{addressLabel(a)}</option>)}
                </select>
                <div className="flex gap-2">
                  <button type="button" disabled={busy || !addressId} onClick={async () => { if (await onSaveOrder({ address_id: addressId })) setEditAddress(false); }} className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50">Enregistrer</button>
                  <button type="button" onClick={() => setEditAddress(false)} className="rounded-md border border-gray-200 px-3 py-1 text-xs">Annuler</button>
                </div>
              </div>
            )}
          </dd>
          {order.tour && (
            <>
              <dt className="text-gray-500">Tournée</dt>
              <dd className="col-span-2">
                <Link to={`/delivery/tours/${order.tour.id}`} className="inline-flex items-center gap-1 text-red-600 hover:underline">
                  <Truck size={13} /> {order.tour.date || 'Tournée'} {order.tour.driver?.name ? `— ${order.tour.driver.name}` : ''} ({order.tour.status?.name_fr})
                </Link>
              </dd>
            </>
          )}
        </dl>
      </Section>

      <Section title={`Lignes (${activeItems.length})`} icon={Package}>
        {items.length === 0 ? <Empty>Aucune ligne.</Empty> : (
          <div className="divide-y divide-gray-100">
            {items.map((item) => {
              const cancelled = lc(item.status?.code) === 'cancelled';
              const canEdit = !cancelled && !item.pack_id && LINE_EDITABLE.includes(code);
              const editing = editLine?.id === item.id;
              return (
                <div key={item.id} className={`py-2.5 text-sm ${cancelled ? 'opacity-50' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className={`font-medium text-gray-800 ${cancelled ? 'line-through' : ''}`}>{item.sku?.name_fr || item.pack?.name_fr || 'Article'}</div>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {item.pack && <Badge tone="bg-violet-50 text-violet-600">Pack : {item.pack.name_fr}</Badge>}
                        {item.flash_sale && <Badge tone="bg-amber-50 text-amber-700"><Zap size={11} className="mr-0.5" />{item.flash_sale.name_fr || 'Vente flash'}</Badge>}
                        {Number(item.qty_backordered) > 0 && <Badge tone="bg-rose-50 text-rose-600">Rupture : {Number(item.qty_backordered)}</Badge>}
                        {item.is_points_exchange && <Badge tone="bg-blue-50 text-blue-600">Échange points</Badge>}
                        {cancelled && <Badge>Annulée</Badge>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-gray-800">{Number(item.qty)} × {money(item.unit_price_sold)}</div>
                      <div className="font-medium text-gray-900">{money(Number(item.qty) * Number(item.unit_price_sold))}</div>
                      {canEdit && !editing && (
                        <button type="button" onClick={() => setEditLine({ id: item.id, qty: Number(item.qty), reason: '' })} className="mt-1 inline-flex items-center gap-1 text-xs text-red-600 hover:underline"><Pencil size={11} /> Modifier</button>
                      )}
                    </div>
                  </div>
                  {editing && (
                    <div className="mt-2 space-y-2 rounded-md bg-gray-50 p-2">
                      <div className="flex items-center gap-2 text-xs">
                        <label className="text-gray-500">Nouvelle quantité (0 = annuler la ligne)</label>
                        <input type="number" min={0} max={Number(item.qty)} step="any" value={editLine.qty} onChange={(e) => setEditLine({ ...editLine, qty: e.target.value })} className="w-20 rounded-md border border-gray-200 px-2 py-1" />
                      </div>
                      <input value={editLine.reason} onChange={(e) => setEditLine({ ...editLine, reason: e.target.value })} placeholder="Motif (rupture, demande client…)" className="w-full rounded-md border border-gray-200 px-2 py-1 text-xs" />
                      <div className="flex gap-2">
                        <button type="button" disabled={busy || editLine.qty === '' || Number(editLine.qty) >= Number(item.qty)} onClick={async () => { if (await onSaveItem(item.id, { qty: Number(editLine.qty), reason: editLine.reason })) setEditLine(null); }} className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50">Enregistrer</button>
                        <button type="button" onClick={() => setEditLine(null)} className="rounded-md border border-gray-200 bg-white px-3 py-1 text-xs">Annuler</button>
                      </div>
                      <p className="text-[11px] text-gray-400">Seule une réduction est possible : la réservation est libérée et le montant à encaisser recalculé.</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <dl className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-sm">
          <div className="flex justify-between text-gray-500"><dt>Sous-total HT</dt><dd>{money(order.subtotal_ht)}</dd></div>
          <div className="flex justify-between text-gray-500"><dt>TVA</dt><dd>{money(order.vat_amount)}</dd></div>
          <div className="flex justify-between text-gray-500"><dt>Frais de livraison</dt><dd>{money(order.delivery_fee)}</dd></div>
          {Number(order.discount_amount) > 0 && (
            <div className="flex justify-between text-emerald-600"><dt>Remise{order.promotion?.code ? ` (code ${order.promotion.code})` : ''}</dt><dd>− {money(order.discount_amount)}</dd></div>
          )}
          {Number(order.wallet_used) > 0 && <div className="flex justify-between text-gray-500"><dt>Portefeuille</dt><dd>− {money(order.wallet_used)}</dd></div>}
          {Number(order.points_redeemed) > 0 && <div className="flex justify-between text-gray-500"><dt>Points utilisés</dt><dd>{order.points_redeemed} pts</dd></div>}
          <div className="flex justify-between text-base font-semibold text-gray-900"><dt>Total TTC</dt><dd>{money(order.total_ttc)}</dd></div>
        </dl>
      </Section>

      <Section title="Notes" icon={Pencil}
        action={!closed && !editNotes && <button type="button" onClick={() => setEditNotes(true)} className="text-xs font-medium text-red-600 hover:underline">Modifier</button>}
      >
        {!editNotes ? <p className="whitespace-pre-wrap text-sm text-gray-700">{order.notes || <span className="text-gray-400">Aucune note</span>}</p> : (
          <div className="space-y-2">
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm" />
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={async () => { if (await onSaveOrder({ notes })) setEditNotes(false); }} className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50">Enregistrer les modifications</button>
              <button type="button" onClick={() => { setNotes(order.notes || ''); setEditNotes(false); }} className="rounded-md border border-gray-200 px-3 py-1 text-xs">Annuler</button>
            </div>
          </div>
        )}
      </Section>

      <Section title="Statut" icon={Check}>
        <div className="mb-3 text-sm text-gray-600">
          Statut actuel : <Badge tone="bg-red-50 text-red-600">{order.status?.name_fr || order.status?.code}</Badge>
          {order.cancelled_reason && <div className="mt-2 text-xs text-gray-500">Motif d'annulation : {order.cancelled_reason}</div>}
        </div>
        {transitions.length === 0 && !order.can_cancel && <p className="text-xs text-gray-400">Statut terminal : aucune évolution possible.</p>}
        <div className="flex flex-wrap gap-2">
          {transitions.map((t) => (
            <button key={t.code} type="button" disabled={busy} onClick={() => onChangeStatus(t)} className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50">
              <ChevronRight size={13} /> {t.label}
            </button>
          ))}
          {order.can_cancel && (
            <button type="button" disabled={busy} onClick={onAskCancel} className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50">
              <Ban size={13} /> Annuler la commande
            </button>
          )}
        </div>
      </Section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet Créneaux
// ─────────────────────────────────────────────────────────────────────────────
function SlotsTab({ orderId, busy, onConfirmSlot }) {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(unwrap(await getOrderSlots(orderId, { from, days: 14 })));
    } catch (err) {
      setError(errMsg(err, 'Erreur lors du chargement des créneaux'));
    } finally {
      setLoading(false);
    }
  }, [orderId, from]);

  useEffect(() => { load(); }, [load]);

  const shift = (days) => {
    const d = new Date(`${from}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    setFrom(d.toISOString().slice(0, 10));
  };

  const grouped = useMemo(() => {
    const g = {};
    for (const s of data?.slots || []) {
      const k = s.date || dateKey(s.specific_date);
      (g[k] = g[k] || []).push(s);
    }
    return Object.entries(g).sort(([a], [b]) => a.localeCompare(b));
  }, [data]);

  if (loading && !data) return <div className="flex items-center justify-center gap-2 p-8 text-sm text-gray-500"><Loader2 size={16} className="animate-spin" /> Chargement…</div>;
  if (error) return <div className="m-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>;
  if (!data) return null;

  const selectedSlot = (data.slots || []).find((s) => s.id === selected);

  return (
    <div className="space-y-4 p-4">
      {!data.slot_selection_enabled && (
        <div className="rounded-lg bg-blue-50 px-3 py-2.5 text-xs text-blue-700">
          Sélection de créneau désactivée sur ce nœud : le client ne choisit pas de créneau, l'équipe l'affecte ici.
        </div>
      )}

      <Section title="Créneau confirmé" icon={CalendarDays}>
        {data.confirmed_slot ? (
          <dl className="grid grid-cols-3 gap-y-1.5 text-sm">
            <dt className="text-gray-500">Créneau</dt><dd className="col-span-2 font-medium text-gray-800">{slotLabel(data.confirmed_slot)}</dd>
            <dt className="text-gray-500">Début / fin</dt><dd className="col-span-2 text-gray-700">{formatDateTime(data.slot_start)} → {formatDateTime(data.slot_end)}</dd>
            <dt className="text-gray-500">Source</dt><dd className="col-span-2 text-gray-700">{data.assignment_source?.name_fr || data.assignment_source?.code || '–'}</dd>
            <dt className="text-gray-500">Affecté par</dt><dd className="col-span-2 text-gray-700">{data.assigned_by?.full_name || (data.assigned_by ? `Utilisateur #${data.assigned_by.id}` : '–')}</dd>
          </dl>
        ) : <p className="text-sm text-amber-600"><AlertTriangle size={14} className="mr-1 inline" />Aucun créneau confirmé pour l'instant.</p>}
      </Section>

      <Section title="Créneaux souhaités par le client" icon={Clock3}>
        {(data.preferences || []).length === 0 ? <p className="text-sm text-gray-400">Aucune préférence exprimée par le client.</p> : (
          <ol className="space-y-1.5">
            {data.preferences.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm">
                <span><span className="mr-2 text-xs font-semibold text-gray-400">#{p.preference_order}</span>{slotLabel(p.slot)}</span>
                <Badge tone={PREF_TONE[lc(p.status?.code)]}>{p.status?.name_fr || PREF_LABEL[lc(p.status?.code)] || 'Souhaité'}</Badge>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-2 text-[11px] text-gray-400">Lecture seule — alimenté par l'application client.</p>
      </Section>

      <Section title="Choisir un créneau du nœud" icon={CalendarDays}
        action={
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => shift(-14)} className="rounded p-1 text-gray-500 hover:bg-gray-100" aria-label="Période précédente"><ChevronLeft size={15} /></button>
            <input type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} className="rounded-md border border-gray-200 px-1.5 py-0.5 text-xs" />
            <button type="button" onClick={() => shift(14)} className="rounded p-1 text-gray-500 hover:bg-gray-100" aria-label="Période suivante"><ChevronRight size={15} /></button>
          </div>
        }
      >
        {!data.can_change && <p className="mb-2 text-xs text-gray-500">Commande livrée, annulée ou retournée : le créneau n'est plus modifiable.</p>}
        {grouped.length === 0 ? <Empty>Aucun créneau daté actif sur ces 14 jours.</Empty> : (
          <div className="space-y-3">
            {grouped.map(([day, slots]) => (
              <div key={day}>
                <div className="mb-1.5 text-xs font-semibold capitalize text-gray-500">{dateHeading(day)}</div>
                <div className="grid grid-cols-2 gap-2">
                  {slots.map((s) => {
                    const isSel = selected === s.id;
                    return (
                      <button key={s.id} type="button" disabled={!data.can_change || s.is_confirmed}
                        onClick={() => setSelected(s.id)}
                        className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${s.is_confirmed ? 'border-emerald-300 bg-emerald-50' : isSel ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white hover:border-red-200'} disabled:cursor-default`}
                      >
                        <div className="flex items-center justify-between font-semibold text-gray-800">
                          {slotRange(s)}
                          {s.is_confirmed && <Check size={13} className="text-emerald-600" />}
                        </div>
                        {s.name_fr && <div className="text-gray-500">{s.name_fr}</div>}
                        <div className={`mt-0.5 ${s.is_full ? 'text-rose-600' : 'text-gray-500'}`}>
                          {s.reservations}/{s.max_orders} réservé(s){s.is_full ? ' — complet' : ''}
                        </div>
                        {s.preference && <div className="text-blue-600">Souhait n°{s.preference.order}</div>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
        {selectedSlot && (
          <div className="mt-3 space-y-2 rounded-lg bg-gray-50 p-3 text-sm">
            <div>Créneau retenu : <strong>{slotLabel(selectedSlot)}</strong></div>
            {selectedSlot.is_full && <div className="text-xs text-amber-700"><AlertTriangle size={13} className="mr-1 inline" />Créneau complet ({selectedSlot.reservations}/{selectedSlot.max_orders}) : l'affectation reste possible.</div>}
            <button type="button" disabled={busy} onClick={async () => { if (await onConfirmSlot(selectedSlot)) { setSelected(null); load(); } }} className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50">
              <Check size={13} /> {data.confirmed_slot ? 'Modifier le créneau' : 'Confirmer le créneau'}
            </button>
          </div>
        )}
      </Section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet Paiement
// ─────────────────────────────────────────────────────────────────────────────
function nowLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function PaymentTab({ order, busy, onCollect }) {
  const payments = order.payments || [];
  const pending = payments.find((p) => lc(p.status?.code) === 'pending');
  const collected = payments.find((p) => lc(p.status?.code) === 'collected');
  const code = lc(order.status?.code);
  const canCollect = !!pending && ['in_delivery', 'delivered'].includes(code);
  const [form, setForm] = useState({ collected_by: order.tour?.driver?.name || '', collected_at: nowLocal(), notes: '' });

  const exportCsv = () => downloadCsv(`paiements-ORD-${order.id.slice(0, 8).toUpperCase()}.csv`,
    ['Mode', 'Montant', 'Statut', 'Créé le', 'Encaissé le', 'Encaissé par', 'Notes'],
    payments.map((p) => [p.payment_method?.name_fr || p.payment_method?.code || '', Number(p.amount).toFixed(2), p.status?.name_fr || p.status?.code || '', formatDateTime(p.created_at), p.collected_at ? formatDateTime(p.collected_at) : '', p.collected_by || '', p.notes || '']));

  return (
    <div className="space-y-4 p-4">
      <Section title="Paiement à la livraison" icon={CreditCard}
        action={payments.length > 0 && <button type="button" onClick={exportCsv} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-600"><Download size={12} /> Exporter</button>}
      >
        <div className="mb-3 grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="text-xs text-gray-500">Montant à encaisser</div>
            <div className="text-lg font-semibold text-gray-900">{money(pending ? pending.amount : (Number(order.cod_amount) || order.total_ttc))}</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="text-xs text-gray-500">Statut</div>
            <div className="mt-1">{collected ? <Badge tone={PAY_TONE.collected}>Encaissé</Badge> : pending ? <Badge tone={PAY_TONE.pending}>À encaisser</Badge> : <Badge>{payments[0]?.status?.name_fr || 'Aucun paiement'}</Badge>}</div>
          </div>
        </div>
        {payments.length === 0 ? <Empty>Aucun paiement enregistré.</Empty> : (
          <div className="divide-y divide-gray-100 text-sm">
            {payments.map((p) => (
              <div key={p.id} className="py-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">{p.payment_method?.name_fr || p.payment_method?.code}</span>
                  <span className="font-medium">{money(p.amount)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <Badge tone={PAY_TONE[lc(p.status?.code)]}>{p.status?.name_fr || p.status?.code}</Badge>
                  <span>{p.collected_at ? `Encaissé le ${formatDateTime(p.collected_at)} par ${p.collected_by || '–'}` : `Créé le ${formatDateTime(p.created_at)}`}</span>
                </div>
                {p.notes && <div className="mt-1 text-xs text-gray-500">Notes : {p.notes}</div>}
              </div>
            ))}
          </div>
        )}
      </Section>

      {canCollect && (
        <Section title="Enregistrer l'encaissement" icon={Check}>
          <div className="space-y-2 text-sm">
            <label className="block"><span className="text-xs text-gray-500">Encaissé par *</span>
              <input value={form.collected_by} onChange={(e) => setForm({ ...form, collected_by: e.target.value })} placeholder="Nom du livreur" className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1.5" />
            </label>
            <label className="block"><span className="text-xs text-gray-500">Date et heure d'encaissement *</span>
              <input type="datetime-local" value={form.collected_at} max={nowLocal()} onChange={(e) => setForm({ ...form, collected_at: e.target.value })} className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1.5" />
            </label>
            <label className="block"><span className="text-xs text-gray-500">Notes</span>
              <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1.5" />
            </label>
            <button type="button" disabled={busy || !form.collected_by.trim() || !form.collected_at}
              onClick={() => onCollect({ collected_by: form.collected_by.trim(), collected_at: new Date(form.collected_at).toISOString(), notes: form.notes })}
              className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              <Check size={13} /> Enregistrer l'encaissement ({money(pending.amount)})
            </button>
            <p className="text-[11px] text-gray-400">Un seul encaissement par commande.</p>
          </div>
        </Section>
      )}
      {!canCollect && pending && (
        <p className="px-1 text-xs text-gray-500">L'encaissement s'enregistre une fois la commande en livraison ou livrée.</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet Suivi des statuts
// ─────────────────────────────────────────────────────────────────────────────
function summarize(ev) {
  const n = ev.new_values || {};
  if (ev.action === 'ASSIGN_SLOT') return `${n.slot || ''}${n.capacity?.full ? ' (créneau complet)' : ''}`;
  if (ev.action === 'COLLECT_PAYMENT') return `Par ${n.collected_by || '–'}${n.notes ? ` — ${n.notes}` : ''}`;
  if (ev.action === 'UPDATE_ORDER_LINE') return n.cancelled ? `Ligne annulée${n.reason ? ` — ${n.reason}` : ''}` : `Quantité ${ev.old_values?.qty} → ${n.qty}${n.reason ? ` — ${n.reason}` : ''}`;
  if (ev.action === 'UPDATE') return Object.keys(n).map((k) => (k === 'address_id' ? 'adresse' : k)).join(', ');
  if (ev.action === 'CREATE') return n.source === 'backoffice' ? 'Créée depuis le back-office' : 'Créée depuis l\'application';
  if (ev.action === 'DELIVER_ORDER') return `${(n.stock_moves || []).length} mouvement(s) de stock`;
  if (ev.action === 'CANCEL_ORDER' && ev.new_values?.status) return ev.new_values.cancelled_reason || '';
  return '';
}

function HistoryTab({ history }) {
  const [type, setType] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const filtered = history.filter((ev) => {
    if (type === 'status' && ev.type !== 'status') return false;
    if (type === 'audit' && ev.type !== 'audit') return false;
    const d = dateKey(ev.at);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });

  const exportCsv = () => downloadCsv('suivi-statuts.csv', ['Date', 'Événement', 'Détail', 'Auteur'],
    filtered.map((ev) => [formatDateTime(ev.at), ev.label, ev.note || summarize(ev), ev.by]));

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-md border border-gray-200 px-2 py-1.5">
          <option value="all">Tous les événements</option>
          <option value="status">Changements de statut</option>
          <option value="audit">Actions (créneau, paiement…)</option>
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-gray-200 px-2 py-1" aria-label="Du" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-gray-200 px-2 py-1" aria-label="Au" />
        <button type="button" onClick={exportCsv} className="ml-auto inline-flex items-center gap-1 text-gray-500 hover:text-red-600"><Download size={12} /> Exporter</button>
      </div>
      {filtered.length === 0 ? <Empty>Aucun événement.</Empty> : (
        <ol className="relative space-y-3 border-l border-gray-200 pl-4">
          {filtered.map((ev) => (
            <li key={`${ev.type}-${ev.id}`} className="relative">
              <span className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ${ev.type === 'status' ? 'bg-red-600' : 'bg-gray-400'}`} />
              <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-gray-800">{ev.label}</span>
                  <span className="text-xs text-gray-400">{formatDateTime(ev.at)}</span>
                </div>
                {(ev.note || summarize(ev)) && <div className="mt-0.5 text-xs text-gray-600">{ev.note || summarize(ev)}</div>}
                <div className="mt-0.5 text-xs text-gray-400">Par {ev.by}</div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal d'annulation (aperçu d'impact + motif obligatoire — US-058)
// ─────────────────────────────────────────────────────────────────────────────
function CancelModal({ orderId, onClose, onDone }) {
  const [preview, setPreview] = useState(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getCancelPreview(orderId).then((r) => setPreview(unwrap(r))).catch((err) => setError(errMsg(err, "Impossible de calculer l'impact"))).finally(() => setLoading(false));
  }, [orderId]);

  async function submit() {
    if (!reason.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await cancelOrder(orderId, reason.trim());
      await onDone();
    } catch (err) {
      setError(errMsg(err, "Erreur lors de l'annulation"));
    } finally {
      setSaving(false);
    }
  }

  const POINTS = { refunded: 'REMBOURSÉS au client', lost: 'PERDUS (préparation terminée)', none: 'Aucun point utilisé' };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button type="button" aria-label="Fermer" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900"><Ban size={18} className="text-red-600" /> Annuler la commande</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4 text-sm">
          {loading && <div className="flex items-center gap-2 text-gray-500"><Loader2 size={15} className="animate-spin" /> Calcul de l'impact…</div>}
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-red-600">{error}</div>}
          {preview && !preview.cancellable && <div className="rounded-lg bg-amber-50 px-3 py-2 text-amber-700">{preview.refusal_reason}</div>}
          {preview && preview.cancellable && (
            <>
              <div className="rounded-lg bg-red-50 px-3 py-2 text-red-700">Action définitive : une commande annulée ne peut plus être rouverte.</div>
              <div>
                <div className="mb-1 font-medium text-gray-700">Produits qui redeviennent disponibles</div>
                {preview.released_products.length === 0 ? <p className="text-gray-400">Aucun</p> : (
                  <ul className="space-y-0.5 text-gray-600">
                    {preview.released_products.map((p, i) => (
                      <li key={i}>• {p.name}{p.pack ? ` (pack ${p.pack})` : ''} : {p.qty_reserved_released} réservé(s){p.qty_backorder_released > 0 ? ` + ${p.qty_backorder_released} en rupture` : ''}</li>
                    ))}
                  </ul>
                )}
              </div>
              <dl className="grid grid-cols-2 gap-y-1 text-gray-600">
                <dt>Points dépensés</dt><dd className={preview.points.outcome === 'lost' ? 'font-semibold text-rose-600' : preview.points.outcome === 'refunded' ? 'font-semibold text-emerald-600' : ''}>{preview.points.spent > 0 ? `${preview.points.spent} pts — ${POINTS[preview.points.outcome]}` : POINTS.none}</dd>
                <dt>Lot gagné</dt><dd>{preview.game_prizes > 0 ? `${preview.game_prizes} lot(s) perdu(s), rendu(s) au pool` : 'Aucun'}</dd>
                <dt>Packs</dt><dd>{preview.packs.length ? preview.packs.map((p) => `${p.name} ×${p.qty}`).join(', ') : 'Aucun'}</dd>
                <dt>Ventes flash</dt><dd>{preview.flash_sales.length ? preview.flash_sales.map((f) => `${f.name || 'Flash'} ×${f.qty}`).join(', ') : 'Aucune'}</dd>
                <dt>Code promo rendu</dt><dd>{preview.promo_code || 'Aucun'}</dd>
                <dt>Créneau libéré</dt><dd>{preview.slot || 'Aucun'}{preview.slot_preferences ? ` (${preview.slot_preferences} préférence(s) expirée(s))` : ''}</dd>
                <dt>Tournée</dt><dd>{preview.tour.length ? 'Arrêt retiré de la tournée' : 'Aucune'}</dd>
                <dt>Paiement annulé</dt><dd>{preview.payments_to_cancel.length ? preview.payments_to_cancel.map((p) => money(p.amount)).join(', ') : 'Aucun'}</dd>
              </dl>
              <label className="block">
                <span className="font-medium text-gray-700">Motif de l'annulation *</span>
                <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus placeholder="Ex : client injoignable, rupture fournisseur…" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-red-400 focus:outline-none" />
              </label>
              {!reason.trim() && <p className="text-xs text-gray-400">Le motif est obligatoire pour confirmer.</p>}
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm">Retour</button>
          {preview?.cancellable && (
            <button type="button" disabled={saving || !reason.trim()} onClick={submit} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
              {saving && <Loader2 size={15} className="animate-spin" />} Confirmer l'annulation
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Panneau latéral
// ─────────────────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'detail', label: 'Détail' },
  { key: 'slots', label: 'Créneaux' },
  { key: 'payment', label: 'Paiement' },
  { key: 'history', label: 'Suivi des statuts' },
];

export default function OrderDetailDrawer({ orderId, initialAction = null, onClose, onChanged }) {
  const [activeTab, setActiveTab] = useState('detail');
  const [order, setOrder] = useState(null);
  const [transitions, setTransitions] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!orderId) return;
    setError(null);
    try {
      const [o, t, h] = await Promise.all([getOrder(orderId), getOrderTransitions(orderId), getOrderHistory(orderId)]);
      setOrder(unwrap(o));
      setTransitions(unwrap(t) || []);
      setHistory(unwrap(h) || []);
    } catch (err) {
      setError(errMsg(err, 'Erreur lors du chargement de la commande'));
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    setActiveTab('detail');
    setOrder(null);
    setNotice(null);
    setLoading(true);
    setCancelOpen(!!orderId && initialAction === 'cancel');
  }, [orderId, initialAction]);

  useEffect(() => { loadData(); }, [loadData]);

  // Exécute une action, recharge et notifie la liste. Renvoie true si succès.
  async function run(fn, successMsg) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fn();
      setNotice(res?.data?.message || successMsg);
      await loadData();
      await onChanged?.();
      return true;
    } catch (err) {
      setError(errMsg(err, 'Action impossible'));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const handleChangeStatus = (t) => {
    if (!window.confirm(`${t.label} : confirmer le passage de la commande à ce statut ?`)) return;
    run(() => changeOrderStatus(orderId, t.code), 'Statut mis à jour');
  };
  const handleConfirmSlot = (slot) => {
    if (slot.is_full && !window.confirm(`Ce créneau est complet (${slot.reservations}/${slot.max_orders}). Affecter malgré tout ?`)) return Promise.resolve(false);
    return run(() => updateOrderSlot(orderId, slot.id), 'Créneau confirmé');
  };

  if (!orderId) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="Fermer le panneau" onClick={onClose} className="absolute inset-0 bg-black/30" />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-[560px] flex-col bg-slate-50 shadow-2xl">
        <header className="border-b border-gray-200 bg-white">
          <div className="flex items-start justify-between px-4 py-4">
            <div>
              <div className="text-base font-semibold text-gray-800">ORD-{order?.id?.slice(0, 8).toUpperCase() || '–'}</div>
              <div className="mt-1 text-xs text-gray-500">{order?.customer?.name || '–'} · {order ? formatDateTime(order.created_at) : ''}</div>
            </div>
            <div className="flex items-center gap-3">
              {order?.status && <Badge tone="bg-red-50 text-red-600">{order.status.name_fr || order.status.code}</Badge>}
              <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X size={18} /></button>
            </div>
          </div>
          <nav className="flex overflow-x-auto border-t border-gray-100">
            {TABS.map((tab) => (
              <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
                className={`min-w-fit flex-1 border-b-2 px-3 py-3 text-xs font-medium transition-colors ${activeTab === tab.key ? 'border-red-600 text-red-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
              >{tab.label}</button>
            ))}
          </nav>
        </header>

        <div className="flex-1 overflow-y-auto">
          {loading && <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-gray-500"><Loader2 size={17} className="animate-spin" /> Chargement…</div>}
          {error && <div className="mx-4 mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
          {notice && !error && <div className="mx-4 mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}

          {!loading && order && (
            <>
              {activeTab === 'detail' && (
                <DetailTab
                  order={order}
                  transitions={transitions}
                  busy={busy}
                  onChangeStatus={handleChangeStatus}
                  onAskCancel={() => setCancelOpen(true)}
                  onSaveOrder={(data) => run(() => updateOrder(orderId, data), 'Commande mise à jour')}
                  onSaveItem={(itemId, data) => run(() => updateOrderItem(orderId, itemId, data), 'Ligne mise à jour')}
                />
              )}
              {activeTab === 'slots' && <SlotsTab orderId={orderId} busy={busy} onConfirmSlot={handleConfirmSlot} />}
              {activeTab === 'payment' && (
                <PaymentTab key={order.id} order={order} busy={busy} onCollect={(data) => run(() => collectOrderPayment(orderId, data), 'Encaissement enregistré')} />
              )}
              {activeTab === 'history' && <HistoryTab history={history} />}
            </>
          )}
        </div>
      </aside>

      {cancelOpen && order && (
        <CancelModal
          orderId={orderId}
          onClose={() => setCancelOpen(false)}
          onDone={async () => {
            setCancelOpen(false);
            setNotice('Commande annulée');
            await loadData();
            await onChanged?.();
          }}
        />
      )}
    </div>
  );
}
