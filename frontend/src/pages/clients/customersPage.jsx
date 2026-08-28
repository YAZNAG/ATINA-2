import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Search, Loader2, CheckCircle2, X, Home, Lock, User } from 'lucide-react';
import { getCustomers, getCustomer, blockCustomer, unblockCustomer, getAddresses, getPointsLedger, adjustPointsBalance, getReferrals } from '../../api/customers.api';
import { getCities } from '../../api/locationNode.api';
import { getOrders } from '../../api/orders_mgmt.api';
import { useAuth } from '../../context/AuthContext';

// ─── Helpers ────────────────────────────────────────────────────────────────

const N = (v) => Number(v ?? 0);

const formatMAD = (v) => `${N(v).toFixed(2)} MAD`;

const formatDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatTime = (d) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

const AVATAR_STYLES = [
  { bg: 'bg-red-100', fg: 'text-red-700' },
  { bg: 'bg-blue-100', fg: 'text-blue-700' },
  { bg: 'bg-purple-100', fg: 'text-purple-700' },
  { bg: 'bg-amber-100', fg: 'text-amber-700' },
  { bg: 'bg-emerald-100', fg: 'text-emerald-700' },
  { bg: 'bg-pink-100', fg: 'text-pink-700' },
];

const avatarStyle = (seed) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % AVATAR_STYLES.length;
  return AVATAR_STYLES[hash];
};

const STATUS_TABS = [
  { key: 'tous', label: 'Tous statuts' },
  { key: 'actif', label: 'Actif' },
  { key: 'bloque', label: 'Bloqué' },
];

const DRAWER_TABS = [
  { key: 'informations', label: 'Informations' },
  { key: 'adresses', label: 'Adresses' },
  { key: 'fidelite', label: 'Points & Fidélité' },
  { key: 'commandes', label: 'Commandes' },
  { key: 'parrainages', label: 'Parrainages' },
];

