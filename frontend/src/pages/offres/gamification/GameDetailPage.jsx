import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Info, Lock, Pencil, Plus, Power, Trash2 } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import Modal from '../../../components/Modal';
import {
  getGamificationLookups, getGame, createGame, updateGame, activateGame, deactivateGame, deleteGame,
  addPrize, updatePrize, deletePrize,
} from '../../../api/gamification.api';
import PrizeFormModal from './PrizeFormModal';
import PlaysPanel from './PlaysPanel';
import {
  GAME_STATUS, CONDITION_RULES, CONDITION_HELP, PERIOD_HELP, PRIZE_COLORS, NO_PRIZE_COLOR,
  errMsg, fmtDateTime, toLocalInput, fromLocalInput, prizeValueLabel, normalizedPct,
} from './gamificationUtils';

const TABS = [
  { key: 'configuration', label: 'Configuration jeu' },
  { key: 'lots', label: 'Lots' },
  { key: 'participations', label: 'Participations' },
];

function StatusBadge({ status }) {
  const s = GAME_STATUS[status] ?? GAME_STATUS.inactive;
  return <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

function Notice({ tone = 'info', children, onClose }) {
  const cls = {
    info: 'bg-sky-50 text-sky-800',
    warn: 'bg-amber-50 text-amber-800',
    error: 'bg-red-50 text-red-700',
    success: 'bg-emerald-50 text-emerald-700',
  }[tone];
  return (
    <div className={`flex items-start gap-2 rounded-lg p-3 text-sm ${cls}`}>
      {tone === 'warn' || tone === 'error' ? <AlertTriangle size={16} className="mt-0.5 shrink-0" /> : <Info size={16} className="mt-0.5 shrink-0" />}
      <div className="flex-1">{children}</div>
      {onClose && <button type="button" onClick={onClose} className="font-bold opacity-60 hover:opacity-100">×</button>}
    </div>
  );
}

function emptyForm() {
  const start = new Date();
  start.setSeconds(0, 0);
  return {
    name_fr: '', name_ar: '', game_type_id: '', node_id: '', unlock_condition_id: '', play_period_id: '',
    max_plays_per_user: '1', unlock_min_amount: '', starts_at: toLocalInput(start), ends_at: '',
  };
}

function formFromGame(g) {
  return {
    name_fr: g.name_fr ?? '',
    name_ar: g.name_ar ?? '',
    game_type_id: g.game_type_id ?? '',
    node_id: g.node_id ?? '',
    unlock_condition_id: g.unlock_condition_id ?? '',
    play_period_id: g.play_period_id ?? '',
    max_plays_per_user: String(g.max_plays_per_user ?? 1),
    unlock_min_amount: g.unlock_min_amount === null || g.unlock_min_amount === undefined ? '' : String(g.unlock_min_amount),
    starts_at: toLocalInput(g.starts_at),
    ends_at: toLocalInput(g.ends_at),
  };
}

/** Camembert des poids normalisés (lots actifs). */
function DistributionPie({ prizes, pcts }) {
  let acc = 0;
  const stops = [];
  prizes.forEach((p, i) => {
    if (!pcts[i]) return;
    const color = (p.prize_type_code ?? p.prize_type?.code) === 'no_prize' ? NO_PRIZE_COLOR : PRIZE_COLORS[i % PRIZE_COLORS.length];
    stops.push(`${color} ${acc}% ${acc + pcts[i]}%`);
    acc += pcts[i];
  });
  const bg = stops.length ? `conic-gradient(${stops.join(', ')})` : '#f4f4f5';
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <div className="h-36 w-36 shrink-0 rounded-full border border-gray-100" style={{ background: bg }} aria-label="Distribution des probabilités" />
      <ul className="space-y-1 text-sm">
        {prizes.map((p, i) => (
          <li key={p.id ?? p._key ?? i} className={`flex items-center gap-2 ${p.is_active ? '' : 'text-gray-300 line-through'}`}>
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: (p.prize_type_code ?? p.prize_type?.code) === 'no_prize' ? NO_PRIZE_COLOR : PRIZE_COLORS[i % PRIZE_COLORS.length] }} />
            <span className="text-gray-700">{p.name_fr}</span>
            <span className="font-semibold text-gray-900">{pcts[i].toFixed(2)} %</span>
          </li>
        ))}
        {prizes.length === 0 && <li className="text-gray-400">Aucun lot.</li>}
      </ul>
    </div>
  );
}

