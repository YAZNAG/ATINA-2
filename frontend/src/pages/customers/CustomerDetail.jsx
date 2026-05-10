import { useEffect, useState, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getCustomer, getAddresses, blockCustomer, unblockCustomer, deleteCustomer } from '../../api/customers.api';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage, formatDate } from '../../utils/helpers';

const SVG = {
  edit:   'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  trash:  'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  lock:   'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
  unlock: 'M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z',
  pin:    'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z',
  back:   'M10 19l-7-7m0 0l7-7m-7 7h18',
  check:  'M5 13l4 4L19 7',
  star:   'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
  wallet: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  gift:   'M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7',
  order:  'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  plus:   'M12 4v16m8-8H4',
};

function Icon({ d, className = 'w-5 h-5' }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} /></svg>;
}

function Stat({ icon, label, value, sub, color }) {
  return (
    <div className={`rounded-2xl border p-5 ${color}`}>
      <div className="flex items-center justify-between mb-3">
        <Icon d={icon} className="w-5 h-5 opacity-70" />
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-semibold opacity-70 mt-0.5">{label}</p>
      {sub && <p className="text-[11px] opacity-50 mt-0.5">{sub}</p>}
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-gray-50 last:border-0 gap-4">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex-shrink-0 w-36">{label}</span>
      <div className="text-sm text-right min-w-0 flex-1">{children ?? <span className="text-gray-300">—</span>}</div>
    </div>
  );
}

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [c, setC]           = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [tab, setTab]       = useState('profil');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const canUpdate = hasPermission('customers.update') || hasPermission('dashboard.view');
  const canDelete = hasPermission('customers.delete') || hasPermission('dashboard.view');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [custRes, addrRes] = await Promise.all([
        getCustomer(id),
        getAddresses(id).catch(() => ({ data: { data: [] } })),
      ]);
      setC(custRes.data?.data ?? null);
      setAddresses(addrRes.data?.data ?? []);
    } catch (e) { toast.error(getErrorMessage(e)); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const act = async (fn, msg) => {
    setActing(true);
    try { await fn(id); toast.success(msg); load(); }
    catch (e) { toast.error(getErrorMessage(e)); }
    finally { setActing(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" />
    </div>
  );

  if (!c) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
      <p className="text-gray-500">Client introuvable</p>
      <Link to="/customers" className="text-sm text-red-600 hover:text-red-800 font-semibold">← Retour à la liste</Link>
    </div>
  );

  const initial    = (c.name || '?').charAt(0).toUpperCase();
  const activeAddr = addresses.filter(a => !a.is_deleted);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="px-6 pt-4 pb-0">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
            <Link to="/customers" className="hover:text-red-600 transition-colors flex items-center gap-1">
              <Icon d={SVG.back} className="w-3.5 h-3.5" />Clients
            </Link>
            <span>›</span><span className="text-gray-700 font-medium">{c.name}</span>
          </div>

          {/* Profile header */}
          <div className="flex items-start gap-5 pb-5">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-2xl flex-shrink-0 shadow-sm ${
              c.is_deleted ? 'bg-gray-400' : c.is_active ? 'bg-gradient-to-br from-red-600 to-red-400' : 'bg-amber-500'
            }`}>{initial}</div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h1 className="text-2xl font-bold text-gray-900">{c.name}</h1>
                {c.is_deleted
                  ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">Supprimé</span>
                  : c.is_active
                    ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">Actif</span>
                    : <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Bloqué</span>}
                {c.phone_verified_at && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                    <Icon d={SVG.check} className="w-3 h-3" />OTP vérifié
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 font-mono">{c.phone_country} {c.phone_number}</p>
              <p className="text-xs text-gray-400 mt-0.5">Code parrainage : <span className="font-mono font-semibold text-gray-600">{c.referral_code}</span></p>
            </div>

            {/* Actions */}
            {!c.is_deleted && canUpdate && (
              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                <button onClick={() => navigate(`/customers/${id}/edit`)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-xl">
                  <Icon d={SVG.edit} className="w-4 h-4" />Modifier
                </button>
                <Link to={`/customers/${id}/addresses`}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl">
                  <Icon d={SVG.pin} className="w-4 h-4" />Adresses
                </Link>
                {c.is_active
                  ? <button disabled={acting} onClick={() => act(blockCustomer, 'Client bloqué')}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-gray-700 bg-gray-50 border border-gray-200 hover:bg-gray-100 rounded-xl disabled:opacity-50">
                      <Icon d={SVG.lock} className="w-4 h-4" />Bloquer
                    </button>
                  : <button disabled={acting} onClick={() => act(unblockCustomer, 'Client débloqué')}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-xl disabled:opacity-50">
                      <Icon d={SVG.unlock} className="w-4 h-4" />Débloquer
                    </button>}
                {canDelete && (
                  <button disabled={acting}
                    onClick={() => { if (window.confirm(`Supprimer « ${c.name} » ?`)) act(deleteCustomer, 'Client supprimé').then(() => navigate('/customers')); }}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 rounded-xl disabled:opacity-50">
                    <Icon d={SVG.trash} className="w-4 h-4" />Supprimer
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 border-t border-gray-100">
            {[{id:'profil',l:'Profil'},{id:'adresses',l:`Adresses (${activeAddr.length})`},{id:'parrainage',l:'Parrainage'}].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-4 py-3 text-sm font-semibold border-b-2 transition-all -mb-px ${
                  tab === t.id ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}>{t.l}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-6 py-6 max-w-5xl">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Stat icon={SVG.wallet} label="Wallet" value={`${Number(c.wallet_balance).toFixed(2)} DH`}
            color="bg-violet-50 border border-violet-200 text-violet-700" />
          <Stat icon={SVG.gift}   label="Points" value={c.points_balance} sub={`${c.points_lifetime} à vie`}
            color="bg-amber-50 border border-amber-200 text-amber-700" />
          <Stat icon={SVG.order}  label="Commandes" value={c._count?.orders ?? 0}
            color="bg-blue-50 border border-blue-200 text-blue-700" />
          <Stat icon={SVG.pin}    label="Adresses" value={activeAddr.length}
            color="bg-slate-50 border border-slate-200 text-slate-700" />
        </div>

        {/* ── TAB: PROFIL ─────────────────────────────────────────────── */}
        {tab === 'profil' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4">
            <h2 className="font-bold text-gray-900 mb-4">Informations client</h2>
            <Row label="Identifiant"><span className="font-mono text-xs text-gray-600 break-all">{c.id}</span></Row>
            <Row label="Téléphone"><span className="font-mono">{c.phone_country} {c.phone_number}</span></Row>
            <Row label="OTP vérifié">
              {c.phone_verified_at
                ? <span className="text-emerald-700">{formatDate(c.phone_verified_at)}</span>
                : <span className="text-gray-400">Non vérifié</span>}
            </Row>
            <Row label="Langue">{c.preferred_lang === 'fr' ? 'Français' : 'العربية'}</Row>
            <Row label="Ville">{c.city}</Row>
            <Row label="GPS">
              {c.lat && c.lng ? <span className="font-mono text-xs">{c.lat}, {c.lng}</span> : null}
            </Row>
            <Row label="Code parrainage"><span className="font-mono font-semibold text-gray-700">{c.referral_code}</span></Row>
            <Row label="Parrain">
              {c.referred_by ? (
                <Link to={`/customers/${c.referred_by.id}`} className="text-red-600 hover:text-red-800 font-semibold">
                  {c.referred_by.name} <span className="font-mono text-xs text-gray-400">({c.referred_by.referral_code})</span>
                </Link>
              ) : null}
            </Row>
            <Row label="Créé le">{formatDate(c.created_at)}</Row>
            <Row label="Modifié le">{formatDate(c.updated_at)}</Row>
          </div>
        )}

        {/* ── TAB: ADRESSES ───────────────────────────────────────────── */}
        {tab === 'adresses' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">{activeAddr.length} adresse{activeAddr.length !== 1 ? 's' : ''}</h2>
              <Link to={`/customers/${id}/addresses`}
                className="flex items-center gap-1.5 text-sm font-semibold text-red-600 hover:text-red-800">
                <Icon d={SVG.plus} className="w-4 h-4" />Gérer les adresses
              </Link>
            </div>
            {activeAddr.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Icon d={SVG.pin} className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                <p className="text-sm">Aucune adresse enregistrée</p>
                <Link to={`/customers/${id}/addresses`} className="mt-2 inline-block text-sm text-red-600 hover:text-red-800 font-semibold">
                  + Ajouter une adresse
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeAddr.map(addr => (
                  <div key={addr.id} className={`bg-white rounded-xl border p-4 ${addr.is_default ? 'border-red-200 ring-2 ring-red-100' : 'border-gray-100'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {addr.is_default && <Icon d={SVG.star} className="w-4 h-4 text-red-500" />}
                      {addr.label && <span className="text-xs font-semibold text-gray-500 uppercase">{addr.label}</span>}
                    </div>
                    <p className="text-sm font-semibold text-gray-800">
                      {addr.street_number && `${addr.street_number} `}{addr.street_name}
                    </p>
                    {addr.quartier && <p className="text-xs text-gray-400">{addr.quartier}</p>}
                    <p className="text-xs text-gray-500">{addr.postal_code ? `${addr.postal_code} ` : ''}{addr.city}</p>
                    {addr.delivery_notes && <p className="text-xs text-gray-400 italic mt-1.5">{addr.delivery_notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: PARRAINAGE ─────────────────────────────────────────── */}
        {tab === 'parrainage' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4">
            <h2 className="font-bold text-gray-900 mb-4">Programme de parrainage</h2>
            <Row label="Code parrain"><span className="font-mono text-lg font-bold text-red-600">{c.referral_code}</span></Row>
            <Row label="Parrainé par">
              {c.referred_by ? (
                <Link to={`/customers/${c.referred_by.id}`} className="text-red-600 hover:text-red-800 font-semibold">
                  {c.referred_by.name}
                </Link>
              ) : null}
            </Row>
            <Row label="Points cumulés à vie"><span className="font-bold text-amber-700">{c.points_lifetime}</span></Row>
            <Row label="Points disponibles"><span className="font-bold text-amber-700">{c.points_balance}</span></Row>
            <Row label="Wallet actuel"><span className="font-bold text-violet-700">{Number(c.wallet_balance).toFixed(2)} DH</span></Row>
          </div>
        )}
      </div>
    </div>
  );
}