const StatusBadge = ({ active }) => (
  <span
    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
      active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
    }`}
  >
    {active ? 'Actif' : 'Bloqué'}
  </span>
);

const InfoRow = ({ label, children }) => (
  <div className="flex items-center justify-between px-5 py-3 border-b last:border-0">
    <span className="text-sm text-gray-500">{label}</span>
    <span className="text-sm font-medium text-gray-900">{children}</span>
  </div>
);

// ─── Addresses tab ──────────────────────────────────────────────────────────

const AddressCard = ({ address }) => {
  const streetLine = [address.street_number, address.street_name].filter(Boolean).join(' ')
    + (address.quartier ? `, ${address.quartier}` : '');
  const cityLine = [address.city, address.postal_code].filter(Boolean).join(' ');

  return (
    <div className="border rounded-xl p-4 bg-white">
      <div className="flex items-start justify-between mb-1.5">
        <p className="font-poppins font-semibold text-sm text-gray-900">{address.label || 'Adresse'}</p>
        {address.is_default && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            Défaut
          </span>
        )}
      </div>

      {streetLine.trim() && <p className="text-sm text-gray-600">{streetLine}</p>}
      {cityLine && <p className="text-sm text-gray-400">{cityLine}</p>}

      {(address.recipient_name || address.phone) && (
        <p className="text-xs text-gray-500 mt-2">
          {address.recipient_name}
          {address.recipient_name && address.phone ? ' • ' : ''}
          {address.phone}
        </p>
      )}

      {address.delivery_notes && (
        <p className="text-xs text-gray-400 italic mt-1">{address.delivery_notes}</p>
      )}
    </div>
  );
};

const AddressesTab = ({ customerId }) => {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await getAddresses(customerId);
        const payload = data?.data ?? data ?? [];
        const list = Array.isArray(payload) ? payload : payload.items ?? [];
        if (!cancelled) setAddresses(list);
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message || 'Erreur lors du chargement des adresses.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [customerId]);

  if (loading) {
    return (
      <p className="text-sm text-gray-400 flex items-center gap-2">
        <Loader2 size={14} className="animate-spin" /> Chargement...
      </p>
    );
  }
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (addresses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <Home size={28} className="mb-2" />
        <p className="text-sm">Aucune adresse enregistrée.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {addresses.map((a) => <AddressCard key={a.id} address={a} />)}
    </div>
  );
};

// ─── Permissions ────────────────────────────────────────────────────────────
// Codes assumed to match user.permissions from getMe() — adjust to your real codes.
const PERMISSIONS = {
  BLOCK_CUSTOMER: 'customers.block',
  ADJUST_POINTS: 'customers.points.adjust',
};

// ─── Points & Fidélité tab ──────────────────────────────────────────────────

const LEDGER_TYPE_STYLES = {
  earn: 'bg-green-100 text-green-700',
  manual_adjustment: 'bg-amber-100 text-amber-700',
  redeem: 'bg-purple-100 text-purple-700',
};

const AdjustPointsModal = ({ customerId, currentBalance, onClose, onSaved }) => {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const points = Number(amount);
    if (isNaN(points) || points === 0) return setError('Montant invalide (ex: -50 ou +100).');
    if (!reason.trim()) return setError('Motif requis.');

    setSaving(true);
    try {
      await adjustPointsBalance(customerId, { points, label: reason.trim() });
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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b">
          <h2 className="font-poppins font-bold text-lg text-gray-900">Ajuster le solde</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-500">Solde actuel : <span className="font-semibold text-amber-600">{N(currentBalance).toLocaleString('fr-FR')} pts</span></p>

          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1.5">Montant (+/-)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="ex: -50 ou +100"
              className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-[#E10600] focus:border-[#E10600]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1.5">Motif</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
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
            Valider
          </button>
        </div>
      </div>
    </div>
  );
};

const PointsTab = ({ customer, canAdjust, onAdjusted }) => {
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdjust, setShowAdjust] = useState(false);

  const loadLedger = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await getPointsLedger(customer.id);
      const payload = data?.data ?? data ?? [];
      const list = Array.isArray(payload) ? payload : payload.items ?? [];
      setLedger(list);
    } catch (err) {
      setError(err?.response?.data?.message || 'Erreur lors du chargement du grand-livre.');
    } finally {
      setLoading(false);
    }
  }, [customer.id]);

  useEffect(() => { loadLedger(); }, [loadLedger]);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="border rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-amber-500">{N(customer.points_balance).toLocaleString('fr-FR')}</p>
          <p className="text-xs text-gray-400 mt-1">Points Actifs</p>
        </div>
        {canAdjust ? (
          <button
            onClick={() => setShowAdjust(true)}
            className="border border-red-200 bg-red-50 rounded-xl p-4 text-sm font-semibold text-[#E10600] hover:bg-red-100"
          >
            Ajuster le solde
          </button>
        ) : (
          <div className="border rounded-xl p-4 flex items-center justify-center text-center text-xs text-gray-400 italic">
            Permission requise pour ajuster le solde
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mb-2">
        <h3 className="font-poppins font-semibold text-sm text-gray-900">Grand-livre</h3>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
          <Lock size={11} /> Immuable
        </span>
      </div>

      <div className="border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-left border-b text-xs">
              <th className="px-3 py-2.5 font-medium">Type</th>
              <th className="px-3 py-2.5 font-medium">Montant</th>
              <th className="px-3 py-2.5 font-medium">Motif</th>
              <th className="px-3 py-2.5 font-medium text-right">Date</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={4} className="px-3 py-8 text-center text-gray-400">
                <Loader2 className="inline animate-spin mr-2" size={14} /> Chargement...
              </td></tr>
            )}
            {!loading && error && (
              <tr><td colSpan={4} className="px-3 py-8 text-center text-red-600">{error}</td></tr>
            )}
            {!loading && !error && ledger.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-8 text-center text-gray-400">Aucun mouvement.</td></tr>
            )}
            {!loading && !error && ledger.map((l) => (
              <tr key={l.id} className="border-b last:border-0">
                <td className="px-3 py-2.5">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-mono ${LEDGER_TYPE_STYLES[l.type] ?? 'bg-gray-100 text-gray-600'}`}>
                    {l.type}
                  </span>
                </td>
                <td className={`px-3 py-2.5 font-semibold ${N(l.points) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {N(l.points) > 0 ? `+${N(l.points)}` : N(l.points)}
                </td>
                <td className="px-3 py-2.5 text-gray-600">{l.label ?? '—'}</td>
                <td className="px-3 py-2.5 text-gray-400 text-right">{formatDate(l.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdjust && (
        <AdjustPointsModal
          customerId={customer.id}
          currentBalance={customer.points_balance}
          onClose={() => setShowAdjust(false)}
          onSaved={() => { loadLedger(); onAdjusted(); }}
        />
      )}
    </>
  );
};

// ─── Commandes tab ──────────────────────────────────────────────────────────

const ORDER_STATUS_STYLES = {
  delivered: 'bg-green-100 text-green-700',
  out_for_delivery: 'bg-blue-100 text-blue-700',
  shipping: 'bg-blue-100 text-blue-700',
  in_delivery: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-700',
  pending: 'bg-gray-100 text-gray-600',
  processing: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-amber-100 text-amber-700',
};

const OrderCard = ({ order }) => {
  const code = order.order_code ?? order.reference ?? `ORD-${(order.id ?? '').slice(0, 8).toUpperCase()}`;
  const statusCode = order.status?.code ?? 'pending';
  const statusLabel = order.status?.name_fr ?? statusCode;
  const badgeClass = ORDER_STATUS_STYLES[statusCode] ?? 'bg-gray-100 text-gray-600';

  return (
    <div className="border rounded-xl p-4 bg-white flex items-center justify-between">
      <div>
        <p className="font-mono text-sm text-[#E10600] font-medium">{code}</p>
        <p className="text-xs text-gray-400 mt-0.5">{formatDate(order.created_at)}</p>
      </div>
      <div className="text-right">
        <p className="font-semibold text-gray-900">{formatMAD(order.total_ttc)}</p>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium mt-1 ${badgeClass}`}>
          {statusLabel}
        </span>
      </div>
    </div>
  );
};

