import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getPicker, activatePicker, deactivatePicker, resetPickerPassword, getPickerStats, getPickerSessions, getPickerOrders } from '../../api/staff.api';
import { getErrorMessage, formatDate } from '../../utils/helpers';

// ── Icons ─────────────────────────────────────────────────────────────────────
const SVG = {
  back:   'M10 19l-7-7m0 0l7-7m-7 7h18',
  user:   'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  node:   'M3 7l9-4 9 4-9 4-9-4zm0 5l9 4 9-4m-18 5l9 4 9-4',
  box:    'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  check:  'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  clock:  'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  warn:   'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  pin:    'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z',
  lock:   'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
  unlock: 'M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z',
  key:    'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z',
  edit:   'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  x:      'M6 18L18 6M6 6l12 12',
  truck:  'M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0',
  chart:  'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  eye:    'M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
  order:  'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  card:   'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
};
function Icon({ d, className = 'w-5 h-5' }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} /></svg>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const ordId = (id) => 'ORD-' + (id ?? '').slice(0, 8).toUpperCase();
const sesId = (id) => 'PSK-' + (id ?? '').slice(0, 8).toUpperCase();

function elapsed(start, end) {
  if (!start) return '—';
  const ms = (end ? new Date(end) : new Date()) - new Date(start);
  const m = Math.floor(ms / 60000);
  return m < 60 ? `${m}min` : `${Math.floor(m/60)}h${String(m%60).padStart(2,'0')}`;
}

const DAYS = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];

const SESSION_COLOR = { open:'bg-gray-100 text-gray-700', in_progress:'bg-amber-100 text-amber-700', completed:'bg-emerald-100 text-emerald-700', cancelled:'bg-red-100 text-red-700' };
const ITEM_COLOR    = { pending:'bg-gray-100 text-gray-600', picked:'bg-emerald-100 text-emerald-700', substituted:'bg-blue-100 text-blue-700', out_of_stock:'bg-red-100 text-red-700' };

function SBadge({ status, map }) {
  if (!status) return null;
  const cls = (map ?? SESSION_COLOR)[status.code] ?? 'bg-gray-100 text-gray-600';
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{status.name_fr}</span>;
}

// ── Period selector ────────────────────────────────────────────────────────────
function getPeriodDates(period) {
  const now = new Date();
  const to  = now.toISOString().split('T')[0];
  if (period === 'today')  return { from: to, to };
  if (period === '7d')     { const d = new Date(now); d.setDate(d.getDate()-6); return { from: d.toISOString().split('T')[0], to }; }
  if (period === '30d')    { const d = new Date(now); d.setDate(d.getDate()-29); return { from: d.toISOString().split('T')[0], to }; }
  return {};
}

