import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search, Loader2, CheckCircle2, X, Home, Lock, User, Download, Unlock, ShieldAlert, ExternalLink, Coins, ChevronLeft, ChevronRight, MapPin,
} from 'lucide-react';
import Modal from '../../components/Modal';
import OrderDetailDrawer from '../commandes/OrderDetailDrawer';
import {
  getCustomers, exportCustomers, getCustomer, blockCustomer, unblockCustomer, getCustomerBlockHistory, getAddresses,
  getPointsLedger, exportPointsLedger, adjustPointsBalance, getReferrals, getCustomerOrders,
} from '../../api/customers.api';
import { getCities } from '../../api/locationNode.api';
import { useAuth } from '../../context/AuthContext';
import {
  PATHS, fmtDate, fmtDateTime, fmtNumber, fmtMAD, orderRef, downloadCsv, todayStamp, apiError,
  TxnTypeBadge, TXN_TYPE_LABELS, PointsAmount, ReferralStatusBadge, RewardCell, REFERRAL_STATUS_LABELS,
  ReferralDetailModal, LedgerDetailModal,
} from '../offres/loyalty/loyaltyShared';

// ─── Helpers ────────────────────────────────────────────────────────────────

const N = (v) => Number(v ?? 0);
const formatTime = (d) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const phoneOf = (c) => `${c?.phone_country ?? ''} ${c?.phone_number ?? ''}`.trim();
const cityOf = (c) => c?.city_label ?? c?.city_ref?.name_fr ?? c?.city ?? null;

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

const ORDER_STATUSES = [
  { code: 'pending', label: 'En attente' },
  { code: 'confirmed', label: 'Confirmée' },
  { code: 'picking', label: 'En préparation' },
  { code: 'ready', label: 'Prête' },
  { code: 'in_delivery', label: 'En livraison' },
  { code: 'delivered', label: 'Livrée' },
  { code: 'cancelled', label: 'Annulée' },
  { code: 'returned', label: 'Retournée' },
  { code: 'awaiting_stock', label: 'En attente de stock' },
];

const ORDER_STATUS_STYLES = {
  delivered: 'bg-green-100 text-green-700',
  in_delivery: 'bg-blue-100 text-blue-700',
  out_for_delivery: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-700',
  returned: 'bg-red-100 text-red-700',
  pending: 'bg-gray-100 text-gray-600',
  picking: 'bg-amber-100 text-amber-700',
  ready: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-amber-100 text-amber-700',
  awaiting_stock: 'bg-orange-100 text-orange-700',
};

const StatusBadge = ({ active }) => (
  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
    {active ? 'Actif' : 'Bloqué'}
  </span>
);

const InfoRow = ({ label, children }) => (
  <div className="flex items-center justify-between gap-4 px-5 py-3 border-b last:border-0">
    <span className="text-sm text-gray-500">{label}</span>
    <span className="text-sm font-medium text-gray-900 text-right">{children}</span>
  </div>
);

const Loading = () => (
  <p className="text-sm text-gray-400 flex items-center gap-2 py-6 justify-center">
    <Loader2 size={14} className="animate-spin" /> Chargement...
  </p>
);