const OrdersTab = ({ customerId }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await getOrders({ customer_id: customerId });
        const payload = data?.data ?? data ?? [];
        const list = Array.isArray(payload) ? payload : payload.items ?? [];
        list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        if (!cancelled) setOrders(list);
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message || 'Erreur lors du chargement des commandes.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [customerId]);

  if (loading) {
    return (
      <p className="text-sm text-gray-400 flex items-center gap-2">
        <Loader2 size={14} className="animate-spin" /> Chargement...
      </p>
    );
  }
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (orders.length === 0) {
    return <p className="text-sm text-gray-400 py-8 text-center">Aucune commande.</p>;
  }

  return (
    <div className="space-y-3">
      {orders.map((o) => <OrderCard key={o.id} order={o} />)}
    </div>
  );
};

// ─── Parrainages tab ────────────────────────────────────────────────────────

const REFERRAL_STATUS_STYLES = {
  validated: 'bg-green-100 text-green-700',
  pending: 'bg-blue-100 text-blue-700',
  expired: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-700',
};

const ParrainagesTab = ({ customer, onViewCustomer }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const { data: res } = await getReferrals(customer.id);
        const payload = res?.data ?? res ?? {};
        if (!cancelled) setData(payload);
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message || 'Erreur lors du chargement des parrainages.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [customer.id]);

  if (loading) {
    return (
      <p className="text-sm text-gray-400 flex items-center gap-2">
        <Loader2 size={14} className="animate-spin" /> Chargement...
      </p>
    );
  }
  if (error) return <p className="text-sm text-red-600">{error}</p>;

  const parrain = data?.parrain ?? null;
  const filleuls = data?.filleuls ?? [];

  return (
    <div className="space-y-4">
      <div className="border rounded-xl p-4">
        <p className="font-poppins font-semibold text-sm text-gray-900 pb-3 mb-3 border-b">
          Parrain (Celui qui a invité {customer.name})
        </p>
        {parrain ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 flex-shrink-0">
                <User size={16} />
              </span>
              <div>
                <p className="text-sm font-medium text-gray-900">{parrain.name}</p>
                <p className="text-xs text-gray-400">{parrain.phone_number}</p>
              </div>
            </div>
            <button
              onClick={() => onViewCustomer(parrain.id)}
              className="text-sm text-[#E10600] font-medium hover:underline"
            >
              Voir fiche
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">Aucun parrain — client venu sans invitation.</p>
        )}
      </div>

      <div className="border rounded-xl p-4">
        <p className="font-poppins font-semibold text-sm text-gray-900 pb-3 mb-3 border-b">
          Filleuls ({customer.name} a invité)
        </p>
        {filleuls.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Aucun filleul pour le moment.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs text-left">
                <th className="pb-2 font-medium">Filleul</th>
                <th className="pb-2 font-medium">Statut</th>
                <th className="pb-2 font-medium text-right">Récompense</th>
              </tr>
            </thead>
            <tbody>
              {filleuls.map((r) => {
                const code = r.status?.code ?? 'pending';
                const label = r.status?.name_fr ?? code;
                return (
                  <tr key={r.id} className="border-t">
                    <td className="py-2.5">
                      <p className="text-sm font-medium text-gray-900">{r.referee?.name ?? '—'}</p>
                      <p className="text-xs text-gray-400">{r.referee?.phone_number}</p>
                    </td>
                    <td className="py-2.5">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${REFERRAL_STATUS_STYLES[code] ?? 'bg-gray-100 text-gray-600'}`}>
                        {label}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-semibold text-green-600">
                      {r.reward_amount != null ? formatMAD(r.reward_amount) : <span className="text-gray-400 font-normal">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

// ─── Customer details drawer ───────────────────────────────────────────────

const CustomerDrawer = ({ customer, onClose, onToggleActive, toggling, onAdjustedPoints, onViewCustomer }) => {
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState('informations');
  const style = avatarStyle(customer.id || customer.name || '?');
  const initial = (customer.name || '?').trim().charAt(0).toUpperCase();

  return (
    <div className="w-[480px] flex-shrink-0 border-l bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between px-5 py-5 border-b">
        <div className="flex items-center gap-3">
          <span className={`w-11 h-11 rounded-full flex items-center justify-center text-base font-bold ${style.bg} ${style.fg}`}>
            {initial}
          </span>
          <div>
            <p className="font-poppins font-bold text-gray-900">{customer.name}</p>
            <p className="text-sm text-gray-400">{customer.phone_country} {customer.phone_number}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge active={customer.is_active} />
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 px-5 border-b">
        {DRAWER_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`py-3 text-xs font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
              tab === t.key ? 'border-[#E10600] text-[#E10600]' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {tab === 'informations' && (
          <>
            <h3 className="font-poppins font-semibold text-sm text-gray-900 mb-2">Identité</h3>
            <div className="border rounded-xl overflow-hidden mb-6">
              <InfoRow label="ID Client">
                <span className="font-mono text-xs">{customer.id}</span>
              </InfoRow>
              <InfoRow label="Code Parrainage">
                <span className="text-[#E10600] font-mono">{customer.referral_code ?? '—'}</span>
              </InfoRow>
              <InfoRow label="Langue préférée">{(customer.preferred_lang || 'fr').toUpperCase()}</InfoRow>
              <InfoRow label="Inscription">{formatDate(customer.created_at)}</InfoRow>
            </div>

            <div className="flex items-center justify-between border rounded-xl px-5 py-4 bg-gray-50">
              <div>
                <p className="font-poppins font-semibold text-sm text-gray-900">Statut du compte</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {customer.is_active
                    ? 'Un compte bloqué ne peut plus se connecter ni commander.'
                    : 'Ce compte est actuellement bloqué.'}
                </p>
              </div>
              <button
                onClick={() => onToggleActive(customer)}
                disabled={toggling || !hasPermission(PERMISSIONS.BLOCK_CUSTOMER)}
                title={!hasPermission(PERMISSIONS.BLOCK_CUSTOMER) ? 'Permission requise' : undefined}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm rounded-lg font-semibold border disabled:opacity-60 flex-shrink-0 ml-4 ${
                  customer.is_active
                    ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                    : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                }`}
              >
                {toggling && <Loader2 size={14} className="animate-spin" />}
                {customer.is_active ? 'Bloquer le client' : 'Débloquer le client'}
              </button>
            </div>
          </>
        )}

        {tab === 'adresses' && <AddressesTab customerId={customer.id} />}

        {tab === 'fidelite' && (
          <PointsTab
            customer={customer}
            canAdjust={hasPermission(PERMISSIONS.ADJUST_POINTS)}
            onAdjusted={onAdjustedPoints}
          />
        )}

        {tab === 'commandes' && <OrdersTab customerId={customer.id} />}

        {tab === 'parrainages' && <ParrainagesTab customer={customer} onViewCustomer={onViewCustomer} />}

        {tab !== 'informations' && tab !== 'adresses' && tab !== 'fidelite' && tab !== 'commandes' && tab !== 'parrainages' && (
          <p className="text-sm text-gray-400 italic">Bientôt disponible.</p>
        )}
      </div>
    </div>
  );
};

// ─── Main page ──────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('tous');
  const [cityFilter, setCityFilter] = useState('');
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(new Date());
  const [togglingId, setTogglingId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [externalCustomer, setExternalCustomer] = useState(null);
  const debounceRef = useRef(null);

  const fetchCustomers = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: pagination.limit };
      if (search.trim()) params.search = search.trim();
      if (statusFilter === 'actif') params.is_active = 'true';
      if (statusFilter === 'bloque') params.is_active = 'false';
      if (cityFilter) params.city = cityFilter;

      const { data } = await getCustomers(params);
      const payload = data?.data ?? data ?? {};
      const newItems = payload.items ?? [];

      setItems(newItems);
      setPagination(payload.pagination ?? { page, limit: pagination.limit, total: newItems.length, totalPages: 1 });
      setUpdatedAt(new Date());
    } catch (err) {
      setError(err?.response?.data?.message || 'Erreur lors du chargement des clients.');
      setItems([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter, cityFilter, pagination.limit]);

  // Canonical city list (Master Data Geography) — independent of loaded customers
  useEffect(() => {
    (async () => {
      try {
        const { data } = await getCities();
        const payload = data?.data ?? data ?? [];
        const list = (Array.isArray(payload) ? payload : payload.items ?? [])
          .filter((c) => c.is_active && !c.is_deleted)
          .map((c) => c.name_fr)
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b));
        setCities(list);
      } catch {
        setCities([]);
      }
    })();
  }, []);

  useEffect(() => { fetchCustomers(1); }, [statusFilter, cityFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchCustomers(1), 400);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handlePageChange = (page) => {
    if (page < 1 || page > pagination.totalPages) return;
    fetchCustomers(page);
  };

  const toggleActive = async (row) => {
    setTogglingId(row.id);
    try {
      if (row.is_active) await blockCustomer(row.id);
      else await unblockCustomer(row.id);
      await fetchCustomers(pagination.page);
    } catch (err) {
      setError(err?.response?.data?.message || 'Erreur lors de la mise à jour du statut.');
    } finally {
      setTogglingId(null);
    }
  };

  const countLabel = useMemo(() => {
    const n = pagination.total ?? items.length;
    return `${n} client${n > 1 ? 's' : ''}`;
  }, [pagination.total, items.length]);

  const selectedCustomer = useMemo(() => {
    const inList = items.find((c) => c.id === selectedId);
    if (inList) return inList;
    if (externalCustomer && externalCustomer.id === selectedId) return externalCustomer;
    return null;
  }, [items, selectedId, externalCustomer]);

  const openCustomerById = async (id) => {
    if (items.some((c) => c.id === id)) {
      setSelectedId(id);
      return;
    }
    try {
      const { data } = await getCustomer(id);
      const c = data?.data ?? data;
      setExternalCustomer(c);
      setSelectedId(id);
    } catch (err) {
      setError(err?.response?.data?.message || 'Impossible de charger ce client.');
    }
  };

  return (
    <div className="flex h-full">
      {/* Left: list */}
      <div className="flex-1 min-w-0 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-poppins font-bold text-2xl text-gray-900">Annuaire Clients</h1>
          <span className="text-xs text-gray-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            Mis à jour à {formatTime(updatedAt)}
          </span>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom, téléphone, code parrainage..."
              className="pl-9 pr-3 py-2 border rounded-lg text-sm w-72 focus:ring-2 focus:ring-[#E10600] focus:border-[#E10600] outline-none"
            />
          </div>

          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm text-gray-700 focus:ring-2 focus:ring-[#E10600] focus:border-[#E10600] outline-none"
          >
            <option value="">Toutes villes</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
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

        {/* Table */}
        <div className="border rounded-xl overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-left border-b">
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Téléphone</th>
                <th className="px-4 py-3 font-medium">Langue</th>
                <th className="px-4 py-3 font-medium">Solde Wallet</th>
                <th className="px-4 py-3 font-medium">Points</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Dernière Cmd</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                    <Loader2 className="inline animate-spin mr-2" size={16} /> Chargement...
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-red-600">{error}</td></tr>
              )}
              {!loading && !error && items.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">Aucun client trouvé.</td></tr>
              )}
              {!loading && !error && items.map((c) => {
                const style = avatarStyle(c.id || c.name || '?');
                const initial = (c.name || '?').trim().charAt(0).toUpperCase();
                const isSelected = c.id === selectedId;
                return (
                  <tr
                    key={c.id}
                    className={`border-b last:border-0 cursor-pointer ${isSelected ? 'bg-red-50' : 'hover:bg-gray-50'}`}
                    onClick={() => setSelectedId(c.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${style.bg} ${style.fg}`}>
                          {initial}
                        </span>
                        <span className="font-medium text-gray-900">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <span className="inline-flex items-center gap-1.5">
                        {c.phone_country} {c.phone_number}
                        {c.phone_verified_at && <CheckCircle2 size={14} className="text-green-600" />}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{(c.preferred_lang || 'fr').toUpperCase()}</td>
                    <td className="px-4 py-3 font-semibold text-green-600">{formatMAD(c.wallet_balance)}</td>
                    <td className="px-4 py-3 font-semibold text-amber-600">{N(c.points_balance).toLocaleString('fr-FR')}</td>
                    <td className="px-4 py-3"><StatusBadge active={c.is_active} /></td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(c.last_order_at ?? c.updated_at)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedId(c.id); }}
                        className="px-3 py-1.5 text-sm rounded-lg font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
                      >
                        Détails
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-3 text-sm text-gray-400">
          <span>{countLabel}</span>
          {pagination.totalPages > 1 && (
            <div className="flex items-center gap-3">
              <button
                disabled={pagination.page <= 1}
                onClick={() => handlePageChange(pagination.page - 1)}
                className="w-7 h-7 rounded-lg border border-gray-300 disabled:opacity-40"
              >
                ‹
              </button>
              <span>{pagination.page} / {pagination.totalPages}</span>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => handlePageChange(pagination.page + 1)}
                className="w-7 h-7 rounded-lg border border-gray-300 disabled:opacity-40"
              >
                ›
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right: details drawer */}
      {selectedCustomer && (
        <CustomerDrawer
          customer={selectedCustomer}
          onClose={() => setSelectedId(null)}
          onToggleActive={toggleActive}
          toggling={togglingId === selectedCustomer.id}
          onAdjustedPoints={() => fetchCustomers(pagination.page)}
          onViewCustomer={openCustomerById}
        />
      )}
    </div>
  );
}