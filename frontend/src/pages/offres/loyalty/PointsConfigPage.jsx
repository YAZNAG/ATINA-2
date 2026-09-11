import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Plus, Pencil, Trash2, Power, PowerOff, Loader2, Download, Search, X, ChevronLeft, ChevronRight, Lock, Eye, BookOpen,
} from 'lucide-react';
import Modal from '../../../components/Modal';
import { useAuth } from '../../../context/AuthContext';
import OrderDetailDrawer from '../../commandes/OrderDetailDrawer';
import {
  getLoyaltyMeta, getPointsRules, getPointsRule, createPointsRule, updatePointsRule, activatePointsRule,
  deactivatePointsRule, deletePointsRule, getPointsLedger, exportPointsLedger,
} from '../../../api/loyalty.api';
import {
  unwrap, apiError, fmtDate, fmtDateTime, fmtNumber, fmtMAD, toInputDateTime, downloadCsv, todayStamp, orderRef,
  TxnTypeBadge, PointsAmount, Spinner, Field, Section, Toast, useToast, ruleSummary,
  LedgerDetailModal, ReferralDetailModal, customerUrl,
} from './loyaltyShared';

const TABS = [
  { key: 'rules', label: 'Configuration des points' },
  { key: 'ledger', label: 'Livre des points' },
];

const RULE_TYPE_HELP = {
  per_spend: 'Points pour chaque tranche de montant dépensé (ex. 1 point par tranche de 10 MAD).',
  flat_bonus: 'Nombre fixe de points à chaque commande livrée.',
  category_multiplier: 'Bonus sur une catégorie produit : par tranche de montant dépensé dans la catégorie, ou bonus fixe si aucune tranche n’est saisie.',
  first_order: 'Nombre fixe de points sur la première commande livrée du client.',
};

const VALIDITY_LABELS = {
  current: { label: 'En cours', cls: 'bg-emerald-50 text-emerald-700' },
  upcoming: { label: 'À venir', cls: 'bg-sky-50 text-sky-700' },
  expired: { label: 'Expirée', cls: 'bg-neutral-100 text-neutral-500' },
};

const EMPTY_RULE = {
  rule_type_code: '',
  points_value: '',
  per_mad_spent: '',
  category_id: '',
  min_order_amount: '0',
  valid_from: '',
  valid_to: '',
  is_active: true,
};

function RuleStatusBadge({ rule }) {
  if (rule.is_deleted) return <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">Supprimée</span>;
  return rule.is_active
    ? <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">Active</span>
    : <span className="inline-flex rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-500">Inactive</span>;
}