const SmallBtn = ({ children, ...props }) => (
  <button type="button" {...props}
    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 ${props.className ?? ''}`}>
    {children}
  </button>
);

const PeriodInputs = ({ from, to, onFrom, onTo }) => (
  <>
    <input type="date" value={from} onChange={(e) => onFrom(e.target.value)} className="border rounded-lg px-2 py-1.5 text-xs text-gray-700" title="Du" />
    <input type="date" value={to} onChange={(e) => onTo(e.target.value)} className="border rounded-lg px-2 py-1.5 text-xs text-gray-700" title="Au" />
  </>
);

// ─── Blocage / déblocage (WF#7) ─────────────────────────────────────────────

const BlockModal = ({ customer, onClose, onDone }) => {
  const blocking = customer?.is_active;
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setReason(''); setError(''); }, [customer?.id]);

  const submit = async () => {
    if (blocking && !reason.trim()) { setError('Le motif du blocage est obligatoire (fraude, litige, abus…).'); return; }
    setSaving(true);
    setError('');
    try {
      if (blocking) await blockCustomer(customer.id, reason.trim());
      else await unblockCustomer(customer.id, reason.trim() || undefined);
      onDone(blocking ? 'Client bloqué' : 'Client débloqué');
    } catch (err) {
      setError(apiError(err, 'Erreur lors de la mise à jour du statut.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={Boolean(customer)} onClose={() => !saving && onClose()} size="sm"
      title={blocking ? 'Bloquer le client' : 'Débloquer le client'} subtitle={customer ? `${customer.name} · ${phoneOf(customer)}` : ''}
      footer={(
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Annuler</button>
          <button type="button" onClick={submit} disabled={saving}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${blocking ? 'bg-[#E10600] hover:bg-[#c00500]' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
            {saving && <Loader2 size={14} className="animate-spin" />} {blocking ? 'Confirmer le blocage' : 'Confirmer le déblocage'}
          </button>
        </>
      )}>
      <div className="space-y-3">
        <p className="text-sm text-gray-600">
          {blocking
            ? 'Le client ne pourra plus se connecter ni commander. Ses commandes, son solde de points et ses parrainages ne sont pas modifiés.'
            : 'Le client pourra de nouveau se connecter et commander.'}
        </p>
        <div>
          <label className="form-label">Motif {blocking ? '*' : '(recommandé)'}</label>
          <textarea className="form-textarea" rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder={blocking ? 'Fraude, litige, abus…' : 'Raison du déblocage'} maxLength={500} />
          <p className="mt-1 text-xs text-gray-400">Le motif est conservé dans le journal d’audit.</p>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
};

// ─── Informations ───────────────────────────────────────────────────────────

const InformationsTab = ({ customer, onViewCustomer }) => {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    let cancelled = false;
    getCustomerBlockHistory(customer.id)
      .then(({ data }) => { if (!cancelled) setHistory(data?.data ?? []); })
      .catch(() => { if (!cancelled) setHistory([]); });
    return () => { cancelled = true; };
  }, [customer.id, customer.is_active]);

  const parrain = customer.referred_by;

  return (
    <>
      <h3 className="font-poppins font-semibold text-sm text-gray-900 mb-2">Identité</h3>
      <div className="border rounded-xl overflow-hidden mb-5">
        <InfoRow label="Nom">{customer.name}</InfoRow>
        <InfoRow label="Téléphone">
          <span className="inline-flex items-center gap-1.5">
            {phoneOf(customer)}
            {customer.phone_verified_at
              ? <span className="inline-flex items-center gap-1 text-xs text-green-700"><CheckCircle2 size={13} /> vérifié le {fmtDate(customer.phone_verified_at)}</span>
              : <span className="text-xs text-gray-400">non vérifié</span>}
          </span>
        </InfoRow>
        <InfoRow label="Langue préférée">{(customer.preferred_lang || 'fr') === 'ar' ? 'Arabe (AR)' : 'Français (FR)'}</InfoRow>
        <InfoRow label="Ville">{cityOf(customer) ?? '—'}</InfoRow>
        <InfoRow label="Code parrainage"><span className="text-[#E10600] font-mono">{customer.referral_code ?? '—'}</span></InfoRow>
        <InfoRow label="Parrain">
          {parrain ? (
            <button type="button" onClick={() => onViewCustomer(parrain.id)} className="text-[#E10600] hover:underline">{parrain.name}</button>
          ) : <span className="text-gray-400">Non parrainé</span>}
        </InfoRow>
        <InfoRow label="Statut"><StatusBadge active={customer.is_active} /></InfoRow>
      </div>

      <h3 className="font-poppins font-semibold text-sm text-gray-900 mb-2">Activité</h3>
      <div className="border rounded-xl overflow-hidden mb-5">
        <InfoRow label="Solde de points">{fmtNumber(customer.points_balance)} pts</InfoRow>
        <InfoRow label="Points cumulés">{fmtNumber(customer.points_lifetime)} pts</InfoRow>
        <InfoRow label="Solde wallet">{fmtMAD(customer.wallet_balance)}</InfoRow>
        <InfoRow label="Inscription">{fmtDateTime(customer.created_at)}</InfoRow>
        <InfoRow label="Dernière mise à jour">{fmtDateTime(customer.updated_at)}</InfoRow>
      </div>

      <h3 className="font-poppins font-semibold text-sm text-gray-900 mb-2 flex items-center gap-2">
        Historique de blocage <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500"><Lock size={11} /> Audit</span>
      </h3>
      {history.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Aucun blocage enregistré.</p>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          {history.map((h) => (
            <div key={h.id} className="px-4 py-2.5 border-b last:border-0 text-sm">
              <div className="flex items-center justify-between">
                <span className={`font-medium ${h.action === 'BLOCK_USER' ? 'text-red-600' : 'text-green-700'}`}>{h.action === 'BLOCK_USER' ? 'Blocage' : 'Déblocage'}</span>
                <span className="text-xs text-gray-400">{fmtDateTime(h.created_at)}{h.admin ? ` · ${h.admin}` : ''}</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{h.reason || 'Sans motif'}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

// ─── Adresses (lecture) ─────────────────────────────────────────────────────

const AddressesTab = ({ customer, cityMap }) => {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [defaultOnly, setDefaultOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await getAddresses(customer.id);
        const payload = data?.data ?? data ?? [];
        const list = Array.isArray(payload) ? payload : payload.items ?? [];
        if (!cancelled) setAddresses(list.filter((a) => !a.is_deleted));
      } catch (err) {
        if (!cancelled) setError(apiError(err, 'Erreur lors du chargement des adresses.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [customer.id]);

  const addrCity = (a) => (a.city_id && cityMap[a.city_id]) || a.city_ref?.name_fr || a.city || '—';
  const cityOptions = useMemo(() => [...new Set(addresses.map(addrCity))].filter((c) => c && c !== '—').sort(), [addresses, cityMap]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = addresses.filter((a) => (!cityFilter || addrCity(a) === cityFilter) && (!defaultOnly || a.is_default));

  const doExport = () => downloadCsv(`adresses-${customer.name}-${todayStamp()}.csv`,
    ['Libellé', 'N°', 'Rue', 'Quartier', 'Ville', 'Code postal', 'Latitude', 'Longitude', 'Notes livraison', 'Par défaut'],
    shown.map((a) => [a.label ?? '', a.street_number ?? '', a.street_name ?? '', a.quartier ?? '', addrCity(a), a.postal_code ?? '', a.lat ?? '', a.lng ?? '', a.delivery_notes ?? '', a.is_default ? 'Oui' : 'Non']));

  if (loading) return <Loading />;
  if (error) return <p className="text-sm text-red-600">{error}</p>;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className="border rounded-lg px-2 py-1.5 text-xs text-gray-700">
          <option value="">Toutes villes</option>
          {cityOptions.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          <input type="checkbox" checked={defaultOnly} onChange={(e) => setDefaultOnly(e.target.checked)} /> Adresse par défaut
        </label>
        <SmallBtn className="ml-auto" onClick={doExport} disabled={shown.length === 0}><Download size={13} /> Exporter</SmallBtn>
      </div>
      <p className="text-xs text-gray-400 mb-3 flex items-center gap-1"><Lock size={11} /> Lecture seule : les adresses sont gérées par le client dans l’application.</p>
      {shown.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <Home size={28} className="mb-2" />
          <p className="text-sm">Aucune adresse{addresses.length ? ' pour ces filtres' : ' enregistrée'}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((a) => (
            <div key={a.id} className="border rounded-xl p-4 bg-white">
              <div className="flex items-start justify-between mb-1.5">
                <p className="font-poppins font-semibold text-sm text-gray-900">{a.label || 'Adresse'}</p>
                {a.is_default && <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Par défaut</span>}
              </div>
              <p className="text-sm text-gray-600">{[a.street_number, a.street_name].filter(Boolean).join(' ')}{a.quartier ? `, ${a.quartier}` : ''}</p>
              <p className="text-sm text-gray-400">{[addrCity(a), a.postal_code].filter(Boolean).join(' ')}</p>
              {(a.lat != null && a.lng != null) && (
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1"><MapPin size={11} /> {Number(a.lat).toFixed(6)}, {Number(a.lng).toFixed(6)}</p>
              )}
              {(a.recipient_name || a.phone) && (
                <p className="text-xs text-gray-500 mt-1">{a.recipient_name}{a.recipient_name && a.phone ? ' • ' : ''}{a.phone}</p>
              )}
              {a.delivery_notes && <p className="text-xs text-gray-400 italic mt-1">{a.delivery_notes}</p>}
            </div>
          ))}
        </div>
      )}
    </>
  );
};

// ─── Points & Fidélité (grand-livre + ajustement) ───────────────────────────

const AdjustPointsModal = ({ open, customerId, currentBalance, onClose, onSaved }) => {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (open) { setAmount(''); setReason(''); setError(''); } }, [open]);

  const n = Number(amount);
  const valid = amount !== '' && Number.isInteger(n) && n !== 0;
  const after = valid ? N(currentBalance) + n : null;

  const submit = async () => {
    setError('');
    if (!valid) { setError('Saisissez un nombre entier de points, positif (crédit) ou négatif (débit).'); return; }
    if (!reason.trim()) { setError('Le motif est obligatoire.'); return; }
    if (after < 0) { setError(`Débit refusé : le solde actuel (${fmtNumber(currentBalance)} pts) est insuffisant.`); return; }
    setSaving(true);
    try {
      await adjustPointsBalance(customerId, { amount: n, reason: reason.trim() });
      onSaved();
      onClose();
    } catch (err) {
      setError(apiError(err, 'Erreur lors de l’ajustement.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={() => !saving && onClose()} title="Ajuster les points" size="sm"
      footer={(
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Annuler</button>
          <button type="button" onClick={submit} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#E10600] px-4 py-2 text-sm font-semibold text-white hover:bg-[#c00500] disabled:opacity-60">
            {saving && <Loader2 size={14} className="animate-spin" />} Confirmer
          </button>
        </>
      )}>
      <div className="space-y-4">
        <p className="text-sm text-gray-500">Solde actuel : <span className="font-semibold text-amber-600">{fmtNumber(currentBalance)} pts</span></p>
        <div>
          <label className="form-label">Nombre de points (+ crédit / − débit) *</label>
          <input type="number" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="ex : 100 ou -50" className="form-input" />
          {valid && <p className={`mt-1 text-xs ${after < 0 ? 'text-red-600' : 'text-gray-500'}`}>Solde après ajustement : {fmtNumber(after)} pts</p>}
        </div>
        <div>
          <label className="form-label">Motif *</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Raison de l'ajustement (incident, geste commercial…)" rows={3} maxLength={200} className="form-textarea" />
        </div>
        <p className="text-xs text-gray-400">Une transaction « Ajustement manuel » est ajoutée au grand-livre (aucune ligne n’est modifiée). Pour corriger une erreur, saisissez un ajustement inverse.</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
};

const PointsTab = ({ customer, canAdjust, canLedgerDetail, initialType, onAdjusted, onOpenOrder, onOpenReferral }) => {
  const [header, setHeader] = useState({ points_balance: customer.points_balance, points_lifetime: customer.points_lifetime });
  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [type, setType] = useState(initialType || '');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showAdjust, setShowAdjust] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [txnId, setTxnId] = useState(null);

  useEffect(() => { setType(initialType || ''); }, [initialType]);

  const params = useMemo(() => {
    const p = { limit: 25 };
    if (type) p.type = type;
    if (dateFrom) p.date_from = dateFrom;
    if (dateTo) p.date_to = dateTo;
    return p;
  }, [type, dateFrom, dateTo]);

  const load = useCallback(async (cursor = null) => {
    if (cursor) setLoadingMore(true); else setLoading(true);
    setError('');
    try {
      const { data } = await getPointsLedger(customer.id, { ...params, ...(cursor ? { cursor } : {}) });
      const d = data?.data ?? {};
      setHeader({ points_balance: d.points_balance, points_lifetime: d.points_lifetime });
      setItems((prev) => (cursor ? [...prev, ...(d.items ?? [])] : d.items ?? []));
      setNextCursor(d.next_cursor ?? null);
    } catch (err) {
      setError(apiError(err, 'Erreur lors du chargement du grand-livre.'));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [customer.id, params]);

  useEffect(() => { load(null); }, [load]);

  const doExport = async () => {
    setExporting(true);
    try {
      const { data } = await exportPointsLedger(customer.id, params);
      const d = data?.data ?? {};
      downloadCsv(`points-${customer.name}-${todayStamp()}.csv`, ['Date', 'Type', 'Montant', 'Motif', 'Règle', 'Source', 'ID transaction'],
        (d.items ?? []).map((t) => [fmtDateTime(t.created_at), t.type_label ?? t.type, t.amount, t.reason ?? '', t.rule?.type_label ?? '', t.source?.label ?? '', t.id]));
    } catch (err) {
      setError(apiError(err, 'Export impossible.'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-amber-500">{fmtNumber(header.points_balance)}</p>
          <p className="text-xs text-gray-400 mt-1">Solde actuel</p>
        </div>
        <div className="border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-gray-700">{fmtNumber(header.points_lifetime)}</p>
          <p className="text-xs text-gray-400 mt-1">Points cumulés</p>
        </div>
        {canAdjust ? (
          <button type="button" onClick={() => setShowAdjust(true)} className="border border-red-200 bg-red-50 rounded-xl p-4 text-sm font-semibold text-[#E10600] hover:bg-red-100">
            Ajuster les points
          </button>
        ) : (
          <div className="border rounded-xl p-4 flex items-center justify-center text-center text-xs text-gray-400 italic">
            Permission requise pour ajuster les points
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-2">
        <h3 className="font-poppins font-semibold text-sm text-gray-900 mr-1">Grand-livre</h3>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500"><Lock size={11} /> Immuable</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <select value={type} onChange={(e) => setType(e.target.value)} className="border rounded-lg px-2 py-1.5 text-xs text-gray-700">
          <option value="">Tous les types</option>
          {Object.entries(TXN_TYPE_LABELS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
        </select>
        <PeriodInputs from={dateFrom} to={dateTo} onFrom={setDateFrom} onTo={setDateTo} />
        <SmallBtn className="ml-auto" onClick={doExport} disabled={exporting}>{exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Exporter</SmallBtn>
      </div>

      <div className="border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-left border-b text-xs">
              <th className="px-3 py-2.5 font-medium">Date</th>
              <th className="px-3 py-2.5 font-medium">Type</th>
              <th className="px-3 py-2.5 font-medium text-right">Montant</th>
              <th className="px-3 py-2.5 font-medium">Motif</th>
              <th className="px-3 py-2.5 font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5}><Loading /></td></tr>}
            {!loading && error && <tr><td colSpan={5} className="px-3 py-8 text-center text-red-600">{error}</td></tr>}
            {!loading && !error && items.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400">Aucun mouvement de points.</td></tr>}
            {!loading && !error && items.map((t) => (
              <tr key={t.id} onClick={canLedgerDetail ? () => setTxnId(t.id) : undefined} className={`border-b last:border-0 ${canLedgerDetail ? 'cursor-pointer hover:bg-gray-50' : ''}`}>
                <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap text-xs">{fmtDateTime(t.created_at)}</td>
                <td className="px-3 py-2.5"><TxnTypeBadge type={t.type} label={t.type_label} /></td>
                <td className="px-3 py-2.5 text-right"><PointsAmount value={t.amount} /></td>
                <td className="px-3 py-2.5 text-gray-600 text-xs">{t.reason ?? '—'}{t.rule ? <div className="text-gray-400">Règle : {t.rule.type_label}</div> : null}</td>
                <td className="px-3 py-2.5 text-xs">
                  {t.source?.kind === 'order' && <button type="button" onClick={(e) => { e.stopPropagation(); onOpenOrder(t.order_id); }} className="text-[#E10600] hover:underline">{orderRef(t.order_id)}</button>}
                  {t.source?.kind === 'referral' && (onOpenReferral
                    ? <button type="button" onClick={(e) => { e.stopPropagation(); onOpenReferral(t.referral_id); }} className="text-[#E10600] hover:underline">Parrainage</button>
                    : <span className="text-gray-600">Parrainage</span>)}
                  {t.source?.kind === 'game_play' && <Link to={`${PATHS.games}?play=${t.game_play_id}`} onClick={(e) => e.stopPropagation()} className="text-[#E10600] hover:underline">Partie de jeu</Link>}
                  {!t.source && <span className="text-gray-400">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {nextCursor && !loading && (
        <div className="mt-3 text-center">
          <SmallBtn onClick={() => load(nextCursor)} disabled={loadingMore}>{loadingMore && <Loader2 size={13} className="animate-spin" />} Charger les transactions suivantes</SmallBtn>
        </div>
      )}

      <AdjustPointsModal
        open={showAdjust}
        customerId={customer.id}
        currentBalance={header.points_balance}
        onClose={() => setShowAdjust(false)}
        onSaved={() => { load(null); onAdjusted('Points ajustés'); }}
      />
      <LedgerDetailModal
        txnId={txnId}
        onClose={() => setTxnId(null)}
        onOpenOrder={(id) => { setTxnId(null); onOpenOrder(id); }}
        onOpenReferral={onOpenReferral ? (id) => { setTxnId(null); onOpenReferral(id); } : undefined}
      />
    </>
  );
};

// ─── Commandes du client (US-105) ───────────────────────────────────────────

const OrdersTab = ({ customer, onOpenOrder }) => {
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 0, total: 0 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  const params = useMemo(() => {
    const p = {};
    if (status) p.status = status;
    if (dateFrom) p.date_from = dateFrom;
    if (dateTo) p.date_to = dateTo;
    return p;
  }, [status, dateFrom, dateTo]);

  useEffect(() => { setPage(1); }, [params]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await getCustomerOrders(customer.id, { ...params, page, limit: 20 });
        const d = data?.data ?? {};
        if (!cancelled) { setOrders(d.items ?? []); setPagination(d.pagination ?? { page: 1, totalPages: 0, total: 0 }); }
      } catch (err) {
        if (!cancelled) setError(apiError(err, 'Erreur lors du chargement des commandes.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [customer.id, params, page]);

  const slotOf = (o) => {
    if (o.confirmed_slot) return `${fmtDate(o.confirmed_slot.specific_date)} ${o.confirmed_slot.slot_start}–${o.confirmed_slot.slot_end}`;
    if (o.slot_start) return `${fmtDateTime(o.slot_start)}`;
    return '—';
  };

  const doExport = async () => {
    setExporting(true);
    try {
      const all = [];
      for (let p = 1; p <= 50; p += 1) {
        // eslint-disable-next-line no-await-in-loop
        const { data } = await getCustomerOrders(customer.id, { ...params, page: p, limit: 200 });
        const d = data?.data ?? {};
        all.push(...(d.items ?? []));
        if (p >= (d.pagination?.totalPages ?? 1)) break;
      }
      downloadCsv(`commandes-${customer.name}-${todayStamp()}.csv`, ['N° commande', 'Date', 'Node', 'Montant total (MAD)', 'Statut', 'Mode de paiement', 'Créneau confirmé', 'ID'],
        all.map((o) => [orderRef(o.id), fmtDateTime(o.created_at), o.node?.name_fr ?? '', N(o.total_ttc).toFixed(2), o.status?.name_fr ?? o.status?.code ?? '', o.payment_method?.name_fr ?? 'COD', slotOf(o), o.id]));
    } catch (err) {
      setError(apiError(err, 'Export impossible.'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded-lg px-2 py-1.5 text-xs text-gray-700">
          <option value="">Tous statuts</option>
          {ORDER_STATUSES.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}
        </select>
        <PeriodInputs from={dateFrom} to={dateTo} onFrom={setDateFrom} onTo={setDateTo} />
        <SmallBtn className="ml-auto" onClick={doExport} disabled={exporting || orders.length === 0}>{exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Exporter</SmallBtn>
      </div>
      {loading ? <Loading /> : error ? <p className="text-sm text-red-600">{error}</p> : orders.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">Aucune commande.</p>
      ) : (
        <div className="border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-left border-b text-xs">
                <th className="px-3 py-2.5 font-medium">N° commande</th>
                <th className="px-3 py-2.5 font-medium">Date</th>
                <th className="px-3 py-2.5 font-medium">Node</th>
                <th className="px-3 py-2.5 font-medium text-right">Montant</th>
                <th className="px-3 py-2.5 font-medium">Statut</th>
                <th className="px-3 py-2.5 font-medium">Paiement</th>
                <th className="px-3 py-2.5 font-medium">Créneau confirmé</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} onClick={() => onOpenOrder(o.id)} className="border-b last:border-0 cursor-pointer hover:bg-gray-50">
                  <td className="px-3 py-2.5 font-mono text-xs text-[#E10600]">{orderRef(o.id)}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{fmtDateTime(o.created_at)}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-600">{o.node?.name_fr ?? '—'}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-gray-900 whitespace-nowrap">{fmtMAD(o.total_ttc)}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ORDER_STATUS_STYLES[o.status?.code] ?? 'bg-gray-100 text-gray-600'}`}>{o.status?.name_fr ?? o.status?.code}</span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-600">{o.payment_method?.name_fr ?? 'COD'}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-600">{slotOf(o)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
        <span>{pagination.total} commande{pagination.total > 1 ? 's' : ''} · triées de la plus récente à la plus ancienne</span>
        <div className="flex items-center gap-2">
          <Link to={PATHS.orders} className="inline-flex items-center gap-1 text-[#E10600] hover:underline">Commandes <ExternalLink size={11} /></Link>
          {pagination.totalPages > 1 && (
            <>
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border p-1 disabled:opacity-40"><ChevronLeft size={13} /></button>
              <span>{page} / {pagination.totalPages}</span>
              <button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border p-1 disabled:opacity-40"><ChevronRight size={13} /></button>
            </>
          )}
        </div>
      </div>
    </>
  );
};

