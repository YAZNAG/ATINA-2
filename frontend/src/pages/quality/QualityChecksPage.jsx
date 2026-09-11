import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Download, ExternalLink, Filter, Plus, RefreshCw } from 'lucide-react';
import OrderDetailDrawer from '../commandes/OrderDetailDrawer';
import { useAuth } from '../../context/AuthContext';
import {
  getQualityChecks, exportQualityChecks, getQualityStats, getQualityCheck, getQualityLookups, getQualitySessionsLookup,
} from '../../api/quality.api';
import { getErrorMessage } from '../../utils/helpers';
import QualityCheckForm from './QualityCheckForm';
import {
  sessionRef, orderRef, fmtDateTime, fmtMinutes, downloadCsv, todayIso, daysAgoIso, SESSION_STATUS_STYLE,
} from '../picking/pickingUtils';

// Contrôles Qualité — onglets exacts du classeur.
const TABS = [
  { key: 'list',   label: 'Liste des contrôles' },
  { key: 'detail', label: 'Détail contrôle' },
];

const qcRef = (id) => 'QC-' + String(id ?? '').slice(0, 8).toUpperCase();
const EMPTY = { node_id: '', check_type_id: '', result: '', date_from: daysAgoIso(29), date_to: todayIso(), score_min: '', score_max: '' };
const LAST_KEY = 'quality.lastCheckId';
const readLast = () => { try { return sessionStorage.getItem(LAST_KEY); } catch { return null; } };
const writeLast = (id) => { try { sessionStorage.setItem(LAST_KEY, id); } catch { /* ignore */ } };

function ResultBadge({ result }) {
  if (!result) return null;
  const ok = result === 'ok';
  return <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{ok ? 'OK' : 'KO'}</span>;
}

