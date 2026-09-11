import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, ExternalLink, User, Gift, Ticket, Coins } from 'lucide-react';
import Modal from '../../../components/Modal';
import { getReferral, getPointsTransaction } from '../../../api/loyalty.api';

// ─── Chemins de navigation (à ajuster par l'intégrateur si les routes diffèrent) ─
export const PATHS = {
  customers: '/customers',
  orders: '/orders-mgmt',
  promoCodes: '/offres/codes-promo',
  points: '/offres/points',
  referrals: '/offres/parrainage',
  games: '/offres/gamification',
};

export const customerUrl = (id, tab) => `${PATHS.customers}?id=${id}${tab ? `&tab=${tab}` : ''}`;

// ─── Helpers ────────────────────────────────────────────────────────────────
export const unwrap = (res) => res?.data?.data ?? res?.data ?? null;
export const apiError = (err, fallback) => err?.response?.data?.message || fallback;

export const fmtDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const fmtDateTime = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const fmtNumber = (v, digits = 0) =>
  Number(v ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const fmtMAD = (v) => `${fmtNumber(v, 2)} MAD`;

export const fmtPoints = (v) => {
  const n = Number(v ?? 0);
  return `${n > 0 ? '+' : ''}${fmtNumber(n)}`;
};

export const orderRef = (id) => (id ? `#${String(id).slice(0, 8).toUpperCase()}` : '—');

/** Valeur pour <input type="datetime-local"> (heure locale). */
export const toInputDateTime = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Export CSV côté client : séparateur « ; », BOM UTF-8. */
export function downloadCsv(filename, headers, rows) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(esc).join(';'), ...rows.map((r) => r.map(esc).join(';'))];
  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const todayStamp = () => new Date().toISOString().slice(0, 10);

// ─── Types de transaction de points ─────────────────────────────────────────
export const TXN_TYPE_STYLES = {
  order_payment: 'bg-emerald-50 text-emerald-700',
  earn: 'bg-emerald-50 text-emerald-700',
  refund: 'bg-sky-50 text-sky-700',
  referral_reward: 'bg-violet-50 text-violet-700',
  promo_credit: 'bg-teal-50 text-teal-700',
  prize_award: 'bg-pink-50 text-pink-700',
  sku_exchange: 'bg-orange-50 text-orange-700',
  redeem: 'bg-orange-50 text-orange-700',
  exchange_revert: 'bg-sky-50 text-sky-700',
  manual_adjustment: 'bg-amber-50 text-amber-700',
};

export const TXN_TYPE_LABELS = {
  order_payment: 'Gain commande',
  refund: 'Remboursement',
  referral_reward: 'Récompense parrainage',
  promo_credit: 'Crédit promotionnel',
  prize_award: 'Gain jeu',
  sku_exchange: 'Échange produit',
  exchange_revert: 'Annulation échange',
  manual_adjustment: 'Ajustement manuel',
  earn: 'Gain commande (ancien format)',
  redeem: 'Rachat de points (ancien format)',
};

export function TxnTypeBadge({ type, label }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${TXN_TYPE_STYLES[type] ?? 'bg-neutral-100 text-neutral-600'}`}>
      {label || TXN_TYPE_LABELS[type] || type}
    </span>
  );
}

export function PointsAmount({ value }) {
  const n = Number(value ?? 0);
  return <span className={`font-semibold tabular-nums ${n >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtPoints(n)}</span>;
}

// ─── Statuts de parrainage ──────────────────────────────────────────────────
export const REFERRAL_STATUS_STYLES = {
  pending: 'bg-amber-50 text-amber-700',
  validated: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-600',
  expired: 'bg-neutral-100 text-neutral-500',
};

export const REFERRAL_STATUS_LABELS = {
  pending: 'En attente',
  validated: 'Validé',
  rejected: 'Rejeté',
  expired: 'Expiré',
};

