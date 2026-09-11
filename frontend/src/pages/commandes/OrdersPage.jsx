import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useSearchParams } from 'react-router-dom';

import {
  AlertTriangle,
  Ban,
  CalendarDays,
  Clock3,
  Download,
  Eye,
  Loader2,
  MapPin,
  Plus,
  Search,
  X,
} from 'lucide-react';

import {
  getOrders,
  getOrdersMeta,
} from '../../api/orders_mgmt.api';

import OrderDetailDrawer from './OrderDetailDrawer';
import CreateOrderDrawer from './CreateOrderDrawer';
import PaymentsView from './PaymentsView';
import { downloadCsv } from './csv';

// Filtres reçus par l'URL (liens depuis le reporting et les offres)
const EXTERNAL_FILTERS = {
  period: 'Période',
  from: 'Du',
  to: 'Au',
  pack_id: 'Pack',
  flash_sale_id: 'Vente flash',
  promotion_id: 'Code promo',
  customer_id: 'Client',
  payment_status: 'Statut paiement',
};

const PERIOD_LABELS = {
  today: "Aujourd'hui", day: "Aujourd'hui", yesterday: 'Hier', week: 'Semaine en cours',
  month: 'Mois en cours', year: 'Année en cours', '7d': '7 derniers jours', '30d': '30 derniers jours', '90d': '90 derniers jours',
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const TONE_CLASSES = {
  blue: 'bg-blue-50 text-blue-600',
  red: 'bg-rose-50 text-rose-600',
  rose: 'bg-rose-50 text-rose-600',
  orange: 'bg-amber-50 text-amber-600',
  amber: 'bg-amber-50 text-amber-600',
  green: 'bg-emerald-50 text-emerald-600',
  gray: 'bg-gray-100 text-gray-500',
};

function toneClass(color) {
  return TONE_CLASSES[color] || TONE_CLASSES.gray;
}

function StatusBadge({ status }) {
  if (!status) return null;

  return (
    <span
      className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ${toneClass(
        status.color
      )}`}
    >
      {status.name_fr || status.code}
    </span>
  );
}

function formatRelativeTime(isoDate) {
  if (!isoDate) return '–';

  const diffMs = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `${minutes}min`;

  const hours = Math.floor(minutes / 60);

  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);

  return `${days}j`;
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

// specific_date arrive en ISO complet (DateTime @db.Date) — on n'en garde
// que la partie date pour l'affichage court dans le dropdown.
function formatShortDate(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

function formatSlot(order) {
  const slot = order.confirmed_slot ?? order;

  const start = formatTime(slot.slot_start);
  const end = formatTime(slot.slot_end);

  if (!start || !end) return null;

  return `${start}–${end}`;
}

// Libellé du dropdown filtre créneau : date courte + plage horaire,
// puisque les créneaux n'ont plus de nom (name_fr a été supprimé).
function formatSlotOption(slot) {
  const start = formatTime(slot.slot_start);
  const end = formatTime(slot.slot_end);
  const dateLabel = formatShortDate(slot.specific_date);
  const timeLabel = start && end ? `${start} – ${end}` : '';
  return [dateLabel, timeLabel].filter(Boolean).join(' · ') || 'Créneau';
}


// -----------------------------------------------------------------------------
// Table cells
// -----------------------------------------------------------------------------

function SlotCell({ order }) {
  const slot = formatSlot(order);

  if (!slot) {
    if (order.status?.code === 'pending') {
      return (
        <span className="inline-flex items-center gap-1 text-sm font-medium text-amber-500">
          <AlertTriangle size={14} />
          En attente
        </span>
      );
    }

    return <span className="text-gray-300">–</span>;
  }

  return (
    <span className="text-sm text-gray-600">
      {slot}
    </span>
  );
}

function PaymentCell({ order }) {
  const payment = order.payments?.[0];

  if (!payment) {
    return <span className="text-gray-300">–</span>;
  }

  const isWallet =
    payment.payment_method?.code === 'wallet';

  return (
    <span
      className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ${
        isWallet
          ? 'bg-emerald-50 text-emerald-600'
          : 'bg-blue-50 text-blue-600'
      }`}
    >
      {payment.payment_method?.name_fr ||
        payment.payment_method?.code ||
        '–'}
    </span>
  );
}

