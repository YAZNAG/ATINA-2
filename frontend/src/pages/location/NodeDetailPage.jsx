import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../utils/helpers';
import * as api from '../../api/locationNode.api';

// ── Icons ─────────────────────────────────────────────────────────────────────

const SVG = {
  node:    'M3 7l9-4 9 4-9 4-9-4zm0 5l9 4 9-4m-18 5l9 4 9-4',
  edit:    'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  trash:   'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  back:    'M10 19l-7-7m0 0l7-7m-7 7h18',
  mapPin:  'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z',
  phone:   'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
  clock:   'M12 8v4l3 2m-3-8a8 8 0 100 16 8 8 0 000-16z',
  location:'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 01.553-.894L9 2m0 18l6-3m-6 3V2m6 15l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 2',
  radius:  'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z',
  orders:  'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
  x:       'M6 18L18 6M6 6l12 12',
};

function Icon({ d, className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
    </svg>
  );
}

const DAY_LABELS = { '1': 'Lundi', '2': 'Mardi', '3': 'Mercredi', '4': 'Jeudi', '5': 'Vendredi', '6': 'Samedi', '0': 'Dimanche' };
const DAYS_ORDER = ['1','2','3','4','5','6','0'];

function parseHours(json) {
  if (!json) return {};
  try { return typeof json === 'string' ? JSON.parse(json) : json; }
  catch { return {}; }
}

function InfoRow({ icon, label, value, mono, rtl, color }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon d={icon} className="w-3.5 h-3.5 text-gray-400" />
      </div>
      <div className="flex-1">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
        <p className={`text-sm font-semibold text-gray-800 mt-0.5 ${mono ? 'font-mono' : ''} ${rtl ? 'text-right' : ''}`} style={color ? { color } : {}} dir={rtl ? 'rtl' : undefined}>
          {value}
        </p>
      </div>
    </div>
  );
}

// ── Delete modal ──────────────────────────────────────────────────────────────

