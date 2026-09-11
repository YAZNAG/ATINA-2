import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Eye, RefreshCw } from 'lucide-react';
import Modal from '../../../components/Modal';
import { getPlays, exportPlays, getPlay, getGames, getGame } from '../../../api/gamification.api';
import { CLAIM_STATUS, errMsg, fmtDateTime, money, downloadCsv } from './gamificationUtils';

const selectCls = 'rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200';

function ResultBadge({ result }) {
  return result === 'win'
    ? <span className="inline-flex rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Gagné</span>
    : <span className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">Perdu</span>;
}

function ClaimBadge({ status }) {
  if (!status) return <span className="text-gray-300">—</span>;
  const s = CLAIM_STATUS[status];
  return <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

const CSV_COLUMNS = [
  { key: 'played_at', label: 'Date de la partie', value: (r) => fmtDateTime(r.played_at) },
  { key: 'game', label: 'Jeu' },
  { key: 'game_type', label: 'Type de jeu' },
  { key: 'node', label: 'Node' },
  { key: 'unlock_condition', label: 'Condition' },
  { key: 'customer', label: 'Client' },
  { key: 'customer_phone', label: 'Téléphone' },
  { key: 'result', label: 'Résultat' },
  { key: 'prize', label: 'Lot' },
  { key: 'prize_type', label: 'Type de lot' },
  { key: 'claim_status', label: 'Réclamation' },
  { key: 'claimed_at', label: 'Réclamé le', value: (r) => (r.claimed_at ? fmtDateTime(r.claimed_at) : '') },
  { key: 'expires_at', label: 'Expire le', value: (r) => (r.expires_at ? fmtDateTime(r.expires_at) : '') },
  { key: 'order_id', label: 'Commande liée' },
  { key: 'order_status', label: 'Statut commande' },
  { key: 'order_total', label: 'Total commande (MAD)' },
];

/** Détail de la session de jeu (lecture seule). */
function PlayDetailModal({ playId, onClose }) {
  const [play, setPlay] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!playId) return;
    setPlay(null);
    setError(null);
    getPlay(playId)
      .then(({ data }) => setPlay(data.data))
      .catch((err) => setError(errMsg(err, 'Impossible de charger la participation')));
  }, [playId]);

  const Row = ({ label, children }) => (
    <div className="grid grid-cols-3 gap-3 border-b border-gray-50 py-2 text-sm">
      <div className="text-gray-500">{label}</div>
      <div className="col-span-2 text-gray-800">{children}</div>
    </div>
  );

  return (
    <Modal open={!!playId} onClose={onClose} title="Détail de la session" subtitle={playId} size="md"
      footer={<button type="button" className="btn-secondary" onClick={onClose}>Fermer</button>}>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!error && !play && <p className="text-sm text-gray-400">Chargement…</p>}
      {play && (
        <div>
          <Row label="Jeu">{play.game?.name_fr} <span className="text-gray-400">({play.game?.game_type?.name_fr})</span></Row>
          <Row label="Node">{play.game?.node?.code ?? '—'}</Row>
          <Row label="Condition">{play.game?.unlock_condition?.name_fr ?? '—'}</Row>
          <Row label="Client">{play.customer?.name} — {play.customer?.phone_country}{play.customer?.phone_number}</Row>
          <Row label="Date de la partie">{fmtDateTime(play.played_at)}</Row>
          <Row label="Résultat"><ResultBadge result={play.result} /></Row>
          <Row label="Lot">
            {play.prize ? (
              <span>{play.prize.name_fr} <span className="text-gray-400">({play.prize.prize_type?.name_fr})</span>
                <span className="ml-2 text-xs text-gray-500">attribués {play.prize.awarded_count}{play.prize.stock_limit ? ` / ${play.prize.stock_limit}` : ' (illimité)'}</span>
              </span>
            ) : '—'}
          </Row>
          <Row label="Réclamation"><ClaimBadge status={play.claim_status} /> {play.claimed_at && <span className="ml-2 text-xs text-gray-500">le {fmtDateTime(play.claimed_at)}</span>}</Row>
          <Row label="Expiration">{fmtDateTime(play.expires_at)}</Row>
          <Row label="Commande liée">
            {play.order ? `#${play.order.id.slice(0, 8).toUpperCase()} — ${play.order.status?.name_fr ?? ''} — ${money(play.order.total_ttc)}` : <span className="text-gray-400">Aucune commande (normal pour inscription / connexion)</span>}
          </Row>
          <Row label="Transaction de points">
            {play.points_transactions?.length
              ? play.points_transactions.map((t) => <div key={t.id}>+{t.points} pts (solde {t.balance_after}) — {fmtDateTime(t.created_at)}</div>)
              : '—'}
          </Row>
          <Row label="Code promo généré">
            {play.promocodes?.length
              ? play.promocodes.map((c) => (
                <div key={c.id}>
                  <span className="font-mono font-semibold">{c.code}</span> — {c.promo_type?.code === 'PERCENTAGE' ? `-${c.value}%` : `-${money(c.value)}`}
                  {' '}· utilisations {c.uses_count}/{c.uses_max ?? '∞'} · valable jusqu'au {fmtDateTime(c.valid_to)}
                </div>
              ))
              : '—'}
          </Row>
          <Row label="Lignes de commande">
            {play.order_items?.length
              ? play.order_items.map((i) => <div key={i.id}>{i.sku_code ? `${i.sku_code} — ${i.sku_name}` : i.pack_name} × {i.qty} ({i.order_status})</div>)
              : '—'}
          </Row>
          <p className="mt-3 text-xs text-gray-400">Participation en lecture seule : game_plays est alimenté par l'app cliente, aucune correction n'est possible depuis le back-office.</p>
        </div>
      )}
    </Modal>
  );
}