// ─── Parrainages du client (US-104) ─────────────────────────────────────────

const ParrainagesTab = ({ customer, onViewCustomer, onOpenOrder, onOpenReferral, onShowReferralPoints }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const params = useMemo(() => {
    const p = {};
    if (status) p.status = status;
    if (dateFrom) p.date_from = dateFrom;
    if (dateTo) p.date_to = dateTo;
    return p;
  }, [status, dateFrom, dateTo]);

  useEffect(() => { setPage(1); }, [params]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const { data: res } = await getReferrals(customer.id, { ...params, page, limit: 20 });
        if (!cancelled) setData(res?.data ?? null);
      } catch (err) {
        if (!cancelled) setError(apiError(err, 'Erreur lors du chargement des parrainages.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [customer.id, params, page]);

  const doExport = async () => {
    setExporting(true);
    try {
      const all = [];
      for (let p = 1; p <= 50; p += 1) {
        // eslint-disable-next-line no-await-in-loop
        const { data: res } = await getReferrals(customer.id, { ...params, page: p, limit: 200 });
        const d = res?.data ?? {};
        all.push(...(d.filleuls ?? []));
        if (p >= (d.pagination?.pages ?? 1)) break;
      }
      downloadCsv(`filleuls-${customer.name}-${todayStamp()}.csv`, ['Filleul', 'Téléphone', 'Statut', 'Date de création', 'Commande qualifiante', 'Date de validation', 'Récompense'],
        all.map((r) => [r.referee?.name ?? '', phoneOf(r.referee), r.status?.name_fr ?? r.status?.code ?? '', fmtDateTime(r.created_at),
          r.qualifying_order_id ? orderRef(r.qualifying_order_id) : '', fmtDateTime(r.validated_at), r.reward?.label ?? '']));
    } catch (err) {
      setError(apiError(err, 'Export impossible.'));
    } finally {
      setExporting(false);
    }
  };

  if (loading && !data) return <Loading />;
  if (error && !data) return <p className="text-sm text-red-600">{error}</p>;

  const parrain = data?.parrain ?? null;
  const filleuls = data?.filleuls ?? [];
  const pag = data?.pagination ?? { pages: 1, total: 0 };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500">Code de parrainage : <span className="font-mono font-semibold text-[#E10600]">{data?.customer?.referral_code ?? customer.referral_code ?? '—'}</span></span>
        <span className="flex items-center gap-3 text-xs">
          <Link to={`${PATHS.referrals}?tab=suivi`} className="inline-flex items-center gap-1 text-[#E10600] hover:underline">Voir dans le suivi global <ExternalLink size={11} /></Link>
          <Link to={`${PATHS.referrals}?tab=config`} className="inline-flex items-center gap-1 text-gray-500 hover:underline">Configuration des règles <ExternalLink size={11} /></Link>
        </span>
      </div>

      {/* Bloc 1 — Parrain (1:1) */}
      <div className="border rounded-xl p-4">
        <p className="font-poppins font-semibold text-sm text-gray-900 pb-3 mb-3 border-b">Parrain</p>
        {parrain ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 flex-shrink-0"><User size={16} /></span>
              <div>
                <p className="text-sm font-medium text-gray-900">{parrain.name}</p>
                <p className="text-xs text-gray-400">{phoneOf(parrain)}</p>
              </div>
            </div>
            <button type="button" onClick={() => onViewCustomer(parrain.id)} className="text-sm text-[#E10600] font-medium hover:underline">Voir la fiche</button>
          </div>
        ) : <p className="text-sm text-gray-400 italic">Non parrainé</p>}
      </div>

      {/* Bloc 2 — Filleuls (1:N) */}
      <div className="border rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b">
          <p className="font-poppins font-semibold text-sm text-gray-900">Filleuls</p>
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-600">{data?.counters?.filleuls ?? 0} filleul{(data?.counters?.filleuls ?? 0) > 1 ? 's' : ''}</span>
            <span className="rounded-full bg-green-50 px-2.5 py-1 text-green-700">{data?.counters?.valides ?? 0} validé{(data?.counters?.valides ?? 0) > 1 ? 's' : ''}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded-lg px-2 py-1.5 text-xs text-gray-700">
            <option value="">Tous statuts</option>
            {Object.entries(REFERRAL_STATUS_LABELS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </select>
          <PeriodInputs from={dateFrom} to={dateTo} onFrom={setDateFrom} onTo={setDateTo} />
          <SmallBtn className="ml-auto" onClick={doExport} disabled={exporting || filleuls.length === 0}>{exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Exporter</SmallBtn>
        </div>
        {loading ? <Loading /> : filleuls.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Aucun filleul{status || dateFrom || dateTo ? ' pour ces filtres' : ''}.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-xs text-left">
                  <th className="pb-2 font-medium">Filleul</th>
                  <th className="pb-2 font-medium">Statut</th>
                  <th className="pb-2 font-medium">Création</th>
                  <th className="pb-2 font-medium">Commande qualifiante</th>
                  <th className="pb-2 font-medium">Validation</th>
                  <th className="pb-2 font-medium">Récompense</th>
                </tr>
              </thead>
              <tbody>
                {filleuls.map((r) => (
                  <tr key={r.id} onClick={() => onViewCustomer(r.referee_id)} className="border-t cursor-pointer hover:bg-gray-50">
                    <td className="py-2.5 pr-2">
                      <p className="text-sm font-medium text-gray-900">{r.referee?.name ?? '—'}</p>
                      <p className="text-xs text-gray-400">{phoneOf(r.referee)}</p>
                    </td>
                    <td className="py-2.5 pr-2"><ReferralStatusBadge status={r.status} /></td>
                    <td className="py-2.5 pr-2 text-xs text-gray-500 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                    <td className="py-2.5 pr-2 text-xs">
                      {r.qualifying_order_id ? (
                        <button type="button" onClick={(e) => { e.stopPropagation(); onOpenOrder(r.qualifying_order_id); }} className="text-[#E10600] hover:underline">{orderRef(r.qualifying_order_id)}</button>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="py-2.5 pr-2 text-xs text-gray-500 whitespace-nowrap">{fmtDate(r.validated_at)}</td>
                    <td className="py-2.5 text-xs" onClick={(e) => e.stopPropagation()}>
                      <RewardCell reward={r.reward} onClick={onOpenReferral ? () => onOpenReferral(r.id) : undefined} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
          <button type="button" onClick={onShowReferralPoints} className="inline-flex items-center gap-1 text-[#E10600] hover:underline">
            <Coins size={12} /> Récompenses en points dans le grand-livre
          </button>
          {pag.pages > 1 && (
            <div className="flex items-center gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border p-1 disabled:opacity-40"><ChevronLeft size={13} /></button>
              <span>{page} / {pag.pages}</span>
              <button type="button" disabled={page >= pag.pages} onClick={() => setPage((p) => p + 1)} className="rounded border p-1 disabled:opacity-40"><ChevronRight size={13} /></button>
            </div>
          )}
        </div>
        <p className="mt-2 text-xs text-gray-400 flex items-center gap-1"><Lock size={11} /> Lecture seule : les parrainages sont créés par l’application et validés à la livraison.</p>
      </div>
    </div>
  );
};

// ─── Fiche client ───────────────────────────────────────────────────────────

const CustomerDrawer = ({ customer, tab, onTabChange, pointsType, onPointsType, onClose, onAskBlock, canBlock, onChanged, onViewCustomer, cityMap }) => {
  const { hasPermission } = useAuth();
  const [orderId, setOrderId] = useState(null);
  const [referralId, setReferralId] = useState(null);
  const style = avatarStyle(customer.id || customer.name || '?');
  const initial = (customer.name || '?').trim().charAt(0).toUpperCase();
  const canAdjust = hasPermission('customers.points.adjust') || hasPermission('customers.update');
  const canLedgerDetail = hasPermission('points_ledger.view');
  // Le détail d'audit d'un parrainage (/loyalty/referrals/:id) exige referrals.view
  const canReferralDetail = hasPermission('referrals.view') || hasPermission('referrals.manage');
  const openReferral = canReferralDetail ? setReferralId : null;

  const exportFiche = () => downloadCsv(`client-${customer.name}-${todayStamp()}.csv`,
    ['Nom', 'Téléphone', 'Téléphone vérifié le', 'Langue', 'Ville', 'Code parrainage', 'Parrain', 'Statut', 'Solde points', 'Points cumulés', 'Inscription', 'Mise à jour'],
    [[customer.name, phoneOf(customer), customer.phone_verified_at ? fmtDateTime(customer.phone_verified_at) : '', (customer.preferred_lang || 'fr').toUpperCase(),
      cityOf(customer) ?? '', customer.referral_code ?? '', customer.referred_by?.name ?? '', customer.is_active ? 'Actif' : 'Bloqué',
      customer.points_balance ?? 0, customer.points_lifetime ?? 0, fmtDateTime(customer.created_at), fmtDateTime(customer.updated_at)]]);

  return (
    <div className="w-[640px] max-w-[60vw] flex-shrink-0 border-l bg-white flex flex-col">
      <div className="flex items-start justify-between px-5 py-5 border-b">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`w-11 h-11 rounded-full flex items-center justify-center text-base font-bold ${style.bg} ${style.fg}`}>{initial}</span>
          <div className="min-w-0">
            <p className="font-poppins font-bold text-gray-900 truncate">{customer.name}</p>
            <p className="text-sm text-gray-400">{phoneOf(customer)}</p>
            <p className="text-xs text-amber-600 font-medium">{fmtNumber(customer.points_balance)} pts</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusBadge active={customer.is_active} />
          <button type="button" onClick={exportFiche} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700" title="Exporter la fiche"><Download size={16} /></button>
          {canBlock && (
            <button type="button" onClick={() => onAskBlock(customer)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-semibold border ${customer.is_active ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100' : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'}`}>
              {customer.is_active ? <><ShieldAlert size={13} /> Bloquer</> : <><Unlock size={13} /> Débloquer</>}
            </button>
          )}
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
      </div>

      <div className="flex gap-4 px-5 border-b overflow-x-auto">
        {DRAWER_TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => onTabChange(t.key)}
            className={`py-3 text-xs font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${tab === t.key ? 'border-[#E10600] text-[#E10600]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {tab === 'informations' && <InformationsTab customer={customer} onViewCustomer={onViewCustomer} />}
        {tab === 'adresses' && <AddressesTab customer={customer} cityMap={cityMap} />}
        {tab === 'fidelite' && (
          <PointsTab
            customer={customer}
            canAdjust={canAdjust}
            canLedgerDetail={canLedgerDetail}
            initialType={pointsType}
            onAdjusted={onChanged}
            onOpenOrder={setOrderId}
            onOpenReferral={openReferral}
          />
        )}
        {tab === 'commandes' && <OrdersTab customer={customer} onOpenOrder={setOrderId} />}
        {tab === 'parrainages' && (
          <ParrainagesTab
            customer={customer}
            onViewCustomer={onViewCustomer}
            onOpenOrder={setOrderId}
            onOpenReferral={openReferral}
            onShowReferralPoints={() => { onPointsType('referral_reward'); onTabChange('fidelite'); }}
          />
        )}
      </div>

      <ReferralDetailModal referralId={referralId} onClose={() => setReferralId(null)} onOpenOrder={(id) => { setReferralId(null); setOrderId(id); }} />
      <OrderDetailDrawer orderId={orderId} onClose={() => setOrderId(null)} onChanged={() => onChanged()} />
    </div>
  );
};

// ─── Page principale ────────────────────────────────────────────────────────

export default function CustomersPage() {
  const { hasPermission } = useAuth();
  const canBlock = hasPermission('customers.update') || hasPermission('customers.block') || hasPermission('dashboard.view');
  const [searchParams, setSearchParams] = useSearchParams();

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('tous');
  const [cityFilter, setCityFilter] = useState('');
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [updatedAt, setUpdatedAt] = useState(new Date());
  const [exporting, setExporting] = useState(false);
  const [blockTarget, setBlockTarget] = useState(null);
  const [selected, setSelected] = useState(null);
  const [pointsType, setPointsType] = useState('');
  const debounceRef = useRef(null);

  const selectedId = searchParams.get('id');
  const tab = DRAWER_TABS.some((t) => t.key === searchParams.get('tab')) ? searchParams.get('tab') : 'informations';

  const cityMap = useMemo(() => Object.fromEntries(cities.map((c) => [c.id, c.name_fr])), [cities]);

  const listParams = useCallback((extra = {}) => {
    const params = { ...extra };
    if (search.trim()) params.search = search.trim();
    if (statusFilter === 'actif') params.is_active = 'true';
    if (statusFilter === 'bloque') params.is_active = 'false';
    if (cityFilter) params.city_id = cityFilter;
    return params;
  }, [search, statusFilter, cityFilter]);

  const fetchCustomers = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await getCustomers(listParams({ page, limit: pagination.limit }));
      const payload = data?.data ?? data ?? {};
      const newItems = payload.items ?? [];
      setItems(newItems);
      setPagination(payload.pagination ?? { page, limit: pagination.limit, total: newItems.length, totalPages: 1 });
      setUpdatedAt(new Date());
    } catch (err) {
      setError(apiError(err, 'Erreur lors du chargement des clients.'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [listParams, pagination.limit]);

  // Référentiel des villes (Master Data Géographie)
  useEffect(() => {
    (async () => {
      try {
        const { data } = await getCities({ limit: 1000 });
        const payload = data?.data ?? data ?? [];
        const list = (Array.isArray(payload) ? payload : payload.items ?? [])
          .filter((c) => c.is_active !== false && !c.is_deleted && c.name_fr)
          .sort((a, b) => a.name_fr.localeCompare(b.name_fr));
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
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fiche : chargée depuis l'API (données complètes : parrain, ville, compteurs)
  const loadSelected = useCallback(async (id) => {
    if (!id) { setSelected(null); return; }
    try {
      const { data } = await getCustomer(id);
      setSelected(data?.data ?? data);
    } catch (err) {
      setError(apiError(err, 'Impossible de charger ce client.'));
      setSelected(null);
    }
  }, []);

  useEffect(() => { loadSelected(selectedId); }, [selectedId, loadSelected]);

  const openCustomer = (id, nextTab = 'informations') => {
    setPointsType('');
    setSearchParams({ id, tab: nextTab });
  };
  const closeCustomer = () => setSearchParams({});
  const changeTab = (key) => { if (key !== 'fidelite') setPointsType(''); setSearchParams({ id: selectedId, tab: key }); };

  const refreshAll = (message) => {
    if (message) { setNotice(message); setTimeout(() => setNotice(''), 3000); }
    fetchCustomers(pagination.page);
    loadSelected(selectedId);
  };

  const handlePageChange = (page) => {
    if (page < 1 || page > pagination.totalPages) return;
    fetchCustomers(page);
  };

  const doExport = async () => {
    setExporting(true);
    try {
      const { data } = await exportCustomers(listParams());
      const d = data?.data ?? {};
      downloadCsv(`clients-${todayStamp()}.csv`,
        ['Nom', 'Téléphone', 'Téléphone vérifié', 'Langue', 'Ville', 'Statut', 'Solde points', 'Points cumulés', 'Code parrainage', 'Inscription'],
        (d.items ?? []).map((c) => [c.name, phoneOf(c), c.phone_verified_at ? 'Oui' : 'Non', (c.preferred_lang || 'fr').toUpperCase(), cityOf(c) ?? '',
          c.is_active ? 'Actif' : 'Bloqué', c.points_balance ?? 0, c.points_lifetime ?? 0, c.referral_code ?? '', fmtDate(c.created_at)]));
      if (d.truncated) setError(`Export limité aux ${d.max} premiers clients : affinez les filtres.`);
    } catch (err) {
      setError(apiError(err, 'Export impossible.'));
    } finally {
      setExporting(false);
    }
  };

  const countLabel = useMemo(() => {
    const n = pagination.total ?? items.length;
    return `${n} client${n > 1 ? 's' : ''}`;
  }, [pagination.total, items.length]);

  return (
    <div className="flex h-full">
      <div className="flex-1 min-w-0 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-poppins font-bold text-2xl text-gray-900">Annuaire Clients</h1>
            <p className="text-sm text-gray-500 mt-0.5">Liste des clients — supervision (les clients s’inscrivent via l’application).</p>
          </div>
          <span className="text-xs text-gray-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            Mis à jour à {formatTime(updatedAt)}
          </span>
        </div>

        {notice && <div className="mb-3 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{notice}</div>}

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom ou téléphone…"
              className="pl-9 pr-3 py-2 border rounded-lg text-sm w-64 focus:ring-2 focus:ring-[#E10600] focus:border-[#E10600] outline-none" />
          </div>
          <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm text-gray-700 focus:ring-2 focus:ring-[#E10600] focus:border-[#E10600] outline-none">
            <option value="">Toutes villes</option>
            {cities.map((c) => <option key={c.id} value={c.id}>{c.name_fr}</option>)}
          </select>
          <div className="flex gap-2">
            {STATUS_TABS.map((t) => (
              <button key={t.key} type="button" onClick={() => setStatusFilter(t.key)}
                className={`px-3 py-2 text-sm rounded-lg font-medium transition-colors ${statusFilter === t.key ? 'bg-[#E10600] text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                {t.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={doExport} disabled={exporting}
            className="ml-auto inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60">
            {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Exporter
          </button>
        </div>

        <div className="border rounded-xl overflow-x-auto bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-left border-b">
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Téléphone</th>
                <th className="px-4 py-3 font-medium">Langue</th>
                <th className="px-4 py-3 font-medium">Ville</th>
                <th className="px-4 py-3 font-medium">Points</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7}><Loading /></td></tr>}
              {!loading && error && <tr><td colSpan={7} className="px-4 py-10 text-center text-red-600">{error}</td></tr>}
              {!loading && !error && items.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Aucun client trouvé.</td></tr>}
              {!loading && !error && items.map((c) => {
                const style = avatarStyle(c.id || c.name || '?');
                const initial = (c.name || '?').trim().charAt(0).toUpperCase();
                return (
                  <tr key={c.id} className={`border-b last:border-0 cursor-pointer ${c.id === selectedId ? 'bg-red-50' : 'hover:bg-gray-50'}`} onClick={() => openCustomer(c.id)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${style.bg} ${style.fg}`}>{initial}</span>
                        <span className="font-medium text-gray-900">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <span className="inline-flex items-center gap-1.5">
                        {phoneOf(c)}
                        {c.phone_verified_at && <CheckCircle2 size={14} className="text-green-600" title="Téléphone vérifié" />}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{(c.preferred_lang || 'fr').toUpperCase()}</td>
                    <td className="px-4 py-3 text-gray-600">{cityOf(c) ?? '—'}</td>
                    <td className="px-4 py-3 font-semibold text-amber-600">{fmtNumber(c.points_balance)}</td>
                    <td className="px-4 py-3"><StatusBadge active={c.is_active} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {canBlock && (
                          <button type="button" onClick={(e) => { e.stopPropagation(); setBlockTarget(c); }}
                            className={`px-2.5 py-1.5 text-xs rounded-lg font-medium border ${c.is_active ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-green-200 text-green-700 hover:bg-green-50'}`}>
                            {c.is_active ? 'Bloquer' : 'Débloquer'}
                          </button>
                        )}
                        <button type="button" onClick={(e) => { e.stopPropagation(); openCustomer(c.id); }}
                          className="px-3 py-1.5 text-xs rounded-lg font-medium border border-gray-300 text-gray-700 hover:bg-gray-50">
                          Détails
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-3 text-sm text-gray-400">
          <span>{countLabel}</span>
          {pagination.totalPages > 1 && (
            <div className="flex items-center gap-3">
              <button type="button" disabled={pagination.page <= 1} onClick={() => handlePageChange(pagination.page - 1)} className="w-7 h-7 rounded-lg border border-gray-300 disabled:opacity-40">‹</button>
              <span>{pagination.page} / {pagination.totalPages}</span>
              <button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => handlePageChange(pagination.page + 1)} className="w-7 h-7 rounded-lg border border-gray-300 disabled:opacity-40">›</button>
            </div>
          )}
        </div>
      </div>

      {selected && selected.id === selectedId && (
        <CustomerDrawer
          customer={selected}
          tab={tab}
          onTabChange={changeTab}
          pointsType={pointsType}
          onPointsType={setPointsType}
          onClose={closeCustomer}
          onAskBlock={setBlockTarget}
          canBlock={canBlock}
          onChanged={refreshAll}
          onViewCustomer={(id) => openCustomer(id)}
          cityMap={cityMap}
        />
      )}

      <BlockModal
        customer={blockTarget}
        onClose={() => setBlockTarget(null)}
        onDone={(msg) => { setBlockTarget(null); refreshAll(msg); }}
      />
    </div>
  );
}
