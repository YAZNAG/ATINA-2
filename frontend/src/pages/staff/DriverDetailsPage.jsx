import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getDriver, activateDriver, deactivateDriver, resetDriverPassword, getDriverStats } from '../../api/staff.api';
import { getErrorMessage, formatDate } from '../../utils/helpers';

const SVG = {
  back:   'M10 19l-7-7m0 0l7-7m-7 7h18',
  truck:  'M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0',
  node:   'M3 7l9-4 9 4-9 4-9-4zm0 5l9 4 9-4m-18 5l9 4 9-4',
  phone:  'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
  lock:   'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
  unlock: 'M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z',
  key:    'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z',
  check:  'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  clock:  'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  map:    'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 01.553-.894L9 2m0 18l6-3m-6 3V2m6 15l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 2',
  car:    'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4',
  info:   'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  calendar:'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  x:      'M6 18L18 6M6 6l12 12',
};

function Icon({ d, className = 'w-5 h-5' }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} /></svg>;
}

function ResetModal({ driverId, onClose }) {
  const [pwd, setPwd] = useState('');
  const [saving, setSaving] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-1">Réinitialiser le mot de passe</h3>
        <p className="text-sm text-gray-500 mb-4">Nouveau mot de passe (min 6 caractères)</p>
        <input type="password" value={pwd} onChange={e => setPwd(e.target.value)} placeholder="Nouveau mot de passe…"
          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-4" />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl">Annuler</button>
          <button disabled={saving || pwd.length < 6}
            onClick={async () => {
              setSaving(true);
              try { await resetDriverPassword(driverId, pwd); toast.success('MDP réinitialisé'); onClose(); }
              catch(e) { toast.error(getErrorMessage(e)); }
              finally { setSaving(false); }
            }}
            className="flex-1 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl disabled:opacity-50">
            {saving ? '…' : 'Réinitialiser'}
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value, mono }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
        <Icon d={icon} className="w-4 h-4 text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
        <p className={`text-sm font-semibold text-gray-800 mt-0.5 ${mono ? 'font-mono' : ''}`}>{value}</p>
      </div>
    </div>
  );
}