/**
 * Participations (supervision) — LECTURE SEULE.
 * @param {object}  props
 * @param {string}  [props.gameId]   jeu imposé (onglet « Participations » de l'écran jeu)
 * @param {Array}   [props.prizes]   lots du jeu imposé (filtre Lot)
 * @param {Array}   [props.nodes]    nodes (filtre global)
 * @param {Array}   [props.gameTypes] types de jeu (filtre global)
 * @param {object}  [props.initialFilters]
 */
export default function PlaysPanel({ gameId = null, prizes = null, nodes = [], gameTypes = [], initialFilters = {} }) {
  const scoped = !!gameId;
  const [filters, setFilters] = useState({
    node_id: '', game_id: '', game_type_id: '', customer: '', result: '', prize_id: '', claim_status: '', date_from: '', date_to: '', has_active_order: '',
    ...initialFilters,
  });
  const [customerInput, setCustomerInput] = useState(initialFilters.customer ?? '');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [games, setGames] = useState([]);
  const [gamePrizes, setGamePrizes] = useState([]);

  useEffect(() => {
    setFilters((f) => ({ ...f, ...initialFilters }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initialFilters)]);

  // Liste des jeux (filtre global)
  useEffect(() => {
    if (scoped) return;
    getGames({ limit: 200, node_id: filters.node_id || undefined })
      .then(({ data }) => setGames(data.data ?? []))
      .catch(() => setGames([]));
  }, [scoped, filters.node_id]);

  // Lots du jeu sélectionné (filtre Lot)
  useEffect(() => {
    if (scoped) { setGamePrizes(prizes ?? []); return; }
    if (!filters.game_id) { setGamePrizes([]); return; }
    getGame(filters.game_id)
      .then(({ data }) => setGamePrizes(data.data?.prizes ?? []))
      .catch(() => setGamePrizes([]));
  }, [scoped, prizes, filters.game_id]);

  // Recherche client : saisie différée
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.customer === customerInput ? f : { ...f, customer: customerInput })), 400);
    return () => clearTimeout(t);
  }, [customerInput]);

  const params = useMemo(() => {
    const p = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) p[k] = v; });
    if (scoped) { p.game_id = gameId; delete p.node_id; delete p.game_type_id; }
    return p;
  }, [filters, scoped, gameId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await getPlays({ ...params, page, limit: 25 });
      setRows(data.data ?? []);
      setPagination(data.pagination ?? { total: 0, pages: 1 });
      setSummary(data.summary ?? null);
    } catch (err) {
      setError(errMsg(err, 'Impossible de charger les participations'));
    } finally {
      setLoading(false);
    }
  }, [params, page]);

  useEffect(() => { load(); }, [load]);

  function setFilter(key, value) {
    setPage(1);
    setFilters((f) => {
      const next = { ...f, [key]: value };
      if (key === 'game_id') next.prize_id = '';
      if (key === 'node_id' && !scoped) { next.game_id = ''; next.prize_id = ''; }
      return next;
    });
  }

  function resetFilters() {
    setPage(1);
    setCustomerInput('');
    setFilters({ node_id: '', game_id: '', game_type_id: '', customer: '', result: '', prize_id: '', claim_status: '', date_from: '', date_to: '', has_active_order: '' });
  }

  async function handleExport() {
    setExporting(true);
    try {
      const { data } = await exportPlays(params);
      const list = data.data ?? [];
      if (list.length === 0) { window.alert('Aucune participation à exporter pour ces filtres.'); return; }
      const stamp = new Date().toISOString().slice(0, 10);
      downloadCsv(`participations-gamification-${stamp}.csv`, CSV_COLUMNS, list);
    } catch (err) {
      window.alert(errMsg(err, "Échec de l'export"));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 px-6 py-4">
        {!scoped && (
          <>
            <select value={filters.node_id} onChange={(e) => setFilter('node_id', e.target.value)} className={selectCls}>
              <option value="">Tous les nodes</option>
              {nodes.map((n) => <option key={n.id} value={n.id}>{n.code} — {n.name_fr}</option>)}
            </select>
            <select value={filters.game_id} onChange={(e) => setFilter('game_id', e.target.value)} className={selectCls}>
              <option value="">Tous les jeux</option>
              {games.map((g) => <option key={g.id} value={g.id}>{g.name_fr}</option>)}
            </select>
            <select value={filters.game_type_id} onChange={(e) => setFilter('game_type_id', e.target.value)} className={selectCls}>
              <option value="">Tous types de jeu</option>
              {gameTypes.map((t) => <option key={t.id} value={t.id}>{t.name_fr}</option>)}
            </select>
          </>
        )}
        <input value={customerInput} onChange={(e) => { setPage(1); setCustomerInput(e.target.value); }} placeholder="Client (nom ou téléphone)" className={`${selectCls} w-56`} />
        <select value={filters.result} onChange={(e) => setFilter('result', e.target.value)} className={selectCls}>
          <option value="">Tous résultats</option>
          <option value="win">Gagné (win)</option>
          <option value="lose">Perdu (lose)</option>
        </select>
        <select value={filters.prize_id} onChange={(e) => setFilter('prize_id', e.target.value)} className={selectCls} disabled={!scoped && !filters.game_id} title={!scoped && !filters.game_id ? "Choisissez d'abord un jeu" : undefined}>
          <option value="">Tous les lots</option>
          {gamePrizes.map((p) => <option key={p.id} value={p.id}>{p.name_fr}</option>)}
        </select>
        <select value={filters.claim_status} onChange={(e) => setFilter('claim_status', e.target.value)} className={selectCls}>
          <option value="">Toutes réclamations</option>
          <option value="claimed">Réclamé</option>
          <option value="pending">En attente</option>
          <option value="expired">Expiré</option>
        </select>
        <label className="flex items-center gap-1 text-xs text-gray-500">Du
          <input type="date" value={filters.date_from} onChange={(e) => setFilter('date_from', e.target.value)} className={selectCls} />
        </label>
        <label className="flex items-center gap-1 text-xs text-gray-500">au
          <input type="date" value={filters.date_to} onChange={(e) => setFilter('date_to', e.target.value)} className={selectCls} />
        </label>
        {filters.has_active_order === 'true' && (
          <span className="inline-flex items-center gap-2 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700">
            Avec commande active
            <button type="button" className="font-bold" onClick={() => setFilter('has_active_order', '')}>×</button>
          </span>
        )}
        <button type="button" onClick={resetFilters} className="text-sm text-gray-500 hover:text-gray-800">Réinitialiser</button>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={load} className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50" title="Rafraîchir"><RefreshCw size={16} /></button>
          <button type="button" onClick={handleExport} disabled={exporting} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            <Download size={16} /> {exporting ? 'Export…' : 'Exporter'}
          </button>
        </div>
      </div>

      {summary && (
        <div className="flex gap-6 px-6 pb-3 text-xs text-gray-500">
          <span><strong className="text-gray-800">{summary.total}</strong> partie(s)</span>
          <span><strong className="text-emerald-700">{summary.wins}</strong> gagnée(s)</span>
          <span><strong className="text-gray-700">{summary.losses}</strong> perdue(s)</span>
          <span className="italic">Lecture seule — alimenté par l'app cliente</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-y border-gray-100 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <th className="whitespace-nowrap px-6 py-3 font-medium">Date de la partie</th>
              {!scoped && <th className="whitespace-nowrap px-4 py-3 font-medium">Jeu</th>}
              {!scoped && <th className="whitespace-nowrap px-4 py-3 font-medium">Type</th>}
              {!scoped && <th className="whitespace-nowrap px-4 py-3 font-medium">Node</th>}
              <th className="whitespace-nowrap px-4 py-3 font-medium">Client</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">Résultat</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">Lot</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">Réclamation</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">Expire le</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">Commande liée</th>
              <th className="whitespace-nowrap px-6 py-3 font-medium">Détail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && <tr><td colSpan={11} className="px-6 py-8 text-center text-gray-400">Chargement…</td></tr>}
            {!loading && error && <tr><td colSpan={11} className="px-6 py-8 text-center text-red-500">{error}</td></tr>}
            {!loading && !error && rows.length === 0 && (
              <tr><td colSpan={11} className="px-6 py-8 text-center text-gray-400">Aucune participation pour ces filtres.</td></tr>
            )}
            {!loading && !error && rows.map((r) => (
              <tr key={r.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setDetailId(r.id)}>
                <td className="whitespace-nowrap px-6 py-3 text-gray-700">{fmtDateTime(r.played_at)}</td>
                {!scoped && <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">{r.game?.name_fr}{r.game?.is_deleted && <span className="ml-1 text-xs text-gray-400">(supprimé)</span>}</td>}
                {!scoped && <td className="whitespace-nowrap px-4 py-3 text-gray-600">{r.game?.game_type?.name_fr}</td>}
                {!scoped && <td className="whitespace-nowrap px-4 py-3 text-gray-600">{r.game?.node?.code ?? '—'}</td>}
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="text-gray-900">{r.customer?.name}</div>
                  <div className="text-xs text-gray-400">{r.customer?.phone_country}{r.customer?.phone_number}</div>
                </td>
                <td className="whitespace-nowrap px-4 py-3"><ResultBadge result={r.result} /></td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-700">{r.prize ? r.prize.name_fr : <span className="text-gray-300">—</span>}</td>
                <td className="whitespace-nowrap px-4 py-3"><ClaimBadge status={r.claim_status} /></td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-600">{r.expires_at ? fmtDateTime(r.expires_at) : '—'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-600">{r.order ? `#${r.order.id.slice(0, 8).toUpperCase()}` : ''}</td>
                <td className="whitespace-nowrap px-6 py-3">
                  <button type="button" className="btn-icon-edit" onClick={(e) => { e.stopPropagation(); setDetailId(r.id); }}><Eye size={14} /> Voir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination.pages > 1 && (
        <div className="flex items-center justify-between px-6 py-3 text-sm text-gray-500">
          <span>Page {page} / {pagination.pages} — {pagination.total} résultat(s)</span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-gray-200 px-3 py-1 disabled:opacity-40">Précédent</button>
            <button type="button" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-gray-200 px-3 py-1 disabled:opacity-40">Suivant</button>
          </div>
        </div>
      )}

      <PlayDetailModal playId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}