// ── CSS Bar chart ─────────────────────────────────────────────────────────────
function BarChart({ data, valueKey = 'sessions', color = 'bg-violet-500', label }) {
  const max = Math.max(...data.map(d => d[valueKey] ?? 0), 1);
  return (
    <div>
      {label && <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{label}</p>}
      <div className="flex items-end gap-1 h-20">
        {data.map((d, i) => {
          const h = Math.round(((d[valueKey] ?? 0) / max) * 100);
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] text-gray-400">{d[valueKey] ?? 0}</span>
              <div className="w-full rounded-t" style={{ height: `${Math.max(h, 2)}%`, backgroundColor: h > 0 ? undefined : '#e5e7eb' }}
                   className={`w-full rounded-t ${h > 0 ? color : 'bg-gray-100'}`} />
              <span className="text-[9px] text-gray-400 truncate w-full text-center">{d.label?.split(' ')[0]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Reset password modal ───────────────────────────────────────────────────────
function ResetModal({ pickerId, onClose }) {
  const [pwd, setPwd] = useState('');
  const [saving, setSaving] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-1">Réinitialiser le mot de passe</h3>
        <p className="text-sm text-gray-500 mb-4">Saisissez un nouveau mot de passe (min 6 caractères)</p>
        <input type="password" value={pwd} onChange={e => setPwd(e.target.value)} placeholder="Nouveau mot de passe…"
          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 mb-4" />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl">Annuler</button>
          <button disabled={saving || pwd.length < 6}
            onClick={async () => { setSaving(true); try { await resetPickerPassword(pickerId, pwd); toast.success('MDP réinitialisé'); onClose(); } catch(e){toast.error(getErrorMessage(e));} finally{setSaving(false);} }}
            className="flex-1 py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-xl disabled:opacity-50">{saving?'…':'Réinitialiser'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Order detail drawer ───────────────────────────────────────────────────────
function OrderDrawer({ sessionData, onClose }) {
  if (!sessionData) return null;
  const { order, items: pickItems, status: sessionStatus } = sessionData;
  const [drawerTab, setDrawerTab] = useState('info');

  // Map picking items by order_item_id
  const pickItemMap = Object.fromEntries((pickItems ?? []).map(pi => [pi.order_item_id, pi]));

  const hexColor = (c) => c?.startsWith('#') ? c : '#64748b';

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex flex-col bg-white shadow-2xl w-full max-w-2xl overflow-hidden">
        {/* Drawer header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-violet-800 to-violet-600 flex-shrink-0">
          <div>
            <p className="text-violet-200 text-xs font-semibold uppercase tracking-widest mb-0.5">Commande préparée</p>
            <h2 className="text-white font-bold text-xl">{ordId(order?.id)}</h2>
            <div className="flex items-center gap-3 mt-1">
              {order?.status && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${hexColor(order.status.color)}25`, color: hexColor(order.status.color) }}>
                  {order.status.name_fr}
                </span>
              )}
              <SBadge status={sessionStatus} map={SESSION_COLOR} />
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/25 flex items-center justify-center">
            <Icon d={SVG.x} className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-6 flex-shrink-0 bg-white">
          {[{id:'info',l:'Commande'},{id:'client',l:'Client'},{id:'articles',l:`Articles (${order?.items?.length??0})`},{id:'history',l:'Historique'}].map(t=>(
            <button key={t.id} onClick={()=>setDrawerTab(t.id)}
              className={`py-3 px-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-all -mb-px ${drawerTab===t.id?'border-violet-600 text-violet-600':'border-transparent text-gray-500 hover:text-gray-800'}`}>{t.l}</button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* ── INFO ────────────────────────────────────────────────────────── */}
          {drawerTab === 'info' && order && (
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { l:'Référence',   v: ordId(order.id) },
                  { l:'Total TTC',   v: `${Number(order.total_ttc).toFixed(2)} MAD` },
                  { l:'Livraison',   v: order.delivery_type?.name_fr ?? '—' },
                  { l:'Paiement',    v: order.payments?.[0]?.payment_method?.name_fr ?? '—' },
                  { l:'Statut cmd',  v: <span style={{color: hexColor(order.status?.color)}} className="font-semibold">{order.status?.name_fr}</span> },
                  { l:'Statut picking', v: <SBadge status={sessionStatus} map={SESSION_COLOR} /> },
                ].map((r,i)=>(
                  <div key={i} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{r.l}</p>
                    <p className="text-sm font-semibold text-gray-800">{r.v}</p>
                  </div>
                ))}
              </div>
              {order.confirmed_slot && (
                <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <Icon d={SVG.clock} className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-blue-500 font-semibold uppercase">Créneau</p>
                    <p className="text-sm font-semibold text-blue-800">{order.confirmed_slot.name_fr} — {order.confirmed_slot.slot_start}–{order.confirmed_slot.slot_end}</p>
                    <p className="text-xs text-blue-500">{DAYS[order.confirmed_slot.day_of_week]}</p>
                  </div>
                </div>
              )}
              {order.notes && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 italic">{order.notes}</div>
              )}
            </div>
          )}

          {/* ── CLIENT ──────────────────────────────────────────────────────── */}
          {drawerTab === 'client' && (
            <div className="p-6 space-y-4">
              {order?.customer ? (
                <>
                  <div className="flex items-center gap-4 p-4 bg-violet-50 border border-violet-200 rounded-xl">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-violet-400 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                      {order.customer.name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{order.customer.name}</p>
                      <p className="text-sm text-gray-500 font-mono">{order.customer.phone_country} {order.customer.phone_number}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{order.customer.city}</p>
                    </div>
                  </div>
                  {order.address && (
                    <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Adresse de livraison</p>
                      <p className="text-sm font-semibold text-gray-800">
                        {order.address.street_number && `${order.address.street_number} `}{order.address.street_name}
                        {order.address.quartier && `, ${order.address.quartier}`}
                      </p>
                      <p className="text-sm text-gray-500">{order.address.postal_code && `${order.address.postal_code} `}{order.address.city}</p>
                      {order.address.delivery_notes && <p className="text-xs text-gray-400 italic mt-1.5">{order.address.delivery_notes}</p>}
                    </div>
                  )}
                </>
              ) : <p className="p-6 text-center text-gray-400">Client introuvable</p>}
            </div>
          )}

          {/* ── ARTICLES ────────────────────────────────────────────────────── */}
          {drawerTab === 'articles' && (
            <div className="p-4">
              {!order?.items?.length ? (
                <p className="text-center py-12 text-gray-400">Aucun article</p>
              ) : (
                <div className="space-y-3">
                  {order.items.map((item, i) => {
                    const pi = pickItemMap[item.id];
                    const art = item.sku?.article;
                    return (
                      <div key={item.id} className={`rounded-xl border p-4 ${pi?.status?.code === 'picked' ? 'border-emerald-200 bg-emerald-50/30' : pi?.status?.code === 'out_of_stock' ? 'border-red-200 bg-red-50/20' : 'border-gray-100 bg-white'}`}>
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 text-sm">{art?.name_fr ?? 'Article inconnu'}</p>
                            <p className="text-xs text-gray-500" dir="rtl">{art?.name_ar}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[11px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{art?.sku_code}</span>
                              {art?.ean13 && <span className="text-[11px] font-mono text-gray-400">EAN: {art.ean13}</span>}
                            </div>
                          </div>
                          {pi?.status && <SBadge status={pi.status} map={ITEM_COLOR} />}
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="bg-gray-50 rounded-lg p-2 text-center">
                            <p className="text-gray-400 uppercase tracking-wide text-[10px] font-semibold">Attendu</p>
                            <p className="font-bold text-gray-800 mt-0.5">{Number(item.qty)}</p>
                          </div>
                          <div className={`rounded-lg p-2 text-center ${(pi?.qty_picked ?? 0) >= Number(item.qty) ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                            <p className="text-gray-400 uppercase tracking-wide text-[10px] font-semibold">Préparé</p>
                            <p className={`font-bold mt-0.5 ${(pi?.qty_picked ?? 0) >= Number(item.qty) ? 'text-emerald-700' : 'text-amber-700'}`}>{pi?.qty_picked ?? 0}</p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-2 text-center">
                            <p className="text-gray-400 uppercase tracking-wide text-[10px] font-semibold">Prix</p>
                            <p className="font-bold text-gray-800 mt-0.5">{Number(item.unit_price_sold).toFixed(0)} MAD</p>
                          </div>
                        </div>
                        {pi && (
                          <div className="mt-3 flex flex-wrap gap-2 text-xs">
                            {pi.scanned_ean && <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-lg font-mono">Scanné: {pi.scanned_ean}</span>}
                            {pi.location && <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg"><Icon d={SVG.pin} className="w-3 h-3 inline mr-0.5" />{pi.location.aisle&&`All.${pi.location.aisle}`}{pi.location.shelf&&` Ray.${pi.location.shelf}`}{pi.location.code&&` (${pi.location.code})`}</span>}
                            {pi.picked_at && <span className="bg-gray-50 text-gray-500 px-2 py-0.5 rounded-lg"><Icon d={SVG.clock} className="w-3 h-3 inline mr-0.5" />{new Date(pi.picked_at).toLocaleTimeString('fr-MA',{hour:'2-digit',minute:'2-digit'})}</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── HISTORIQUE ──────────────────────────────────────────────────── */}
          {drawerTab === 'history' && (
            <div className="p-6">
              <div className="relative">
                <div className="absolute left-4 top-4 bottom-4 w-px bg-gray-200" />
                <div className="space-y-5">
                  {[
                    { label:'Commande créée',       date: order?.created_at,      color:'#6366f1', ok: !!order?.created_at },
                    { label:'Passage en picking',    date: sessionData?.created_at, color:'#8b5cf6', ok: !!sessionData?.created_at },
                    { label:'Démarrage préparation', date: sessionData?.started_at, color:'#f59e0b', ok: !!sessionData?.started_at },
                    { label:'Préparation terminée',  date: sessionData?.completed_at, color:'#10b981', ok: !!sessionData?.completed_at },
                  ].map((e, i) => (
                    <div key={i} className="flex gap-4 relative z-10">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 border-white flex-shrink-0 ${e.ok ? '' : 'bg-gray-100 border-gray-200'}`}
                        style={e.ok ? { backgroundColor: `${e.color}20`, border: `2px solid ${e.color}` } : {}}>
                        {e.ok ? <Icon d={SVG.check} className="w-3.5 h-3.5" style={{ color: e.color }} /> : <span className="w-2 h-2 rounded-full bg-gray-300" />}
                      </div>
                      <div className="flex-1 pt-0.5">
                        <p className="text-sm font-semibold text-gray-800">{e.label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{e.date ? `${new Date(e.date).toLocaleDateString('fr-MA',{day:'2-digit',month:'short',year:'numeric'})} ${new Date(e.date).toLocaleTimeString('fr-MA',{hour:'2-digit',minute:'2-digit'})}` : 'Non effectué'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
const PERIODS = [{ v:'today',l:"Aujourd'hui"},{v:'7d',l:'7 jours'},{v:'30d',l:'30 jours'},{v:'',l:'Tout'}];

export default function PickerDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [picker, setPicker]   = useState(null);
  const [stats, setStats]     = useState(null);
  const [sessions, setSessions] = useState([]);
  const [sessTotal, setSessTotal] = useState(0);
  const [sessPages, setSessPages] = useState(0);
  const [orders, setOrders]   = useState([]);
  const [ordTotal, setOrdTotal] = useState(0);
  const [ordPages, setOrdPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [sessLoading, setSessLoading] = useState(false);
  const [ordLoading, setOrdLoading]   = useState(false);

  const [tab, setTab]       = useState('resume');
  const [period, setPeriod] = useState('7d');
  const [sessPage, setSessPage] = useState(1);
  const [ordPage, setOrdPage]   = useState(1);
  const [sessStatus, setSessStatus] = useState('');
  const [ordStatus, setOrdStatus]   = useState('');
  const [ordSearch, setOrdSearch]   = useState('');
  const [ordSearchInput, setOrdSearchInput] = useState('');

  const [acting, setActing]       = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [drawerSession, setDrawerSession] = useState(null);

  // ── Load picker ────────────────────────────────────────────────────────────
  const loadPicker = useCallback(async () => {
    setLoading(true);
    try { const r = await getPicker(id); setPicker(r.data?.data); }
    catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, [id]);

  // ── Load stats ─────────────────────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const p = getPeriodDates(period);
      const r = await getPickerStats(id, p);
      setStats(r.data?.data);
    } catch { /* silent */ }
    finally { setStatsLoading(false); }
  }, [id, period]);

  // ── Load sessions ──────────────────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    setSessLoading(true);
    try {
      const p = { ...getPeriodDates(period), page: sessPage, limit: 20 };
      if (sessStatus) p.status_code = sessStatus;
      const r = await getPickerSessions(id, p);
      setSessions(r.data?.data ?? []);
      setSessTotal(r.data?.pagination?.total ?? 0);
      setSessPages(r.data?.pagination?.pages ?? 0);
    } catch { /* silent */ }
    finally { setSessLoading(false); }
  }, [id, period, sessPage, sessStatus]);

  // ── Load orders ────────────────────────────────────────────────────────────
  const loadOrders = useCallback(async () => {
    setOrdLoading(true);
    try {
      const p = { ...getPeriodDates(period), page: ordPage, limit: 15 };
      if (ordStatus) p.status_code = ordStatus;
      if (ordSearch) p.search = ordSearch;
      const r = await getPickerOrders(id, p);
      setOrders(r.data?.data ?? []);
      setOrdTotal(r.data?.pagination?.total ?? 0);
      setOrdPages(r.data?.pagination?.pages ?? 0);
    } catch { /* silent */ }
    finally { setOrdLoading(false); }
  }, [id, period, ordPage, ordStatus, ordSearch]);

  useEffect(() => { loadPicker(); }, [loadPicker]);
  useEffect(() => { if (tab === 'resume' || tab === 'analytics') loadStats(); }, [loadStats, tab]);
  useEffect(() => { if (tab === 'sessions')  loadSessions(); }, [loadSessions, tab]);
  useEffect(() => { if (tab === 'commandes') loadOrders();   }, [loadOrders, tab]);

  const act = async (fn, msg) => {
    setActing(true);
    try { await fn(); toast.success(msg); loadPicker(); }
    catch (err) { toast.error(getErrorMessage(err)); }
    finally { setActing(false); }
  };

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" /></div>;
  if (!picker) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">Picker introuvable</div>;

  const STAT_CARDS = stats ? [
    { label:'Sessions',        value: stats.total_sessions,       color:'bg-violet-50 border-violet-200 text-violet-700',   icon: SVG.box   },
    { label:'Terminées',       value: stats.completed_sessions,   color:'bg-emerald-50 border-emerald-200 text-emerald-700', icon: SVG.check },
    { label:'En cours',        value: stats.in_progress_sessions, color:'bg-amber-50 border-amber-200 text-amber-700',       icon: SVG.clock },
    { label:'Annulées',        value: stats.cancelled_sessions,   color:'bg-red-50 border-red-200 text-red-600',             icon: SVG.x     },
    { label:'Articles préparés',value:stats.total_items_picked,   color:'bg-blue-50 border-blue-200 text-blue-700',          icon: SVG.box   },
    { label:'Erreurs scan',    value: stats.total_errors,         color:'bg-orange-50 border-orange-200 text-orange-700',    icon: SVG.warn  },
    { label:'Taux réussite',   value: `${stats.success_rate}%`,  color: stats.success_rate>=80?'bg-emerald-50 border-emerald-200 text-emerald-700':'bg-gray-50 border-gray-200 text-gray-700', icon: SVG.chart },
    { label:'Durée moy.',      value: stats.avg_duration_min>0?`${stats.avg_duration_min}min`:'—', color:'bg-slate-50 border-slate-200 text-slate-700', icon: SVG.clock },
  ] : [];

  const TABS = [
    { id:'resume',    l:'Résumé'    },
    { id:'sessions',  l:`Sessions${sessTotal>0?' ('+sessTotal+')':''}` },
    { id:'commandes', l:`Commandes${ordTotal>0?' ('+ordTotal+')':''}` },
    { id:'analytics', l:'Analytics' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {showReset && <ResetModal pickerId={id} onClose={() => setShowReset(false)} />}
      {drawerSession && <OrderDrawer sessionData={drawerSession} onClose={() => setDrawerSession(null)} />}

      {/* ── HEADER ───────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="px-6 pt-4 pb-0">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
            <Link to="/staff/pickers" className="hover:text-violet-600 flex items-center gap-1"><Icon d={SVG.back} className="w-3.5 h-3.5" />Pickers</Link>
            <span>›</span><span className="text-gray-700 font-medium">{picker.name}</span>
          </div>

          <div className="flex items-start gap-5 pb-4">
            {/* Avatar */}
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-2xl flex-shrink-0 shadow-sm ${picker.is_active ? 'bg-gradient-to-br from-violet-600 to-violet-400' : 'bg-gray-400'}`}>
              {picker.name.charAt(0).toUpperCase()}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900">{picker.name}</h1>
                {picker.is_active
                  ? <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">Actif</span>
                  : <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200">Inactif</span>}
              </div>
              <p className="text-sm text-gray-500 font-mono">{picker.phone_country} {picker.phone_number}</p>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400 flex-wrap">
                <span className="flex items-center gap-1"><Icon d={SVG.node} className="w-3 h-3" />{picker.node?.name_fr} ({picker.node?.code})</span>
                <span>·</span><span>Créé {formatDate(picker.created_at)}</span>
                <span>·</span><span>Modifié {formatDate(picker.updated_at)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
              <button onClick={() => navigate(`/staff/pickers/${id}/edit`)} disabled className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-gray-600 bg-gray-50 border border-gray-200 rounded-xl opacity-40 cursor-not-allowed">
                <Icon d={SVG.edit} className="w-4 h-4" />Modifier
              </button>
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

          {/* Period + Tabs */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1 overflow-x-auto">
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`py-3 px-4 text-sm font-semibold border-b-2 whitespace-nowrap transition-all -mb-px ${tab===t.id?'border-violet-600 text-violet-600':'border-transparent text-gray-500 hover:text-gray-800'}`}>{t.l}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 mb-0.5 flex-shrink-0">
              {PERIODS.map(p => (
                <button key={p.v} onClick={() => { setPeriod(p.v); setSessPage(1); setOrdPage(1); }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${period===p.v?'bg-violet-600 text-white':'text-gray-500 hover:bg-gray-100'}`}>{p.l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 max-w-6xl">

        {/* ── RÉSUMÉ ───────────────────────────────────────────────────────────── */}
        {tab === 'resume' && (
          <div className="space-y-6">
            {statsLoading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-violet-600" /></div> : (
              <>
                {/* Stat cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                  {STAT_CARDS.map((s, i) => (
                    <div key={i} className={`rounded-2xl border p-4 ${s.color}`}>
                      <p className="text-xl font-bold">{s.value}</p>
                      <p className="text-[10px] font-semibold opacity-60 uppercase tracking-wide mt-0.5 leading-tight">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Success rate bar */}
                {stats && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-gray-900 text-sm">Taux de réussite</h3>
                      <span className={`text-lg font-bold ${stats.success_rate>=80?'text-emerald-600':'text-amber-600'}`}>{stats.success_rate}%</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${stats.success_rate>=80?'bg-emerald-500':stats.success_rate>=50?'bg-amber-500':'bg-red-500'}`} style={{ width: `${stats.success_rate}%` }} />
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                      <span>{stats.completed_sessions} terminées / {stats.total_sessions} sessions</span>
                      {stats.avg_duration_min > 0 && <span>·</span>}
                      {stats.avg_duration_min > 0 && <span>Durée moy: {stats.avg_duration_min}min</span>}
                    </div>
                  </div>
                )}

                {/* Recent sessions preview */}
                {stats && stats.total_sessions > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-gray-900 text-sm">Répartition des statuts</h3>
                    </div>
                    {stats.total_sessions > 0 && (
                      <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
                        {stats.completed_sessions > 0   && <div className="bg-emerald-400 transition-all" style={{ flex: stats.completed_sessions }}   title={`${stats.completed_sessions} terminées`} />}
                        {stats.in_progress_sessions > 0 && <div className="bg-amber-400 transition-all"   style={{ flex: stats.in_progress_sessions }} title={`${stats.in_progress_sessions} en cours`} />}
                        {stats.cancelled_sessions > 0   && <div className="bg-red-400 transition-all"     style={{ flex: stats.cancelled_sessions }}   title={`${stats.cancelled_sessions} annulées`} />}
                      </div>
                    )}
                    <div className="flex items-center gap-4 mt-3 text-[11px] text-gray-500 flex-wrap">
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-400" />{stats.completed_sessions} terminées</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-400" />{stats.in_progress_sessions} en cours</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-400" />{stats.cancelled_sessions} annulées</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── SESSIONS ─────────────────────────────────────────────────────────── */}
        {tab === 'sessions' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
              <select value={sessStatus} onChange={e => { setSessStatus(e.target.value); setSessPage(1); }}
                className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="">Tous les statuts</option>
                {['open','in_progress','completed','cancelled'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <span className="text-sm text-gray-400 ml-auto">{sessTotal} session{sessTotal!==1?'s':''}</span>
            </div>

            {sessLoading ? <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-violet-600" /></div> : (
              <>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Session</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Commande</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Client</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Articles</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Erreurs</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Durée</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {sessions.length === 0 ? <tr><td colSpan={8} className="text-center py-12 text-gray-400">Aucune session</td></tr>
                      : sessions.map(s => (
                        <tr key={s.id} className="hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => setDrawerSession(s)}>
                          <td className="px-5 py-3.5"><span className="font-mono text-xs font-bold text-violet-600">{sesId(s.id)}</span></td>
                          <td className="px-4 py-3.5"><span className="font-mono text-xs text-blue-600">{ordId(s.order_id)}</span></td>
                          <td className="px-4 py-3.5 text-xs text-gray-600">{s.order?.customer?.name ?? '—'}</td>
                          <td className="px-4 py-3.5"><SBadge status={s.status} /></td>
                          <td className="px-4 py-3.5 text-center"><span className="text-sm font-bold text-gray-700">{s._count?.items ?? 0}</span></td>
                          <td className="px-4 py-3.5 text-center">{(s.error_count??0)>0?<span className="text-red-600 font-bold text-sm">{s.error_count}</span>:<span className="text-gray-300 text-xs">—</span>}</td>
                          <td className="px-4 py-3.5 text-right text-xs text-gray-500">{elapsed(s.started_at, s.completed_at)}</td>
                          <td className="px-4 py-3.5 text-right text-xs text-gray-400">{formatDate(s.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {sessPages > 1 && (
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-400">Page {sessPage}/{sessPages}</p>
                    <div className="flex gap-1">
                      <button onClick={()=>setSessPage(p=>Math.max(1,p-1))} disabled={sessPage<=1} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">←</button>
                      <button onClick={()=>setSessPage(p=>Math.min(sessPages,p+1))} disabled={sessPage>=sessPages} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">→</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── COMMANDES ────────────────────────────────────────────────────────── */}
        {tab === 'commandes' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
              <form onSubmit={e=>{e.preventDefault();setOrdSearch(ordSearchInput);setOrdPage(1);}} className="flex gap-2">
                <input value={ordSearchInput} onChange={e=>setOrdSearchInput(e.target.value)} placeholder="Réf. commande…"
                  className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 w-44" />
                <button type="submit" className="px-3 py-2 bg-gray-800 text-white text-sm font-medium rounded-xl">Go</button>
                {ordSearch && <button type="button" onClick={()=>{setOrdSearch('');setOrdSearchInput('');setOrdPage(1);}} className="px-2 py-2 border border-gray-200 text-gray-500 rounded-xl hover:bg-gray-50">✕</button>}
              </form>
              <select value={ordStatus} onChange={e=>{setOrdStatus(e.target.value);setOrdPage(1);}}
                className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="">Tous statuts picking</option>
                {['open','in_progress','completed','cancelled'].map(c=><option key={c} value={c}>{c}</option>)}
              </select>
              <span className="text-sm text-gray-400 ml-auto">{ordTotal} commande{ordTotal!==1?'s':''}</span>
            </div>

            {ordLoading ? <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-violet-600" /></div> : (
              <>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Commande</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Client</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Livraison</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Cmd statut</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Picking</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Articles</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {orders.length === 0 ? <tr><td colSpan={8} className="text-center py-12 text-gray-400">Aucune commande</td></tr>
                      : orders.map(sess => {
                        const ord = sess.order;
                        if (!ord) return null;
                        const hexC = ord.status?.color?.startsWith('#') ? ord.status.color : '#64748b';
                        return (
                          <tr key={sess.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-5 py-3.5">
                              <p className="font-mono text-xs font-bold text-blue-600">{ordId(ord.id)}</p>
                              <p className="text-[10px] text-gray-400">{formatDate(ord.created_at)}</p>
                            </td>
                            <td className="px-4 py-3.5">
                              <p className="font-semibold text-gray-800 text-xs truncate max-w-[120px]">{ord.customer?.name ?? '—'}</p>
                              <p className="text-[11px] font-mono text-gray-400">{ord.customer?.phone_number}</p>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="text-xs text-gray-600">{ord.delivery_type?.name_fr ?? '—'}</span>
                            </td>
                            <td className="px-4 py-3.5">
                              {ord.status && <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor:`${hexC}18`, color:hexC, border:`1px solid ${hexC}35` }}>{ord.status.name_fr}</span>}
                            </td>
                            <td className="px-4 py-3.5"><SBadge status={sess.status} /></td>
                            <td className="px-4 py-3.5 text-center"><span className="text-sm font-bold text-gray-700">{ord.items?.length ?? 0}</span></td>
                            <td className="px-4 py-3.5 text-right"><span className="font-bold text-gray-900 text-sm">{Number(ord.total_ttc).toFixed(2)} MAD</span></td>
                            <td className="px-4 py-3.5 text-right">
                              <button onClick={() => setDrawerSession(sess)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-lg ml-auto">
                                <Icon d={SVG.eye} className="w-3.5 h-3.5" />Détail
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {ordPages > 1 && (
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-400">Page {ordPage}/{ordPages}</p>
                    <div className="flex gap-1">
                      <button onClick={()=>setOrdPage(p=>Math.max(1,p-1))} disabled={ordPage<=1} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">←</button>
                      <button onClick={()=>setOrdPage(p=>Math.min(ordPages,p+1))} disabled={ordPage>=ordPages} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">→</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── ANALYTICS ────────────────────────────────────────────────────────── */}
        {tab === 'analytics' && (
          <div className="space-y-6">
            {statsLoading ? <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-violet-600" /></div>
            : !stats ? <p className="text-center py-12 text-gray-400">Aucune donnée</p>
            : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Sessions par jour */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <h3 className="font-bold text-gray-900 text-sm mb-4">Sessions par jour</h3>
                    {stats.daily?.length > 0 ? (
                      <div className="flex items-end gap-1 h-24">
                        {stats.daily.map((d, i) => {
                          const max = Math.max(...stats.daily.map(x => x.sessions), 1);
                          const h = Math.round((d.sessions / max) * 100);
                          return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1 group cursor-default">
                              <span className="text-[9px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">{d.sessions}</span>
                              <div className={`w-full rounded-t ${d.sessions > 0 ? 'bg-violet-500' : 'bg-gray-100'}`} style={{ height: `${Math.max(h, 2)}%` }} />
                              <span className="text-[9px] text-gray-400 truncate w-full text-center">{d.label?.split(' ')[0]}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : <p className="text-sm text-gray-400 text-center py-8">Aucune donnée</p>}
                  </div>

                  {/* Erreurs par jour */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <h3 className="font-bold text-gray-900 text-sm mb-4">Erreurs scan par jour</h3>
                    {stats.daily?.length > 0 ? (
                      <div className="flex items-end gap-1 h-24">
                        {stats.daily.map((d, i) => {
                          const max = Math.max(...stats.daily.map(x => x.errors), 1);
                          const h = Math.round(((d.errors ?? 0) / max) * 100);
                          return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1 group cursor-default">
                              <span className="text-[9px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">{d.errors ?? 0}</span>
                              <div className={`w-full rounded-t ${(d.errors ?? 0) > 0 ? 'bg-red-400' : 'bg-gray-100'}`} style={{ height: `${Math.max(h, 2)}%` }} />
                              <span className="text-[9px] text-gray-400 truncate w-full text-center">{d.label?.split(' ')[0]}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : <p className="text-sm text-gray-400 text-center py-8">Aucune donnée</p>}
                  </div>
                </div>

                {/* Summary table */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h3 className="font-bold text-gray-900 text-sm mb-4">Activité jour par jour</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-4 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                          <th className="px-4 py-2 text-center font-semibold text-gray-500 uppercase tracking-wide">Sessions</th>
                          <th className="px-4 py-2 text-center font-semibold text-gray-500 uppercase tracking-wide">Erreurs</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {(stats.daily ?? []).filter(d => d.sessions > 0 || d.errors > 0).map((d, i) => (
                          <tr key={i} className="hover:bg-gray-50/50">
                            <td className="px-4 py-2 text-gray-600">{d.date}</td>
                            <td className="px-4 py-2 text-center font-bold text-violet-700">{d.sessions}</td>
                            <td className="px-4 py-2 text-center font-bold text-red-500">{d.errors ?? 0}</td>
                          </tr>
                        ))}
                        {!(stats.daily ?? []).some(d => d.sessions > 0 || d.errors > 0) && (
                          <tr><td colSpan={3} className="text-center py-8 text-gray-400">Aucune activité sur la période</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