// ── Onglet « Liste des contrôles » ───────────────────────────────────────────
function ChecksListTab({ lookups, onOpen, reloadKey }) {
  const [draft, setDraft] = useState(EMPTY);
  const [filters, setFilters] = useState(EMPTY);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, pages: 0 });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  const params = useMemo(() => {
    const p = {};
    Object.entries(filters).forEach(([k, v]) => { if (v !== '' && v != null) p[k] = v; });
    return p;
  }, [filters]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [r, s] = await Promise.all([getQualityChecks({ ...params, page, limit: 25 }), getQualityStats(params)]);
      setRows(r.data?.data ?? []);
      setPagination(r.data?.pagination ?? { total: 0, pages: 0 });
      setStats(s.data?.data ?? null);
    } catch (err) {
      setError(getErrorMessage(err)); setRows([]);
    } finally { setLoading(false); }
  }, [params, page]);

  useEffect(() => { load(); }, [load, reloadKey]);

  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const apply = (e) => { e?.preventDefault(); setPage(1); setFilters({ ...draft }); };
  const reset = () => { setDraft(EMPTY); setFilters(EMPTY); setPage(1); };

  const handleExport = async () => {
    setExporting(true);
    try {
      const r = await exportQualityChecks(params);
      const data = r.data?.data ?? [];
      if (!data.length) { toast('Aucun contrôle à exporter'); return; }
      downloadCsv(`controles-qualite-${todayIso()}.csv`, [
        { label: 'Contrôle', value: (q) => qcRef(q.id) },
        { label: 'Date', value: (q) => fmtDateTime(q.created_at) },
        { label: 'Node', value: (q) => q.node?.code ?? '' },
        { label: 'Type', value: (q) => q.check_type?.name_fr ?? '' },
        { label: 'Session', value: (q) => (q.picking_session_id ? sessionRef(q.picking_session_id) : '') },
        { label: 'Commande', value: (q) => (q.order_id ? orderRef(q.order_id) : '') },
        { label: 'Picker', value: (q) => q.picking_session?.picker?.name ?? '' },
        { label: 'Résultat', value: (q) => (q.result || '').toUpperCase() },
        { label: 'Score', value: (q) => q.score ?? '' },
        { label: 'Anomalies', value: (q) => q.anomalies ?? '' },
        { label: 'Notes', value: (q) => q.notes ?? '' },
        { label: 'Contrôleur', value: (q) => q.checker?.full_name ?? '' },
      ], data);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setExporting(false); }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={apply} className="card grid grid-cols-1 gap-3 !p-4 sm:grid-cols-2 lg:grid-cols-7">
        <div>
          <label className="form-label">Node</label>
          <select className="form-select" value={draft.node_id} onChange={(e) => set('node_id', e.target.value)}>
            <option value="">Tous</option>
            {(lookups.nodes ?? []).map((n) => <option key={n.id} value={n.id}>{n.code} · {n.name_fr}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Type</label>
          <select className="form-select" value={draft.check_type_id} onChange={(e) => set('check_type_id', e.target.value)}>
            <option value="">Tous</option>
            {(lookups.types ?? []).map((t) => <option key={t.id} value={t.id}>{t.name_fr}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Statut</label>
          <select className="form-select" value={draft.result} onChange={(e) => set('result', e.target.value)}>
            <option value="">OK et KO</option>
            <option value="ok">OK</option>
            <option value="ko">KO</option>
          </select>
        </div>
        <div>
          <label className="form-label">Du</label>
          <input type="date" className="form-input" value={draft.date_from} onChange={(e) => set('date_from', e.target.value)} />
        </div>
        <div>
          <label className="form-label">Au</label>
          <input type="date" className="form-input" value={draft.date_to} onChange={(e) => set('date_to', e.target.value)} />
        </div>
        <div>
          <label className="form-label">Score min / max</label>
          <div className="flex gap-1">
            <input type="number" min="0" max="100" className="form-input" value={draft.score_min} onChange={(e) => set('score_min', e.target.value)} placeholder="0" />
            <input type="number" min="0" max="100" className="form-input" value={draft.score_max} onChange={(e) => set('score_max', e.target.value)} placeholder="100" />
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <button type="submit" className="btn-danger"><Filter size={16} />Filtrer</button>
          <button type="button" className="btn-secondary" onClick={reset}>Réinitialiser</button>
        </div>
      </form>

      {/* Agrégats (US-070) */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            { l: 'Contrôles', v: stats.total },
            { l: 'OK', v: stats.ok, c: 'text-emerald-600' },
            { l: 'KO', v: stats.ko, c: 'text-rose-600' },
            { l: 'Taux de conformité', v: stats.ok_rate != null ? `${stats.ok_rate} %` : '—' },
            { l: 'Score moyen', v: stats.avg_score ?? '—' },
          ].map((k) => (
            <div key={k.l} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{k.l}</p>
              <p className={`mt-1 text-2xl font-semibold ${k.c ?? 'text-slate-800'}`}>{k.v}</p>
            </div>
          ))}
        </div>
      )}
      {stats?.by_type?.some((t) => t.total > 0) && (
        <div className="flex flex-wrap gap-2 text-xs">
          {stats.by_type.filter((t) => t.total > 0).map((t) => (
            <span key={t.check_type.id} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-600">
              <strong className="text-slate-800">{t.check_type.name_fr}</strong> · {t.total} contrôle(s) · {t.ok_rate ?? '—'} % OK · score moy. {t.avg_score ?? '—'}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">{pagination.total ?? 0} contrôle(s)</span>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={load} title="Rafraîchir"><RefreshCw size={16} /></button>
          <button type="button" className="btn-secondary" onClick={handleExport} disabled={exporting}><Download size={16} />{exporting ? 'Export…' : 'Exporter'}</button>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

      <div className="table-wrap">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="table-th">Contrôle</th>
                <th className="table-th">Date</th>
                <th className="table-th">Node</th>
                <th className="table-th">Type</th>
                <th className="table-th">Session</th>
                <th className="table-th">Résultat</th>
                <th className="table-th text-right">Score</th>
                <th className="table-th">Anomalies</th>
                <th className="table-th">Contrôleur</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={9} className="table-td py-10 text-center text-slate-400">Chargement…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} className="table-td py-10 text-center text-slate-400">Aucun contrôle qualité pour ces filtres.</td></tr>
              ) : rows.map((q) => (
                <tr key={q.id} className="cursor-pointer hover:bg-slate-50" onClick={() => onOpen(q.id)}>
                  <td className="table-td font-mono text-xs font-semibold text-slate-800">{qcRef(q.id)}</td>
                  <td className="table-td text-xs text-slate-500">{fmtDateTime(q.created_at)}</td>
                  <td className="table-td font-mono text-xs font-semibold">{q.node?.code}</td>
                  <td className="table-td">{q.check_type?.name_fr}</td>
                  <td className="table-td" onClick={(e) => e.stopPropagation()}>
                    {q.picking_session_id
                      ? <Link to={`/picking/sessions/${q.picking_session_id}`} className="font-mono text-xs text-red-600 hover:underline">{sessionRef(q.picking_session_id)}</Link>
                      : <span className="font-mono text-xs text-slate-500">{orderRef(q.order_id)}</span>}
                  </td>
                  <td className="table-td"><ResultBadge result={q.result} /></td>
                  <td className="table-td text-right font-semibold">{q.score ?? '—'}</td>
                  <td className="table-td max-w-[220px] truncate text-xs text-slate-500" title={q.anomalies ?? ''}>{q.anomalies ?? '—'}</td>
                  <td className="table-td text-xs text-slate-600">{q.checker?.full_name ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {pagination.pages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>Page {page} / {pagination.pages}</span>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Précédent</button>
            <button type="button" className="btn-secondary" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}>Suivant</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Onglet « Détail contrôle » ───────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-0.5 text-sm text-slate-800">{children}</div>
    </div>
  );
}

function CheckDetailTab({ checkId }) {
  const [check, setCheck] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [orderId, setOrderId] = useState(null);

  useEffect(() => {
    if (!checkId) return;
    setLoading(true); setError('');
    getQualityCheck(checkId)
      .then((r) => setCheck(r.data?.data ?? null))
      .catch((err) => { setError(getErrorMessage(err)); setCheck(null); })
      .finally(() => setLoading(false));
  }, [checkId]);

  if (!checkId) {
    return <div className="card text-center text-sm text-slate-500">Sélectionnez un contrôle dans l'onglet « Liste des contrôles » pour afficher son détail.</div>;
  }
  if (loading) return <div className="card text-center text-sm text-slate-400">Chargement du contrôle…</div>;
  if (error || !check) return <div className="card text-center text-sm text-red-600">{error || 'Contrôle introuvable'}</div>;

  const s = check.picking_session;
  const dur = s?.started_at && s?.completed_at ? Math.round((new Date(s.completed_at) - new Date(s.started_at)) / 60000) : null;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <OrderDetailDrawer orderId={orderId} onClose={() => setOrderId(null)} />
      <div className="card space-y-4 lg:col-span-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-mono text-lg font-semibold text-slate-800">{qcRef(check.id)}</h2>
          <ResultBadge result={check.result} />
          <span className="text-sm text-slate-500">{check.check_type?.name_fr}</span>
          {check.check_type?.name_ar && <span className="text-sm text-slate-400" dir="rtl">{check.check_type.name_ar}</span>}
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Field label="Résultat">{check.result === 'ok' ? 'Conforme (OK)' : 'Non conforme (KO)'}</Field>
          <Field label="Score">{check.score != null ? `${check.score} / 100` : '—'}</Field>
          <Field label="Date du contrôle">{fmtDateTime(check.created_at)}</Field>
          <Field label="Node">{check.node ? `${check.node.code} · ${check.node.name_fr}` : '—'}</Field>
          <Field label="Contrôleur">{check.checker?.full_name ?? '—'}{check.checker?.email ? <span className="block text-xs text-slate-400">{check.checker.email}</span> : null}</Field>
          <Field label="Commande">
            {check.order_id ? (
              <button type="button" className="font-mono font-semibold text-red-600 hover:underline" onClick={() => setOrderId(check.order_id)}>{orderRef(check.order_id)}</button>
            ) : '—'}
            {check.order?.customer?.name ? <span className="block text-xs text-slate-400">{check.order.customer.name}</span> : null}
          </Field>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Anomalies</p>
          <p className={`mt-1 whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${check.anomalies ? 'bg-rose-50 text-rose-800' : 'bg-slate-50 text-slate-400'}`}>{check.anomalies || 'Aucune anomalie signalée'}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Notes</p>
          <p className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{check.notes || '—'}</p>
        </div>
      </div>

      <div className="card space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">Session de préparation liée</h3>
        {s ? (
          <>
            <Link to={`/picking/sessions/${s.id}`} className="inline-flex items-center gap-1 font-mono text-sm font-semibold text-red-600 hover:underline">
              {sessionRef(s.id)} <ExternalLink size={13} />
            </Link>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SESSION_STATUS_STYLE[s.status?.code] ?? 'bg-slate-100 text-slate-600'}`}>{s.status?.name_fr}</span>
              {s.node?.code && <span className="font-mono text-xs text-slate-500">{s.node.code}</span>}
            </div>
            <Field label="Picker">{s.picker ? <Link to={`/staff/pickers/${s.picker.id}`} className="hover:text-red-600">{s.picker.name}</Link> : 'Non assigné'}</Field>
            <Field label="Début → fin">{fmtDateTime(s.started_at)} → {fmtDateTime(s.completed_at)}</Field>
            <Field label="Durée">{fmtMinutes(dur)}</Field>
            <Field label="Lignes / erreurs de scan">{s._count?.items ?? 0} ligne(s) · {s.error_count ?? 0} erreur(s)</Field>
          </>
        ) : (
          <p className="text-sm text-slate-400">Contrôle réalisé directement sur la commande (aucune session liée).</p>
        )}
      </div>
    </div>
  );
}

/**
 * Page « Contrôles Qualité » (US-069 / US-070).
 * Routes : /quality/checks (?tab=detail, ?new=1&session=<id>) et /quality/checks/:id.
 */
export default function QualityChecksPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('quality_checks.create');

  const activeTab = id || searchParams.get('tab') === 'detail' ? 'detail' : 'list';
  const [lookups, setLookups] = useState({ types: [], nodes: [] });
  const [formOpen, setFormOpen] = useState(false);
  const [initialSession, setInitialSession] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    getQualityLookups().then((r) => setLookups(r.data?.data ?? { types: [], nodes: [] })).catch((err) => toast.error(getErrorMessage(err)));
  }, []);
  useEffect(() => { if (id) writeLast(id); }, [id]);

  // Ouverture directe du formulaire depuis une session de picking (?new=1&session=<id>)
  useEffect(() => {
    if (searchParams.get('new') !== '1' || !canCreate) return;
    const sid = searchParams.get('session');
    const open = (sess) => { setInitialSession(sess); setFormOpen(true); };
    if (sid) {
      getQualitySessionsLookup({ id: sid }).then((r) => open(r.data?.data?.[0] ?? null)).catch(() => open(null));
    } else open(null);
    const next = new URLSearchParams(searchParams); next.delete('new'); next.delete('session');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, canCreate]);

  const openCheck = (cid) => { writeLast(cid); navigate(`/quality/checks/${cid}`); };
  const goTab = (key) => {
    if (key === 'detail') {
      const last = id || readLast();
      navigate(last ? `/quality/checks/${last}` : '/quality/checks?tab=detail');
    } else navigate('/quality/checks');
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Contrôles Qualité</h1>
          <p className="page-subtitle">Conformité des préparations avant livraison : résultat OK/KO, score, anomalies, session liée.</p>
        </div>
        {canCreate && (
          <button type="button" className="btn-danger" onClick={() => { setInitialSession(null); setFormOpen(true); }}>
            <Plus size={16} />Nouveau contrôle
          </button>
        )}
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => goTab(t.key)}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition ${
              activeTab === t.key ? 'border-red-600 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'list' && <ChecksListTab lookups={lookups} onOpen={openCheck} reloadKey={reloadKey} />}
      {activeTab === 'detail' && <CheckDetailTab checkId={id || null} />}

      <QualityCheckForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        lookups={lookups}
        initialSession={initialSession}
        onCreated={(created) => {
          setFormOpen(false);
          toast.success('Contrôle qualité enregistré');
          setReloadKey((k) => k + 1);
          if (created?.id) openCheck(created.id);
        }}
      />
    </div>
  );
}