export function ReferralStatusBadge({ status }) {
  const code = status?.code ?? status;
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${REFERRAL_STATUS_STYLES[code] ?? 'bg-neutral-100 text-neutral-600'}`}>
      {status?.name_fr ?? REFERRAL_STATUS_LABELS[code] ?? code ?? '—'}
    </span>
  );
}

/** Colonne « Récompense » : une seule valeur, pilotée par le statut (fournie par l'API). */
export function RewardCell({ reward, onClick }) {
  if (!reward) return <span className="text-neutral-400">—</span>;
  const cls = reward.state === 'paid'
    ? 'text-emerald-700 font-medium'
    : reward.state === 'pending' ? 'text-amber-700' : 'text-neutral-400';
  if (reward.state === 'paid' && onClick) {
    return (
      <button type="button" onClick={onClick} className={`${cls} underline decoration-dotted underline-offset-2 hover:text-[#E10600]`} title="Voir le détail de la récompense versée">
        {reward.label}
      </button>
    );
  }
  return <span className={cls}>{reward.label}</span>;
}

export const REWARD_TYPE_LABELS = { points: 'Points', promo_code: 'Code promo' };

// ─── Petits composants ──────────────────────────────────────────────────────
export function Spinner({ label = 'Chargement…' }) {
  return (
    <p className="flex items-center justify-center gap-2 py-10 text-sm text-neutral-400">
      <Loader2 size={16} className="animate-spin" /> {label}
    </p>
  );
}

export function Field({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-neutral-100 py-2.5 last:border-0">
      <span className="text-sm text-neutral-500">{label}</span>
      <span className="text-right text-sm font-medium text-neutral-900">{children}</span>
    </div>
  );
}

export function Section({ title, icon: Icon, children, right }) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white">
      <header className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
          {Icon && <Icon size={15} className="text-neutral-400" />} {title}
        </h3>
        {right}
      </header>
      <div className="px-4 py-2">{children}</div>
    </section>
  );
}

export function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className={`fixed right-5 top-5 z-[70] rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-[#E10600]'}`}>
      {toast.message}
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState(null);
  const show = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };
  return [toast, show];
}

export const ruleSummary = (rule) => {
  if (!rule) return '—';
  const code = rule.rule_type?.code ?? rule.type_code;
  const pv = fmtNumber(rule.points_value);
  const per = rule.per_mad_spent != null ? fmtNumber(rule.per_mad_spent, Number(rule.per_mad_spent) % 1 ? 2 : 0) : null;
  const cat = rule.category?.name_fr ?? (typeof rule.category === 'string' ? rule.category : null);
  if (code === 'per_spend') return `${pv} pt(s) par tranche de ${per} MAD`;
  if (code === 'flat_bonus') return `${pv} pt(s) par commande`;
  if (code === 'first_order') return `${pv} pt(s) sur la 1re commande`;
  if (code === 'category_multiplier') {
    return per ? `${pv} pt(s) par tranche de ${per} MAD en « ${cat ?? '?'} »` : `${pv} pt(s) si la commande contient « ${cat ?? '?'} »`;
  }
  return `${pv} pt(s)`;
};

// ─── Détail d'un parrainage (US-085 / US-104) ───────────────────────────────
/**
 * Seul endroit où points_transactions et promotions sont lues (audit).
 * Props : referralId, onClose, onOpenOrder(orderId)
 */
