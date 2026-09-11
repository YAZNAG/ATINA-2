import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gamepad2, Lock, Pencil, Plus, Power, RefreshCw, Trash2 } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import Modal from '../../../components/Modal';
import {
  getGamificationLookups, getGames, activateGame, deactivateGame, deleteGame,
} from '../../../api/gamification.api';
import PlaysPanel from './PlaysPanel';
import { GAME_STATUS, STATUS_FILTERS, errMsg, fmtDate, money } from './gamificationUtils';

const TABS = [
  { key: 'games', label: 'Liste des jeux' },
  { key: 'plays', label: 'Participations' },
];

const selectCls = 'rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200';

function StatusBadge({ status }) {
  const s = GAME_STATUS[status] ?? GAME_STATUS.inactive;
  return <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

export default function GamesPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canView = hasPermission('games.view') || hasPermission('games.manage');
  const canManage = hasPermission('games.manage');

  const [activeTab, setActiveTab] = useState('games');
  const [lookups, setLookups] = useState(null);
  const [filters, setFilters] = useState({ node_id: '', game_type_id: '', status: '', play_period_id: '', search: '' });
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [games, setGames] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [refusal, setRefusal] = useState(null); // { game, message, details }

  useEffect(() => {
    getGamificationLookups().then(({ data }) => setLookups(data.data)).catch(() => setLookups(null));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); setFilters((f) => ({ ...f, search: searchInput })); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: 25 };
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const { data } = await getGames(params);
      setGames(data.data ?? []);
      setPagination(data.pagination ?? { total: 0, pages: 1 });
    } catch (err) {
      setError(errMsg(err, 'Impossible de charger les jeux'));
    } finally {
      setLoading(false);
    }
  }, [canView, filters, page]);

  useEffect(() => { if (activeTab === 'games') load(); }, [load, activeTab]);

  function setFilter(k, v) { setPage(1); setFilters((f) => ({ ...f, [k]: v })); }

  async function toggleActive(g) {
    setBusyId(g.id);
    try {
      if (g.is_active) await deactivateGame(g.id);
      else await activateGame(g.id);
      await load();
    } catch (err) {
      window.alert(errMsg(err, 'Échec du changement de statut'));
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    const g = toDelete;
    setToDelete(null);
    try {
      await deleteGame(g.id);
      await load();
    } catch (err) {
      if (err?.response?.status === 409) setRefusal({ game: g, message: errMsg(err), details: err.response.data.errors ?? {} });
      else window.alert(errMsg(err, 'Échec de la suppression'));
    }
  }

  async function deactivateInstead() {
    const g = refusal.game;
    setRefusal(null);
    try {
      await deactivateGame(g.id);
      await load();
    } catch (err) {
      window.alert(errMsg(err, 'Échec de la désactivation'));
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

  return (
    <div className="p-6">
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <Gamepad2 size={20} className="text-red-600" />
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Gamification</h1>
              <p className="text-xs text-gray-500">Roulettes et cartes à gratter : configuration des jeux et des lots, supervision des participations.</p>
            </div>
          </div>
          {canManage && activeTab === 'games' && (
            <button type="button" onClick={() => navigate('/offres/gamification/nouveau')}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
              <Plus size={16} /> Créer un jeu
            </button>
          )}
        </div>

        <div className="flex gap-1 border-b border-gray-100 px-6">
          {TABS.map((t) => (
            <button key={t.key} type="button" onClick={() => setActiveTab(t.key)}
              className={`-mb-px border-b-2 px-4 py-3 text-sm font-medium ${activeTab === t.key ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'games' && (
          <>
            <div className="flex flex-wrap items-center gap-3 px-6 py-4">
              <select value={filters.node_id} onChange={(e) => setFilter('node_id', e.target.value)} className={selectCls}>
                <option value="">Tous les nodes</option>
                {(lookups?.nodes ?? []).map((n) => <option key={n.id} value={n.id}>{n.code} — {n.name_fr}</option>)}
              </select>
              <select value={filters.game_type_id} onChange={(e) => setFilter('game_type_id', e.target.value)} className={selectCls}>
                <option value="">Tous types</option>
                {(lookups?.game_types ?? []).map((t) => <option key={t.id} value={t.id}>{t.name_fr}</option>)}
              </select>
              <select value={filters.status} onChange={(e) => setFilter('status', e.target.value)} className={selectCls}>
                {STATUS_FILTERS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <select value={filters.play_period_id} onChange={(e) => setFilter('play_period_id', e.target.value)} className={selectCls}>
                <option value="">Toutes périodes</option>
                {(lookups?.play_periods ?? []).map((p) => <option key={p.id} value={p.id}>{p.name_fr}</option>)}
              </select>
              <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Rechercher un jeu…" className={`${selectCls} w-52`} />
              <button type="button" onClick={load} className="ml-auto rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50" title="Rafraîchir"><RefreshCw size={16} /></button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-y border-gray-100 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <th className="whitespace-nowrap px-6 py-3 font-medium">Jeu (FR / AR)</th>
                    <th className="whitespace-nowrap px-4 py-3 font-medium">Type</th>
                    <th className="whitespace-nowrap px-4 py-3 font-medium">Node</th>
                    <th className="whitespace-nowrap px-4 py-3 font-medium">Condition</th>
                    <th className="whitespace-nowrap px-4 py-3 font-medium">Période</th>
                    <th className="whitespace-nowrap px-4 py-3 font-medium">Quota</th>
                    <th className="whitespace-nowrap px-4 py-3 font-medium">Validité</th>
                    <th className="whitespace-nowrap px-4 py-3 font-medium">Lots</th>
                    <th className="whitespace-nowrap px-4 py-3 font-medium">Parties</th>
                    <th className="whitespace-nowrap px-4 py-3 font-medium">Statut</th>
                    <th className="whitespace-nowrap px-6 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading && <tr><td colSpan={11} className="px-6 py-8 text-center text-gray-400">Chargement…</td></tr>}
                  {!loading && error && <tr><td colSpan={11} className="px-6 py-8 text-center text-red-500">{error}</td></tr>}
                  {!loading && !error && games.length === 0 && (
                    <tr><td colSpan={11} className="px-6 py-8 text-center text-gray-400">Aucun jeu trouvé.{canManage ? ' Cliquez sur « Créer un jeu » pour commencer.' : ''}</td></tr>
                  )}
                  {!loading && !error && games.map((g) => (
                    <tr key={g.id} className="cursor-pointer hover:bg-gray-50" onClick={() => navigate(`/offres/gamification/${g.id}`)}>
                      <td className="whitespace-nowrap px-6 py-3">
                        <div className="font-medium text-gray-900">{g.name_fr}</div>
                        <div className="text-xs text-gray-400" dir="rtl">{g.name_ar}</div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-600">{g.game_type?.name_fr}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-600">{g.node?.code ?? '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                        {g.unlock_condition?.name_fr ?? '—'}
                        {g.unlock_min_amount > 0 && <div className="text-xs text-gray-400">≥ {money(g.unlock_min_amount)}</div>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-600">{g.play_period?.name_fr}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-600">{g.max_plays_per_user} / {g.play_period?.code === 'lifetime' ? 'vie' : 'période'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-600">{fmtDate(g.starts_at)} → {g.ends_at ? fmtDate(g.ends_at) : 'sans fin'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                        {g.prizes_count}
                        {g.active_winning_prizes_count === 0 && <span className="ml-1 text-xs text-amber-600">(aucun lot gagnant actif)</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-600">{g.plays_count}</td>
                      <td className="whitespace-nowrap px-4 py-3"><StatusBadge status={g.status} /></td>
                      <td className="whitespace-nowrap px-6 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <button type="button" className="btn-icon-edit" onClick={() => navigate(`/offres/gamification/${g.id}`)}>
                            <Pencil size={14} /> {canManage ? 'Modifier' : 'Voir'}
                          </button>
                          {canManage && (
                            <>
                              <button type="button" disabled={busyId === g.id} onClick={() => toggleActive(g)}
                                className={`btn-icon ${g.is_active ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'} disabled:opacity-50`}>
                                <Power size={14} /> {g.is_active ? 'Désactiver' : 'Activer'}
                              </button>
                              <button type="button" className="btn-icon-delete" onClick={() => setToDelete(g)} title="Supprimer"><Trash2 size={14} /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination.pages > 1 && (
              <div className="flex items-center justify-between px-6 py-3 text-sm text-gray-500">
                <span>Page {page} / {pagination.pages} — {pagination.total} jeu(x)</span>
                <div className="flex gap-2">
                  <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-gray-200 px-3 py-1 disabled:opacity-40">Précédent</button>
                  <button type="button" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-gray-200 px-3 py-1 disabled:opacity-40">Suivant</button>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'plays' && (
          <div className="pb-4">
            <PlaysPanel nodes={lookups?.nodes ?? []} gameTypes={lookups?.game_types ?? []} />
          </div>
        )}
      </div>

      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="Supprimer le jeu ?" size="sm"
        footer={(
          <>
            <button type="button" className="btn-secondary" onClick={() => setToDelete(null)}>Annuler</button>
            <button type="button" className="btn-danger" onClick={confirmDelete}>Supprimer</button>
          </>
        )}>
        <p className="text-sm text-gray-600">
          « {toDelete?.name_fr} » sera retiré de la liste (suppression logique) ; l'historique des parties reste consultable.
          Refusé si une commande active contient un lot de ce jeu ou si un lot gagné n'est ni réclamé ni expiré.
        </p>
      </Modal>

      <Modal open={!!refusal} onClose={() => setRefusal(null)} title="Suppression refusée" size="sm"
        footer={(
          <>
            <button type="button" className="btn-secondary" onClick={() => setRefusal(null)}>Fermer</button>
            <button type="button" className="btn-secondary" onClick={() => navigate(`/offres/gamification/${refusal.game.id}`)}>Ouvrir le jeu</button>
            {refusal?.game?.is_active && <button type="button" className="btn-danger" onClick={deactivateInstead}>Désactiver à la place</button>}
          </>
        )}>
        {refusal && (
          <div className="space-y-2 text-sm text-gray-700">
            <p>{refusal.message}</p>
            {refusal.details.active_orders > 0 && <p className="rounded-lg bg-red-50 px-3 py-2">Verrou 1 : <strong>{refusal.details.active_orders}</strong> commande(s) active(s) liée(s).</p>}
            {refusal.details.unclaimed_prizes > 0 && <p className="rounded-lg bg-amber-50 px-3 py-2">Verrou 2 : <strong>{refusal.details.unclaimed_prizes}</strong> lot(s) gagné(s) non réclamé(s) et non expiré(s).</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