function DeleteModal({ item, onCancel, onConfirm, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <Icon d={SVG.trash} className="w-7 h-7 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 text-center mb-1">Confirmer la suppression</h3>
        <p className="text-sm text-gray-500 text-center mb-6">
          Le nœud <span className="font-semibold text-gray-700">«{item?.name_fr}»</span> sera supprimé définitivement, ainsi que ses créneaux.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50">Annuler</button>
          <button onClick={onConfirm} disabled={loading} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
            {loading ? 'Suppression…' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────

function Section({ title, icon, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-50 bg-gray-50/50">
        <Icon d={icon} className="w-4 h-4 text-red-500" />
        <h3 className="text-sm font-bold text-gray-800">{title}</h3>
      </div>
      <div className="px-5">{children}</div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function NodeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const [node, setNode]     = useState(null);
  const [slots, setSlots]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [nRes, sRes] = await Promise.all([api.getNode(id), api.getNodeSlots(id)]);
        setNode(nRes.data.data);
        setSlots(sRes.data.data ?? []);
      } catch (err) {
        toast.error(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await api.deleteNode(id);
      toast.success('Nœud supprimé');
      navigate('/nodes');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" />
          <p className="text-sm text-gray-400">Chargement du nœud…</p>
        </div>
      </div>
    );
  }

  if (!node) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 font-semibold">Nœud introuvable</p>
          <button onClick={() => navigate('/nodes')} className="mt-3 text-sm text-red-600 hover:underline">← Retour aux nœuds</button>
        </div>
      </div>
    );
  }

  const badgeColor = node.node_type?.color_badge || '#dc2626';
  const hours = parseHours(node.opening_hours_json);

  const address = [node.address_line1, node.quartier, node.city?.name_fr, node.postal_code]
    .filter(Boolean).join(', ');

  return (
    <div className="min-h-screen bg-gray-50">
      {deleting && (
        <DeleteModal
          item={node}
          onCancel={() => setDeleting(false)}
          onConfirm={handleDelete}
          loading={deleteLoading}
        />
      )}

      {/* ── Hero header ── */}
      <div className="text-white" style={{ background: `linear-gradient(135deg, ${badgeColor}ee, ${badgeColor})` }}>
        <div className="px-6 py-5">
          {/* Breadcrumb */}
          <button onClick={() => navigate('/nodes')}
            className="flex items-center gap-2 text-white/70 hover:text-white text-sm font-medium mb-4 transition-colors">
            <Icon d={SVG.back} className="w-4 h-4" />
            Retour aux nœuds
          </button>

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-5">
              <div className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0 shadow-lg">
                {node.node_type?.icon
                  ? <span className="text-4xl">{node.node_type.icon}</span>
                  : <Icon d={SVG.node} className="w-10 h-10 text-white" />}
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl font-bold">{node.name_fr}</h1>
                  {node.is_active
                    ? <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-white/20 text-white">Actif</span>
                    : <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-black/20 text-white/70">Inactif</span>}
                </div>
                {node.name_ar && <p className="text-white/70 text-sm mb-2" dir="rtl">{node.name_ar}</p>}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 bg-white/20 rounded-lg text-xs font-mono font-bold">{node.code}</span>
                  {node.node_type && (
                    <span className="px-2.5 py-0.5 bg-white/20 rounded-lg text-xs font-semibold">
                      {node.node_type.name_fr}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {hasPermission('nodes.update') && (
                <button onClick={() => navigate('/nodes', { state: { editNodeId: node.id } })}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold rounded-xl transition-colors">
                  <Icon d={SVG.edit} className="w-4 h-4" />Modifier
                </button>
              )}
              {hasPermission('nodes.delete') && (
                <button onClick={() => setDeleting(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-black/20 hover:bg-black/30 text-white text-sm font-semibold rounded-xl transition-colors">
                  <Icon d={SVG.trash} className="w-4 h-4" />Supprimer
                </button>
              )}
            </div>
          </div>

          {/* Stat chips */}
          <div className="flex gap-3 mt-5 flex-wrap">
            {node.delivery_radius_km && (
              <div className="flex items-center gap-2 px-3 py-2 bg-white/15 rounded-xl text-sm">
                <Icon d={SVG.location} className="w-4 h-4" />
                <span className="font-semibold">{node.delivery_radius_km} km</span>
                <span className="text-white/70 text-xs">rayon</span>
              </div>
            )}
            {node.max_daily_orders && (
              <div className="flex items-center gap-2 px-3 py-2 bg-white/15 rounded-xl text-sm">
                <Icon d={SVG.orders} className="w-4 h-4" />
                <span className="font-semibold">{node.max_daily_orders}</span>
                <span className="text-white/70 text-xs">cmd/jour max</span>
              </div>
            )}
            {slots.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-white/15 rounded-xl text-sm">
                <Icon d={SVG.clock} className="w-4 h-4" />
                <span className="font-semibold">{slots.length}</span>
                <span className="text-white/70 text-xs">créneaux</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-5 max-w-6xl">

        {/* Left column */}
        <div className="lg:col-span-2 space-y-5">

          {/* Informations générales */}
          <Section title="Informations générales" icon={SVG.node}>
            <InfoRow icon={SVG.node} label="Code" value={node.code} mono />
            <InfoRow icon={SVG.node} label="Nom (Arabe)" value={node.name_ar} rtl />
            <InfoRow icon={SVG.phone} label="Téléphone" value={node.phone} />
            <InfoRow icon={SVG.clock} label="Timezone" value={node.timezone} mono />
          </Section>

          {/* Localisation */}
          <Section title="Localisation" icon={SVG.mapPin}>
            {address && (
              <div className="py-2.5 border-b border-gray-50">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Adresse complète</p>
                <p className="text-sm text-gray-800 font-medium">{address}</p>
              </div>
            )}
            <InfoRow icon={SVG.location} label="Région" value={node.region?.name_fr} />
            <InfoRow icon={SVG.mapPin} label="Province" value={node.province?.name_fr} />
            {node.lat && node.lng && (
              <div className="py-2.5 border-b border-gray-50 last:border-0">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Coordonnées GPS</p>
                <p className="text-sm font-mono text-gray-800">{node.lat}, {node.lng}</p>
              </div>
            )}
          </Section>

          {/* Créneaux horaires */}
          <Section title={`Créneaux horaires (${slots.length})`} icon={SVG.clock}>
            {slots.length === 0 ? (
              <p className="text-sm text-gray-400 py-5 text-center">Aucun créneau configuré.</p>
            ) : (
              <div className="py-3">
                {DAYS_ORDER.map((dayKey) => {
                  const daySlots = slots.filter((s) => String(s.day_of_week) === dayKey);
                  if (!daySlots.length) return null;
                  return (
                    <div key={dayKey} className="mb-3 last:mb-0">
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">{DAY_LABELS[dayKey]}</p>
                      <div className="space-y-1.5">
                        {daySlots.map((s) => (
                          <div key={s.id} className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5">
                            <Icon d={SVG.clock} className="w-4 h-4 text-gray-300 flex-shrink-0" />
                            <span className="text-sm font-semibold text-gray-800 flex-1">{s.name_fr}</span>
                            {s.name_ar && <span className="text-xs text-gray-400" dir="rtl">{s.name_ar}</span>}
                            <span className="text-xs text-gray-500 font-mono bg-white border border-gray-100 px-2 py-0.5 rounded-lg">{s.slot_start} – {s.slot_end}</span>
                            <span className="text-xs text-gray-500 px-2 py-0.5 bg-white border border-gray-100 rounded-lg">{s.max_orders ?? 0} cmd max</span>
                            {s.is_active
                              ? <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Actif</span>
                              : <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">Inactif</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        </div>

        {/* Right column */}
        <div className="space-y-5">

          {/* Type de nœud */}
          {node.node_type && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3">Type de nœud</p>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${badgeColor}bb, ${badgeColor})` }}>
                  {node.node_type.icon ? <span className="text-xl">{node.node_type.icon}</span>
                    : <Icon d={SVG.node} className="w-6 h-6 text-white" />}
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">{node.node_type.name_fr}</p>
                  {node.node_type.name_ar && <p className="text-xs text-gray-400" dir="rtl">{node.node_type.name_ar}</p>}
                  <span className="text-[10px] font-mono text-gray-400">{node.node_type.code}</span>
                </div>
              </div>
              {node.node_type.description && (
                <p className="text-xs text-gray-400 leading-relaxed">{node.node_type.description}</p>
              )}
            </div>
          )}

          {/* Horaires d'ouverture */}
          <Section title="Horaires d'ouverture" icon={SVG.clock}>
            <div className="py-2 space-y-1">
              {DAYS_ORDER.map((dayKey) => {
                const h = hours[dayKey];
                const isOpen = h?.open;
                return (
                  <div key={dayKey} className={`flex items-center justify-between py-1.5 px-1 rounded-lg ${isOpen ? '' : 'opacity-50'}`}>
                    <span className={`text-xs font-semibold w-20 ${isOpen ? 'text-gray-800' : 'text-gray-400'}`}>{DAY_LABELS[dayKey]}</span>
                    {isOpen
                      ? <span className="text-xs font-mono text-red-600 font-semibold">{h.from} – {h.to}</span>
                      : <span className="text-xs text-gray-400 italic">Fermé</span>}
                  </div>
                );
              })}
            </div>
          </Section>

          {/* Capacité */}
          {(node.delivery_radius_km || node.max_daily_orders) && (
            <Section title="Capacité logistique" icon={SVG.orders}>
              {node.delivery_radius_km && (
                <div className="py-2.5 border-b border-gray-50">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Rayon de livraison</p>
                  <p className="text-2xl font-bold text-gray-900 mt-0.5">{node.delivery_radius_km} <span className="text-base text-gray-400 font-normal">km</span></p>
                </div>
              )}
              {node.max_daily_orders && (
                <div className="py-2.5">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Capacité max / jour</p>
                  <p className="text-2xl font-bold text-gray-900 mt-0.5">{node.max_daily_orders} <span className="text-base text-gray-400 font-normal">commandes</span></p>
                </div>
              )}
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
