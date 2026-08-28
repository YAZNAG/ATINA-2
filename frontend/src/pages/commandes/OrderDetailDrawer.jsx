import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  CreditCard,
  Loader2,
  MapPin,
  Package,
  User,
  X,
} from 'lucide-react';

import {
  cancelOrder,
  changeOrderStatus,
  getOrder,
  getOrderHistory,
  getOrderTransitions,
  updateOrderSlot,
} from '../../api/orders_mgmt.api';


// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function unwrap(response) {
  return response?.data?.data ?? response?.data ?? response;
}

function money(value, currency = 'MAD') {
  return `${Number(value ?? 0).toFixed(2)} ${currency}`;
}

function formatDateTime(value) {
  if (!value) return '–';

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTime(value) {
  if (!value) return null;

  const parsed = new Date(value);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const match = String(value).match(/^(\d{1,2}):(\d{2})/);

  return match
    ? `${match[1].padStart(2, '0')}:${match[2]}`
    : String(value);
}

function getItemName(item) {
  return (
    item.sku?.name_fr ||
    item.sku?.name ||
    item.product?.name_fr ||
    item.product?.name ||
    item.name_fr ||
    'Article sans nom'
  );
}

function getItemUnitPrice(item) {
  return Number(
    item.unit_price_sold ??
      item.unit_price ??
      item.price ??
      item.sku?.price ??
      0
  );
}

function getItemTotal(item) {
  return Number(
    item.total_ttc ??
      item.line_total ??
      getItemUnitPrice(item) * Number(item.qty ?? 0)
  );
}

function getAddress(address = {}) {
  return [
    address.address_line1,
    address.address_line2,
    address.address_line,
    address.street,
    address.city,
    address.postal_code,
  ]
    .filter(Boolean)
    .join(', ');
}

function getDayLabel(day) {
  const days = {
    0: 'Dimanche',
    1: 'Lundi',
    2: 'Mardi',
    3: 'Mercredi',
    4: 'Jeudi',
    5: 'Vendredi',
    6: 'Samedi',

    sunday: 'Dimanche',
    monday: 'Lundi',
    tuesday: 'Mardi',
    wednesday: 'Mercredi',
    thursday: 'Jeudi',
    friday: 'Vendredi',
    saturday: 'Samedi',

    dimanche: 'Dimanche',
    lundi: 'Lundi',
    mardi: 'Mardi',
    mercredi: 'Mercredi',
    jeudi: 'Jeudi',
    vendredi: 'Vendredi',
    samedi: 'Samedi',
  };

  return (
    days[String(day).toLowerCase()] ||
    'Autre jour'
  );
}

function getSlotLabel(slot) {
  const start = formatTime(slot.slot_start);
  const end = formatTime(slot.slot_end);

  const timeLabel =
    start && end
      ? `${start} – ${end}`
      : '';

  if (slot.name_fr && timeLabel) {
    return `${slot.name_fr} (${timeLabel})`;
  }

  return slot.name_fr || timeLabel || 'Créneau';
}


// -----------------------------------------------------------------------------
// Common components
// -----------------------------------------------------------------------------

function StatusBadge({ status }) {
  if (!status) return null;

  return (
    <span className="inline-flex items-center rounded-md bg-red-100 px-2.5 py-1 text-xs font-medium text-red-600">
      {status.name_fr || status.code}
    </span>
  );
}

function EmptyState({ children }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 text-center text-sm text-gray-500">
      {children}
    </div>
  );
}


// -----------------------------------------------------------------------------
// Detail tab
// -----------------------------------------------------------------------------

