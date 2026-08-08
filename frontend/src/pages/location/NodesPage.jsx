import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../utils/helpers';
import * as api from '../../api/locationNode.api';

// ── Icons ─────────────────────────────────────────────────────────────────────

const SVG = {
  plus:    'M12 4v16m8-8H4',
  edit:    'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  trash:   'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  search:  'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  node:    'M3 7l9-4 9 4-9 4-9-4zm0 5l9 4 9-4m-18 5l9 4 9-4',
  mapPin:  'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z',
  phone:   'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
  x:       'M6 18L18 6M6 6l12 12',
  clock:   'M12 8v4l3 2m-3-8a8 8 0 100 16 8 8 0 000-16z',
  eye:     'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
  check:   'M5 13l4 4L19 7',
  chevR:   'M9 5l7 7-7 7',
  sliders: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4',
};

function Icon({ d, className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
    </svg>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────

const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-300';
const sel = `${inp} cursor-pointer`;

function Fld({ label, req, half, children }) {
  return (
    <div className={half ? '' : ''}>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
        {label}{req && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

function StatusBadge({ active }) {
  return active ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Actif
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-500">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />Inactif
    </span>
  );
}

// ── Days config ───────────────────────────────────────────────────────────────

const DAYS = [
  { key: '1', label: 'Lun' }, { key: '2', label: 'Mar' }, { key: '3', label: 'Mer' },
  { key: '4', label: 'Jeu' }, { key: '5', label: 'Ven' }, { key: '6', label: 'Sam' },
  { key: '0', label: 'Dim' },
];
const DAY_LABELS = { '1': 'Lundi', '2': 'Mardi', '3': 'Mercredi', '4': 'Jeudi', '5': 'Vendredi', '6': 'Samedi', '0': 'Dimanche' };

const DEFAULT_HOURS = Object.fromEntries(
  ['1','2','3','4','5','6','0'].map((k) => [k, { open: k !== '0', from: '08:00', to: '20:00' }])
);

function parseHours(json) {
  if (!json) return { ...DEFAULT_HOURS };
  try {
    const parsed = typeof json === 'string' ? JSON.parse(json) : json;
    const result = { ...DEFAULT_HOURS };
    for (const [k, v] of Object.entries(parsed)) {
      result[k] = { open: v.open ?? true, from: v.from ?? '08:00', to: v.to ?? '20:00' };
    }
    return result;
  } catch { return { ...DEFAULT_HOURS }; }
}

// ── Step indicator ────────────────────────────────────────────────────────────

function StepBar({ step, nodeId }) {
  const steps = [
    { n: 1, label: 'Informations' },
    { n: 2, label: 'Horaires' },
    { n: 3, label: 'Créneaux', disabled: !nodeId },
  ];
  return (
    <div className="flex items-center gap-0 bg-black/10 rounded-xl p-1 mt-4">
      {steps.map((s, i) => (
        <div key={s.n} className="flex-1 flex items-center">
          <div className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            step === s.n ? 'bg-white text-red-600 shadow-sm' :
            s.disabled ? 'text-white/30 cursor-not-allowed' : 'text-white/60'
          }`}>
            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${step === s.n ? 'bg-red-600 text-white' : step > s.n ? 'bg-green-500 text-white' : 'bg-white/20 text-white/60'}`}>
              {step > s.n ? '✓' : s.n}
            </span>
            {s.label}
          </div>
          {i < steps.length - 1 && <div className="w-px h-4 bg-white/20 mx-0.5" />}
        </div>
      ))}
    </div>
  );
}

// ── NodeDrawer ────────────────────────────────────────────────────────────────

const EMPTY_NODE = {
  code: '', name_fr: '', name_ar: '', node_type_id: '',
  region_id: '', province_id: '', city_id: '',
  address_line1: '', quartier: '', postal_code: '',
  lat: '', lng: '', phone: '',
  timezone: 'Africa/Casablanca',
  delivery_radius_km: '', max_daily_orders: '', is_active: true,
};

const EMPTY_SLOT = { name_fr: '', name_ar: '', day_of_week: 1, slot_start: '08:00', slot_end: '10:00', max_orders: 0, is_active: true };

function NodeDrawer({ editNode, onClose, onSaved }) {
  const isEdit = !!editNode;

  // Step state
  const [step, setStep] = useState(1);
  const [savedNode, setSavedNode] = useState(editNode ?? null);

  // Step 1 form
  const [info, setInfo] = useState({ ...EMPTY_NODE });

  // Step 2 – opening hours
  const [hours, setHours] = useState({ ...DEFAULT_HOURS });

  // Step 3 – slots
  const [slots, setSlots] = useState([]);
  const [slotForm, setSlotForm] = useState({ ...EMPTY_SLOT });
  const [editingSlot, setEditingSlot] = useState(null);

  // Lookups
  const [nodeTypes, setNodeTypes] = useState([]);
  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [cities, setCities] = useState([]);
  const [saving, setSaving] = useState(false);

  // ── init ─────────────────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const [tRes, rRes] = await Promise.all([api.getActiveNodeTypes(), api.getRegions({ limit: 500 })]);
        setNodeTypes(tRes.data.data ?? []);
        setRegions(rRes.data.data ?? []);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (!editNode) { setInfo({ ...EMPTY_NODE }); setHours({ ...DEFAULT_HOURS }); return; }
    setInfo({
      code:              editNode.code          ?? '',
      name_fr:           editNode.name_fr       ?? '',
      name_ar:           editNode.name_ar       ?? '',
      node_type_id:      editNode.node_type_id  ?? '',
      region_id:         editNode.region_id     ?? '',
      province_id:       editNode.province_id   ?? '',
      city_id:           editNode.city_id       ?? '',
      address_line1:     editNode.address_line1 ?? '',
      quartier:          editNode.quartier       ?? '',
      postal_code:       editNode.postal_code   ?? '',
      lat:               editNode.lat           ?? '',
      lng:               editNode.lng           ?? '',
      phone:             editNode.phone         ?? '',
      timezone:          editNode.timezone      ?? 'Africa/Casablanca',
      delivery_radius_km:editNode.delivery_radius_km ?? '',
      max_daily_orders:  editNode.max_daily_orders   ?? '',
      is_active:         editNode.is_active ?? true,
    });
    setHours(parseHours(editNode.opening_hours_json));
    setSavedNode(editNode);
    loadDep(editNode.region_id, editNode.province_id);
    loadSlots(editNode.id);
  }, [editNode]);

  const loadDep = async (regionId, provinceId) => {
    try {
      const [pRes, cRes] = await Promise.all([
        api.getProvinces({ region_id: regionId || undefined, limit: 500 }),
        api.getCities({ province_id: provinceId || undefined, limit: 500 }),
      ]);
      setProvinces(pRes.data.data ?? []);
      setCities(cRes.data.data ?? []);
    } catch {}
  };

  const loadSlots = async (nodeId) => {
    if (!nodeId) return;
    try {
      const res = await api.getNodeSlots(nodeId);
      setSlots(res.data.data ?? []);
    } catch {}
  };

  // ── step 1/2 save ────────────────────────────────────────────────────────────

  const validateInfo = () => {
    const required = [
      { value: info.code?.trim(), label: 'Code' },
      { value: info.name_fr?.trim(), label: 'Nom (Français)' },
      { value: info.node_type_id, label: 'Type de nœud' },
      { value: info.region_id, label: 'Région' },
      { value: info.province_id, label: 'Province' },
      { value: info.city_id, label: 'Ville' },
    ];

    const missing = required.find((field) => !field.value);
    if (missing) {
      toast.error(`${missing.label} est requis`);
      return false;
    }

    return true;
  };

  const saveNode = async () => {
    if (!validateInfo()) {
      return null;
    }
    setSaving(true);
    try {
      const payload = {
        ...info,
        opening_hours_json: hours,
        lat: info.lat !== '' ? parseFloat(info.lat) : undefined,
        lng: info.lng !== '' ? parseFloat(info.lng) : undefined,
        delivery_radius_km: info.delivery_radius_km !== '' ? parseFloat(info.delivery_radius_km) : undefined,
        max_daily_orders: info.max_daily_orders !== '' ? parseInt(info.max_daily_orders) : undefined,
      };
      let node;
      if (isEdit && savedNode) {
        const res = await api.updateNode(savedNode.id, payload);
        node = res.data.data;
        toast.success('Nœud mis à jour');
      } else {
        const res = await api.createNode(payload);
        node = res.data.data;
        toast.success('Nœud créé');
      }
      setSavedNode(node);
      await loadSlots(node.id);
      return node;
    } catch (err) {
      toast.error(getErrorMessage(err));
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    if (step === 1) {
      if (!validateInfo()) return;
      setStep(2);
      return;
    }
    if (step === 2) {
      const node = await saveNode();
      if (node) setStep(3);
    }
  };

  const handleFinish = () => { onSaved(); };

  // ── slot CRUD ────────────────────────────────────────────────────────────────

  const submitSlot = async (e) => {
    e.preventDefault();
    if (!savedNode?.id) return;
    try {
      if (editingSlot) {
        await api.updateSlot(editingSlot.id, slotForm);
        toast.success('Créneau mis à jour');
      } else {
        await api.createNodeSlot(savedNode.id, slotForm);
        toast.success('Créneau ajouté');
      }
      setSlotForm({ ...EMPTY_SLOT });
      setEditingSlot(null);
      loadSlots(savedNode.id);
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  const deleteSlotItem = async (slotId) => {
    try {
      await api.deleteSlot(slotId);
      toast.success('Créneau supprimé');
      loadSlots(savedNode.id);
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  // ── render ────────────────────────────────────────────────────────────────────

  const badgeColor = nodeTypes.find((t) => t.id === info.node_type_id)?.color_badge || '#dc2626';

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-40 flex flex-col bg-white shadow-2xl w-full max-w-2xl">

        {/* Header */}
        <div className="px-6 py-5" style={{ background: `linear-gradient(135deg, ${badgeColor}dd, ${badgeColor})` }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                <Icon d={SVG.node} className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-white/60 text-[11px] font-semibold uppercase tracking-widest">
                  {isEdit ? 'Modifier le nœud' : 'Nouveau nœud'}
                </p>
                <h2 className="text-white font-bold text-xl leading-tight">
                  {info.name_fr || 'Nœud logistique'}
                </h2>
              </div>
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/25 flex items-center justify-center">
              <Icon d={SVG.x} className="w-5 h-5 text-white" />
            </button>
          </div>
          <StepBar step={step} nodeId={savedNode?.id} />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Step 1: Info ── */}
          {step === 1 && (
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Fld label="Code" req>
                  <input className={`${inp} uppercase`} value={info.code}
                    onChange={(e) => setInfo((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                    required placeholder="DS-CASA-01" />
                </Fld>
                <Fld label="Statut">
                  <div className="h-full flex items-end pb-0.5">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div onClick={() => setInfo((f) => ({ ...f, is_active: !f.is_active }))}
                        className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${info.is_active ? 'bg-red-600' : 'bg-gray-200'}`}>
                        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${info.is_active ? 'translate-x-5' : ''}`} />
                      </div>
                      <span className={`text-sm font-semibold ${info.is_active ? 'text-red-600' : 'text-gray-400'}`}>
                        {info.is_active ? 'Actif' : 'Inactif'}
                      </span>
                    </label>
                  </div>
                </Fld>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Fld label="Nom (Français)" req>
                  <input className={inp} value={info.name_fr} onChange={(e) => setInfo((f) => ({ ...f, name_fr: e.target.value }))} placeholder="Dark Store Casablanca" />
                </Fld>
                <Fld label="Nom (Arabe)">
                  <input className={inp} value={info.name_ar} onChange={(e) => setInfo((f) => ({ ...f, name_ar: e.target.value }))} dir="rtl" placeholder="متجر الظلام الدار البيضاء" />
                </Fld>
              </div>

              <Fld label="Type de nœud" req>
                <select className={sel} value={info.node_type_id} onChange={(e) => setInfo((f) => ({ ...f, node_type_id: e.target.value }))} required>
                  <option value="">— Sélectionner un type —</option>
                  {nodeTypes.map((t) => <option key={t.id} value={t.id}>{t.icon ? `${t.icon} ` : ''}{t.name_fr}</option>)}
                </select>
              </Fld>

              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Localisation</p>
                <div className="grid grid-cols-3 gap-3">
                  <Fld label="Région" req>
                    <select className={sel} value={info.region_id}
                      onChange={async (e) => {
                        const v = e.target.value;
                        setInfo((f) => ({ ...f, region_id: v, province_id: '', city_id: '' }));
                        setProvinces([]); setCities([]);
                        if (v) {
                          const res = await api.getProvinces({ region_id: v, limit: 500 });
                          setProvinces(res.data.data ?? []);
                        }
                      }} required>
                      <option value="">Région…</option>
                      {regions.map((r) => <option key={r.id} value={r.id}>{r.name_fr}</option>)}
                    </select>
                  </Fld>
                  <Fld label="Province" req>
                    <select className={sel} value={info.province_id}
                      onChange={async (e) => {
                        const v = e.target.value;
                        setInfo((f) => ({ ...f, province_id: v, city_id: '' }));
                        setCities([]);
                        if (v) {
                          const res = await api.getCities({ province_id: v, limit: 500 });
                          setCities(res.data.data ?? []);
                        }
                      }} required disabled={!info.region_id}>
                      <option value="">Province…</option>
                      {provinces.map((p) => <option key={p.id} value={p.id}>{p.name_fr}</option>)}
                    </select>
                  </Fld>
                  <Fld label="Ville" req>
                    <select className={sel} value={info.city_id}
                      onChange={(e) => setInfo((f) => ({ ...f, city_id: e.target.value }))}
                      required disabled={!info.province_id}>
                      <option value="">Ville…</option>
                      {cities.map((c) => <option key={c.id} value={c.id}>{c.name_fr}</option>)}
                    </select>
                  </Fld>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Fld label="Adresse">
                  <input className={inp} value={info.address_line1} onChange={(e) => setInfo((f) => ({ ...f, address_line1: e.target.value }))} placeholder="Rue / Boulevard…" />
                </Fld>
                <Fld label="Quartier">
                  <input className={inp} value={info.quartier} onChange={(e) => setInfo((f) => ({ ...f, quartier: e.target.value }))} placeholder="Quartier…" />
                </Fld>
                <Fld label="Code postal">
                  <input className={inp} value={info.postal_code} onChange={(e) => setInfo((f) => ({ ...f, postal_code: e.target.value }))} placeholder="20000" />
                </Fld>
                <Fld label="Téléphone">
                  <input className={inp} value={info.phone} onChange={(e) => setInfo((f) => ({ ...f, phone: e.target.value }))} placeholder="+212 6XX XXX XXX" />
                </Fld>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Fld label="Latitude">
                  <input type="number" step="any" min="-90" max="90" className={inp} value={info.lat}
                    onChange={(e) => setInfo((f) => ({ ...f, lat: e.target.value }))} placeholder="33.5731 (−90 à 90)" />
                </Fld>
                <Fld label="Longitude">
                  <input type="number" step="any" min="-180" max="180" className={inp} value={info.lng}
                    onChange={(e) => setInfo((f) => ({ ...f, lng: e.target.value }))} placeholder="-7.5898 (−180 à 180)" />
                </Fld>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Fld label="Timezone">
                  <input className={inp} value={info.timezone} onChange={(e) => setInfo((f) => ({ ...f, timezone: e.target.value }))} placeholder="Africa/Casablanca" />
                </Fld>
                <Fld label="Rayon livraison (km)">
                  <input type="number" min={0} step={0.1} className={inp} value={info.delivery_radius_km}
                    onChange={(e) => setInfo((f) => ({ ...f, delivery_radius_km: e.target.value }))} placeholder="5" />
                </Fld>
                <Fld label="Capacité max / jour">
                  <input type="number" min={0} className={inp} value={info.max_daily_orders}
                    onChange={(e) => setInfo((f) => ({ ...f, max_daily_orders: e.target.value }))} placeholder="200" />
                </Fld>
              </div>
            </div>
          )}

          {/* ── Step 2: Horaires ── */}
          {step === 2 && (
            <div className="p-6">
              <p className="text-sm text-gray-500 mb-5">Définissez les horaires d'ouverture pour chaque jour de la semaine.</p>
              <div className="space-y-2">
                {DAYS.map(({ key, label }) => {
                  const h = hours[key];
                  return (
                    <div key={key} className={`flex items-center gap-4 p-3 rounded-xl border transition-colors ${h.open ? 'border-red-100 bg-red-50/30' : 'border-gray-100 bg-gray-50'}`}>
                      {/* Day toggle */}
                      <div className="w-24 flex items-center gap-2 flex-shrink-0">
                        <div
                          onClick={() => setHours((prev) => ({ ...prev, [key]: { ...prev[key], open: !prev[key].open } }))}
                          className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer flex-shrink-0 ${h.open ? 'bg-red-600' : 'bg-gray-300'}`}
                        >
                          <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${h.open ? 'translate-x-5' : ''}`} />
                        </div>
                        <span className={`text-sm font-bold w-8 ${h.open ? 'text-red-700' : 'text-gray-400'}`}>{label}</span>
                      </div>

                      {h.open ? (
                        <div className="flex items-center gap-3 flex-1">
                          <div className="flex items-center gap-2 flex-1">
                            <Icon d={SVG.clock} className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <input
                              type="time"
                              value={h.from}
                              onChange={(e) => setHours((prev) => ({ ...prev, [key]: { ...prev[key], from: e.target.value } }))}
                              className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400"
                            />
                          </div>
                          <span className="text-gray-400 text-xs font-medium">à</span>
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="time"
                              value={h.to}
                              onChange={(e) => setHours((prev) => ({ ...prev, [key]: { ...prev[key], to: e.target.value } }))}
                              className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400"
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400 italic flex-1">Fermé</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Step 3: Créneaux ── */}
          {step === 3 && (
            <div className="p-6 space-y-5">
              {!savedNode?.id ? (
                <p className="text-sm text-gray-500 text-center py-8">Enregistrez d'abord le nœud pour gérer les créneaux.</p>
              ) : (
                <>
                  {/* Add / edit slot form */}
                  <div className="bg-gray-50 rounded-2xl border border-gray-100 p-4">
                    <h3 className="text-sm font-bold text-gray-800 mb-3">{editingSlot ? 'Modifier le créneau' : 'Nouveau créneau'}</h3>
                    <form id="slot-form" onSubmit={submitSlot} className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <Fld label="Nom FR" req>
                          <input className={inp} value={slotForm.name_fr}
                            onChange={(e) => setSlotForm((f) => ({ ...f, name_fr: e.target.value }))}
                            required placeholder="Matin" />
                        </Fld>
                        <Fld label="Nom AR">
                          <input className={inp} dir="rtl" value={slotForm.name_ar}
                            onChange={(e) => setSlotForm((f) => ({ ...f, name_ar: e.target.value }))}
                            placeholder="الصباح" />
                        </Fld>
                      </div>
                      <div className="grid grid-cols-4 gap-3">
                        <Fld label="Jour">
                          <select className={sel} value={slotForm.day_of_week}
                            onChange={(e) => setSlotForm((f) => ({ ...f, day_of_week: Number(e.target.value) }))}>
                            {DAYS.map(({ key, label }) => <option key={key} value={key}>{DAY_LABELS[key]}</option>)}
                          </select>
                        </Fld>
                        <Fld label="Début">
                          <input type="time" className={inp} value={slotForm.slot_start}
                            onChange={(e) => setSlotForm((f) => ({ ...f, slot_start: e.target.value }))} />
                        </Fld>
                        <Fld label="Fin">
                          <input type="time" className={inp} value={slotForm.slot_end}
                            onChange={(e) => setSlotForm((f) => ({ ...f, slot_end: e.target.value }))} />
                        </Fld>
                        <Fld label="Max cmdes">
                          <input type="number" min={0} className={inp} value={slotForm.max_orders}
                            onChange={(e) => setSlotForm((f) => ({ ...f, max_orders: Number(e.target.value) }))} />
                        </Fld>
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
                          <div onClick={() => setSlotForm((f) => ({ ...f, is_active: !f.is_active }))}
                            className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${slotForm.is_active ? 'bg-red-600' : 'bg-gray-200'}`}>
                            <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${slotForm.is_active ? 'translate-x-4' : ''}`} />
                          </div>
                          <span className={`font-semibold ${slotForm.is_active ? 'text-red-600' : 'text-gray-400'}`}>{slotForm.is_active ? 'Actif' : 'Inactif'}</span>
                        </label>
                        <div className="flex gap-2">
                          {editingSlot && (
                            <button type="button" onClick={() => { setEditingSlot(null); setSlotForm({ ...EMPTY_SLOT }); }}
                              className="px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                              Annuler
                            </button>
                          )}
                          <button type="submit" className="px-4 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">
                            {editingSlot ? 'Mettre à jour' : '+ Ajouter'}
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>

                  {/* Slot list */}
                  {slots.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">Aucun créneau — ajoutez-en un ci-dessus.</div>
                  ) : (
                    <div className="space-y-2">
                      {DAYS.map(({ key }) => {
                        const daySlots = slots.filter((s) => String(s.day_of_week) === key);
                        if (!daySlots.length) return null;
                        return (
                          <div key={key}>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-1.5">{DAY_LABELS[key]}</p>
                            <div className="space-y-1.5">
                              {daySlots.map((s) => (
                                <div key={s.id} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-2.5 shadow-sm">
                                  <Icon d={SVG.clock} className="w-4 h-4 text-gray-300 flex-shrink-0" />
                                  <span className="text-sm font-semibold text-gray-800 flex-1">{s.name_fr}</span>
                                  <span className="text-xs text-gray-500 font-mono">{s.slot_start} – {s.slot_end}</span>
                                  <span className="text-xs text-gray-400 px-2 py-0.5 bg-gray-50 rounded-lg border border-gray-100">
                                    {s.max_orders} cmd max
                                  </span>
                                  {s.is_active
                                    ? <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Actif</span>
                                    : <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">Inactif</span>
                                  }
                                  <button onClick={() => { setEditingSlot(s); setSlotForm({ name_fr: s.name_fr, name_ar: s.name_ar ?? '', day_of_week: s.day_of_week, slot_start: s.slot_start, slot_end: s.slot_end, max_orders: s.max_orders ?? 0, is_active: s.is_active }); }}
                                    className="text-amber-500 hover:text-amber-700 p-1">
                                    <Icon d={SVG.edit} className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => deleteSlotItem(s.id)} className="text-red-400 hover:text-red-600 p-1">
                                    <Icon d={SVG.trash} className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-100">
            {step === 3 ? 'Fermer' : 'Annuler'}
          </button>
          <div className="flex-1" />
          {step > 1 && (
            <button type="button" onClick={() => setStep((s) => s - 1)}
              className="px-4 py-2.5 text-sm font-semibold text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50">
              ← Précédent
            </button>
          )}
          {step < 3 ? (
            <button type="button" onClick={handleNext} disabled={saving}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors disabled:opacity-50">
              {saving ? 'Enregistrement…' : step === 2 ? (isEdit ? 'Mettre à jour →' : 'Créer & Créneaux →') : 'Suivant →'}
            </button>
          ) : (
            <button type="button" onClick={handleFinish}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors">
              <Icon d={SVG.check} className="w-4 h-4 inline mr-1" />
              Terminer
            </button>
          )}
        </div>
      </div>
    </>
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
          Le nœud <span className="font-semibold text-gray-700">«{item?.name_fr}»</span> sera supprimé définitivement.
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

// ── Node card ─────────────────────────────────────────────────────────────────

function NodeCard({ node, onEdit, onDelete, onDetail }) {
  const badgeColor = node.node_type?.color_badge || '#dc2626';
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-red-100 transition-all flex flex-col">
      <div className="flex-1 p-5 cursor-pointer" onClick={() => onDetail(node)}>
        <div className="flex items-start gap-4 mb-3">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm"
            style={{ background: `linear-gradient(135deg, ${badgeColor}bb, ${badgeColor})` }}>
            {node.node_type?.icon ? <span className="text-2xl">{node.node_type.icon}</span>
              : <Icon d={SVG.node} className="w-7 h-7 text-white" />}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-sm leading-tight">{node.name_fr}</h3>
            {node.name_ar && <p className="text-xs text-gray-400 mt-0.5 truncate" dir="rtl">{node.name_ar}</p>}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[11px] font-mono rounded-md border border-gray-200">{node.code}</span>
              <StatusBadge active={node.is_active} />
            </div>
          </div>
        </div>

        {node.node_type && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold text-white mb-2"
            style={{ background: badgeColor }}>
            {node.node_type.icon && <span>{node.node_type.icon}</span>}
            {node.node_type.name_fr}
          </span>
        )}

        {node.city?.name_fr && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-1">
            <Icon d={SVG.mapPin} className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
            <span className="truncate">{node.city.name_fr}{node.quartier ? ` — ${node.quartier}` : ''}</span>
          </div>
        )}
        {node.phone && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-1">
            <Icon d={SVG.phone} className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
            <span>{node.phone}</span>
          </div>
        )}
        {node.delivery_radius_km && (
          <p className="text-[11px] text-gray-400 mt-1.5">
            Rayon: <span className="font-semibold text-gray-600">{node.delivery_radius_km} km</span>
            {node.max_daily_orders ? <> · Capacité: <span className="font-semibold text-gray-600">{node.max_daily_orders}/j</span></> : null}
          </p>
        )}

        <div className="mt-3 text-xs text-red-400 font-semibold flex items-center gap-1">
          <Icon d={SVG.eye} className="w-3.5 h-3.5" />
          Voir détail
        </div>
      </div>

      <div className="flex items-center gap-1.5 px-4 pb-4 pt-3 border-t border-gray-50">
        <button onClick={(e) => { e.stopPropagation(); onEdit(node); }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg">
          <Icon d={SVG.edit} className="w-3.5 h-3.5" />Modifier
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(node); }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg ml-auto">
          <Icon d={SVG.trash} className="w-3.5 h-3.5" />Supprimer
        </button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function NodesPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  const [nodes, setNodes]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [drawer, setDrawer]     = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [statusFilter, setStatusFilter] = useState('all');
  const [searchInput, setSearchInput]   = useState('');
  const [search, setSearch]             = useState('');
  const [typeFilter, setTypeFilter]     = useState('all');
  const [nodeTypes, setNodeTypes]       = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nodesRes, typesRes] = await Promise.all([api.getNodes({ limit: 500 }), api.getNodeTypes()]);
      setNodes(nodesRes.data.data ?? []);
      setNodeTypes(typesRes.data.data ?? []);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      await api.deleteNode(deleting.id);
      toast.success('Nœud supprimé');
      setDeleting(null);
      load();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setDeleteLoading(false); }
  };

  const q = search.toLowerCase();
  const filtered = nodes.filter((n) => {
    if (statusFilter === 'active' && !n.is_active) return false;
    if (statusFilter === 'inactive' && n.is_active) return false;
    if (typeFilter !== 'all' && n.node_type_id !== typeFilter) return false;
    if (q && !(n.name_fr ?? '').toLowerCase().includes(q) && !(n.code ?? '').toLowerCase().includes(q)) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {deleting && <DeleteModal item={deleting} onCancel={() => setDeleting(null)} onConfirm={handleDelete} loading={deleteLoading} />}
      {drawer && (
        <NodeDrawer
          editNode={drawer.editNode ?? null}
          onClose={() => setDrawer(null)}
          onSaved={() => { setDrawer(null); load(); }}
        />
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Noeuds</h1>
              <p className="text-sm text-gray-400 mt-0.5">Entrepôts, dark stores, hubs logistiques</p>
            </div>
            {hasPermission('nodes.create') && (
              <button onClick={() => setDrawer({ editNode: null })}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all flex-shrink-0">
                <Icon d={SVG.plus} className="w-4 h-4" />Nouveau nœud
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
              {[{ v: 'all', l: 'Tous' }, { v: 'active', l: 'Actif' }, { v: 'inactive', l: 'Inactif' }].map((o) => (
                <button key={o.v} onClick={() => setStatusFilter(o.v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${statusFilter === o.v ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
                  {o.l}
                </button>
              ))}
            </div>

            {nodeTypes.length > 0 && (
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
                className="text-xs font-semibold border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500">
                <option value="all">Tous les types</option>
                {nodeTypes.map((t) => <option key={t.id} value={t.id}>{t.name_fr}</option>)}
              </select>
            )}

            <form onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); }} className="flex items-center gap-2 flex-1 min-w-0 max-w-sm">
              <div className="relative flex-1">
                <Icon d={SVG.search} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Rechercher…"
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 bg-white" />
              </div>
              <button type="submit" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-xl">Filtrer</button>
              {search && <button type="button" onClick={() => { setSearch(''); setSearchInput(''); }} className="px-2.5 py-2 border border-gray-200 text-gray-500 text-sm rounded-xl hover:bg-gray-50">✕</button>}
            </form>

            <span className="text-xs text-gray-400 ml-auto">{filtered.length} nœud{filtered.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      {nodes.length > 0 && (
        <div className="px-6 pt-4 pb-0">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total', value: nodes.length, color: 'bg-red-50 border-red-100 text-red-700' },
              { label: 'Actifs', value: nodes.filter((n) => n.is_active).length, color: 'bg-emerald-50 border-emerald-100 text-emerald-700' },
              { label: 'Inactifs', value: nodes.filter((n) => !n.is_active).length, color: 'bg-gray-50 border-gray-100 text-gray-600' },
            ].map((s) => (
              <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.color}`}>
                <p className="text-xs font-semibold opacity-70 uppercase tracking-wide">{s.label}</p>
                <p className="text-2xl font-bold mt-0.5">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="px-6 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" />
            <p className="text-sm text-gray-400">Chargement…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center bg-red-50 border border-red-100">
              <Icon d={SVG.node} className="w-10 h-10 text-red-200" />
            </div>
            <div className="text-center">
              <p className="text-gray-600 font-semibold">Aucun nœud trouvé</p>
              <p className="text-gray-400 text-sm mt-1">{search || statusFilter !== 'all' || typeFilter !== 'all' ? 'Modifiez vos filtres.' : 'Cliquez sur « Nouveau nœud » pour commencer.'}</p>
            </div>
            {!search && statusFilter === 'all' && typeFilter === 'all' && hasPermission('nodes.create') && (
              <button onClick={() => setDrawer({ editNode: null })} className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl">
                + Créer le premier nœud
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((node) => (
              <NodeCard key={node.id} node={node}
                onEdit={(n) => setDrawer({ editNode: n })}
                onDelete={(n) => setDeleting(n)}
                onDetail={(n) => navigate(`/nodes/${n.id}`)}
              />
            ))}
            {hasPermission('nodes.create') && (
              <button onClick={() => setDrawer({ editNode: null })}
                className="rounded-2xl border-2 border-dashed border-red-200 hover:border-red-400 bg-white hover:bg-red-50 text-red-400 hover:text-red-600 transition-all flex flex-col items-center justify-center gap-3 p-8 min-h-[200px]">
                <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                  <Icon d={SVG.plus} className="w-6 h-6 text-red-500" />
                </div>
                <span className="text-sm font-semibold">Ajouter un nœud</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