function PaymentStatusCell({ order }) {
  const payment = order.payments?.[0];

  const statusCode = payment?.status?.code;
  const statusLabel =
    payment?.status?.name_fr ||
    payment?.status?.code;

  if (!statusLabel) {
    return <span className="text-gray-300">–</span>;
  }

  const statusClasses = {
    pending: 'bg-amber-50 text-amber-600',
    collected: 'bg-emerald-50 text-emerald-600',
    paid: 'bg-emerald-50 text-emerald-600',
    captured: 'bg-emerald-50 text-emerald-600',
    failed: 'bg-rose-50 text-rose-600',
    cancelled: 'bg-gray-100 text-gray-500',
    refunded: 'bg-gray-100 text-gray-500',
  };

  return (
    <span
      className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ${
        statusClasses[statusCode] ||
        'bg-gray-100 text-gray-500'
      }`}
    >
      {statusLabel}
    </span>
  );
}


// -----------------------------------------------------------------------------
// Page
// -----------------------------------------------------------------------------

export default function OrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState(searchParams.get('view') === 'payments' ? 'payments' : 'orders');
  const [orders, setOrders] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [cancelIntent, setCancelIntent] = useState(false);
  const [extFilters, setExtFilters] = useState(() => {
    const out = {};
    for (const key of Object.keys(EXTERNAL_FILTERS)) {
      const v = searchParams.get(key);
      if (v) out[key] = v;
    }
    return out;
  });

  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 25,
    pages: 1,
  });

  const [statusCounts, setStatusCounts] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [slots, setSlots] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(
    new Date()
  );

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] =
    useState('');

  const [activeTab, setActiveTab] = useState(searchParams.get('status') || searchParams.get('status_code') || 'all');
  const [nodeId, setNodeId] = useState(searchParams.get('node_id') || '');
  const [date, setDate] = useState(searchParams.get('date') || '');
  const [slotFilter, setSlotFilter] = useState('');
  const [createOrderOpen, setCreateOrderOpen] =
  useState(false);

  const [openFilter, setOpenFilter] = useState(null);
  const [selectedOrderId, setSelectedOrderId] =
    useState(searchParams.get('order_id') || null);

  function removeExtFilter(key) {
    setExtFilters((prev) => {
      const next = { ...prev };
      delete next[key];
      if (key === 'period') { delete next.from; delete next.to; }
      return next;
    });
    const params = new URLSearchParams(searchParams);
    params.delete(key);
    setSearchParams(params, { replace: true });
    setPagination((prev) => ({ ...prev, page: 1 }));
  }

  function extFilterLabel(key, value) {
    if (key === 'period') return PERIOD_LABELS[value] || value;
    if (['pack_id', 'flash_sale_id', 'promotion_id', 'customer_id'].includes(key)) return `#${String(value).slice(0, 8).toUpperCase()}`;
    return value;
  }

  // ---------------------------------------------------------------------------
  // Recherche avec debounce
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => clearTimeout(timeout);
  }, [search]);

  // ---------------------------------------------------------------------------
  // Chargement des métadonnées
  // ---------------------------------------------------------------------------

  // Les créneaux sont maintenant liés à une date précise : on scope le
  // dropdown au nœud/jour actuellement filtrés pour éviter une liste
  // interminable (le backend se limite sinon aux créneaux à venir, tous
  // nœuds confondus, borné à 200).
  const loadMeta = useCallback(async () => {
    try {
      const response = await getOrdersMeta({
        node_id: nodeId || undefined,
        date: date || undefined,
      });
      const meta = response.data.data;

      setStatusCounts(meta.status_counts ?? []);
      setNodes(meta.nodes ?? []);
      setSlots(meta.slots ?? []);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          'Erreur lors du chargement des métadonnées'
      );
    }
  }, [nodeId, date]);

  // ---------------------------------------------------------------------------
  // Chargement des commandes
  // ---------------------------------------------------------------------------

  const queryFilters = useMemo(() => ({
    ...extFilters,
    search: debouncedSearch || undefined,
    status_code: activeTab === 'all' ? undefined : activeTab,
    node_id: nodeId || undefined,
    date: date || undefined,
    slot_id: slotFilter || undefined,
  }), [extFilters, debouncedSearch, activeTab, nodeId, date, slotFilter]);

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      const rows = [];
      let page = 1;
      let pages = 1;
      do {
        const res = await getOrders({ ...queryFilters, page, limit: 100 });
        rows.push(...(res.data.data || []));
        pages = res.data.pagination?.pages || 1;
        page += 1;
      } while (page <= pages && page <= 100);
      downloadCsv(`commandes-${new Date().toISOString().slice(0, 10)}.csv`, [
        'N° commande', 'Date', 'Client', 'Téléphone', 'Nœud', 'Statut', 'Articles', 'Total TTC', 'Frais livraison',
        'Remise', 'Créneau confirmé', 'Mode paiement', 'Statut paiement', 'Encaissé le',
      ], rows.map((o) => {
        const pay = o.payments?.[0];
        const slot = o.confirmed_slot;
        return [
          `ORD-${o.id.slice(0, 8).toUpperCase()}`,
          new Date(o.created_at).toLocaleString('fr-FR'),
          o.customer?.name || '',
          `${o.customer?.phone_country || ''}${o.customer?.phone_number || ''}`,
          o.node?.name_fr || '',
          o.status?.name_fr || o.status?.code || '',
          o._count?.items ?? '',
          Number(o.total_ttc ?? 0).toFixed(2),
          Number(o.delivery_fee ?? 0).toFixed(2),
          Number(o.discount_amount ?? 0).toFixed(2),
          slot ? `${String(slot.specific_date).slice(0, 10)} ${slot.slot_start}-${slot.slot_end}` : '',
          pay?.payment_method?.name_fr || pay?.payment_method?.code || '',
          pay?.status?.name_fr || pay?.status?.code || '',
          o.cod_collected_at ? new Date(o.cod_collected_at).toLocaleString('fr-FR') : '',
        ];
      }));
    } catch (err) {
      setError(err?.response?.data?.message || "Erreur lors de l'export");
    } finally {
      setExporting(false);
    }
  }

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getOrders({
        ...extFilters,
        page: pagination.page,
        limit: pagination.limit,

        search: debouncedSearch || undefined,

        status_code:
          activeTab === 'all'
            ? undefined
            : activeTab,

        node_id: nodeId || undefined,

        date: date || undefined,
        slot_id: slotFilter || undefined,
      });

      setOrders(response.data.data);
      setPagination(response.data.pagination);
      setLastUpdated(new Date());
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          'Erreur lors du chargement des commandes'
      );
    } finally {
      setLoading(false);
    }
  }, [
    extFilters,
    pagination.page,
    pagination.limit,
    debouncedSearch,
    activeTab,
    nodeId,
    date,
    slotFilter,
  ]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // ---------------------------------------------------------------------------
  // Calculs
  // ---------------------------------------------------------------------------

  const totalCount = useMemo(() => {
    return statusCounts.reduce(
      (sum, status) =>
        sum + Number(status.count || 0),
      0
    );
  }, [statusCounts]);

  // ---------------------------------------------------------------------------
  // Pagination
  // ---------------------------------------------------------------------------

  function goToPage(page) {
    setPagination((previous) => ({
      ...previous,
      page: Math.min(
        Math.max(1, page),
        previous.pages || 1
      ),
    }));
  }

  function changeLimit(limit) {
    setPagination((previous) => ({
      ...previous,
      limit,
      page: 1,
    }));
  }

  // ---------------------------------------------------------------------------
  // Annulation
  // ---------------------------------------------------------------------------

  // L'annulation passe par le panneau de détail : aperçu d'impact + motif obligatoire (US-058)
  function handleCancel(order) {
    setCancelIntent(true);
    setSelectedOrderId(order.id);
  }

  // ---------------------------------------------------------------------------
  // Changement de statut
  // ---------------------------------------------------------------------------

  function handleStatusChange(statusCode) {
    setActiveTab(statusCode);
    goToPage(1);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl rounded-xl border border-gray-200 bg-white">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-gray-900">
              {view === 'payments' ? 'Paiements à la livraison' : 'Liste des commandes'}
            </h1>
            <div className="flex rounded-lg bg-gray-100 p-0.5 text-xs font-medium">
              {[
                { key: 'orders', label: 'Liste des commandes' },
                { key: 'payments', label: 'Paiements à la livraison' },
              ].map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => setView(v.key)}
                  className={`rounded-md px-3 py-1.5 ${view === v.key ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-sm text-emerald-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />

            Mis à jour à{' '}
            {lastUpdated.toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 rounded-lg bg-rose-50 px-4 py-2.5 text-sm text-rose-600">
            {error}
          </div>
        )}

        {view === 'payments' && (
          <PaymentsView nodes={nodes} onOpenOrder={(id) => setSelectedOrderId(id)} />
        )}

        {view === 'orders' && (<>
        {/* Filtres */}
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-6 py-4">

          {/* Recherche */}
          <div className="relative min-w-[220px] flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                goToPage(1);
              }}
              placeholder="ID commande, client, téléphone..."
              className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-100"
            />
          </div>

          {/* Filtre nœud */}
          <div className="relative">
            <button
              type="button"
              title="Filtrer par nœud"
              aria-label="Filtrer par nœud"
              onClick={() =>
                setOpenFilter(
                  openFilter === 'node'
                    ? null
                    : 'node'
                )
              }
              className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
                nodeId
                  ? 'border-red-300 bg-red-50 text-red-600'
                  : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              <MapPin size={17} />
            </button>

            {openFilter === 'node' && (
              <div className="absolute right-0 top-11 z-30 min-w-[190px] rounded-lg border border-gray-200 bg-white p-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setNodeId('');
                    setOpenFilter(null);
                    goToPage(1);
                  }}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                    !nodeId
                      ? 'bg-red-50 text-red-600'
                      : 'text-gray-700'
                  }`}
                >
                  Tous les nœuds
                </button>

                {nodes.map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => {
                      setNodeId(node.id);
                      setOpenFilter(null);
                      goToPage(1);
                    }}
                    className={`w-full rounded-md px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                      nodeId === node.id
                        ? 'bg-red-50 text-red-600'
                        : 'text-gray-700'
                    }`}
                  >
                    {node.name_fr}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Filtre jour */}
          <label
            title="Filtrer par jour"
            className={`relative inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border transition-colors ${
              date
                ? 'border-red-300 bg-red-50 text-red-600'
                : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            <CalendarDays size={17} />

            <input
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                goToPage(1);
              }}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>

          {/* Filtre créneau */}
          <div className="relative">
            <button
              type="button"
              title="Filtrer par créneau"
              aria-label="Filtrer par créneau"
              onClick={() =>
                setOpenFilter(
                  openFilter === 'slot'
                    ? null
                    : 'slot'
                )
              }
              className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
                slotFilter
                  ? 'border-red-300 bg-red-50 text-red-600'
                  : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Clock3 size={17} />
            </button>

            {openFilter === 'slot' && (
              <div className="absolute right-0 top-11 z-30 min-w-[220px] rounded-lg border border-gray-200 bg-white p-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setSlotFilter('');
                    setOpenFilter(null);
                    goToPage(1);
                  }}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                    !slotFilter
                      ? 'bg-red-50 text-red-600'
                      : 'text-gray-700'
                  }`}
                >
                  Tous les créneaux
                </button>

                {slots.length === 0 && (
                  <div className="px-3 py-2 text-sm text-gray-400">
                    Aucun créneau disponible
                  </div>
                )}

                {slots.map((slot) => (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => {
                      setSlotFilter(slot.id);
                      setOpenFilter(null);
                      goToPage(1);
                    }}
                    className={`w-full rounded-md px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                      slotFilter === slot.id
                        ? 'bg-red-50 text-red-600'
                        : 'text-gray-700'
                    }`}
                  >
                    {formatSlotOption(slot)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Exporter */}
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Exporter
          </button>

          {/* Créer une commande */}
          <button
  type="button"
  onClick={() => setCreateOrderOpen(true)}
  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
>
  <Plus size={16} />
  Créer une commande
</button>
        </div>

        {Object.keys(extFilters).length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-6 py-2.5 text-xs">
            <span className="text-gray-400">Filtres appliqués :</span>
            {Object.entries(extFilters).map(([key, value]) => (
              <span key={key} className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 font-medium text-red-600">
                {EXTERNAL_FILTERS[key]} : {extFilterLabel(key, value)}
                <button type="button" onClick={() => removeExtFilter(key)} aria-label="Retirer le filtre" className="rounded hover:bg-red-100">
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Filtres des statuts */}
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-6 py-3">
          {/* Tous */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('all');
              goToPage(1);
            }}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              activeTab === 'all'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <span>Tous</span>

            <span
              className={`inline-flex min-w-[18px] justify-center rounded px-1 py-0.5 text-[11px] font-semibold ${
                activeTab === 'all'
                  ? 'bg-red-700 text-white'
                  : 'bg-red-100 text-red-600'
              }`}
            >
              {totalCount}
            </span>
          </button>

          {/* Statuts venant de la base */}
          {statusCounts.map((status) => {
            const isActive =
              activeTab === status.code;

            return (
              <button
                key={status.code}
                type="button"
                onClick={() =>
                  handleStatusChange(status.code)
                }
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {status.name_fr || status.code}
              </button>
            );
          })}
        </div>

        {/* Tableau des commandes */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-6 py-3 font-medium">
                  ID Commande
                </th>

                <th className="px-3 py-3 font-medium">
                  Client
                </th>

                <th className="px-3 py-3 font-medium">
                  Créée
                </th>

                <th className="px-3 py-3 font-medium">
                  Statut
                </th>

                <th className="px-3 py-3 font-medium">
                  Articles
                </th>

                <th className="px-3 py-3 font-medium">
                  Total
                </th>

                <th className="px-3 py-3 font-medium">
                  Créneau
                </th>

                <th className="px-3 py-3 font-medium">
                  Paiement
                </th>

                <th className="px-3 py-3 font-medium">
                  Statut paiement
                </th>

                <th className="px-6 py-3 text-right font-medium">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-6 py-10 text-center text-gray-400"
                  >
                    Chargement…
                  </td>
                </tr>
              )}

              {!loading && orders.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-6 py-10 text-center text-gray-400"
                  >
                    Aucune commande ne correspond aux filtres.
                  </td>
                </tr>
              )}

              {!loading &&
                orders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => { setCancelIntent(false); setSelectedOrderId(order.id); }}
                    className="cursor-pointer border-t border-gray-50 hover:bg-gray-50/60"
                  >
                    <td className="px-6 py-3.5 font-medium text-red-600">
                      ORD-
                      {order.id
                        ?.slice(0, 8)
                        .toUpperCase()}
                    </td>

                    <td className="px-3 py-3.5">
                      <div className="text-gray-900">
                        {order.customer?.name || '–'}
                      </div>

                      <div className="text-xs text-gray-400">
                        {order.customer?.phone_country}
                        {order.customer?.phone_number}
                      </div>
                    </td>

                    <td className="px-3 py-3.5 text-gray-400">
                      {formatRelativeTime(
                        order.created_at
                      )}
                    </td>

                    <td className="px-3 py-3.5">
                      <StatusBadge status={order.status} />
                    </td>

                    <td className="px-3 py-3.5 text-gray-600">
                      {order._count?.items ?? 0}
                    </td>

                    <td className="px-3 py-3.5 font-medium text-gray-900">
                      {Number(
                        order.total_ttc ?? 0
                      ).toFixed(2)}{' '}
                      {order.currency || 'MAD'}
                    </td>

                    <td className="px-3 py-3.5">
                      <SlotCell order={order} />
                    </td>

                    <td className="px-3 py-3.5">
                      <PaymentCell order={order} />
                    </td>

                    <td className="px-3 py-3.5">
                      <PaymentStatusCell
                        order={order}
                      />
                    </td>

                    {/* Actions avec icônes */}
                    <td className="px-6 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-1">
                        {/* Voir le détail */}
                        <button
                          type="button"
                          title="Voir le détail"
                          aria-label="Voir le détail"
                          onClick={() => {
                            setCancelIntent(false);
                            setSelectedOrderId(order.id);
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          <Eye size={17} />
                        </button>

                        {/* Annuler */}
                        {!order.status?.is_terminal && order.status?.code !== 'delivered' && (
                          <button
                            type="button"
                            title="Annuler la commande"
                            aria-label="Annuler la commande"
                            onClick={() =>
                              handleCancel(order)
                            }
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                          >
                            <Ban size={17} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4 text-sm text-gray-400">
          <span>
            {pagination.total} commandes
          </span>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span>Lignes par page :</span>

              {[25, 50, 100].map((limit) => (
                <button
                  key={limit}
                  type="button"
                  onClick={() => changeLimit(limit)}
                  className={`rounded-md px-2 py-1 text-xs font-medium ${
                    pagination.limit === limit
                      ? 'bg-red-600 text-white'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {limit}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  goToPage(pagination.page - 1)
                }
                disabled={pagination.page <= 1}
                className="rounded-md px-2 py-1 hover:bg-gray-100 disabled:opacity-30"
              >
                ◄
              </button>

              <span>
                {pagination.page}/
                {pagination.pages || 1}
              </span>

              <button
                type="button"
                onClick={() =>
                  goToPage(pagination.page + 1)
                }
                disabled={
                  pagination.page >= pagination.pages
                }
                className="rounded-md px-2 py-1 hover:bg-gray-100 disabled:opacity-30"
              >
                ►
              </button>
            </div>
          </div>
        </div>
        </>)}
      </div>


      {/* Drawer de détail */}
      <OrderDetailDrawer
        orderId={selectedOrderId}
        initialAction={cancelIntent ? 'cancel' : null}
        onClose={() => { setSelectedOrderId(null); setCancelIntent(false); }}
        onChanged={async () => {
          await Promise.all([
            loadOrders(),
            loadMeta(),
          ]);
        }}
      />

      <CreateOrderDrawer
  open={createOrderOpen}
  nodes={nodes}
  onClose={() => setCreateOrderOpen(false)}
  onCreated={async () => {
    await Promise.all([
      loadOrders(),
      loadMeta(),
    ]);
  }}
/>
    </div>
  );
}