function DetailTab({
  order,
  transitions,
  onChangeStatus,
  onCancel,
}) {
  const items = order.items ?? [];
  const customer = order.customer ?? {};
  const address = order.address ?? {};
  const currency = order.currency || 'MAD';

  const itemsTotal = items.reduce(
    (sum, item) => sum + getItemTotal(item),
    0
  );

  const subtotal = Number(
    order.subtotal_ttc ??
      order.subtotal ??
      order.sub_total ??
      itemsTotal
  );

  const deliveryFee = Number(
    order.delivery_fee ??
      order.shipping_fee ??
      order.delivery_amount ??
      0
  );

  const discount = Number(
    order.discount_amount ??
      order.promotion_discount ??
      order.discount ??
      0
  );

  const total = Number(
    order.total_ttc ??
      order.total ??
      subtotal + deliveryFee - discount
  );

  return (
    <div className="space-y-4 p-4">
      {/* Informations client et adresse */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="mb-2 flex items-center gap-2 text-xs text-gray-500">
            <User size={14} />
            Client & Nœud
          </div>

          <div className="text-sm font-medium text-gray-800">
            {customer.name || 'Client inconnu'}
          </div>

          <div className="text-xs text-gray-500">
            {customer.phone_country || ''}
            {customer.phone_number || 'Téléphone non renseigné'}
          </div>

          <div className="mt-2 text-xs text-red-600">
            Nœud :{' '}
            {order.node?.code ||
              order.node?.name_fr ||
              '–'}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="mb-2 flex items-center gap-2 text-xs text-gray-500">
            <MapPin size={14} />
            Adresse
          </div>

          <div className="text-sm text-gray-700">
            {getAddress(address) || 'Adresse non renseignée'}
          </div>

          {address.note && (
            <div className="mt-2 text-xs text-amber-600">
              Note : {address.note}
            </div>
          )}
        </div>
      </div>

      {/* Lignes de commande */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-3 py-3">
          <span className="text-xs text-gray-500">
            Lignes de commande
          </span>

          <button
            type="button"
            className="text-xs font-medium text-red-600 hover:text-red-700"
          >
            Modifier
          </button>
        </div>

        <div className="px-3">
          {items.length === 0 && (
            <div className="py-6 text-center text-sm text-gray-400">
              Aucun article
            </div>
          )}

          {items.map((item, index) => {
            const quantity = Number(item.qty ?? 0);
            const unitPrice = getItemUnitPrice(item);
            const itemTotal = getItemTotal(item);

            return (
              <div
                key={item.id || index}
                className="flex items-center justify-between border-b border-gray-100 py-3 last:border-b-0"
              >
                <div className="min-w-0 pr-3">
                  <div className="truncate text-sm text-gray-800">
                    {getItemName(item)}
                  </div>

                  <div className="text-xs text-gray-500">
                    x{quantity} × {money(unitPrice, currency)}
                  </div>
                </div>

                <div className="shrink-0 text-sm text-gray-700">
                  {money(itemTotal, currency)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Totaux */}
        <div className="space-y-2 border-t border-gray-200 px-3 py-3 text-xs">
          <div className="flex justify-between text-gray-500">
            <span>Sous-total articles</span>
            <span>{money(subtotal, currency)}</span>
          </div>

          <div className="flex justify-between text-gray-500">
            <span>Frais de livraison</span>
            <span>{money(deliveryFee, currency)}</span>
          </div>

          {discount > 0 && (
            <div className="flex justify-between text-gray-500">
              <span>Réduction promo</span>
              <span>
                -{money(discount, currency)}
              </span>
            </div>
          )}

          <div className="flex justify-between border-t border-gray-200 pt-3 text-sm font-semibold text-gray-800">
            <span>Total TTC</span>
            <span>{money(total, currency)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        {transitions.length > 0 && (
          <button
            type="button"
            onClick={() =>
              onChangeStatus(transitions[0])
            }
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
          >
            Faire évoluer le statut
            <ChevronRight size={16} />
            {transitions[0].label}
          </button>
        )}

        {!order.status?.is_terminal && (
          <button
            type="button"
            onClick={onCancel}
            className="w-full rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
          >
            Annuler la commande
          </button>
        )}
      </div>
    </div>
  );
}


// -----------------------------------------------------------------------------
// Slots tab
// -----------------------------------------------------------------------------

function SlotsTab({
  order,
  slots = [],
  onConfirmSlot,
  savingSlot,
}) {
  const confirmedSlotId =
    order.confirmed_slot?.id || null;

  const [selectedSlotId, setSelectedSlotId] =
    useState(confirmedSlotId);

  useEffect(() => {
    setSelectedSlotId(confirmedSlotId);
  }, [confirmedSlotId]);

  const groupedSlots = useMemo(() => {
    return slots.reduce((groups, slot) => {
      const day = slot.day_of_week ?? 'other';

      if (!groups[day]) {
        groups[day] = [];
      }

      groups[day].push(slot);

      return groups;
    }, {});
  }, [slots]);

  if (!slots.length) {
    return (
      <div className="p-4">
        <EmptyState>
          Aucun créneau disponible dans la base de données.
        </EmptyState>
      </div>
    );
  }

  const hasChanged =
    selectedSlotId &&
    selectedSlotId !== confirmedSlotId;

  return (
    <div className="space-y-4 p-4">
      {/* Créneau confirmé */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-2 text-xs text-gray-500">
          Créneau confirmé
        </div>

        {order.confirmed_slot ? (
          <>
            <div className="text-lg font-medium text-gray-800">
              {order.confirmed_slot.name_fr ||
                'Créneau confirmé'}
            </div>

            <div className="mt-1 text-sm text-gray-600">
              {formatTime(order.confirmed_slot.slot_start)}
              {' – '}
              {formatTime(order.confirmed_slot.slot_end)}
            </div>

            {order.confirmed_slot.day_of_week && (
              <div className="mt-1 text-xs text-gray-400">
                {getDayLabel(
                  order.confirmed_slot.day_of_week
                )}
              </div>
            )}
          </>
        ) : (
          <div className="text-sm text-gray-400">
            Aucun créneau confirmé.
          </div>
        )}
      </div>

      {/* Calendrier basé sur les créneaux de la base */}
      <div className="rounded-lg border border-gray-200 bg-white p-3">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
            <CalendarDays size={16} />
            Calendrier des créneaux
          </div>

          <span className="text-xs text-gray-400">
            {slots.length} créneau
            {slots.length > 1 ? 'x' : ''}
          </span>
        </div>

        <div className="space-y-5">
          {Object.entries(groupedSlots).map(
            ([day, daySlots]) => (
              <div key={day}>
                <div className="mb-2 text-xs font-medium text-gray-500">
                  {getDayLabel(day)}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {daySlots.map((slot) => {
                    const isConfirmed =
                      slot.id === confirmedSlotId;

                    const isSelected =
                      slot.id === selectedSlotId;

                    return (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() =>
                          setSelectedSlotId(slot.id)
                        }
                        className={`rounded-lg border px-3 py-3 text-left transition-colors ${
                          isConfirmed
                            ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                            : isSelected
                              ? 'border-red-500 bg-red-50 text-red-600'
                              : 'border-gray-200 bg-white text-gray-700 hover:border-red-300 hover:bg-red-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-sm font-medium">
                            {getSlotLabel(slot)}
                          </div>

                          {isConfirmed && (
                            <Check
                              size={16}
                              className="shrink-0"
                            />
                          )}
                        </div>

                        {isConfirmed && (
                          <div className="mt-1 text-[11px] font-medium">
                            Confirmé
                          </div>
                        )}

                        {isSelected &&
                          !isConfirmed && (
                            <div className="mt-1 text-[11px] font-medium">
                              Sélectionné
                            </div>
                          )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )
          )}
        </div>

        {/* Légende */}
        <div className="mt-5 flex flex-wrap gap-3 border-t border-gray-100 pt-3 text-[11px] text-gray-500">
          <div className="flex items-center gap-1">
            <span className="h-3 w-3 rounded border border-red-500 bg-red-50" />
            Sélectionné
          </div>

          <div className="flex items-center gap-1">
            <span className="h-3 w-3 rounded border border-emerald-400 bg-emerald-50" />
            Confirmé
          </div>

          <div className="flex items-center gap-1">
            <span className="h-3 w-3 rounded border border-gray-200 bg-white" />
            Disponible
          </div>
        </div>
      </div>

      {/* Confirmation du créneau */}
      <div className="rounded-lg border border-gray-200 bg-white p-3">
        <div className="mb-3 text-sm text-gray-600">
          {hasChanged
            ? 'Un nouveau créneau est sélectionné.'
            : 'Le créneau confirmé est sélectionné.'}
        </div>

        <button
          type="button"
          disabled={!hasChanged || savingSlot}
          onClick={() =>
            onConfirmSlot(selectedSlotId)
          }
          className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
            !hasChanged || savingSlot
              ? 'cursor-not-allowed bg-gray-200 text-gray-400'
              : 'bg-red-600 text-white hover:bg-red-700'
          }`}
        >
          {savingSlot && (
            <Loader2
              size={16}
              className="animate-spin"
            />
          )}

          {savingSlot
            ? 'Enregistrement…'
            : hasChanged
              ? 'Confirmer ce créneau'
              : 'Créneau déjà confirmé'}
        </button>
      </div>
    </div>
  );
}


// -----------------------------------------------------------------------------
// Payment tab
// -----------------------------------------------------------------------------

function PaymentTab({ order }) {
  const payments = order.payments ?? [];
  const currency = order.currency || 'MAD';

  return (
    <div className="p-4">
      <div className="rounded-lg border border-gray-200 bg-white p-5 text-center">
        <div className="text-sm text-gray-500">
          Montant à encaisser
        </div>

        <div className="mt-1 text-3xl font-bold text-gray-800">
          {money(
            order.total_ttc ?? order.total,
            currency
          )}
        </div>

        {payments.length === 0 && (
          <div className="mt-4 text-sm text-gray-400">
            Aucun paiement enregistré.
          </div>
        )}

        <div className="mt-4 space-y-2">
          {payments.map((payment, index) => (
            <div
              key={payment.id || index}
              className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-left text-sm"
            >
              <div className="flex items-center gap-2">
                <CreditCard
                  size={16}
                  className="text-gray-400"
                />

                <span>
                  {payment.payment_method?.name_fr ||
                    payment.payment_method?.code ||
                    'Paiement'}
                </span>
              </div>

              <span className="text-xs text-gray-500">
                {payment.status?.name_fr ||
                  payment.status?.code ||
                  '–'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


// -----------------------------------------------------------------------------
// History tab
// -----------------------------------------------------------------------------

function HistoryTab({ history }) {
  if (!history.length) {
    return (
      <div className="p-4">
        <EmptyState>
          Aucun historique disponible.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="relative">
        {history.map((event, index) => (
          <div
            key={event.id || index}
            className="relative flex gap-3 pb-6"
          >
            {index !== history.length - 1 && (
              <div className="absolute left-[15px] top-8 h-full w-px bg-red-100" />
            )}

            <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-red-100 bg-white text-emerald-500">
              {index === history.length - 1 ? (
                <Check size={16} />
              ) : (
                <Package size={15} />
              )}
            </div>

            <div className="min-w-0 pt-1">
              <div className="text-sm font-medium text-gray-800">
                {event.status?.name_fr ||
                  event.status?.code ||
                  'Statut'}
              </div>

              <div className="mt-1 text-xs text-gray-500">
                Par {event.changed_by || 'Système'} ·{' '}
                {formatDateTime(event.created_at)}
              </div>

              {event.note && (
                <div className="mt-1 text-xs text-gray-500">
                  {event.note}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


// -----------------------------------------------------------------------------
// Drawer
// -----------------------------------------------------------------------------

const TABS = [
  {
    key: 'detail',
    label: 'Détail',
  },
  {
    key: 'slots',
    label: 'Créneaux',
  },
  {
    key: 'payment',
    label: 'Paiement',
  },
  {
    key: 'history',
    label: 'Suivi Des Statuts',
  },
];

export default function OrderDetailDrawer({
  orderId,
  slots = [],
  onClose,
  onChanged,
}) {
  const [activeTab, setActiveTab] = useState('detail');

  const [order, setOrder] = useState(null);
  const [transitions, setTransitions] = useState([]);
  const [history, setHistory] = useState([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [savingSlot, setSavingSlot] = useState(false);
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    if (!orderId) return;

    setLoading(true);
    setError(null);

    try {
      const [
        orderResponse,
        transitionsResponse,
        historyResponse,
      ] = await Promise.all([
        getOrder(orderId),
        getOrderTransitions(orderId),
        getOrderHistory(orderId),
      ]);

      const orderData = unwrap(orderResponse);
      const transitionsData =
        unwrap(transitionsResponse);
      const historyData = unwrap(historyResponse);

      setOrder(orderData);
      setTransitions(
        Array.isArray(transitionsData)
          ? transitionsData
          : []
      );
      setHistory(
        Array.isArray(historyData)
          ? historyData
          : []
      );
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          'Erreur lors du chargement de la commande'
      );
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    setActiveTab('detail');
  }, [orderId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleChangeStatus(transition) {
    if (!transition?.code) return;

    const confirmed = window.confirm(
      `Faire évoluer la commande vers "${transition.label}" ?`
    );

    if (!confirmed) return;

    setActionLoading(true);
    setError(null);

    try {
      await changeOrderStatus(
        orderId,
        transition.code
      );

      await loadData();
      await onChanged?.();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          'Erreur lors du changement de statut'
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel() {
    const confirmed = window.confirm(
      'Voulez-vous vraiment annuler cette commande ?'
    );

    if (!confirmed) return;

    const reason = window.prompt(
      'Motif de l’annulation :'
    );

    if (reason === null) return;

    setActionLoading(true);
    setError(null);

    try {
      await cancelOrder(
        orderId,
        reason || undefined
      );

      await loadData();
      await onChanged?.();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          'Erreur lors de l’annulation'
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleConfirmSlot(slotId) {
    if (!slotId) return;

    setSavingSlot(true);
    setError(null);

    try {
      await updateOrderSlot(orderId, slotId);

      await loadData();
      await onChanged?.();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          'Erreur lors de la mise à jour du créneau'
      );
    } finally {
      setSavingSlot(false);
    }
  }

  if (!orderId) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <button
        type="button"
        aria-label="Fermer le drawer"
        onClick={onClose}
        className="absolute inset-0 bg-black/30"
      />

      {/* Drawer */}
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-[500px] flex-col bg-slate-50 shadow-2xl">
        {/* Header */}
        <header className="border-b border-gray-200 bg-white">
          <div className="flex items-start justify-between px-4 py-4">
            <div>
              <div className="text-base font-semibold text-gray-800">
                ORD-
                {order?.id
                  ?.slice(0, 8)
                  .toUpperCase() || '–'}
              </div>

              <div className="mt-1 text-xs text-gray-500">
                {order?.customer?.name || '–'}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <StatusBadge status={order?.status} />

              <button
                type="button"
                onClick={onClose}
                title="Fermer"
                aria-label="Fermer"
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Navigation tabs */}
          <nav className="flex overflow-x-auto border-t border-gray-100">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`min-w-fit flex-1 border-b-2 px-3 py-3 text-xs font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'border-red-600 text-red-600'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {(loading || actionLoading) && (
            <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-gray-500">
              <Loader2
                size={17}
                className="animate-spin"
              />
              Chargement…
            </div>
          )}

          {error && (
            <div className="m-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {!loading && !actionLoading && order && (
            <>
              {activeTab === 'detail' && (
                <DetailTab
                  order={order}
                  transitions={transitions}
                  onChangeStatus={handleChangeStatus}
                  onCancel={handleCancel}
                />
              )}

              {activeTab === 'slots' && (
                <SlotsTab
                  order={order}
                  slots={slots}
                  onConfirmSlot={handleConfirmSlot}
                  savingSlot={savingSlot}
                />
              )}

              {activeTab === 'payment' && (
                <PaymentTab order={order} />
              )}

              {activeTab === 'history' && (
                <HistoryTab history={history} />
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}