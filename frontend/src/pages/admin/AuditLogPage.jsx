import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Download, Eye, Filter, Loader2, RotateCcw, ScrollText, Bell } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/Modal';
import {
  getAuditLogs, getAuditLogFacets, exportAuditLogs,
  getNotificationLogs, getNotificationFacets, exportNotificationLogs,
  downloadBlob,
} from '../../api/admin.api';
import { getErrorMessage } from '../../utils/helpers';

/**
 * Admin / Configuration > Log & Audit
 * Tables append-only : LECTURE SEULE (aucune action d'écriture).
 * Onglets : « Journal d'audit » (audit_logs) et « Notifications (log) » (notifications).
 */

const TABS = [
  { key: 'audit', label: "Journal d'audit", perm: 'audit_logs.view', icon: ScrollText },
  { key: 'notifications', label: 'Notifications (log)', perm: 'notifications.view', icon: Bell },
];

const PAGE_SIZE = 50;

const fmtDateTime = (d) => (d
  ? new Date(d).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  : '—');

const ACTION_LABELS = {
  CREATE: 'Création',
  UPDATE: 'Modification',
  DELETE: 'Suppression',
  ACTIVATE: 'Activation',
  DEACTIVATE: 'Désactivation',
  RESTORE: 'Restauration',
  EXPORT: 'Export',
  CONFIG_CHANGE: 'Changement de config',
  MOVE_CITY: 'Déplacement de ville',
  MAP_SKU: 'Mapping SKU',
  UNMAP_SKU: 'Retrait mapping SKU',
  BULK_CREATE: 'Création en lot',
  UPDATE_MIN_ORDER_AMOUNT: 'Modif. minimum de commande',
  LOGIN: 'Connexion',
  LOGOUT: 'Déconnexion',
};
const actionLabel = (a) => ACTION_LABELS[a] || a;

/** Les libellés FR/AR viennent des référentiels audit_actions / audit_resources. */
const refLabel = (ref, fallback) => ref?.name_fr || ACTION_LABELS[ref?.code] || ref?.code || fallback || '—';
const refCode = (ref) => ref?.code || '';

const actionTone = (a = '') => {
  if (/DELETE|UNMAP|REFUSED|DEACTIVATE|BLOCK|CANCEL/.test(a)) return 'bg-red-50 text-red-700 ring-red-100';
  if (/CREATE|ACTIVATE|RESTORE|MAP_SKU/.test(a)) return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
  if (/UPDATE|CHANGE|MOVE|ADJUST/.test(a)) return 'bg-amber-50 text-amber-700 ring-amber-100';
  return 'bg-zinc-100 text-zinc-700 ring-zinc-200';
};

const show = (v) => {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'Oui' : 'Non';
  if (typeof v === 'object') return JSON.stringify(v, null, 2);
  return String(v);
};

const clean = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v !== null && v !== undefined));

/** Chargement paginé par curseur (liste + « Charger plus »). */
function useCursorList(fetcher, filters) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await fetcher({ ...clean(filters), limit: PAGE_SIZE });
      setRows(data.data || []);
      setTotal(data.pagination?.total ?? null);
      setCursor(data.pagination?.next_cursor || null);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setRows([]);
      setTotal(null);
      setCursor(null);
    } finally {
      setLoading(false);
    }
  }, [fetcher, filters]);

  useEffect(() => { load(); }, [load]);

  const loadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const { data } = await fetcher({ ...clean(filters), limit: PAGE_SIZE, cursor });
      setRows((prev) => [...prev, ...(data.data || [])]);
      setCursor(data.pagination?.next_cursor || null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  };

  return { rows, total, cursor, loading, loadingMore, loadMore };
}

function CountLine({ loading, total, shown, noun }) {
  if (loading) return <p className="text-sm text-zinc-500">Chargement…</p>;
  const t = total ?? shown;
  return (
    <p className="text-sm text-zinc-500">
      {t} {noun}{shown < t ? ` — ${shown} affiché(s)` : ''}
    </p>
  );
}

function LoadMore({ cursor, loading, loadingMore, onClick }) {
  if (!cursor || loading) return null;
  return (
    <div className="flex justify-center">
      <button type="button" className="btn-secondary inline-flex items-center gap-1.5" onClick={onClick} disabled={loadingMore}>
        {loadingMore && <Loader2 size={15} className="animate-spin" />}Charger plus
      </button>
    </div>
  );
}

