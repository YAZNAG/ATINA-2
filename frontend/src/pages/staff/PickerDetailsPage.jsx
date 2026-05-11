import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getPicker, activatePicker, deactivatePicker, resetPickerPassword } from '../../api/staff.api';
import { getPickingSessions } from '../../api/picking.api';
import { getErrorMessage, formatDate } from '../../utils/helpers';

const SVG = {
  back:   'M10 19l-7-7m0 0l7-7m-7 7h18',
  user:   'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  node:   'M3 7l9-4 9 4-9 4-9-4zm0 5l9 4 9-4m-18 5l9 4 9-4',
  check:  'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  clock:  'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  warn:   'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  box:    'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  lock:   'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
  unlock: 'M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z',
  key:    'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z',
};
function Icon({ d, className = 'w-5 h-5' }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} /></svg>;
}

const SESSION_COLORS = { open:'bg-gray-100 text-gray-700', in_progress:'bg-amber-100 text-amber-700', completed:'bg-emerald-100 text-emerald-700', cancelled:'bg-red-100 text-red-700' };
function SessionBadge({ status }) {
  const cls = SESSION_COLORS[status?.code] ?? 'bg-gray-100 text-gray-600';
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{status?.name_fr}</span>;
}

function elapsed(start, end) {
  if (!start) return '—';
  const ms = (end ? new Date(end) : new Date()) - new Date(start);
  const m = Math.floor(ms / 60000);
  return m < 60 ? `${m}min` : `${Math.floor(m/60)}h${String(m%60).padStart(2,'0')}`;
}

// Simple bar chart (CSS-based, no external library)
function MiniBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] text-gray-500 w-8 text-right flex-shrink-0">{value}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] text-gray-400 w-6 flex-shrink-0">{label}</span>
    </div>
  );
}

function ResetModal({ pickerId, onClose }) {
  const [pwd, setPwd] = useState('');
  const [saving, setSaving] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Réinitialiser le mot de passe</h3>
        <input type="password" value={pwd} onChange={e => setPwd(e.target.value)} placeholder="Nouveau mot de passe (min 6)" className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 mb-4" />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl">Annuler</button>
          <button disabled={saving||pwd.length<6} onClick={async () => { setSaving(true); try { await resetPickerPassword(pickerId, pwd); toast.success('MDP réinitialisé'); onClose(); } catch(e){toast.error(getErrorMessage(e));} finally{setSaving(false);} }}
            className="flex-1 py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-xl disabled:opacity-50">{saving?'…':'Réinitialiser'}</button>
        </div>
      </div>
    </div>
  );
}