export default function GameDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isNew = !id || id === 'nouveau';
  const { hasPermission } = useAuth();
  const canView = hasPermission('games.view') || hasPermission('games.manage');
  const canManage = hasPermission('games.manage');

  const [lookups, setLookups] = useState(null);
  const [game, setGame] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [localPrizes, setLocalPrizes] = useState([]); // création : lots saisis avant l'enregistrement
  const [activeTab, setActiveTab] = useState('configuration');
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null); // { tone, text, list }
  const [prizeModal, setPrizeModal] = useState(null); // { prize } | { prize: null }
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteRefusal, setDeleteRefusal] = useState(null); // { message, details }
  const [playsFilters, setPlaysFilters] = useState({});

  useEffect(() => {
    getGamificationLookups()
      .then(({ data }) => setLookups(data.data))
      .catch((err) => setError(errMsg(err, 'Impossible de charger les référentiels')));
  }, []);

  const loadGame = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    try {
      const { data } = await getGame(id);
      setGame(data.data);
      setForm(formFromGame(data.data));
      setError(null);
    } catch (err) {
      setError(errMsg(err, 'Impossible de charger le jeu'));
    } finally {
      setLoading(false);
    }
  }, [id, isNew]);

  useEffect(() => { loadGame(); }, [loadGame]);

  // Valeurs par défaut en création
  useEffect(() => {
    if (!isNew || !lookups) return;
    setForm((f) => ({
      ...f,
      game_type_id: f.game_type_id || lookups.game_types.find((t) => t.code === 'roulette')?.id || '',
    }));
  }, [isNew, lookups]);

  const conditionCode = useMemo(() => lookups?.unlock_conditions.find((c) => c.id === form.unlock_condition_id)?.code ?? null, [lookups, form.unlock_condition_id]);
  const rule = conditionCode ? CONDITION_RULES[conditionCode] : null;
  const periodCode = useMemo(() => lookups?.play_periods.find((p) => p.id === form.play_period_id)?.code ?? null, [lookups, form.play_period_id]);
  const rulesLocked = !!game?.rules_locked;
  const editable = canManage;

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  function onConditionChange(condId) {
    const code = lookups.unlock_conditions.find((c) => c.id === condId)?.code;
    const r = CONDITION_RULES[code];
    setForm((f) => {
      const next = { ...f, unlock_condition_id: condId };
      if (r) {
        const curPeriod = lookups.play_periods.find((p) => p.id === f.play_period_id)?.code;
        if (!r.periods.includes(curPeriod)) {
          next.play_period_id = lookups.play_periods.find((p) => p.code === r.periods[0])?.id ?? '';
        }
        if (r.fixedMaxPlays !== null) next.max_plays_per_user = String(r.fixedMaxPlays);
        if (!r.minAmount) next.unlock_min_amount = '';
      }
      return next;
    });
  }

  function buildPayload() {
    const sameStart = game && form.starts_at === toLocalInput(game.starts_at);
    const sameEnd = game && form.ends_at === toLocalInput(game.ends_at);
    const ends = sameEnd ? game.ends_at : fromLocalInput(form.ends_at);
    if (rulesLocked) {
      return { name_fr: form.name_fr, name_ar: form.name_ar, ends_at: ends };
    }
    return {
      name_fr: form.name_fr,
      name_ar: form.name_ar,
      game_type_id: form.game_type_id,
      node_id: form.node_id,
      unlock_condition_id: form.unlock_condition_id,
      play_period_id: form.play_period_id,
      max_plays_per_user: rule && rule.fixedMaxPlays !== null ? rule.fixedMaxPlays : form.max_plays_per_user,
      unlock_min_amount: rule?.minAmount && form.unlock_min_amount !== '' ? form.unlock_min_amount : null,
      starts_at: sameStart ? game.starts_at : fromLocalInput(form.starts_at),
      ends_at: ends,
    };
  }

  async function handleSave() {
    setSaving(true);
    setNotice(null);
    try {
      if (isNew) {
        const payload = { ...buildPayload(), prizes: localPrizes.map(({ _key, sku_label, pack_label, sku_stock, coupon_promo_type, prize_type_code, ...p }) => p) };
        const { data } = await createGame(payload);
        const created = data.data.game;
        navigate(`/offres/gamification/${created.id}`, { replace: true, state: { warnings: data.data.warnings, created: true } });
      } else {
        const { data } = await updateGame(game.id, buildPayload());
        setGame(data.data.game);
        setForm(formFromGame(data.data.game));
        setNotice({ tone: data.data.warnings?.length ? 'warn' : 'success', text: 'Jeu enregistré.', list: data.data.warnings });
      }
    } catch (err) {
      setNotice({ tone: 'error', text: errMsg(err, "Échec de l'enregistrement") });
    } finally {
      setSaving(false);
    }
  }

  // Message post-création (navigation)
  useEffect(() => {
    const st = location.state;
    if (!isNew && st?.created) {
      setNotice({ tone: 'success', text: 'Jeu créé au statut INACTIF. Vérifiez les lots et la distribution, puis cliquez sur « Activer ».', list: st.warnings });
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [isNew, location.state, location.pathname, navigate]);

  async function handleToggleActive() {
    setNotice(null);
    try {
      const { data } = game.is_active ? await deactivateGame(game.id) : await activateGame(game.id);
      setGame(data.data.game);
      setNotice({
        tone: data.data.warnings?.length ? 'warn' : 'success',
        text: data.data.game.is_active ? 'Jeu activé : visible dans l’app à partir de sa date de début.' : 'Jeu désactivé : il disparaît immédiatement de l’app. Les lots déjà gagnés restent réclamables.',
        list: data.data.warnings,
      });
    } catch (err) {
      setNotice({ tone: 'error', text: errMsg(err, 'Échec du changement de statut') });
    }
  }

  async function handleDelete() {
    setConfirmDelete(false);
    try {
      await deleteGame(game.id);
      navigate('/offres/gamification', { replace: true });
    } catch (err) {
      if (err?.response?.status === 409) {
        setDeleteRefusal({ message: errMsg(err), details: err.response.data.errors ?? {} });
      } else {
        setNotice({ tone: 'error', text: errMsg(err, 'Échec de la suppression') });
      }
    }
  }

  async function deactivateInstead() {
    try {
      const { data } = await deactivateGame(game.id);
      setGame(data.data.game);
      setDeleteRefusal(null);
      setNotice({ tone: 'success', text: 'Jeu désactivé à la place de la suppression.' });
    } catch (err) {
      setNotice({ tone: 'error', text: errMsg(err, 'Échec de la désactivation') });
    }
  }

  function showLockedPlays(filters) {
    setDeleteRefusal(null);
    setPlaysFilters(filters);
    setActiveTab('participations');
  }

  // ── lots ──
  const prizes = isNew ? localPrizes : (game?.prizes ?? []);
  const prizeTypeCode = (p) => p.prize_type_code ?? lookups?.prize_types.find((t) => t.id === p.prize_type_id)?.code;
  const displayPrizes = prizes.map((p) => ({ ...p, prize_type_code: prizeTypeCode(p) }));
  const pcts = normalizedPct(displayPrizes);
  const weightSum = displayPrizes.filter((p) => p.is_active).reduce((s, p) => s + Number(p.probability_weight || 0), 0);
  const hasWinning = displayPrizes.some((p) => p.is_active && p.prize_type_code !== 'no_prize');

  async function submitPrize(payload, display) {
    const editing = prizeModal?.prize;
    if (isNew) {
      const row = {
        ...payload,
        ...display,
        probability_weight: Number(payload.probability_weight),
        value: payload.value === null || payload.value === '' ? null : Number(payload.value),
        coupon_promo_type: lookups.coupon_promo_types.find((t) => t.id === payload.coupon_promo_type_id) ?? null,
        _key: editing?._key ?? `${Date.now()}-${Math.random()}`,
      };
      if (!row.name_fr || !row.name_ar) throw new Error('Nom FR et Nom AR du lot sont obligatoires');
      if (!(Number(row.probability_weight) > 0)) throw new Error('Le poids de probabilité doit être strictement supérieur à 0');
      setLocalPrizes((list) => (editing ? list.map((p) => (p._key === editing._key ? row : p)) : [...list, row]));
      setPrizeModal(null);
      return;
    }
    const { data } = editing ? await updatePrize(game.id, editing.id, payload) : await addPrize(game.id, payload);
    setGame(data.data.game);
    setPrizeModal(null);
    setNotice({ tone: data.data.warnings?.length ? 'warn' : 'success', text: editing ? 'Lot mis à jour.' : 'Lot ajouté.', list: data.data.warnings });
  }

  async function removePrize(p) {
    if (!window.confirm(`Supprimer le lot « ${p.name_fr} » ?`)) return;
    if (isNew) { setLocalPrizes((list) => list.filter((x) => x._key !== p._key)); return; }
    try {
      const { data } = await deletePrize(game.id, p.id);
      setGame(data.data.game);
      setNotice({ tone: data.data.warnings?.length ? 'warn' : 'success', text: 'Lot supprimé.', list: data.data.warnings });
    } catch (err) {
      setNotice({ tone: 'error', text: errMsg(err, 'Échec de la suppression du lot') });
    }
  }

  if (!canView) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-gray-400">
        <Lock size={28} />
        <p className="text-sm">Vous n'avez pas accès à cette page.</p>
      </div>
    );
  }

  const title = isNew ? 'Créer un jeu' : (game?.name_fr ?? 'Jeu');
  const lockedRule = rulesLocked || !editable;

  return (
    <div className="space-y-4 p-6">
      <button type="button" onClick={() => navigate('/offres/gamification')} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft size={16} /> Liste des jeux
      </button>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-6 py-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
              {game && <StatusBadge status={game.status} />}
            </div>
            {game && (
              <p className="mt-0.5 text-xs text-gray-500">
                <span dir="rtl">{game.name_ar}</span> · {game.game_type?.name_fr} · {game.node?.code} · créé le {fmtDateTime(game.created_at)}{game.creator ? ` par ${game.creator.full_name}` : ''}
              </p>
            )}
          </div>
          {game && canManage && (
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleToggleActive}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${game.is_active ? 'border border-gray-200 text-gray-700 hover:bg-gray-50' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
                <Power size={16} /> {game.is_active ? 'Désactiver' : 'Activer'}
              </button>
              <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
                <Trash2 size={16} /> Supprimer
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-1 border-b border-gray-100 px-6">
          {TABS.map((t) => {
            const disabled = isNew && t.key === 'participations';
            return (
              <button key={t.key} type="button" disabled={disabled} onClick={() => setActiveTab(t.key)}
                className={`-mb-px border-b-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === t.key ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-800'} ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}>
                {t.label}
                {t.key === 'lots' && <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 text-xs text-gray-600">{prizes.length}</span>}
              </button>
            );
          })}
        </div>

        <div className="space-y-3 px-6 pt-4">
          {error && <Notice tone="error">{error}</Notice>}
          {notice && (
            <Notice tone={notice.tone} onClose={() => setNotice(null)}>
              <div>{notice.text}</div>
              {notice.list?.length > 0 && <ul className="mt-1 list-disc pl-5">{notice.list.map((w) => <li key={w}>{w}</li>)}</ul>}
            </Notice>
          )}
          {game?.checks?.errors?.length > 0 && (
            <Notice tone="warn">
              Configuration incomplète — le jeu ne pourra pas être activé :
              <ul className="mt-1 list-disc pl-5">{game.checks.errors.map((w) => <li key={w}>{w}</li>)}</ul>
            </Notice>
          )}
        </div>

        {(loading || !lookups) && !error && <p className="px-6 py-8 text-sm text-gray-400">Chargement…</p>}

        {/* ── Configuration ── */}
        {lookups && !loading && activeTab === 'configuration' && (isNew || game) && (
          <div className="space-y-5 px-6 py-5">
            {rulesLocked && (
              <Notice tone="info">
                {game.stats.plays_count} partie(s) déjà jouée(s) : les règles du jeu (type, node, condition, période, quota, seuil, date de début) sont figées. Seuls le nom, la date de fin et l'activation restent modifiables.
              </Notice>
            )}

            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">A. Identité du jeu</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="form-label">Type de jeu *</label>
                  <div className="flex gap-2">
                    {lookups.game_types.map((t) => (
                      <label key={t.id} className={`flex flex-1 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${form.game_type_id === t.id ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-700'} ${lockedRule ? 'cursor-not-allowed opacity-60' : ''}`}>
                        <input type="radio" name="game_type" className="sr-only" disabled={lockedRule} checked={form.game_type_id === t.id} onChange={() => set('game_type_id', t.id)} />
                        {t.name_fr}
                        <span className="text-xs text-gray-400">{t.code === 'roulette' ? '(secteurs d’une roue)' : '(cases à gratter)'}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="form-label">Node * <span className="font-normal text-gray-400">(un jeu par dark store)</span></label>
                  <select className="form-select" value={form.node_id} disabled={lockedRule} onChange={(e) => set('node_id', e.target.value)}>
                    <option value="">— Choisir un node —</option>
                    {lookups.nodes.map((n) => <option key={n.id} value={n.id}>{n.code} — {n.name_fr}{n.is_active ? '' : ' (inactif)'}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Nom FR *</label>
                  <input className="form-input" value={form.name_fr} disabled={!editable} onChange={(e) => set('name_fr', e.target.value)} placeholder="ex. Roue ATINA" maxLength={255} />
                </div>
                <div>
                  <label className="form-label">Nom AR *</label>
                  <input className="form-input" dir="rtl" value={form.name_ar} disabled={!editable} onChange={(e) => set('name_ar', e.target.value)} maxLength={255} />
                </div>
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">B. Règles de jeu</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="form-label">Condition de déblocage * <span className="font-normal text-gray-400">(une seule par jeu)</span></label>
                  <select className="form-select" value={form.unlock_condition_id} disabled={lockedRule} onChange={(e) => onConditionChange(e.target.value)}>
                    <option value="">— Choisir une condition —</option>
                    {lookups.unlock_conditions.map((c) => <option key={c.id} value={c.id}>{c.name_fr} ({c.code})</option>)}
                  </select>
                  {conditionCode && <p className="mt-1 text-xs text-gray-500">{CONDITION_HELP[conditionCode]}</p>}
                </div>
                <div>
                  <label className="form-label">Période de reset *</label>
                  <select className="form-select" value={form.play_period_id} disabled={lockedRule || !rule} onChange={(e) => set('play_period_id', e.target.value)}>
                    <option value="">— Choisir une période —</option>
                    {lookups.play_periods.map((p) => {
                      const allowed = !rule || rule.periods.includes(p.code);
                      return (
                        <option key={p.id} value={p.id} disabled={!allowed}>
                          {p.name_fr}{!allowed ? (conditionCode === 'app_login' && p.code === 'lifetime' ? ' — interdit avec « Connexion à l’app »' : ' — incohérent avec la condition') : ''}
                        </option>
                      );
                    })}
                  </select>
                  {periodCode && <p className="mt-1 text-xs text-gray-500">{PERIOD_HELP[periodCode]}</p>}
                </div>
                <div>
                  <label className="form-label">Nb de parties max par client *</label>
                  <input type="number" min="1" step="1" className="form-input" value={form.max_plays_per_user}
                    disabled={lockedRule || !rule || rule.fixedMaxPlays !== null} onChange={(e) => set('max_plays_per_user', e.target.value)} />
                  <p className="mt-1 text-xs text-gray-500">
                    {rule && rule.fixedMaxPlays !== null ? 'Valeur imposée à 1 pour cette condition.' : 'Plafond par période ; les participations excédentaires sont perdues (aucun report).'}
                  </p>
                </div>
                {rule?.minAmount && (
                  <div>
                    <label className="form-label">Montant minimum (MAD) <span className="font-normal text-gray-400">— facultatif</span></label>
                    <input type="number" min="0" step="0.01" className="form-input" value={form.unlock_min_amount} disabled={lockedRule}
                      onChange={(e) => set('unlock_min_amount', e.target.value)} placeholder="Vide ou 0 = aucun seuil" />
                    <p className="mt-1 text-xs text-gray-500">Total TTC ≥ seuil ET commande livrée encaissée (exigences cumulatives).</p>
                  </div>
                )}
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Validité</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="form-label">Date de début *</label>
                  <input type="datetime-local" className="form-input" value={form.starts_at} disabled={lockedRule} onChange={(e) => set('starts_at', e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Date de fin <span className="font-normal text-gray-400">(vide = sans expiration)</span></label>
                  <input type="datetime-local" className="form-input" value={form.ends_at} disabled={!editable} onChange={(e) => set('ends_at', e.target.value)} />
                </div>
              </div>
              {isNew && <p className="mt-2 text-xs text-gray-500">Le jeu est enregistré au statut INACTIF ; il n'apparaît dans l'app qu'après l'action « Activer ».</p>}
            </section>

            {editable && (
              <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
                {isNew && <button type="button" className="btn-secondary" onClick={() => setActiveTab('lots')}>Configurer les lots ({localPrizes.length})</button>}
                <button type="button" onClick={handleSave} disabled={saving} className="rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Lots ── */}
        {lookups && !loading && activeTab === 'lots' && (isNew || game) && (
          <div className="space-y-5 px-6 py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-500">
                Chaque lot = un {lookups.game_types.find((t) => t.id === form.game_type_id)?.code === 'scratch_card' ? 'case de la grille à gratter' : 'secteur de la roue'}.
                {isNew && ' Les lots seront enregistrés avec le jeu.'}
              </p>
              {editable && (
                <button type="button" onClick={() => setPrizeModal({ prize: null })} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
                  <Plus size={16} /> Ajouter un lot
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <span className={`rounded-md px-2 py-1 ${hasWinning ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{hasWinning ? '✓' : '✗'} Au moins 1 lot actif hors « Aucun gain »</span>
              <span className={`rounded-md px-2 py-1 ${weightSum > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{weightSum > 0 ? '✓' : '✗'} Somme des poids actifs : {weightSum.toFixed(4).replace(/\.?0+$/, '')}</span>
            </div>
            {game?.checks?.warnings?.length > 0 && (
              <Notice tone="warn"><ul className="list-disc pl-5">{game.checks.warnings.map((w) => <li key={w}>{w}</li>)}</ul></Notice>
            )}

            <div className="overflow-x-auto rounded-lg border border-gray-100">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3 font-medium">Ordre</th>
                    <th className="px-4 py-3 font-medium">Lot (FR / AR)</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Valeur</th>
                    <th className="px-4 py-3 font-medium">Poids</th>
                    <th className="px-4 py-3 font-medium">Probabilité</th>
                    <th className="px-4 py-3 font-medium">Attribués / Stock max</th>
                    <th className="px-4 py-3 font-medium">Statut</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {displayPrizes.length === 0 && (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Aucun lot. Ajoutez au moins un lot gagnant et un lot « Aucun gain ».</td></tr>
                  )}
                  {displayPrizes.map((p, i) => {
                    const locked = !!p.is_locked;
                    const typeLabel = lookups.prize_types.find((t) => t.id === p.prize_type_id)?.name_fr ?? p.prize_type_code;
                    return (
                      <tr key={p.id ?? p._key} className={p.is_active ? '' : 'bg-gray-50/60 text-gray-400'}>
                        <td className="px-4 py-3">{p.sort_order}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{p.name_fr}</div>
                          <div className="text-xs text-gray-400" dir="rtl">{p.name_ar}</div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">{typeLabel}</td>
                        <td className="px-4 py-3 text-gray-700">
                          {prizeValueLabel(p)}
                          {p.prize_type_code === 'free_sku' && p.sku_stock !== null && p.sku_stock !== undefined && !(p.sku_stock > 0) && (
                            <span className="ml-1 inline-flex items-center gap-1 text-xs text-amber-600"><AlertTriangle size={12} /> sans stock</span>
                          )}
                        </td>
                        <td className="px-4 py-3">{Number(p.probability_weight)}</td>
                        <td className="px-4 py-3 font-semibold text-gray-900">{pcts[i].toFixed(2)} %</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {p.prize_type_code === 'no_prize' ? '—' : `${p.awarded_count ?? 0} / ${p.stock_limit ?? '∞'}`}
                          {p.is_exhausted && <span className="ml-1 text-xs text-red-500">épuisé</span>}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {p.is_active ? <span className="badge-active">Actif</span> : <span className="badge-inactive">Inactif</span>}
                          {locked && <span className="ml-1 inline-flex items-center text-xs text-gray-400" title="Lot déjà attribué"><Lock size={12} /></span>}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {editable && (
                            <div className="flex gap-2">
                              <button type="button" className="btn-icon-edit" onClick={() => setPrizeModal({ prize: p })}><Pencil size={14} /> Modifier</button>
                              <button type="button" className="btn-icon-delete disabled:cursor-not-allowed disabled:opacity-40" disabled={locked}
                                title={locked ? 'Lot déjà attribué : suppression impossible, désactivez-le' : undefined} onClick={() => removePrize(p)}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="rounded-lg border border-gray-100 p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">Distribution (poids normalisés en %)</h3>
              <DistributionPie prizes={displayPrizes} pcts={pcts} />
            </div>

            {isNew && editable && (
              <div className="flex justify-end border-t border-gray-100 pt-4">
                <button type="button" onClick={handleSave} disabled={saving} className="rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                  {saving ? 'Enregistrement…' : 'Enregistrer le jeu'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Participations (lecture seule) ── */}
        {game && activeTab === 'participations' && (
          <div className="pb-4">
            <PlaysPanel gameId={game.id} prizes={game.prizes} initialFilters={playsFilters} />
          </div>
        )}
      </div>

      {prizeModal && lookups && (
        <PrizeFormModal
          open
          onClose={() => setPrizeModal(null)}
          prize={prizeModal.prize}
          locked={!!prizeModal.prize?.is_locked}
          prizeTypes={lookups.prize_types}
          couponPromoTypes={lookups.coupon_promo_types}
          nodeId={form.node_id || game?.node_id}
          onSubmit={submitPrize}
        />
      )}

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Supprimer le jeu ?" size="sm"
        footer={(
          <>
            <button type="button" className="btn-secondary" onClick={() => setConfirmDelete(false)}>Annuler</button>
            <button type="button" className="btn-danger" onClick={handleDelete}>Supprimer</button>
          </>
        )}>
        <p className="text-sm text-gray-600">
          Le jeu « {game?.name_fr} » sera retiré de la liste (suppression logique). L'historique des parties et des gains reste consultable.
          La suppression est refusée tant qu'une commande active contient un lot de ce jeu ou qu'un lot gagné n'est ni réclamé ni expiré.
        </p>
      </Modal>

      <Modal open={!!deleteRefusal} onClose={() => setDeleteRefusal(null)} title="Suppression refusée" size="sm"
        footer={(
          <>
            <button type="button" className="btn-secondary" onClick={() => setDeleteRefusal(null)}>Fermer</button>
            {game?.is_active && <button type="button" className="btn-danger" onClick={deactivateInstead}>Désactiver à la place</button>}
          </>
        )}>
        {deleteRefusal && (
          <div className="space-y-3 text-sm text-gray-700">
            <p>{deleteRefusal.message}</p>
            <ul className="space-y-2">
              {deleteRefusal.details.active_orders > 0 && (
                <li className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2">
                  <span>Verrou 1 : <strong>{deleteRefusal.details.active_orders}</strong> commande(s) active(s) liée(s)</span>
                  <button type="button" className="text-xs font-medium text-red-700 underline" onClick={() => showLockedPlays({ has_active_order: 'true' })}>Voir la liste</button>
                </li>
              )}
              {deleteRefusal.details.unclaimed_prizes > 0 && (
                <li className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2">
                  <span>Verrou 2 : <strong>{deleteRefusal.details.unclaimed_prizes}</strong> lot(s) gagné(s) non réclamé(s)</span>
                  <button type="button" className="text-xs font-medium text-amber-700 underline" onClick={() => showLockedPlays({ claim_status: 'pending' })}>Voir la liste</button>
                </li>
              )}
            </ul>
            {!game?.is_active && <p className="text-xs text-gray-500">Le jeu est déjà inactif : il n'est plus proposé dans l'app. Réessayez une fois les commandes terminées et les lots réclamés ou expirés.</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
