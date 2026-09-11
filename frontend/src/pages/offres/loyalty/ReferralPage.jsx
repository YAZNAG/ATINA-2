import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Plus, Pencil, Power, PowerOff, Loader2, Download, Search, ChevronLeft, ChevronRight, Lock, Eye, Users,
} from 'lucide-react';
import Modal from '../../../components/Modal';
import { useAuth } from '../../../context/AuthContext';
import OrderDetailDrawer from '../../commandes/OrderDetailDrawer';
import {
  getLoyaltyMeta, getReferralConfigs, createReferralConfig, updateReferralConfig, activateReferralConfig,
  deactivateReferralConfig, getReferralsList, exportReferrals,
} from '../../../api/loyalty.api';
import {
  unwrap, apiError, fmtDate, fmtDateTime, fmtMAD, toInputDateTime, downloadCsv, todayStamp, orderRef,
  ReferralStatusBadge, RewardCell, REWARD_TYPE_LABELS, Spinner, Field, Section, Toast, useToast,
  ReferralDetailModal, customerUrl,
} from './loyaltyShared';

const TABS = [
  { key: 'config', label: 'Configuration parrainage' },
  { key: 'suivi', label: 'Liste des parrainages (suivi)' },
];

const CONFIG_STATE = {
  active: { label: 'Active', cls: 'bg-emerald-50 text-emerald-700' },
  upcoming: { label: 'Active (à venir)', cls: 'bg-sky-50 text-sky-700' },
  expired: { label: 'Active (période expirée)', cls: 'bg-amber-50 text-amber-700' },
  inactive: { label: 'Inactive', cls: 'bg-neutral-100 text-neutral-500' },
};

const EMPTY_CONFIG = {
  referrer_reward_type: 'points',
  referrer_reward_value: '',
  referee_reward_type: 'points',
  referee_reward_value: '',
  promo_type_id: '',
  promo_min_order_amount: '0',
  promo_validity_days: '30',
  min_order_amount: '0',
  max_referrals_per_user: '',
  valid_from: '',
  valid_to: '',
  is_active: false,
};