export default function PickerDetailsPage() {
  const { id } = useParams();
  const [picker, setPicker]   = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing]   = useState(false);
  const [showReset, setShowReset] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, sRes] = await Promise.all([
        getPicker(id),
        getPickingSessions({ picker_id: id, limit: 100 }).catch(() => ({ data: { data: [] } })),
      ]);
      setPicker(pRes.data?.data);
      setSessions(sRes.data?.data ?? []);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const act = async (fn, msg) => {
    setActing(true);
    try { await fn(); toast.success(msg); load(); }
    catch (err) { toast.error(getErrorMessage(err)); }
    finally { setActing(false); }
  };

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" /></div>;
  if (!picker) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">Picker introuvable</div>;

  // ── Stats calculation ──────────────────────────────────────────────────────
  const total    = sessions.length;
  const completed= sessions.filter(s => s.status?.code === 'completed').length;
  const inProg   = sessions.filter(s => s.status?.code === 'in_progress').length;
  const cancelled= sessions.filter(s => s.status?.code === 'cancelled').length;
  const errTotal = sessions.reduce((sum, s) => sum + (s.error_count ?? 0), 0);
  const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  // ── Sessions by day (last 7 days) ──────────────────────────────────────────
  const dayLabels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return d.toLocaleDateString('fr-MA', { weekday: 'short' }).slice(0, 3);
  });
  const dayCounts = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split('T')[0];
    return sessions.filter(s => s.created_at?.startsWith(dateStr)).length;
  });
  const maxDay = Math.max(...dayCounts, 1);

  const STAT_CARDS = [
    { label: 'Total sessions',  value: total,        color: 'bg-violet-50 border-violet-200 text-violet-700' },
    { label: 'Terminées',       value: completed,    color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
    { label: 'En cours',        value: inProg,       color: 'bg-amber-50 border-amber-200 text-amber-700' },
    { label: 'Annulées',        value: cancelled,    color: 'bg-red-50 border-red-200 text-red-700' },
    { label: 'Erreurs scan',    value: errTotal,     color: 'bg-orange-50 border-orange-200 text-orange-700' },
    { label: 'Taux réussite',   value: `${successRate}%`, color: successRate >= 80 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-700' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {showReset && <ResetModal pickerId={id} onClose={() => setShowReset(false)} />}

      {/* Header */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="px-6 pt-4 pb-5">
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
            <Link to="/staff/pickers" className="hover:text-violet-600 flex items-center gap-1">
              <Icon d={SVG.back} className="w-3.5 h-3.5" />Pickers
            </Link>
            <span>›</span><span className="text-gray-700 font-medium">{picker.name}</span>
          </div>
          <div className="flex items-start gap-5">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-2xl flex-shrink-0 ${picker.is_active ? 'bg-gradient-to-br from-violet-600 to-violet-400' : 'bg-gray-400'}`}>
              {picker.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-gray-900">{picker.name}</h1>
                {picker.is_active
                  ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">Actif</span>
                  : <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200">Inactif</span>}
              </div>
              <p className="text-sm text-gray-500 font-mono">{picker.phone_country} {picker.phone_number}</p>
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                <Icon d={SVG.node} className="w-3 h-3" /><span>{picker.node?.name_fr} ({picker.node?.code})</span>
                <span>·</span><span>Créé {formatDate(picker.created_at)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {picker.is_active
                ? <button disabled={acting} onClick={() => act(() => deactivatePicker(id), 'Picker désactivé')}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-gray-700 bg-gray-50 border border-gray-200 hover:bg-gray-100 rounded-xl disabled:opacity-50">
                    <Icon d={SVG.lock} className="w-4 h-4" />Désactiver
                  </button>
                : <button disabled={acting} onClick={() => act(() => activatePicker(id), 'Picker activé')}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-xl disabled:opacity-50">
                    <Icon d={SVG.unlock} className="w-4 h-4" />Activer
                  </button>}
              <button onClick={() => setShowReset(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-xl">
                <Icon d={SVG.key} className="w-4 h-4" />Reset MDP
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 max-w-5xl space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {STAT_CARDS.map(s => (
            <div key={s.label} className={`rounded-2xl border p-4 text-center ${s.color}`}>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-[11px] font-semibold opacity-70 uppercase tracking-wide mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Activity chart - last 7 days */}
        {total > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-bold text-gray-900 mb-4">Sessions — 7 derniers jours</h2>
            <div className="space-y-2">
              {dayLabels.map((label, i) => (
                <MiniBar key={i} label={label} value={dayCounts[i]} max={maxDay}
                  color={dayCounts[i] > 0 ? 'bg-violet-500' : 'bg-gray-200'} />
              ))}
            </div>
            {/* Status distribution bar */}
            {total > 0 && (
              <div className="mt-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Répartition statuts</p>
                <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                  {completed  > 0 && <div className="bg-emerald-400" style={{ flex: completed }} title={`${completed} terminées`} />}
                  {inProg     > 0 && <div className="bg-amber-400"   style={{ flex: inProg }}    title={`${inProg} en cours`} />}
                  {cancelled  > 0 && <div className="bg-red-400"     style={{ flex: cancelled }} title={`${cancelled} annulées`} />}
                </div>
                <div className="flex items-center gap-4 mt-2 text-[11px] text-gray-500">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />Terminées</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" />En cours</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-400" />Annulées</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sessions table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="font-bold text-gray-900">Sessions picking</h2>
            <span className="text-sm text-gray-400">{total} session{total !== 1 ? 's' : ''}</span>
          </div>
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Icon d={SVG.box} className="w-10 h-10 text-gray-200" />
              <p className="text-sm text-gray-400">Aucune session picking</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Session</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Commande</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Articles</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Erreurs</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Durée</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sessions.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3.5"><span className="font-mono text-xs text-violet-600 font-bold">PSK-{s.id.slice(0,8).toUpperCase()}</span></td>
                    <td className="px-4 py-3.5"><span className="font-mono text-xs text-blue-600">ORD-{s.order_id?.slice(0,8).toUpperCase()}</span></td>
                    <td className="px-4 py-3.5"><SessionBadge status={s.status} /></td>
                    <td className="px-4 py-3.5 text-center"><span className="text-sm font-bold text-gray-700">{s._count?.items ?? 0}</span></td>
                    <td className="px-4 py-3.5 text-center">
                      {(s.error_count ?? 0) > 0
                        ? <span className="text-red-600 font-bold text-sm">{s.error_count}</span>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-right text-xs text-gray-500">{elapsed(s.started_at, s.completed_at)}</td>
                    <td className="px-4 py-3.5 text-right text-xs text-gray-400">{formatDate(s.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