export default function DriverDetailsPage() {
  const { id } = useParams();
  const [driver, setDriver] = useState(null);
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing]   = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [tab, setTab]         = useState('profil');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dRes, sRes] = await Promise.all([
        getDriver(id),
        getDriverStats(id).catch(() => ({ data: { data: null } })),
      ]);
      setDriver(dRes.data?.data);
      setStats(sRes.data?.data);
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

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
    </div>
  );

  if (!driver) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
      <p className="text-gray-500 font-medium">Livreur introuvable</p>
      <Link to="/staff/drivers" className="text-sm text-emerald-600 hover:text-emerald-800 font-semibold">← Retour à la liste</Link>
    </div>
  );

  const VEHICLE_ICONS = { Moto: '🏍', Camion: '🚛', Voiture: '🚗', Vélo: '🚴', Van: '🚐' };
  const vehicleEmoji = Object.entries(VEHICLE_ICONS).find(([k]) => driver.vehicle_type?.toLowerCase().includes(k.toLowerCase()))?.[1] ?? '🚚';

  const TABS = [
    { id: 'profil',    l: 'Profil'          },
    { id: 'vehicule',  l: 'Véhicule'        },
    { id: 'tournees',  l: 'Tournées'        },
    { id: 'historique',l: 'Historique'      },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {showReset && <ResetModal driverId={id} onClose={() => setShowReset(false)} />}

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="px-6 pt-4 pb-0">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
            <Link to="/staff/drivers" className="hover:text-emerald-600 flex items-center gap-1 transition-colors">
              <Icon d={SVG.back} className="w-3.5 h-3.5" />Livreurs
            </Link>
            <span>›</span>
            <span className="text-gray-700 font-medium">{driver.name}</span>
          </div>

          {/* Profile header */}
          <div className="flex items-start gap-5 pb-5">
            {/* Avatar */}
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-2xl flex-shrink-0 shadow-sm ${driver.is_active ? 'bg-gradient-to-br from-emerald-600 to-emerald-400' : 'bg-gray-400'}`}>
              {driver.vehicle_type ? <span className="text-2xl">{vehicleEmoji}</span> : driver.name.charAt(0).toUpperCase()}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900">{driver.name}</h1>
                {driver.is_active
                  ? <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">Actif</span>
                  : <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200">Inactif</span>}
              </div>
              <p className="text-sm text-gray-500 font-mono">{driver.phone_country} {driver.phone_number}</p>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400 flex-wrap">
                <span className="flex items-center gap-1">
                  <Icon d={SVG.node} className="w-3 h-3" />
                  {driver.node?.name_fr} <span className="font-mono">({driver.node?.code})</span>
                </span>
                {driver.vehicle_type && (
                  <><span>·</span><span className="flex items-center gap-1"><Icon d={SVG.truck} className="w-3 h-3" />{driver.vehicle_type}</span></>
                )}
                {driver.vehicle_plate && (
                  <><span>·</span><span className="font-mono font-semibold text-gray-600">{driver.vehicle_plate}</span></>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
              {driver.is_active
                ? <button disabled={acting} onClick={() => act(() => deactivateDriver(id), 'Livreur désactivé')}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-gray-700 bg-gray-50 border border-gray-200 hover:bg-gray-100 rounded-xl disabled:opacity-50 transition-colors">
                    <Icon d={SVG.lock} className="w-4 h-4" />Désactiver
                  </button>
                : <button disabled={acting} onClick={() => act(() => activateDriver(id), 'Livreur activé')}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-xl disabled:opacity-50 transition-colors">
                    <Icon d={SVG.unlock} className="w-4 h-4" />Activer
                  </button>}
              <button onClick={() => setShowReset(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-xl transition-colors">
                <Icon d={SVG.key} className="w-4 h-4" />Reset MDP
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-0 overflow-x-auto">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`py-3 px-4 text-sm font-semibold border-b-2 whitespace-nowrap transition-all -mb-px ${tab === t.id ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
                {t.l}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-6 py-6 max-w-4xl">

        {/* ── PROFIL ───────────────────────────────────────────────────────── */}
        {tab === 'profil' && (
          <div className="space-y-5">
            {/* Info cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Identité */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h2 className="font-bold text-gray-900 mb-4 text-sm uppercase tracking-wide">Identité</h2>
                <InfoRow icon={SVG.truck} label="Nom complet" value={driver.name} />
                <InfoRow icon={SVG.phone} label="Téléphone" value={`${driver.phone_country} ${driver.phone_number}`} mono />
                <InfoRow icon={SVG.node}  label="Node affecté" value={`${driver.node?.name_fr} (${driver.node?.code})`} />
                <InfoRow icon={SVG.calendar} label="Date création" value={formatDate(driver.created_at)} />
                <InfoRow icon={SVG.calendar} label="Dernière modification" value={formatDate(driver.updated_at)} />
              </div>

              {/* Statut */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h2 className="font-bold text-gray-900 mb-4 text-sm uppercase tracking-wide">Statut & Accès</h2>
                <div className={`flex items-center justify-between p-4 rounded-xl border mb-3 ${driver.is_active ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${driver.is_active ? 'bg-emerald-100' : 'bg-gray-200'}`}>
                      <Icon d={driver.is_active ? SVG.check : SVG.lock} className={`w-5 h-5 ${driver.is_active ? 'text-emerald-600' : 'text-gray-500'}`} />
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${driver.is_active ? 'text-emerald-800' : 'text-gray-600'}`}>
                        {driver.is_active ? 'Compte actif' : 'Compte inactif'}
                      </p>
                      <p className="text-xs text-gray-500">{driver.is_active ? 'Peut recevoir des tournées' : 'Aucune tournée assignable'}</p>
                    </div>
                  </div>
                </div>

                {driver.deleted_at && (
                  <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                    <Icon d={SVG.info} className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-red-800">Compte supprimé</p>
                      <p className="text-xs text-red-500">Le {formatDate(driver.deleted_at)}</p>
                    </div>
                  </div>
                )}

                <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Identifiant technique</p>
                  <p className="text-xs font-mono text-gray-500 break-all">{driver.id}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── VÉHICULE ─────────────────────────────────────────────────────── */}
        {tab === 'vehicule' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              {driver.vehicle_type || driver.vehicle_plate ? (
                <>
                  <div className="flex items-center gap-5 mb-6">
                    <div className="w-20 h-20 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-4xl">
                      {vehicleEmoji}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{driver.vehicle_type ?? 'Type non précisé'}</h2>
                      {driver.vehicle_plate && (
                        <div className="mt-2 px-4 py-2 bg-gray-900 text-white font-mono font-bold text-lg rounded-xl inline-block tracking-widest">
                          {driver.vehicle_plate}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Type de véhicule</p>
                      <p className="text-sm font-semibold text-gray-800">{driver.vehicle_type ?? '—'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Plaque d'immatriculation</p>
                      <p className="text-sm font-mono font-bold text-gray-800">{driver.vehicle_plate ?? '—'}</p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <div className="w-20 h-20 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center">
                    <Icon d={SVG.truck} className="w-10 h-10 text-gray-200" />
                  </div>
                  <p className="text-gray-500 font-medium">Aucune information véhicule</p>
                  <p className="text-gray-400 text-sm">Modifiez ce livreur pour ajouter le type et la plaque</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TOURNÉES ─────────────────────────────────────────────────────── */}
        {tab === 'tournees' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
              <div className="w-20 h-20 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <Icon d={SVG.map} className="w-10 h-10 text-emerald-200" />
              </div>
              <div>
                <p className="text-gray-700 font-semibold text-lg">Module Livraison</p>
                <p className="text-gray-400 text-sm mt-1 max-w-sm">
                  Les tournées et livraisons seront disponibles ici lorsque le module Livraison sera connecté à ce livreur.
                </p>
              </div>
              <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                <Icon d={SVG.info} className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <p className="text-xs text-amber-700 font-medium">Prêt pour: tours, tour_stops, COD, livraisons</p>
              </div>
            </div>
          </div>
        )}

        {/* ── HISTORIQUE ───────────────────────────────────────────────────── */}
        {tab === 'historique' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-bold text-gray-900 mb-5 text-sm">Historique du compte</h2>
            <div className="relative">
              <div className="absolute left-4 top-4 bottom-4 w-px bg-gray-100" />
              <div className="space-y-5">
                {[
                  { label: 'Compte créé',       date: driver.created_at,  color: '#10b981', icon: SVG.check, desc: 'Livreur enregistré dans le système' },
                  { label: 'Dernière modification', date: driver.updated_at, color: '#6366f1', icon: SVG.clock, desc: driver.updated_at !== driver.created_at ? 'Informations mises à jour' : 'Aucune modification' },
                  ...(driver.deleted_at ? [{ label: 'Compte supprimé', date: driver.deleted_at, color: '#ef4444', icon: SVG.x, desc: 'Suppression logique' }] : []),
                ].map((e, i) => (
                  <div key={i} className="flex gap-4 relative z-10">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center border-2 border-white flex-shrink-0"
                      style={{ backgroundColor: `${e.color}20`, border: `2px solid ${e.color}` }}>
                      <Icon d={e.icon} className="w-3.5 h-3.5" style={{ color: e.color }} />
                    </div>
                    <div className="flex-1 pt-0.5">
                      <p className="text-sm font-semibold text-gray-800">{e.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{e.desc}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(e.date).toLocaleDateString('fr-MA', { day: '2-digit', month: 'long', year: 'numeric' })}
                        {' '}{new Date(e.date).toLocaleTimeString('fr-MA', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