function ConfigStateBadge({ state }) {
  const s = CONFIG_STATE[state] ?? CONFIG_STATE.inactive;
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

// ═══════════════════════════════════════════════════════════════════════════
// Onglet « Configuration parrainage »
// ═══════════════════════════════════════════════════════════════════════════
function ConfigTab({ meta, canManage, showToast, onShowReferralsOfConfig }) {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_CONFIG);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setConfigs(unwrap(await getReferralConfigs()) ?? []);
    } catch (err) {
      setError(apiError(err, 'Erreur lors du chargement des configurations.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const active = configs.find((c) => c.is_active) ?? null;
  const promoTypes = meta?.promo_types ?? [];
  const hasPromo = form.referrer_reward_type === 'promo_code' || form.referee_reward_type === 'promo_code';

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_CONFIG, valid_from: toInputDateTime(new Date()) });
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    setForm({
      referrer_reward_type: c.referrer_type?.code ?? 'points',
      referrer_reward_value: String(c.referrer_reward_value ?? ''),
      referee_reward_type: c.referee_type?.code ?? 'points',
      referee_reward_value: String(c.referee_reward_value ?? ''),
      promo_type_id: c.promo_type_id ?? '',
      promo_min_order_amount: String(c.promo_min_order_amount ?? 0),
      promo_validity_days: String(c.promo_validity_days ?? 30),
      min_order_amount: String(c.min_order_amount ?? 0),
      max_referrals_per_user: c.max_referrals_per_user != null ? String(c.max_referrals_per_user) : '',
      valid_from: toInputDateTime(c.valid_from),
      valid_to: toInputDateTime(c.valid_to),
      is_active: c.is_active,
    });
    setFormError('');
    setFormOpen(true);
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const validate = () => {
    for (const [who, t, v] of [['parrain', form.referrer_reward_type, form.referrer_reward_value], ['filleul', form.referee_reward_type, form.referee_reward_value]]) {
      const n = Number(v);
      if (!t) return `Choisissez le type de récompense du ${who}.`;
      if (v === '' || !(n > 0)) return `La valeur de la récompense du ${who} doit être strictement supérieure à 0.`;
      if (t === 'points' && !Number.isInteger(n)) return `La récompense du ${who} en points doit être un nombre entier.`;
    }
    if (hasPromo) {
      if (!form.promo_type_id) return 'Le type de promo est obligatoire lorsqu’une récompense est un code promo.';
      const d = Number(form.promo_validity_days);
      if (!Number.isInteger(d) || d <= 0) return 'La durée de validité du coupon doit être un nombre entier de jours supérieur à 0.';
      if (form.promo_min_order_amount !== '' && Number(form.promo_min_order_amount) < 0) return 'Le montant minimum du coupon doit être supérieur ou égal à 0.';
    }
    if (form.min_order_amount !== '' && Number(form.min_order_amount) < 0) return 'Le montant minimum de la première commande doit être supérieur ou égal à 0.';
    if (form.max_referrals_per_user !== '' && !(Number.isInteger(Number(form.max_referrals_per_user)) && Number(form.max_referrals_per_user) > 0)) {
      return 'Le nombre maximal de parrainages doit être un entier supérieur à 0 (vide = illimité).';
    }
    if (!form.valid_from) return 'La date de début est obligatoire.';
    if (form.valid_to && new Date(form.valid_to) <= new Date(form.valid_from)) return 'La date de fin doit être postérieure à la date de début.';
    return '';
  };

  const submit = async () => {
    const msg = validate();
    if (msg) { setFormError(msg); return; }
    const body = {
      referrer_reward_type: form.referrer_reward_type,
      referrer_reward_value: Number(form.referrer_reward_value),
      referee_reward_type: form.referee_reward_type,
      referee_reward_value: Number(form.referee_reward_value),
      promo_type_id: hasPromo ? form.promo_type_id : null,
      promo_min_order_amount: hasPromo ? Number(form.promo_min_order_amount || 0) : 0,
      promo_validity_days: hasPromo ? Number(form.promo_validity_days) : 30,
      min_order_amount: Number(form.min_order_amount || 0),
      max_referrals_per_user: form.max_referrals_per_user === '' ? null : Number(form.max_referrals_per_user),
      valid_from: new Date(form.valid_from).toISOString(),
      valid_to: form.valid_to ? new Date(form.valid_to).toISOString() : null,
    };
    setSaving(true);
    setFormError('');
    try {
      if (editing) {
        await updateReferralConfig(editing.id, body);
        showToast('success', 'Configuration mise à jour');
      } else {
        await createReferralConfig({ ...body, is_active: form.is_active });
        showToast('success', form.is_active ? 'Configuration créée et activée — la précédente a été désactivée' : 'Configuration créée (inactive)');
      }
      setFormOpen(false);
      load();
    } catch (err) {
      setFormError(apiError(err, 'Erreur lors de l’enregistrement.'));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (c) => {
    if (!c.is_active && active && !window.confirm('Activer cette configuration désactivera la configuration active actuelle. Continuer ?')) return;
    setBusyId(c.id);
    try {
      if (c.is_active) await deactivateReferralConfig(c.id);
      else await activateReferralConfig(c.id);
      showToast('success', c.is_active ? 'Configuration désactivée' : 'Configuration activée');
      load();
    } catch (err) {
      showToast('error', apiError(err, 'Action impossible.'));
    } finally {
      setBusyId(null);
    }
  };

  const rewardFields = (prefix, who) => (
    <div className="rounded-lg border border-neutral-200 p-4">
      <p className="mb-3 text-sm font-semibold text-neutral-800">Récompense du {who} *</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="form-label">Type</label>
          <select className="form-select" value={form[`${prefix}_reward_type`]} onChange={set(`${prefix}_reward_type`)}>
            {(meta?.reward_types?.length ? meta.reward_types : [{ code: 'points', name_fr: 'Points' }, { code: 'promo_code', name_fr: 'Code promo' }])
              .map((t) => <option key={t.code} value={t.code}>{t.name_fr}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Valeur {form[`${prefix}_reward_type`] === 'points' ? '(points entiers)' : '(valeur du coupon)'}</label>
          <input type="number" min="0" step={form[`${prefix}_reward_type`] === 'points' ? '1' : '0.01'} className="form-input"
            value={form[`${prefix}_reward_value`]} onChange={set(`${prefix}_reward_value`)} />
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <p className="text-sm text-neutral-500">
          Programme global (tous clients, tous nodes). Une seule configuration active ; une configuration déjà utilisée par un parrainage n’est plus modifiable.
        </p>
        {canManage && (
          <button type="button" onClick={openCreate} className="ml-auto inline-flex items-center gap-2 rounded-lg bg-[#E10600] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#c00500]">
            <Plus size={16} /> Créer une configuration
          </button>
        )}
      </div>

      {loading ? <Spinner /> : error ? <p className="py-6 text-sm text-red-600">{error}</p> : (
        <>
          <div className="mb-5 rounded-xl border border-neutral-200 bg-white p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">Configuration active</p>
            {active ? (
              <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div><p className="text-neutral-500">Parrain</p><p className="font-semibold text-neutral-900">{active.referrer_reward_label}</p></div>
                <div><p className="text-neutral-500">Filleul</p><p className="font-semibold text-neutral-900">{active.referee_reward_label}</p></div>
                <div><p className="text-neutral-500">Conditions</p><p className="font-medium text-neutral-800">1re commande ≥ {fmtMAD(active.min_order_amount)} · {active.max_referrals_per_user ? `${active.max_referrals_per_user} parrainages max / client` : 'parrainages illimités'}</p></div>
                <div><p className="text-neutral-500">Validité</p><p className="font-medium text-neutral-800">{fmtDate(active.valid_from)} → {active.valid_to ? fmtDate(active.valid_to) : 'sans fin'}</p><ConfigStateBadge state={active.state} /></div>
              </div>
            ) : <p className="text-sm text-neutral-400">Aucune configuration active : les nouveaux parrainages ne sont pas enregistrés.</p>}
          </div>

          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium">Récompense parrain</th>
                  <th className="px-4 py-3 font-medium">Récompense filleul</th>
                  <th className="px-4 py-3 font-medium">Min. 1re commande</th>
                  <th className="px-4 py-3 font-medium">Max / client</th>
                  <th className="px-4 py-3 font-medium">Validité</th>
                  <th className="px-4 py-3 font-medium">Parrainages</th>
                  <th className="px-4 py-3 font-medium">Créée</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {configs.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-neutral-400">Aucune configuration de parrainage.</td></tr>
                ) : configs.map((c) => (
                  <tr key={c.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3"><ConfigStateBadge state={c.state} /></td>
                    <td className="px-4 py-3 font-medium text-neutral-800">{c.referrer_reward_label}</td>
                    <td className="px-4 py-3 font-medium text-neutral-800">{c.referee_reward_label}</td>
                    <td className="px-4 py-3 text-neutral-600">{Number(c.min_order_amount) > 0 ? fmtMAD(c.min_order_amount) : 'Aucun'}</td>
                    <td className="px-4 py-3 text-neutral-600">{c.max_referrals_per_user ?? 'Illimité'}</td>
                    <td className="px-4 py-3 text-neutral-600">{fmtDate(c.valid_from)} → {c.valid_to ? fmtDate(c.valid_to) : 'sans fin'}</td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => onShowReferralsOfConfig(c.id)} className="inline-flex items-center gap-1 text-neutral-700 hover:text-[#E10600]">
                        {c.referrals_count} {c.is_locked && <Lock size={12} className="text-neutral-400" title="Configuration figée" />}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-500">{c.creator?.full_name ?? '—'}<div>{fmtDate(c.created_at)}</div></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" onClick={() => setViewing(c)} className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100" title="Détail"><Eye size={16} /></button>
                        {canManage && (
                          <>
                            <button type="button" onClick={() => toggle(c)} disabled={busyId === c.id}
                              className={`rounded-lg p-2 disabled:opacity-50 ${c.is_active ? 'text-emerald-600 hover:bg-emerald-50' : 'text-neutral-400 hover:bg-neutral-100'}`}
                              title={c.is_active ? 'Désactiver' : 'Activer (désactive la configuration active)'}>
                              {busyId === c.id ? <Loader2 size={16} className="animate-spin" /> : c.is_active ? <Power size={16} /> : <PowerOff size={16} />}
                            </button>
                            <button type="button" onClick={() => openEdit(c)} disabled={c.is_locked}
                              className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30"
                              title={c.is_locked ? 'Configuration utilisée par des parrainages : créez une nouvelle configuration' : 'Modifier'}>
                              <Pencil size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Formulaire */}
      <Modal open={formOpen} onClose={() => !saving && setFormOpen(false)} size="lg"
        title={editing ? 'Modifier la configuration de parrainage' : 'Créer une configuration de parrainage'}
        footer={(
          <>
            <button type="button" className="btn-secondary" onClick={() => setFormOpen(false)} disabled={saving}>Annuler</button>
            <button type="button" onClick={submit} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#E10600] px-4 py-2 text-sm font-medium text-white hover:bg-[#c00500] disabled:opacity-60">
              {saving && <Loader2 size={14} className="animate-spin" />} Enregistrer
            </button>
          </>
        )}>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {rewardFields('referrer', 'parrain')}
            {rewardFields('referee', 'filleul')}
          </div>

          {hasPromo && (
            <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-4">
              <p className="mb-1 text-sm font-semibold text-neutral-800">Paramètres communs des coupons</p>
              <p className="mb-3 text-xs text-neutral-500">Coupon nominatif généré à la validation : utilisable une fois (uses_max = 1), non cumulable.</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="form-label">Type de promo *</label>
                  <select className="form-select" value={form.promo_type_id} onChange={set('promo_type_id')}>
                    <option value="">— Choisir —</option>
                    {promoTypes.map((p) => <option key={p.id} value={p.id}>{p.name_fr}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Montant min. de commande (MAD)</label>
                  <input type="number" min="0" step="0.01" className="form-input" value={form.promo_min_order_amount} onChange={set('promo_min_order_amount')} />
                </div>
                <div>
                  <label className="form-label">Durée de validité (jours) *</label>
                  <input type="number" min="1" step="1" className="form-input" value={form.promo_validity_days} onChange={set('promo_validity_days')} />
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="form-label">Montant minimum de la 1re commande du filleul (MAD)</label>
              <input type="number" min="0" step="0.01" className="form-input" value={form.min_order_amount} onChange={set('min_order_amount')} />
              <p className="mt-1 text-xs text-neutral-400">0 = aucun minimum</p>
            </div>
            <div>
              <label className="form-label">Nombre maximal de parrainages par client</label>
              <input type="number" min="1" step="1" className="form-input" value={form.max_referrals_per_user} onChange={set('max_referrals_per_user')} placeholder="Illimité" />
              <p className="mt-1 text-xs text-neutral-400">Vide = illimité</p>
            </div>
            <div>
              <label className="form-label">Début de validité *</label>
              <input type="datetime-local" className="form-input" value={form.valid_from} onChange={set('valid_from')} />
            </div>
            <div>
              <label className="form-label">Fin de validité</label>
              <input type="datetime-local" className="form-input" value={form.valid_to} onChange={set('valid_to')} />
              <p className="mt-1 text-xs text-neutral-400">Vide = sans date de fin</p>
            </div>
          </div>

          {!editing && (
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input type="checkbox" className="form-checkbox" checked={form.is_active} onChange={set('is_active')} />
              Activer immédiatement {active ? '(la configuration active actuelle sera désactivée)' : ''}
            </label>
          )}
          {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{formError}</p>}
        </div>
      </Modal>

      {/* Détail d'une configuration */}
      <Modal open={Boolean(viewing)} onClose={() => setViewing(null)} title="Configuration de parrainage" subtitle={viewing?.id} size="md"
        footer={<button type="button" className="btn-secondary" onClick={() => setViewing(null)}>Fermer</button>}>
        {viewing && (
          <Section title="Règles">
            <Field label="Statut"><ConfigStateBadge state={viewing.state} /></Field>
            <Field label="Récompense parrain">{viewing.referrer_reward_label} ({REWARD_TYPE_LABELS[viewing.referrer_type?.code]})</Field>
            <Field label="Récompense filleul">{viewing.referee_reward_label} ({REWARD_TYPE_LABELS[viewing.referee_type?.code]})</Field>
            {viewing.promo_type && <Field label="Coupon">{viewing.promo_type.name_fr} · min {fmtMAD(viewing.promo_min_order_amount)} · {viewing.promo_validity_days} jours</Field>}
            <Field label="Min. 1re commande">{Number(viewing.min_order_amount) > 0 ? fmtMAD(viewing.min_order_amount) : 'Aucun minimum'}</Field>
            <Field label="Max parrainages / client">{viewing.max_referrals_per_user ?? 'Illimité'}</Field>
            <Field label="Validité">{fmtDateTime(viewing.valid_from)} → {viewing.valid_to ? fmtDateTime(viewing.valid_to) : 'sans fin'}</Field>
            <Field label="Parrainages liés">{viewing.referrals_count}{viewing.is_locked ? ' — configuration figée' : ''}</Field>
            <Field label="Créée par">{viewing.creator?.full_name ?? '—'} · {fmtDateTime(viewing.created_at)}</Field>
          </Section>
        )}
      </Modal>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Onglet « Liste des parrainages (suivi) » — lecture seule
// ═══════════════════════════════════════════════════════════════════════════
function SuiviTab({ meta, initialFilters, showToast }) {
  const [filters, setFilters] = useState({ status: '', date_from: '', date_to: '', search: '', config_id: '', ...initialFilters });
  const [searchInput, setSearchInput] = useState('');
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [orderId, setOrderId] = useState(null);

  useEffect(() => { setFilters((f) => ({ ...f, ...initialFilters })); }, [initialFilters]);
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.search === searchInput.trim() ? f : { ...f, search: searchInput.trim() })), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const params = useMemo(() => {
    const p = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) p[k] = v; });
    return p;
  }, [filters]);

  useEffect(() => { setPage(1); }, [params]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await getReferralsList({ ...params, page, limit: 25 });
      setRows(data?.data ?? []);
      setPagination(data?.pagination ?? { total: 0, page: 1, pages: 1 });
    } catch (err) {
      setError(apiError(err, 'Erreur lors du chargement des parrainages.'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [params, page]);

  useEffect(() => { load(); }, [load]);

  const doExport = async () => {
    setExporting(true);
    try {
      const d = unwrap(await exportReferrals(params)) ?? {};
      downloadCsv(`parrainages-${todayStamp()}.csv`,
        ['Parrain', 'Téléphone parrain', 'Filleul', 'Téléphone filleul', 'Statut', 'Date de création', 'Date de validation',
          'Commande qualifiante', 'Type récompense parrain', 'Récompense parrain', 'Type récompense filleul', 'Récompense filleul', 'Configuration'],
        (d.items ?? []).map((r) => [
          r.referrer?.name ?? '', r.referrer?.phone_number ?? '', r.referee?.name ?? '', r.referee?.phone_number ?? '',
          r.status?.name_fr ?? r.status?.code ?? '', fmtDateTime(r.created_at), fmtDateTime(r.validated_at),
          r.qualifying_order_id ? orderRef(r.qualifying_order_id) : '',
          REWARD_TYPE_LABELS[r.referrer_reward_type?.code] ?? '', r.referrer_reward?.label ?? '',
          REWARD_TYPE_LABELS[r.referee_reward_type?.code] ?? '', r.referee_reward?.label ?? '',
          r.config_id ?? '',
        ]));
      if (d.truncated) showToast('error', `Export limité aux ${d.max} premières lignes : affinez les filtres.`);
    } catch (err) {
      showToast('error', apiError(err, 'Export impossible.'));
    } finally {
      setExporting(false);
    }
  };

  const setF = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const person = (c) => (c ? (
    <Link to={customerUrl(c.id, 'parrainages')} onClick={(e) => e.stopPropagation()} className="font-medium text-neutral-800 hover:text-[#E10600] hover:underline">
      {c.name}<div className="text-xs font-normal text-neutral-400">{c.phone_number}</div>
    </Link>
  ) : '—');

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="relative min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input className="form-input pl-9" placeholder="Parrain ou filleul (nom, téléphone)" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
        </div>
        <select className="form-select w-auto" value={filters.status} onChange={setF('status')}>
          <option value="">Tous les statuts</option>
          {(meta?.referral_statuses ?? []).map((s) => <option key={s.id} value={s.code}>{s.name_fr}</option>)}
        </select>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Créés du</label>
          <input type="date" className="form-input" value={filters.date_from} onChange={setF('date_from')} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">au</label>
          <input type="date" className="form-input" value={filters.date_to} onChange={setF('date_to')} />
        </div>
        {filters.config_id && (
          <button type="button" onClick={() => setFilters((f) => ({ ...f, config_id: '' }))} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-600 hover:bg-neutral-50">
            Configuration {filters.config_id.slice(0, 8)} ✕
          </button>
        )}
        <button type="button" onClick={doExport} disabled={exporting} className="ml-auto inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60">
          {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Exporter
        </button>
      </div>

      <div className="mb-2 flex items-center gap-2 text-xs text-neutral-500">
        <Lock size={12} /> Suivi en lecture seule : les parrainages sont créés par l’application et validés à la livraison de la première commande qualifiante.
      </div>

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Parrain</th>
              <th className="px-4 py-3 font-medium">Filleul</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 font-medium">Création</th>
              <th className="px-4 py-3 font-medium">Validation</th>
              <th className="px-4 py-3 font-medium">Commande qualifiante</th>
              <th className="px-4 py-3 font-medium">Récompense parrain</th>
              <th className="px-4 py-3 font-medium">Récompense filleul</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading ? (
              <tr><td colSpan={8}><Spinner /></td></tr>
            ) : error ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-red-600">{error}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-neutral-400">Aucun parrainage pour ces filtres.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} onClick={() => setDetailId(r.id)} className="cursor-pointer hover:bg-neutral-50">
                <td className="px-4 py-3">{person(r.referrer)}</td>
                <td className="px-4 py-3">{person(r.referee)}</td>
                <td className="px-4 py-3"><ReferralStatusBadge status={r.status} /></td>
                <td className="whitespace-nowrap px-4 py-3 text-neutral-600">{fmtDate(r.created_at)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-neutral-600">{fmtDate(r.validated_at)}</td>
                <td className="px-4 py-3">
                  {r.qualifying_order_id ? (
                    <button type="button" onClick={(e) => { e.stopPropagation(); setOrderId(r.qualifying_order_id); }} className="text-[#E10600] hover:underline">
                      {orderRef(r.qualifying_order_id)}
                    </button>
                  ) : <span className="text-neutral-400">—</span>}
                </td>
                <td className="px-4 py-3 text-xs">
                  <div className="text-[10px] uppercase text-neutral-400">{REWARD_TYPE_LABELS[r.referrer_reward_type?.code] ?? ''}</div>
                  <RewardCell reward={r.referrer_reward} />
                </td>
                <td className="px-4 py-3 text-xs">
                  <div className="text-[10px] uppercase text-neutral-400">{REWARD_TYPE_LABELS[r.referee_reward_type?.code] ?? ''}</div>
                  <RewardCell reward={r.referee_reward} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm text-neutral-500">
        <span>{pagination.total} parrainage{pagination.total > 1 ? 's' : ''}</span>
        {pagination.pages > 1 && (
          <div className="flex items-center gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-neutral-200 p-1.5 disabled:opacity-40"><ChevronLeft size={16} /></button>
            <span>{page} / {pagination.pages}</span>
            <button type="button" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-neutral-200 p-1.5 disabled:opacity-40"><ChevronRight size={16} /></button>
          </div>
        )}
      </div>

      <ReferralDetailModal referralId={detailId} onClose={() => setDetailId(null)} onOpenOrder={(id) => { setDetailId(null); setOrderId(id); }} />
      <OrderDetailDrawer orderId={orderId} onClose={() => setOrderId(null)} onChanged={load} />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
export default function ReferralPage() {
  const { hasPermission } = useAuth();
  const canView = hasPermission('referrals.view') || hasPermission('referrals.manage');
  const canManage = hasPermission('referrals.manage');
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = TABS.some((t) => t.key === searchParams.get('tab')) ? searchParams.get('tab') : 'config';
  const [meta, setMeta] = useState(null);
  const [toast, showToast] = useToast();

  const suiviInitial = useMemo(() => {
    const f = {};
    ['status', 'config_id'].forEach((k) => { if (searchParams.get(k)) f[k] = searchParams.get(k); });
    return f;
  }, [searchParams]);

  useEffect(() => {
    getLoyaltyMeta().then((res) => setMeta(unwrap(res))).catch(() => setMeta({}));
  }, []);

  if (!canView) {
    return (
      <div className="min-h-screen bg-neutral-50 p-6">
        <h1 className="font-poppins text-2xl font-semibold text-neutral-900">Parrainage</h1>
        <p className="mt-4 text-sm text-neutral-500">Vous n’avez pas la permission d’accéder à cet écran.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      <Toast toast={toast} />
      <div className="mb-5">
        <h1 className="flex items-center gap-2 font-poppins text-2xl font-semibold text-neutral-900"><Users size={22} className="text-[#E10600]" /> Parrainage</h1>
        <p className="mt-1 text-sm text-neutral-500">Configurer le programme de parrainage et suivre les parrainages.</p>
      </div>

      <div className="mb-5 flex gap-6 border-b border-neutral-200">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setSearchParams({ tab: t.key })}
            className={`-mb-px border-b-2 pb-3 text-sm font-medium transition-colors ${activeTab === t.key ? 'border-[#E10600] text-[#E10600]' : 'border-transparent text-neutral-500 hover:text-neutral-800'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'config' && (
        <ConfigTab meta={meta} canManage={canManage} showToast={showToast}
          onShowReferralsOfConfig={(configId) => setSearchParams({ tab: 'suivi', config_id: configId })} />
      )}
      {activeTab === 'suivi' && <SuiviTab meta={meta} initialFilters={suiviInitial} showToast={showToast} />}
    </div>
  );
}