function ExportButton({ onClick, busy }) {
  return (
    <button type="button" className="btn-secondary inline-flex items-center gap-1.5" onClick={onClick} disabled={busy}>
      {busy ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}Exporter
    </button>
  );
}

function FilterActions({ onReset }) {
  return (
    <div className="flex items-end gap-2">
      <button type="submit" className="btn-primary inline-flex items-center gap-1.5"><Filter size={15} />Filtrer</button>
      <button type="button" className="btn-secondary inline-flex items-center gap-1.5" onClick={onReset}><RotateCcw size={15} />Réinitialiser</button>
    </div>
  );
}

/* ───────────────────────── Modale avant / après ───────────────────────── */

function AuditDetailModal({ log, onClose }) {
  const rows = useMemo(() => {
    if (!log) return [];
    const before = log.old_values && typeof log.old_values === 'object' ? log.old_values : {};
    const after = log.new_values && typeof log.new_values === 'object' ? log.new_values : {};
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
    return keys.map((k) => ({
      key: k,
      before: before[k],
      after: after[k],
      changed: JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null),
    }));
  }, [log]);

  return (
    <Modal
      open={Boolean(log)}
      onClose={onClose}
      size="lg"
      title="Détail de l'événement d'audit"
      subtitle={log ? `${refLabel(log.action)} — ${refLabel(log.resource)}${log.target_id ? ` #${log.target_id}` : ''}` : ''}
      footer={<button type="button" className="btn-secondary" onClick={onClose}>Fermer</button>}
    >
      {log && (
        <div className="space-y-4">
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div><dt className="form-label">Date</dt><dd className="text-zinc-800">{fmtDateTime(log.created_at)}</dd></div>
            <div>
              <dt className="form-label">Auteur</dt>
              <dd className="text-zinc-800">
                {log.user ? `${log.user.full_name} (${log.user.email})` : log.user_id ? `Utilisateur #${log.user_id}` : 'Système'}
              </dd>
            </div>
            <div>
              <dt className="form-label">Action</dt>
              <dd className="text-zinc-800">
                {refLabel(log.action)} <span className="font-mono text-xs text-zinc-400">({refCode(log.action)})</span>
                {log.action?.name_ar && <p dir="rtl" className="text-xs text-zinc-400">{log.action.name_ar}</p>}
              </dd>
            </div>
            <div>
              <dt className="form-label">Entité</dt>
              <dd className="text-zinc-800">
                {refLabel(log.resource)} <span className="font-mono text-xs text-zinc-400">({refCode(log.resource)})</span>
                {log.resource?.name_ar && <p dir="rtl" className="text-xs text-zinc-400">{log.resource.name_ar}</p>}
              </dd>
            </div>
            <div>
              <dt className="form-label">Enregistrement concerné</dt>
              <dd className="font-mono text-xs text-zinc-800">{log.target_id || '—'}</dd>
            </div>
            <div><dt className="form-label">Adresse IP</dt><dd className="font-mono text-zinc-800">{log.ip || '—'}</dd></div>
            <div>
              <dt className="form-label">Navigateur</dt>
              <dd className="truncate text-xs text-zinc-500" title={log.user_agent || ''}>{log.user_agent || '—'}</dd>
            </div>
          </dl>

          <div>
            <p className="form-label">Avant / Après</p>
            {rows.length === 0 ? (
              <p className="rounded-lg border border-dashed border-zinc-200 px-4 py-6 text-center text-sm text-zinc-400">
                Aucune valeur enregistrée pour cet événement.
              </p>
            ) : (
              <div className="table-wrap overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr>
                      <th className="table-th">Champ</th>
                      <th className="table-th">Avant</th>
                      <th className="table-th">Après</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.key} className={r.changed ? 'bg-amber-50/40' : ''}>
                        <td className="table-td font-mono text-xs text-zinc-600">{r.key}</td>
                        <td className="table-td">
                          <pre className="whitespace-pre-wrap break-all font-mono text-xs text-red-700">{show(r.before)}</pre>
                        </td>
                        <td className="table-td">
                          <pre className="whitespace-pre-wrap break-all font-mono text-xs text-emerald-700">{show(r.after)}</pre>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ───────────────────────── Onglet Journal d'audit ───────────────────────── */

const EMPTY_AUDIT_FILTERS = { user_id: '', resource: '', action: '', target_id: '', search: '', date_from: '', date_to: '' };

function AuditTab() {
  const [facets, setFacets] = useState({ users: [], resources: [], actions: [] });
  const [draft, setDraft] = useState(EMPTY_AUDIT_FILTERS);
  const [filters, setFilters] = useState(EMPTY_AUDIT_FILTERS);
  const [exporting, setExporting] = useState(false);
  const [detail, setDetail] = useState(null);
  const { rows, total, cursor, loading, loadingMore, loadMore } = useCursorList(getAuditLogs, filters);

  useEffect(() => {
    getAuditLogFacets()
      .then(({ data }) => setFacets(data.data || { users: [], resources: [], actions: [] }))
      .catch(() => {});
  }, []);

  const apply = (e) => {
    e?.preventDefault();
    if (draft.date_from && draft.date_to && draft.date_from > draft.date_to) {
      toast.error('La date de début doit précéder la date de fin');
      return;
    }
    setFilters({ ...draft });
  };
  const reset = () => { setDraft(EMPTY_AUDIT_FILTERS); setFilters(EMPTY_AUDIT_FILTERS); };

  const doExport = async () => {
    setExporting(true);
    try {
      const res = await exportAuditLogs(clean(filters));
      downloadBlob(res, 'journal_audit.csv');
      toast.success('Export généré');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      <form onSubmit={apply} className="card grid grid-cols-1 gap-3 p-4 md:grid-cols-4">
        <div>
          <label className="form-label">Utilisateur</label>
          <select className="form-select" value={draft.user_id} onChange={set('user_id')}>
            <option value="">Tous</option>
            {facets.users.map((u) => (
              <option key={u.id} value={u.id}>{u.full_name}{u.email ? ` — ${u.email}` : ''} ({u.count})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">Entité / Table</label>
          <select className="form-select" value={draft.resource} onChange={set('resource')}>
            <option value="">Toutes</option>
            {facets.resources.map((r) => <option key={r.value} value={r.value}>{r.name_fr || r.value} ({r.count})</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Action</label>
          <select className="form-select" value={draft.action} onChange={set('action')}>
            <option value="">Toutes</option>
            {facets.actions.map((a) => <option key={a.value} value={a.value}>{a.name_fr || actionLabel(a.value)} ({a.count})</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Enregistrement</label>
          <input className="form-input" value={draft.target_id} onChange={set('target_id')} placeholder="Identifiant de l'enregistrement" />
        </div>
        <div>
          <label className="form-label">Du</label>
          <input type="date" className="form-input" value={draft.date_from} onChange={set('date_from')} />
        </div>
        <div>
          <label className="form-label">Au</label>
          <input type="date" className="form-input" value={draft.date_to} onChange={set('date_to')} />
        </div>
        <div>
          <label className="form-label">Recherche</label>
          <input className="form-input" value={draft.search} onChange={set('search')} placeholder="Auteur, entité, action…" />
        </div>
        <FilterActions onReset={reset} />
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <CountLine loading={loading} total={total} shown={rows.length} noun="événement(s)" />
        <ExportButton onClick={doExport} busy={exporting} />
      </div>

      <div className="table-wrap overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="table-th">Date</th>
              <th className="table-th">Auteur</th>
              <th className="table-th">Action</th>
              <th className="table-th">Entité</th>
              <th className="table-th">Enregistrement</th>
              <th className="table-th">IP</th>
              <th className="table-th text-right">Avant / Après</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="table-td py-10 text-center text-zinc-400"><Loader2 className="mx-auto animate-spin" size={20} /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="table-td py-10 text-center text-zinc-400">Aucun événement d'audit pour ces critères.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="hover:bg-zinc-50">
                <td className="table-td whitespace-nowrap text-zinc-600">{fmtDateTime(r.created_at)}</td>
                <td className="table-td">
                  {r.user ? (
                    <div>
                      <p className="font-medium text-zinc-800">{r.user.full_name}</p>
                      <p className="text-xs text-zinc-400">{r.user.email}</p>
                    </div>
                  ) : <span className="text-zinc-400">{r.user_id ? `#${r.user_id}` : 'Système'}</span>}
                </td>
                <td className="table-td">
                  <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ${actionTone(refCode(r.action))}`}>
                    {refLabel(r.action)}
                  </span>
                </td>
                <td className="table-td text-zinc-700">
                  {refLabel(r.resource)}
                  <p className="font-mono text-[11px] text-zinc-400">{refCode(r.resource)}</p>
                </td>
                <td className="table-td max-w-[180px] truncate font-mono text-xs text-zinc-500" title={r.target_id || ''}>{r.target_id || '—'}</td>
                <td className="table-td font-mono text-xs text-zinc-500">{r.ip || '—'}</td>
                <td className="table-td text-right">
                  <button type="button" onClick={() => setDetail(r)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50">
                    <Eye size={14} />Voir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <LoadMore cursor={cursor} loading={loading} loadingMore={loadingMore} onClick={loadMore} />
      <AuditDetailModal log={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

/* ───────────────────────── Onglet Notifications (log) ───────────────────────── */

const EMPTY_NOTIF_FILTERS = { type_id: '', event_code: '', channel_id: '', status_id: '', is_read: '', search: '', date_from: '', date_to: '' };

/** Couleurs des statuts du référentiel notification_statuses. */
const NOTIF_STATUS_STYLE = {
  pending: 'bg-amber-50 text-amber-700',
  sent: 'bg-blue-50 text-blue-700',
  delivered: 'bg-indigo-50 text-indigo-700',
  read: 'bg-emerald-50 text-emerald-700',
  failed: 'bg-red-50 text-red-600',
};

function NotifStatusBadge({ status }) {
  if (!status) return <span className="text-xs text-zinc-400">—</span>;
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${NOTIF_STATUS_STYLE[status.code] || 'bg-zinc-100 text-zinc-600'}`} title={status.name_ar || ''}>
      {status.name_fr || status.code}
    </span>
  );
}

function NotificationsTab() {
  const [facets, setFacets] = useState({ event_codes: [], types: [], channels: [], statuses: [] });
  const [draft, setDraft] = useState(EMPTY_NOTIF_FILTERS);
  const [filters, setFilters] = useState(EMPTY_NOTIF_FILTERS);
  const [exporting, setExporting] = useState(false);
  const [detail, setDetail] = useState(null);
  const { rows, total, cursor, loading, loadingMore, loadMore } = useCursorList(getNotificationLogs, filters);

  useEffect(() => {
    getNotificationFacets()
      .then(({ data }) => setFacets({ event_codes: [], types: [], channels: [], statuses: [], ...(data.data || {}) }))
      .catch(() => {});
  }, []);

  const apply = (e) => {
    e?.preventDefault();
    if (draft.date_from && draft.date_to && draft.date_from > draft.date_to) {
      toast.error('La date de début doit précéder la date de fin');
      return;
    }
    setFilters({ ...draft });
  };
  const reset = () => { setDraft(EMPTY_NOTIF_FILTERS); setFilters(EMPTY_NOTIF_FILTERS); };

  const doExport = async () => {
    setExporting(true);
    try {
      const res = await exportNotificationLogs(clean(filters));
      downloadBlob(res, 'journal_notifications.csv');
      toast.success('Export généré');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));
  const phone = (c) => (c ? `${c.phone_country || ''}${c.phone_number || ''}` : '');

  return (
    <div className="space-y-4">
      <form onSubmit={apply} className="card grid grid-cols-1 gap-3 p-4 md:grid-cols-4">
        <div>
          <label className="form-label">Type</label>
          <select className="form-select" value={draft.type_id} onChange={set('type_id')}>
            <option value="">Tous</option>
            {facets.types.map((t) => <option key={t.id} value={t.id}>{t.name_fr} ({t.count})</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Événement</label>
          <select className="form-select" value={draft.event_code} onChange={set('event_code')}>
            <option value="">Tous</option>
            {facets.event_codes.map((e) => <option key={e.value} value={e.value}>{e.value} ({e.count})</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Canal</label>
          <select className="form-select" value={draft.channel_id} onChange={set('channel_id')}>
            <option value="">Tous</option>
            <option value="none">Sans canal</option>
            {facets.channels.map((c) => <option key={c.id} value={c.id}>{c.name_fr}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Statut</label>
          <select className="form-select" value={draft.status_id} onChange={set('status_id')}>
            <option value="">Tous</option>
            {facets.statuses.map((s) => <option key={s.id} value={s.id}>{s.name_fr} ({s.count})</option>)}
            <option value="none">Sans statut</option>
          </select>
        </div>
        <div>
          <label className="form-label">Lecture</label>
          <select className="form-select" value={draft.is_read} onChange={set('is_read')}>
            <option value="">Toutes</option>
            <option value="false">Non lue</option>
            <option value="true">Lue</option>
          </select>
        </div>
        <div>
          <label className="form-label">Destinataire</label>
          <input className="form-input" value={draft.search} onChange={set('search')} placeholder="Nom, téléphone, titre…" />
        </div>
        <div>
          <label className="form-label">Du</label>
          <input type="date" className="form-input" value={draft.date_from} onChange={set('date_from')} />
        </div>
        <div>
          <label className="form-label">Au</label>
          <input type="date" className="form-input" value={draft.date_to} onChange={set('date_to')} />
        </div>
        <FilterActions onReset={reset} />
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <CountLine loading={loading} total={total} shown={rows.length} noun="notification(s)" />
        <ExportButton onClick={doExport} busy={exporting} />
      </div>

      <div className="table-wrap overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="table-th">Date d'envoi</th>
              <th className="table-th">Destinataire</th>
              <th className="table-th">Canal</th>
              <th className="table-th">Type</th>
              <th className="table-th">Événement</th>
              <th className="table-th">Titre / contenu (FR)</th>
              <th className="table-th">Titre / contenu (AR)</th>
              <th className="table-th">Statut</th>
              <th className="table-th">Lue le</th>
              <th className="table-th text-right">Détail</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="table-td py-10 text-center text-zinc-400"><Loader2 className="mx-auto animate-spin" size={20} /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={10} className="table-td py-10 text-center text-zinc-400">Aucune notification pour ces critères.</td></tr>
            ) : rows.map((n) => (
              <tr key={n.id} className="hover:bg-zinc-50">
                <td className="table-td whitespace-nowrap text-zinc-600">{fmtDateTime(n.sent_at)}</td>
                <td className="table-td">
                  <p className="font-medium text-zinc-800">{n.customer?.name || '—'}</p>
                  {n.customer && <p className="font-mono text-xs text-zinc-400">{phone(n.customer)}</p>}
                </td>
                <td className="table-td text-zinc-600">{n.channel?.name_fr || n.channel?.code || '—'}</td>
                <td className="table-td text-zinc-700">{n.type?.name_fr || '—'}</td>
                <td className="table-td font-mono text-xs text-zinc-500">{n.event_code}</td>
                <td className="table-td max-w-[240px] text-zinc-700">
                  <p className="truncate font-medium" title={n.title_fr || ''}>{n.title_fr || '—'}</p>
                  <p className="truncate text-xs text-zinc-400" title={n.body_fr || ''}>{n.body_fr || ''}</p>
                </td>
                <td className="table-td max-w-[240px] text-zinc-700" dir="rtl">
                  <p className="truncate font-medium" title={n.title_ar || ''}>{n.title_ar || '—'}</p>
                  <p className="truncate text-xs text-zinc-400" title={n.body_ar || ''}>{n.body_ar || ''}</p>
                </td>
                <td className="table-td">
                  <NotifStatusBadge status={n.status} />
                  {n.error_message && (
                    <p className="mt-1 max-w-[200px] truncate text-[11px] text-red-600" title={n.error_message}>
                      {n.error_message}
                    </p>
                  )}
                </td>
                <td className="table-td whitespace-nowrap text-xs text-zinc-600">
                  {n.read_at ? fmtDateTime(n.read_at) : n.is_read ? 'Lue' : 'Non lue'}
                </td>
                <td className="table-td text-right">
                  <button type="button" onClick={() => setDetail(n)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50">
                    <Eye size={14} />Voir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <LoadMore cursor={cursor} loading={loading} loadingMore={loadingMore} onClick={loadMore} />

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title="Détail de la notification"
        subtitle={detail ? `${detail.type?.name_fr || detail.event_code} — ${fmtDateTime(detail.sent_at)}` : ''}
        footer={<button type="button" className="btn-secondary" onClick={() => setDetail(null)}>Fermer</button>}
      >
        {detail && (
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="form-label">Destinataire</dt>
              <dd>{detail.customer?.name || '—'} <span className="font-mono text-xs text-zinc-400">{phone(detail.customer)}</span></dd>
            </div>
            <div><dt className="form-label">Canal</dt><dd>{detail.channel?.name_fr || '—'}</dd></div>
            <div>
              <dt className="form-label">Type</dt>
              <dd>
                {detail.type?.name_fr || '—'}
                <span className="ml-2 font-mono text-xs text-zinc-400">{detail.event_code}</span>
              </dd>
            </div>
            <div><dt className="form-label">Statut</dt><dd><NotifStatusBadge status={detail.status} /></dd></div>
            <div>
              <dt className="form-label">Motif d'échec</dt>
              <dd className={detail.error_message ? 'text-red-600' : 'text-zinc-400'}>{detail.error_message || '—'}</dd>
            </div>
            <div><dt className="form-label">Commande</dt><dd className="font-mono text-xs">{detail.order_id || '—'}</dd></div>
            <div><dt className="form-label">Date d'envoi</dt><dd>{fmtDateTime(detail.sent_at)}</dd></div>
            <div><dt className="form-label">Date de lecture</dt><dd>{detail.read_at ? fmtDateTime(detail.read_at) : detail.is_read ? 'Lue (date inconnue)' : 'Non lue'}</dd></div>
            <div className="sm:col-span-2"><dt className="form-label">Titre (FR)</dt><dd>{detail.title_fr || '—'}</dd></div>
            <div className="sm:col-span-2">
              <dt className="form-label">Contenu (FR)</dt>
              <dd className="whitespace-pre-wrap text-zinc-700">{detail.body_fr || '—'}</dd>
            </div>
            <div className="sm:col-span-2"><dt className="form-label">Titre (AR)</dt><dd dir="rtl">{detail.title_ar || '—'}</dd></div>
            <div className="sm:col-span-2">
              <dt className="form-label">Contenu (AR)</dt>
              <dd dir="rtl" className="whitespace-pre-wrap text-zinc-700">{detail.body_ar || '—'}</dd>
            </div>
            {detail.metadata && (
              <div className="sm:col-span-2">
                <dt className="form-label">Métadonnées</dt>
                <dd>
                  <pre className="whitespace-pre-wrap break-all rounded-lg bg-zinc-50 p-3 font-mono text-xs text-zinc-600">
                    {JSON.stringify(detail.metadata, null, 2)}
                  </pre>
                </dd>
              </div>
            )}
          </dl>
        )}
      </Modal>
    </div>
  );
}

/* ───────────────────────── Page ───────────────────────── */

export default function AuditLogPage() {
  const { hasPermission } = useAuth();
  const tabs = TABS.filter((t) => hasPermission(t.perm));
  const [activeTab, setActiveTab] = useState(tabs[0]?.key || 'audit');
  const current = tabs.find((t) => t.key === activeTab) ? activeTab : tabs[0]?.key;

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Log &amp; Audit</h1>
          <p className="page-subtitle">
            Traçabilité (qui a fait quoi, quand, sur quelle entité) et journal des notifications envoyées.
            Tables en ajout seul : consultation uniquement.
          </p>
        </div>
      </div>

      {tabs.length === 0 ? (
        <div className="card p-8 text-center text-sm text-zinc-500">Vous n'avez pas accès aux journaux.</div>
      ) : (
        <>
          <div className="mb-4 flex gap-1 border-b border-zinc-200">
            {tabs.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveTab(t.key)}
                  className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                    current === t.key ? 'border-red-600 text-red-700' : 'border-transparent text-zinc-500 hover:text-zinc-800'
                  }`}
                >
                  <Icon size={15} />{t.label}
                </button>
              );
            })}
          </div>
          {current === 'audit' && <AuditTab />}
          {current === 'notifications' && <NotificationsTab />}
        </>
      )}
    </div>
  );
}