export function ReferralDetailModal({ referralId, onClose, onOpenOrder }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!referralId) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    getReferral(referralId)
      .then((res) => { if (!cancelled) setData(unwrap(res)); })
      .catch((err) => { if (!cancelled) setError(apiError(err, 'Erreur lors du chargement du parrainage.')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [referralId]);

  const cfg = data?.config;
  const person = (c, tab) => (c ? (
    <Link to={customerUrl(c.id, tab)} className="text-[#E10600] hover:underline" onClick={onClose}>
      {c.name} <span className="text-xs text-neutral-400">{c.phone_country} {c.phone_number}</span>
    </Link>
  ) : '—');

  return (
    <Modal open={Boolean(referralId)} onClose={onClose} title="Détail du parrainage" subtitle={referralId} size="lg"
      footer={<button type="button" className="btn-secondary" onClick={onClose}>Fermer</button>}>
      {loading && <Spinner />}
      {!loading && error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && data && (
        <div className="grid gap-4 md:grid-cols-2">
          <Section title="Participants" icon={User}>
            <Field label="Parrain">{person(data.referrer, 'parrainages')}</Field>
            <Field label="Filleul">{person(data.referee, 'parrainages')}</Field>
          </Section>
          <Section title="Suivi" icon={Gift}>
            <Field label="Statut"><ReferralStatusBadge status={data.status} /></Field>
            <Field label="Date de création">{fmtDateTime(data.created_at)}</Field>
            <Field label="Date de validation">{fmtDateTime(data.validated_at)}</Field>
            <Field label="Commande qualifiante">
              {data.qualifying_order_id ? (
                <button type="button" className="text-[#E10600] hover:underline" onClick={() => onOpenOrder?.(data.qualifying_order_id)}>
                  {orderRef(data.qualifying_order_id)}
                </button>
              ) : '—'}
            </Field>
          </Section>
          <Section title="Configuration appliquée" icon={Ticket}>
            {cfg ? (
              <>
                <Field label="Configuration"><span className="font-mono text-xs">{cfg.id.slice(0, 8)}</span></Field>
                <Field label="Récompense parrain">{cfg.referrer_reward_label} <span className="text-xs text-neutral-400">({REWARD_TYPE_LABELS[cfg.referrer_type?.code] ?? '—'})</span></Field>
                <Field label="Récompense filleul">{cfg.referee_reward_label} <span className="text-xs text-neutral-400">({REWARD_TYPE_LABELS[cfg.referee_type?.code] ?? '—'})</span></Field>
                <Field label="Minimum 1re commande">{Number(cfg.min_order_amount) > 0 ? fmtMAD(cfg.min_order_amount) : 'Aucun minimum'}</Field>
                <Field label="Parrainages max / client">{cfg.max_referrals_per_user ?? 'Illimité'}</Field>
                <Field label="Validité">{fmtDate(cfg.valid_from)} → {cfg.valid_to ? fmtDate(cfg.valid_to) : 'sans fin'}</Field>
                {cfg.promo_type && (
                  <Field label="Coupon">
                    {cfg.promo_type.name_fr} · min {fmtMAD(cfg.promo_min_order_amount)} · {cfg.promo_validity_days} j
                  </Field>
                )}
              </>
            ) : <p className="py-2 text-sm text-neutral-400">Aucune configuration liée.</p>}
          </Section>
          <Section title="Récompenses versées" icon={Coins}>
            {(!data.rewards || data.rewards.length === 0) ? (
              <p className="py-2 text-sm text-neutral-400">Aucune récompense versée.</p>
            ) : data.rewards.map((r) => (
              <div key={r.points_txn_id || r.promotion_id} className="border-b border-neutral-100 py-2.5 text-sm last:border-0">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-neutral-500">{r.role === 'referrer' ? 'Parrain' : r.role === 'referee' ? 'Filleul' : 'Bénéficiaire'} · {r.beneficiary?.name ?? '—'}</span>
                  {r.kind === 'points' ? <PointsAmount value={r.amount} /> : <span className="font-medium text-neutral-900">{r.label}</span>}
                </div>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-400">
                  <span>{fmtDateTime(r.created_at)}</span>
                  {r.kind === 'points' ? (
                    <Link to={customerUrl(r.beneficiary?.id, 'fidelite')} onClick={onClose} className="inline-flex items-center gap-1 text-[#E10600] hover:underline">
                      Grand-livre de points <ExternalLink size={11} />
                    </Link>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-neutral-600">{r.code}</span>
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600">{r.usage_status?.label}</span>
                      <Link to={PATHS.promoCodes} onClick={onClose} className="inline-flex items-center gap-1 text-[#E10600] hover:underline">
                        Codes promo <ExternalLink size={11} />
                      </Link>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </Section>
        </div>
      )}
    </Modal>
  );
}

// ─── Détail d'une transaction de points (US-086) ────────────────────────────
/** Props : txnId, onClose, onOpenOrder(orderId), onOpenReferral(referralId) */
export function LedgerDetailModal({ txnId, onClose, onOpenOrder, onOpenReferral }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!txnId) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    getPointsTransaction(txnId)
      .then((res) => { if (!cancelled) setData(unwrap(res)); })
      .catch((err) => { if (!cancelled) setError(apiError(err, 'Erreur lors du chargement de la transaction.')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [txnId]);

  return (
    <Modal open={Boolean(txnId)} onClose={onClose} title="Détail de la transaction" subtitle={txnId} size="md"
      footer={<button type="button" className="btn-secondary" onClick={onClose}>Fermer</button>}>
      {loading && <Spinner />}
      {!loading && error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && data && (
        <div className="space-y-4">
          <Section title="Transaction (lecture seule — table append-only)">
            <Field label="Identifiant"><span className="font-mono text-xs">{data.id}</span></Field>
            <Field label="Date">{fmtDateTime(data.created_at)}</Field>
            <Field label="Type">
              <TxnTypeBadge type={data.type} label={data.type_label} />
              {data.type_label_ar && <span dir="rtl" lang="ar" className="ml-2 text-xs text-neutral-500">{data.type_label_ar}</span>}
            </Field>
            <Field label="Montant"><PointsAmount value={data.amount} /> <span className="text-xs text-neutral-400">({data.amount >= 0 ? 'crédit' : 'débit'})</span></Field>
            <Field label="Motif">{data.reason || '—'}</Field>
          </Section>
          <Section title="Client">
            <Field label="Client">
              {data.customer ? (
                <Link to={customerUrl(data.customer.id, 'fidelite')} onClick={onClose} className="text-[#E10600] hover:underline">
                  {data.customer.name}
                </Link>
              ) : '—'}
            </Field>
            <Field label="Solde courant (customers.points_balance)">{data.customer ? `${fmtNumber(data.customer.points_balance)} pts` : '—'}</Field>
          </Section>
          <Section title="Règle appliquée & source">
            <Field label="Règle">
              {data.rule ? (
                <span>
                  <Link to={`${PATHS.points}?tab=rules&rule=${data.rule.id}`} onClick={onClose} className="text-[#E10600] hover:underline" title="Ouvrir la règle">
                    {data.rule.rule_type?.name_fr ?? '—'} — {ruleSummary(data.rule)}
                  </Link>
                  {data.rule.is_deleted && <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-600">Supprimée</span>}
                  <Link to={`${PATHS.points}?tab=ledger&rule_id=${data.rule.id}`} onClick={onClose} className="ml-2 inline-flex items-center gap-1 text-xs text-neutral-500 hover:underline">
                    Transactions de cette règle <ExternalLink size={11} />
                  </Link>
                </span>
              ) : '—'}
            </Field>
            <Field label="Références">
              <span className="font-mono text-[11px] leading-5 text-neutral-500">
                points_rule_id : {data.points_rule_id ?? '—'}<br />
                order_id : {data.order_id ?? '—'}<br />
                referral_id : {data.referral_id ?? '—'}<br />
                game_play_id : {data.game_play_id ?? '—'}
              </span>
            </Field>
            <Field label="Source">
              {data.source?.kind === 'order' && (
                <button type="button" onClick={() => onOpenOrder?.(data.order_id)} className="text-[#E10600] hover:underline">
                  Commande {orderRef(data.order_id)}
                </button>
              )}
              {data.source?.kind === 'referral' && (
                <button type="button" onClick={() => onOpenReferral?.(data.referral_id)} className="text-[#E10600] hover:underline">
                  Parrainage {data.referral ? `${data.referral.referrer?.name ?? ''} → ${data.referral.referee?.name ?? ''}` : ''}
                </button>
              )}
              {data.source?.kind === 'game_play' && (
                <Link to={`${PATHS.games}?play=${data.game_play_id}`} onClick={onClose} className="text-[#E10600] hover:underline">
                  Partie de jeu {data.game_play?.game?.name_fr ?? String(data.game_play_id).slice(0, 8)}
                </Link>
              )}
              {!data.source && '—'}
            </Field>
          </Section>
        </div>
      )}
    </Modal>
  );
}