// ═══════════════════════════════════════════════════════════════════════════
// Onglet « Configuration des points »
// ═══════════════════════════════════════════════════════════════════════════
function RulesTab({ meta, canManage, showToast, onOpenLedgerForRule }) {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ rule_type: '', status: '', validity: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_RULE);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [detailId, setDetailId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: 20 };
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const { data } = await getPointsRules(params);
      setRows(data?.data ?? []);
      setPagination(data?.pagination ?? { total: 0, page: 1, pages: 1 });
    } catch (err) {
      setError(apiError(err, 'Erreur lors du chargement des règles.'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [filters]);

  useEffect(() => {
    if (!detailId) { setDetail(null); return; }
    getPointsRule(detailId).then((res) => setDetail(unwrap(res))).catch((err) => showToast('error', apiError(err, 'Règle introuvable.')));
  }, [detailId]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_RULE, valid_from: toInputDateTime(new Date()) });
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (rule) => {
    setEditing(rule);
    setForm({
      rule_type_code: rule.rule_type?.code ?? '',
      points_value: String(rule.points_value ?? ''),
      per_mad_spent: rule.per_mad_spent != null ? String(rule.per_mad_spent) : '',
      category_id: rule.category_id ?? '',
      min_order_amount: String(rule.min_order_amount ?? 0),
      valid_from: toInputDateTime(rule.valid_from),
      valid_to: toInputDateTime(rule.valid_to),
      is_active: rule.is_active,
    });
    setFormError('');
    setFormOpen(true);
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const validate = () => {
    const t = form.rule_type_code;
    if (!t) return 'Choisissez le type de règle.';
    const pv = Number(form.points_value);
    if (form.points_value === '' || !Number.isInteger(pv) || pv <= 0) return 'Le nombre de points doit être un entier strictement supérieur à 0.';
    if (t === 'per_spend' && !(Number(form.per_mad_spent) > 0)) return 'Le montant par tranche (MAD) doit être strictement supérieur à 0.';
    if (t === 'category_multiplier' && !form.category_id) return 'La catégorie est obligatoire.';
    if (t === 'category_multiplier' && form.per_mad_spent !== '' && !(Number(form.per_mad_spent) > 0)) return 'Le montant par tranche doit être strictement supérieur à 0.';
    if (form.min_order_amount !== '' && Number(form.min_order_amount) < 0) return 'Le montant minimum doit être supérieur ou égal à 0.';
    if (!form.valid_from) return 'La date de début est obligatoire.';
    if (form.valid_to && new Date(form.valid_to) <= new Date(form.valid_from)) return 'La date de fin doit être postérieure à la date de début.';
    return '';
  };

  const submit = async () => {
    const msg = validate();
    if (msg) { setFormError(msg); return; }
    const t = form.rule_type_code;
    const body = {
      rule_type_code: t,
      points_value: Number(form.points_value),
      per_mad_spent: (t === 'per_spend' || t === 'category_multiplier') && form.per_mad_spent !== '' ? Number(form.per_mad_spent) : null,
      category_id: t === 'category_multiplier' ? form.category_id : null,
      min_order_amount: form.min_order_amount === '' ? 0 : Number(form.min_order_amount),
      valid_from: new Date(form.valid_from).toISOString(),
      valid_to: form.valid_to ? new Date(form.valid_to).toISOString() : null,
    };
    setSaving(true);
    setFormError('');
    try {
      if (editing) {
        await updatePointsRule(editing.id, body);
        showToast('success', 'Règle mise à jour — effet sur les prochaines commandes livrées uniquement');
      } else {
        await createPointsRule({ ...body, is_active: form.is_active });
        showToast('success', 'Règle créée');
      }
      setFormOpen(false);
      load();
    } catch (err) {
      setFormError(apiError(err, 'Erreur lors de l’enregistrement.'));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (rule) => {
    setBusyId(rule.id);
    try {
      if (rule.is_active) await deactivatePointsRule(rule.id);
      else await activatePointsRule(rule.id);
      showToast('success', rule.is_active ? 'Règle désactivée' : 'Règle activée');
      load();
    } catch (err) {
      showToast('error', apiError(err, 'Action impossible.'));
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deletePointsRule(deleteTarget.id);
      showToast('success', 'Règle supprimée (historique des points inchangé)');
      setDeleteTarget(null);
      load();
    } catch (err) {
      showToast('error', apiError(err, 'Suppression impossible.'));
    } finally {
      setDeleting(false);
    }
  };

  const type = form.rule_type_code;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select className="form-select w-auto" value={filters.rule_type} onChange={(e) => setFilters((f) => ({ ...f, rule_type: e.target.value }))}>
          <option value="">Tous les types de règle</option>
          {(meta?.rule_types ?? []).map((t) => <option key={t.id} value={t.code}>{t.name_fr}</option>)}
        </select>
        <select className="form-select w-auto" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
          <option value="">Tous les statuts</option>
          <option value="active">Actives</option>
          <option value="inactive">Inactives</option>
          <option value="deleted">Supprimées (historique)</option>
        </select>
        <select className="form-select w-auto" value={filters.validity} onChange={(e) => setFilters((f) => ({ ...f, validity: e.target.value }))}>
          <option value="">Toutes validités</option>
          <option value="current">En cours</option>
          <option value="upcoming">À venir</option>
          <option value="expired">Expirées</option>
        </select>
        {canManage && (
          <button type="button" onClick={openCreate} className="ml-auto inline-flex items-center gap-2 rounded-lg bg-[#E10600] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#c00500]">
            <Plus size={16} /> Nouvelle règle
          </button>
        )}
      </div>

      <p className="mb-3 text-xs text-neutral-500">
        Règles globales et cumulables : à la livraison, chaque règle active, valide, applicable et non supprimée est calculée séparément
        (une ligne du livre des points par règle) ; le gain de la commande est la somme des règles appliquées.
      </p>

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Paramètres</th>
              <th className="px-4 py-3 font-medium">Montant min.</th>
              <th className="px-4 py-3 font-medium">Validité</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 font-medium">Créée par</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading ? (
              <tr><td colSpan={7}><Spinner /></td></tr>
            ) : error ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-red-600">{error}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-neutral-400">Aucune règle de points ne correspond aux filtres.</td></tr>
            ) : rows.map((r) => {
              const v = VALIDITY_LABELS[r.validity_state] ?? VALIDITY_LABELS.current;
              return (
                <tr key={r.id} className={`hover:bg-neutral-50 ${r.is_deleted ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3 font-medium text-neutral-800">
                    <button type="button" onClick={() => setDetailId(r.id)} className="text-left hover:text-[#E10600] hover:underline">
                      {r.rule_type?.name_fr ?? r.rule_type?.code}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{ruleSummary(r)}</td>
                  <td className="px-4 py-3 text-neutral-600">{Number(r.min_order_amount) > 0 ? fmtMAD(r.min_order_amount) : 'Aucun'}</td>
                  <td className="px-4 py-3 text-neutral-600">
                    <div>{fmtDate(r.valid_from)} → {r.valid_to ? fmtDate(r.valid_to) : 'sans fin'}</div>
                    <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${v.cls}`}>{v.label}</span>
                  </td>
                  <td className="px-4 py-3"><RuleStatusBadge rule={r} /></td>
                  <td className="px-4 py-3 text-xs text-neutral-500">{r.created_by_name ?? '—'}<div>{fmtDate(r.created_at)}</div></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button type="button" onClick={() => setDetailId(r.id)} className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100" title="Détail"><Eye size={16} /></button>
                      {canManage && !r.is_deleted && (
                        <>
                          <button type="button" onClick={() => toggle(r)} disabled={busyId === r.id}
                            className={`rounded-lg p-2 disabled:opacity-50 ${r.is_active ? 'text-emerald-600 hover:bg-emerald-50' : 'text-neutral-400 hover:bg-neutral-100'}`}
                            title={r.is_active ? 'Désactiver' : 'Activer'}>
                            {busyId === r.id ? <Loader2 size={16} className="animate-spin" /> : r.is_active ? <Power size={16} /> : <PowerOff size={16} />}
                          </button>
                          <button type="button" onClick={() => openEdit(r)} className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100" title="Modifier"><Pencil size={16} /></button>
                          <button type="button" onClick={() => setDeleteTarget(r)} className="rounded-lg p-2 text-neutral-500 hover:bg-red-50 hover:text-[#E10600]" title="Supprimer"><Trash2 size={16} /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm text-neutral-500">
        <span>{pagination.total} règle{pagination.total > 1 ? 's' : ''}</span>
        {pagination.pages > 1 && (
          <div className="flex items-center gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-neutral-200 p-1.5 disabled:opacity-40"><ChevronLeft size={16} /></button>
            <span>{page} / {pagination.pages}</span>
            <button type="button" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-neutral-200 p-1.5 disabled:opacity-40"><ChevronRight size={16} /></button>
          </div>
        )}
      </div>

      {/* Formulaire création / édition */}
      <Modal
        open={formOpen}
        onClose={() => !saving && setFormOpen(false)}
        title={editing ? 'Modifier la règle de points' : 'Nouvelle règle de points'}
        size="md"
        footer={(
          <>
            <button type="button" className="btn-secondary" onClick={() => setFormOpen(false)} disabled={saving}>Annuler</button>
            <button type="button" onClick={submit} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#E10600] px-4 py-2 text-sm font-medium text-white hover:bg-[#c00500] disabled:opacity-60">
              {saving && <Loader2 size={14} className="animate-spin" />} Enregistrer
            </button>
          </>
        )}
      >
        <div className="space-y-4">
          {editing && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              La modification s’applique uniquement aux prochaines commandes livrées : aucun point déjà attribué n’est recalculé.
            </p>
          )}
          <div>
            <label className="form-label">Type de règle *</label>
            <select className="form-select" value={form.rule_type_code} onChange={set('rule_type_code')}>
              <option value="">— Choisir —</option>
              {(meta?.rule_types ?? []).map((t) => <option key={t.id} value={t.code}>{t.name_fr}</option>)}
            </select>
            {type && <p className="mt-1 text-xs text-neutral-500">{RULE_TYPE_HELP[type]}</p>}
          </div>

          {type === 'category_multiplier' && (
            <div>
              <label className="form-label">Catégorie *</label>
              <select className="form-select" value={form.category_id} onChange={set('category_id')}>
                <option value="">— Choisir une catégorie —</option>
                {(meta?.categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.name_fr}{c.is_active ? '' : ' (inactive)'}</option>)}
              </select>
            </div>
          )}

          {type && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="form-label">Nombre de points (points_value) *</label>
                <input type="number" min="1" step="1" className="form-input" value={form.points_value} onChange={set('points_value')} placeholder="ex. 10" />
              </div>
              {(type === 'per_spend' || type === 'category_multiplier') && (
                <div>
                  <label className="form-label">Par tranche de (MAD){type === 'per_spend' ? ' *' : ''}</label>
                  <input type="number" min="0.01" step="0.01" max="999.99" className="form-input" value={form.per_mad_spent} onChange={set('per_mad_spent')} placeholder={type === 'per_spend' ? 'ex. 10' : 'vide = bonus fixe'} />
                </div>
              )}
              <div>
                <label className="form-label">Montant minimum de commande (MAD)</label>
                <input type="number" min="0" step="0.01" className="form-input" value={form.min_order_amount} onChange={set('min_order_amount')} />
                <p className="mt-1 text-xs text-neutral-400">0 = pas de seuil</p>
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
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
              <input type="checkbox" className="form-checkbox" checked={form.is_active} onChange={set('is_active')} /> Activer la règle dès sa création
            </label>
          )}

          {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{formError}</p>}
        </div>
      </Modal>

      {/* Détail d'une règle */}
      <Modal open={Boolean(detailId)} onClose={() => setDetailId(null)} title="Détail de la règle" subtitle={detailId} size="md"
        footer={(
          <>
            {detail && (
              <button type="button" className="btn-secondary" onClick={() => { onOpenLedgerForRule(detail.id); setDetailId(null); }}>
                <BookOpen size={15} /> Voir dans le livre des points
              </button>
            )}
            {detail && canManage && !detail.is_deleted && (
              <button type="button" className="btn-secondary" onClick={() => { const r = detail; setDetailId(null); openEdit(r); }}>
                <Pencil size={15} /> Modifier
              </button>
            )}
            <button type="button" className="btn-secondary" onClick={() => setDetailId(null)}>Fermer</button>
          </>
        )}>
        {!detail ? <Spinner /> : (
          <Section title={detail.rule_type?.name_fr ?? 'Règle'}>
            <Field label="Paramètres">{ruleSummary(detail)}</Field>
            {detail.category && <Field label="Catégorie">{detail.category.name_fr}</Field>}
            <Field label="Montant minimum">{Number(detail.min_order_amount) > 0 ? fmtMAD(detail.min_order_amount) : 'Aucun'}</Field>
            <Field label="Validité">{fmtDateTime(detail.valid_from)} → {detail.valid_to ? fmtDateTime(detail.valid_to) : 'sans fin'}</Field>
            <Field label="Statut"><RuleStatusBadge rule={detail} /></Field>
            <Field label="Créée par">{detail.created_by_name ?? '—'} · {fmtDateTime(detail.created_at)}</Field>
            <Field label="Dernière modification">{fmtDateTime(detail.updated_at)}</Field>
            {detail.is_deleted && <Field label="Supprimée le">{fmtDateTime(detail.deleted_at)}</Field>}
            <Field label="Transactions générées">{fmtNumber(detail.transactions_count)}</Field>
          </Section>
        )}
      </Modal>

      {/* Suppression (soft-delete) */}
      <Modal open={Boolean(deleteTarget)} onClose={() => !deleting && setDeleteTarget(null)} title="Supprimer la règle" size="sm"
        footer={(
          <>
            <button type="button" className="btn-secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>Annuler</button>
            <button type="button" className="btn-danger" onClick={confirmDelete} disabled={deleting}>
              {deleting && <Loader2 size={14} className="animate-spin" />} Supprimer
            </button>
          </>
        )}>
        <p className="text-sm text-neutral-600">
          La règle « {deleteTarget ? `${deleteTarget.rule_type?.name_fr} — ${ruleSummary(deleteTarget)}` : ''} » sera supprimée (soft-delete) :
          elle sera exclue des futurs calculs et ne pourra plus être modifiée ni réactivée. Les points déjà attribués et le solde des clients restent inchangés.
        </p>
      </Modal>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Onglet « Livre des points » (lecture seule, pagination keyset)
// ═══════════════════════════════════════════════════════════════════════════
function LedgerTab({ meta, initialFilters, showToast }) {
  const [filters, setFilters] = useState({
    customer_search: '', customer_id: '', type: '', direction: '', rule_id: '', date_from: '', date_to: '', ...initialFilters,
  });
  const [searchInput, setSearchInput] = useState('');
  const [rules, setRules] = useState([]);
  const [items, setItems] = useState([]);
  const [cursorStack, setCursorStack] = useState([null]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [txnId, setTxnId] = useState(null);
  const [orderId, setOrderId] = useState(null);
  const [referralId, setReferralId] = useState(null);

  useEffect(() => { setFilters((f) => ({ ...f, ...initialFilters })); }, [initialFilters]);

  // Règles pour le filtre (y compris supprimées : l'historique reste explicable)
  useEffect(() => {
    Promise.all([
      getPointsRules({ limit: 100 }).catch(() => null),
      getPointsRules({ limit: 100, status: 'deleted' }).catch(() => null),
    ]).then(([a, d]) => setRules([...(a?.data?.data ?? []), ...(d?.data?.data ?? [])]));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.customer_search === searchInput.trim() ? f : { ...f, customer_search: searchInput.trim() })), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const params = useMemo(() => {
    const p = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) p[k] = v; });
    return p;
  }, [filters]);

  const load = useCallback(async (cursor) => {
    setLoading(true);
    setError('');
    try {
      const res = await getPointsLedger({ ...params, limit: 25, ...(cursor ? { cursor } : {}) });
      const d = unwrap(res) ?? {};
      setItems(d.items ?? []);
      setNextCursor(d.next_cursor ?? null);
    } catch (err) {
      setError(apiError(err, 'Erreur lors du chargement du livre des points.'));
      setItems([]);
      setNextCursor(null);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { setCursorStack([null]); load(null); }, [load]);

  const goNext = () => { if (!nextCursor) return; setCursorStack((s) => [...s, nextCursor]); load(nextCursor); };
  const goPrev = () => {
    if (cursorStack.length <= 1) return;
    const s = cursorStack.slice(0, -1);
    setCursorStack(s);
    load(s[s.length - 1]);
  };

  const doExport = async () => {
    setExporting(true);
    try {
      const d = unwrap(await exportPointsLedger(params)) ?? {};
      const rows = (d.items ?? []).map((t) => [
        fmtDateTime(t.created_at), t.customer?.name ?? '', `${t.customer?.phone_country ?? ''} ${t.customer?.phone_number ?? ''}`.trim(),
        t.type_label ?? t.type, t.amount, t.amount >= 0 ? 'Crédit' : 'Débit', t.reason ?? '',
        t.rule ? `${t.rule.type_label} (${t.rule.id.slice(0, 8)})${t.rule.is_deleted ? ' [supprimée]' : ''}` : '',
        t.source?.label ?? '', t.order_id ?? t.referral_id ?? t.game_play_id ?? '', t.id,
      ]);
      downloadCsv(`livre-des-points-${todayStamp()}.csv`,
        ['Date', 'Client', 'Téléphone', 'Type', 'Montant', 'Sens', 'Motif', 'Règle appliquée', 'Source', 'Réf. source', 'ID transaction'], rows);
      if (d.truncated) showToast('error', `Export limité aux ${d.max} premières lignes : affinez les filtres.`);
    } catch (err) {
      showToast('error', apiError(err, 'Export impossible.'));
    } finally {
      setExporting(false);
    }
  };

  const setF = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const pageNo = cursorStack.length;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        {filters.customer_id ? (
          <span className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm">
            Client : <Link className="font-medium text-[#E10600] hover:underline" to={customerUrl(filters.customer_id, 'fidelite')}>{items[0]?.customer?.name ?? filters.customer_id.slice(0, 8)}</Link>
            <button type="button" onClick={() => setFilters((f) => ({ ...f, customer_id: '' }))} className="text-neutral-400 hover:text-neutral-700"><X size={14} /></button>
          </span>
        ) : (
          <div className="relative min-w-[220px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input className="form-input pl-9" placeholder="Client (nom ou téléphone)" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          </div>
        )}
        <select className="form-select w-auto" value={filters.type} onChange={setF('type')}>
          <option value="">Tous les types</option>
          {(meta?.txn_types ?? []).map((t) => <option key={t.code} value={t.code}>{t.name_fr}</option>)}
        </select>
        <select className="form-select w-auto" value={filters.direction} onChange={setF('direction')}>
          <option value="">Crédits et débits</option>
          <option value="in">Crédits (+)</option>
          <option value="out">Débits (−)</option>
        </select>
        <select className="form-select w-auto max-w-[260px]" value={filters.rule_id} onChange={setF('rule_id')}>
          <option value="">Toutes les règles</option>
          {rules.map((r) => <option key={r.id} value={r.id}>{r.rule_type?.name_fr} — {ruleSummary(r)}{r.is_deleted ? ' (supprimée)' : ''}</option>)}
        </select>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Du</label>
          <input type="date" className="form-input" value={filters.date_from} onChange={setF('date_from')} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Au</label>
          <input type="date" className="form-input" value={filters.date_to} onChange={setF('date_to')} />
        </div>
        <button type="button" onClick={doExport} disabled={exporting} className="ml-auto inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60">
          {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Exporter
        </button>
      </div>

      <div className="mb-2 flex items-center gap-2 text-xs text-neutral-500">
        <Lock size={12} /> Lecture seule : le livre des points n’accepte que des insertions. Le solde d’un client est lu dans sa fiche (jamais recalculé).
      </div>

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 text-right font-medium">Montant ±</th>
              <th className="px-4 py-3 font-medium">Règle appliquée</th>
              <th className="px-4 py-3 font-medium">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading ? (
              <tr><td colSpan={6}><Spinner /></td></tr>
            ) : error ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-red-600">{error}</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-neutral-400">Aucune transaction de points pour ces filtres.</td></tr>
            ) : items.map((t) => (
              <tr key={t.id} onClick={() => setTxnId(t.id)} className="cursor-pointer hover:bg-neutral-50">
                <td className="whitespace-nowrap px-4 py-3 text-neutral-600">{fmtDateTime(t.created_at)}</td>
                <td className="px-4 py-3">
                  <Link to={customerUrl(t.customer_id, 'fidelite')} onClick={(e) => e.stopPropagation()} className="font-medium text-neutral-800 hover:text-[#E10600] hover:underline">
                    {t.customer?.name ?? '—'}
                  </Link>
                  <div className="text-xs text-neutral-400">{t.customer?.phone_number}</div>
                </td>
                <td className="px-4 py-3"><TxnTypeBadge type={t.type} label={t.type_label} /></td>
                <td className="px-4 py-3 text-right"><PointsAmount value={t.amount} /></td>
                <td className="px-4 py-3 text-xs text-neutral-600">
                  {t.rule ? (
                    <>
                      {t.rule.type_label}
                      {t.rule.is_deleted && <span className="ml-1 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] text-red-600">supprimée</span>}
                    </>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 text-xs">
                  {t.source?.kind === 'order' && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); setOrderId(t.order_id); }} className="text-[#E10600] hover:underline">{orderRef(t.order_id)}</button>
                  )}
                  {t.source?.kind === 'referral' && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); setReferralId(t.referral_id); }} className="text-[#E10600] hover:underline">Parrainage</button>
                  )}
                  {t.source?.kind === 'game_play' && <span className="text-neutral-600">Partie de jeu</span>}
                  {!t.source && <span className="text-neutral-400">{t.reason ?? '—'}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2 text-sm text-neutral-500">
        <button type="button" disabled={pageNo <= 1 || loading} onClick={goPrev} className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-3 py-1.5 disabled:opacity-40">
          <ChevronLeft size={15} /> Précédent
        </button>
        <span>Page {pageNo}</span>
        <button type="button" disabled={!nextCursor || loading} onClick={goNext} className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-3 py-1.5 disabled:opacity-40">
          Suivant <ChevronRight size={15} />
        </button>
      </div>

      <LedgerDetailModal
        txnId={txnId}
        onClose={() => setTxnId(null)}
        onOpenOrder={(id) => { setTxnId(null); setOrderId(id); }}
        onOpenReferral={(id) => { setTxnId(null); setReferralId(id); }}
      />
      <ReferralDetailModal referralId={referralId} onClose={() => setReferralId(null)} onOpenOrder={(id) => { setReferralId(null); setOrderId(id); }} />
      <OrderDetailDrawer orderId={orderId} onClose={() => setOrderId(null)} onChanged={() => load(cursorStack[cursorStack.length - 1])} />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
export default function PointsConfigPage() {
  const { hasPermission } = useAuth();
  const canRules = hasPermission('points_rules.view') || hasPermission('points_rules.manage');
  const canManage = hasPermission('points_rules.manage');
  const canLedger = hasPermission('points_ledger.view');
  const [searchParams, setSearchParams] = useSearchParams();
  const tabs = TABS.filter((t) => (t.key === 'rules' ? canRules : canLedger));
  const requested = searchParams.get('tab');
  const activeTab = tabs.some((t) => t.key === requested) ? requested : tabs[0]?.key;
  const [meta, setMeta] = useState(null);
  const [toast, showToast] = useToast();

  const ledgerInitial = useMemo(() => {
    const f = {};
    ['customer_id', 'rule_id', 'type', 'direction'].forEach((k) => { if (searchParams.get(k)) f[k] = searchParams.get(k); });
    return f;
  }, [searchParams]);

  useEffect(() => {
    getLoyaltyMeta().then((res) => setMeta(unwrap(res))).catch(() => setMeta({}));
  }, []);

  const setTab = (key) => setSearchParams({ tab: key });

  if (!tabs.length) {
    return (
      <div className="min-h-screen bg-neutral-50 p-6">
        <h1 className="font-poppins text-2xl font-semibold text-neutral-900">Configuration des points</h1>
        <p className="mt-4 text-sm text-neutral-500">Vous n’avez pas la permission d’accéder à cet écran.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      <Toast toast={toast} />
      <div className="mb-5">
        <h1 className="font-poppins text-2xl font-semibold text-neutral-900">Configuration des points</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Règles globales d’acquisition cumulables et grand livre des mouvements de points (crédits et débits).
        </p>
      </div>

      <div className="mb-5 flex gap-6 border-b border-neutral-200">
        {tabs.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 pb-3 text-sm font-medium transition-colors ${activeTab === t.key ? 'border-[#E10600] text-[#E10600]' : 'border-transparent text-neutral-500 hover:text-neutral-800'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'rules' && (
        <RulesTab meta={meta} canManage={canManage} showToast={showToast}
          onOpenLedgerForRule={(ruleId) => setSearchParams({ tab: 'ledger', rule_id: ruleId })} />
      )}
      {activeTab === 'ledger' && <LedgerTab meta={meta} initialFilters={ledgerInitial} showToast={showToast} />}
    </div>
  );
}
