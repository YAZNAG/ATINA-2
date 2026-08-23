import { useState, useEffect } from 'react';
import {
  createNode, updateNode, getRegions, getActiveNodeTypes,
  getNodeSlots, createNodeSlot, updateSlot, deleteSlot,
} from '../../../api/locationNode.api';
import { getConfigKeys, getOrderConfigs, saveOrderConfig, deleteOrderConfig } from '../../../api/orders.api';
import { useCascadeGeo } from './useCascadeGeo';
import Toggle from '../../../components/ui/Toggle';

const SVG = {
  node: 'M3 7l9-4 9 4-9 4-9-4zm0 5l9 4 9-4m-18 5l9 4 9-4',
  x: 'M6 18L18 6M6 6l12 12',
  clock: 'M12 8v4l3 2m-3-8a8 8 0 100 16 8 8 0 000-16z',
  check: 'M5 13l4 4L19 7',
  edit: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  trash: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
};

function Icon({ d, className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
    </svg>
  );
}

const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#E10600] placeholder-gray-300';
const sel = `${inp} cursor-pointer`;

function Fld({ label, req, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
        {label}{req && <span className="text-[#E10600] ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

const DAYS = [
  { key: '1', label: 'Lun' }, { key: '2', label: 'Mar' }, { key: '3', label: 'Mer' },
  { key: '4', label: 'Jeu' }, { key: '5', label: 'Ven' }, { key: '6', label: 'Sam' },
  { key: '0', label: 'Dim' },
];
const DAY_LABELS = { '1': 'Lundi', '2': 'Mardi', '3': 'Mercredi', '4': 'Jeudi', '5': 'Vendredi', '6': 'Samedi', '0': 'Dimanche' };

const DEFAULT_HOURS = Object.fromEntries(
  ['1', '2', '3', '4', '5', '6', '0'].map((k) => [k, { open: k !== '0', from: '08:00', to: '20:00' }])
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

function StepBar({ step, nodeId }) {
  const steps = [
    { n: 1, label: 'Informations' },
    { n: 2, label: 'Horaires' },
    { n: 3, label: 'Créneaux', disabled: !nodeId },
    { n: 4, label: 'Configuration', disabled: !nodeId },
  ];
  return (
    <div className="flex items-center gap-0 bg-black/10 rounded-xl p-1 mt-4">
      {steps.map((s, i) => (
        <div key={s.n} className="flex-1 flex items-center">
          <div className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            step === s.n ? 'bg-white text-[#E10600] shadow-sm' :
            s.disabled ? 'text-white/30 cursor-not-allowed' : 'text-white/60'
          }`}>
            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${step === s.n ? 'bg-[#E10600] text-white' : step > s.n ? 'bg-green-500 text-white' : 'bg-white/20 text-white/60'}`}>
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

const EMPTY_NODE = {
  code: '', name_fr: '', name_ar: '', node_type_id: '',
  region_id: '', city_id: '',
  lat: '', lng: '', delivery_radius_km: '', max_daily_orders: '', is_active: true,
};

const EMPTY_SLOT = { name_fr: '', name_ar: '', day_of_week: 1, slot_start: '08:00', slot_end: '10:00', max_orders: 0, is_active: true };

export default function NodeDrawer({ editNode, onClose, onSaved, showToast }) {
  const isEdit = !!editNode;

  const [step, setStep] = useState(1);
  const [savedNode, setSavedNode] = useState(editNode ?? null);
  const [info, setInfo] = useState({ ...EMPTY_NODE });
  const [hours, setHours] = useState({ ...DEFAULT_HOURS });
  const [slots, setSlots] = useState([]);
  const [slotForm, setSlotForm] = useState({ ...EMPTY_SLOT });
  const [editingSlot, setEditingSlot] = useState(null);
  const [nodeTypes, setNodeTypes] = useState([]);
  const [regions, setRegions] = useState([]);
  const [configDefinitions, setConfigDefinitions] = useState([]);
  const [configValues, setConfigValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [savingConfig, setSavingConfig] = useState({});

    const { cities } = useCascadeGeo({
    regionId: info.region_id,
    onCityReset: () => setInfo((f) => ({ ...f, city_id: '' })),
  });

  useEffect(() => {
    (async () => {
      try {
        const [tRes, rRes] = await Promise.all([
          getActiveNodeTypes(),
          getRegions({ limit: 500, is_active: true }),
        ]);
        setNodeTypes(tRes.data.data ?? []);
        setRegions(rRes.data.data ?? []);
      } catch { /* non bloquant */ }
    })();
  }, []);

    useEffect(() => {
    if (!editNode) { setInfo({ ...EMPTY_NODE }); setHours({ ...DEFAULT_HOURS }); setSavedNode(null); setConfigDefinitions([]); setConfigValues({}); return; }
    setInfo({
      code: editNode.code ?? '',
      name_fr: editNode.name_fr ?? '',
      name_ar: editNode.name_ar ?? '',
      node_type_id: editNode.node_type_id ?? '',
      region_id: editNode.region_id ?? '',
      city_id: editNode.city_id ?? '',
      lat: editNode.lat ?? '',
      lng: editNode.lng ?? '',
      delivery_radius_km: editNode.delivery_radius_km ?? '',
      max_daily_orders: editNode.max_daily_orders ?? '',
      is_active: editNode.is_active ?? true,
    });
    setHours(parseHours(editNode.opening_hours_json));
    setSavedNode(editNode);
    loadSlots(editNode.id);
    loadNodeConfigs(editNode.id);
  }, [editNode]);

  const loadSlots = async (nodeId) => {
    if (!nodeId) return;
    try {
      const res = await getNodeSlots(nodeId);
      setSlots(res.data.data ?? []);
    } catch { /* non bloquant */ }
  };

  const loadNodeConfigs = async (nodeIdValue) => {
    if (!nodeIdValue) {
      setConfigDefinitions([]);
      setConfigValues({});
      return;
    }
    try {
      const [keysRes, cfgRes] = await Promise.all([
        getConfigKeys(),
        getOrderConfigs({ node_id: nodeIdValue }),
      ]);
      const definitions = [
        ...(keysRes.data?.data?.order_rules ?? []),
        ...(keysRes.data?.data?.payment ?? []),
      ];
      const current = Object.fromEntries((cfgRes.data?.data ?? cfgRes.data ?? []).map((c) => [c.config_key, c]));
      const initialValues = Object.fromEntries(definitions.map((d) => [d.key, current[d.key]?.config_value ?? d.default ?? '']));
      setConfigDefinitions(definitions);
      setConfigValues(initialValues);
    } catch {
      setConfigDefinitions([]);
      setConfigValues({});
    }
  };

  const saveNodeConfig = async (configKey, configType, configValue) => {
    if (!savedNode?.id) return;
    setSavingConfig((prev) => ({ ...prev, [configKey]: true }));
    try {
      await saveOrderConfig({
        node_id: savedNode.id,
        config_key: configKey,
        config_value: configValue,
        value_type_code: configType,
      });
      await loadNodeConfigs(savedNode.id);
      showToast('success', 'Configuration enregistrée');
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Erreur lors de l\'enregistrement de la configuration');
    } finally {
      setSavingConfig((prev) => ({ ...prev, [configKey]: false }));
    }
  };

  const removeNodeConfig = async (configKey) => {
    if (!savedNode?.id) return;
    const existing = (await getOrderConfigs({ node_id: savedNode.id })).data?.data ?? [];
    const found = existing.find((c) => c.config_key === configKey);
    if (!found) return;
    try {
      await deleteOrderConfig(found.id);
      await loadNodeConfigs(savedNode.id);
      showToast('success', 'Override supprimé');
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  const saveNode = async () => {
    if (!info.code.trim() || !info.name_fr.trim() || !info.node_type_id) {
      showToast('error', 'Code, Nom FR et Type sont requis');
      return null;
    }
    setSaving(true);
    try {
      const payload = {
        ...info,
        opening_hours_json: hours,
        region_id: info.region_id || null,
        city_id: info.city_id || null,
        lat: info.lat !== '' ? parseFloat(info.lat) : undefined,
        lng: info.lng !== '' ? parseFloat(info.lng) : undefined,
        delivery_radius_km: info.delivery_radius_km !== '' ? parseFloat(info.delivery_radius_km) : undefined,
        max_daily_orders: info.max_daily_orders !== '' ? parseInt(info.max_daily_orders, 10) : undefined,
      };
      let node;
      if (isEdit && savedNode) {
        const res = await updateNode(savedNode.id, payload);
        node = res.data.data;
        showToast('success', 'Nœud mis à jour');
      } else {
        const res = await createNode(payload);
        node = res.data.data;
        showToast('success', 'Nœud créé');
      }
      setSavedNode(node);
      await loadSlots(node.id);
      return node;
    } catch (err) {
      showToast('error', err?.response?.data?.message || "Erreur lors de l'enregistrement");
      return null;
    } finally {
      setSaving(false);
    }
  };

    const validateInfo = () => {
    const required = [
      { value: info.code?.trim(), label: 'Code' },
      { value: info.name_fr?.trim(), label: 'Nom (Français)' },
      { value: info.node_type_id, label: 'Type de nœud' },
      { value: info.region_id, label: 'Région' },
      { value: info.city_id, label: 'Ville' },
    ];

    const missing = required.find((field) => !field.value);
    if (missing) {
      showToast('error', `${missing.label} est requis`);
      return false;
    }

    return true;
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
      return;
    }
    if (step === 3) {
      setStep(4);
      if (savedNode?.id) {
        await loadNodeConfigs(savedNode.id);
      }
    }
  };

  const submitSlot = async (e) => {
    e.preventDefault();
    if (!savedNode?.id) return;
    try {
      if (editingSlot) {
        await updateSlot(editingSlot.id, slotForm);
        showToast('success', 'Créneau mis à jour');
      } else {
        await createNodeSlot(savedNode.id, slotForm);
        showToast('success', 'Créneau ajouté');
      }
      setSlotForm({ ...EMPTY_SLOT });
      setEditingSlot(null);
      loadSlots(savedNode.id);
    } catch (err) {
      showToast('error', err?.response?.data?.message || "Erreur lors de l'enregistrement du créneau");
    }
  };

  const deleteSlotItem = async (slotId) => {
    try {
      await deleteSlot(slotId);
      showToast('success', 'Créneau supprimé');
      loadSlots(savedNode.id);
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Erreur lors de la suppression du créneau');
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-40 flex flex-col bg-white shadow-2xl w-full max-w-2xl">

        <div className="px-6 py-5 bg-gradient-to-br from-[#E10600] to-[#c00500]">
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

        <div className="flex-1 overflow-y-auto">
          {step === 1 && (
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Fld label="Code" req>
                  <input className={`${inp} uppercase`} value={info.code}
                    onChange={(e) => setInfo((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                    required placeholder="DS-CASA-01" />
                </Fld>
                <Fld label="Statut">
  <div className="h-[42px] flex items-center">
    <Toggle checked={info.is_active} onChange={() => setInfo((f) => ({ ...f, is_active: !f.is_active }))} />
  </div>
</Fld>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Fld label="Nom (Français)" req>
                  <input className={inp} value={info.name_fr} onChange={(e) => setInfo((f) => ({ ...f, name_fr: e.target.value }))} placeholder="Dark Store Casablanca" />
                </Fld>
                <Fld label="Nom (Arabe)">
                  <input className={inp} value={info.name_ar} onChange={(e) => setInfo((f) => ({ ...f, name_ar: e.target.value }))} dir="rtl" />
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
                <div className="grid grid-cols-2 gap-3">
                  <Fld label="Région">
                    <select className={sel} value={info.region_id}
                      onChange={(e) => setInfo((f) => ({ ...f, region_id: e.target.value, city_id: '' }))}>
                      <option value="">Région…</option>
                      {regions.map((r) => <option key={r.id} value={r.id}>{r.name_fr}</option>)}
                    </select>
                  </Fld>
                  <Fld label="Ville">
                    <select className={sel} value={info.city_id}
                      onChange={(e) => setInfo((f) => ({ ...f, city_id: e.target.value }))}
                      disabled={!info.region_id}>
                      <option value="">Ville…</option>
                      {cities.map((c) => <option key={c.id} value={c.id}>{c.name_fr}</option>)}
                    </select>
                  </Fld>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Fld label="Latitude">
                  <input type="number" step="any" min="-90" max="90" className={inp} value={info.lat}
                    onChange={(e) => setInfo((f) => ({ ...f, lat: e.target.value }))} placeholder="33.5731" />
                </Fld>
                <Fld label="Longitude">
                  <input type="number" step="any" min="-180" max="180" className={inp} value={info.lng}
                    onChange={(e) => setInfo((f) => ({ ...f, lng: e.target.value }))} placeholder="-7.5898" />
                </Fld>
              </div>

              <div className="grid grid-cols-2 gap-3">
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

          {step === 2 && (
            <div className="p-6">
              <p className="text-sm text-gray-500 mb-5">Définissez les horaires d'ouverture pour chaque jour de la semaine.</p>
              <div className="space-y-2">
                {DAYS.map(({ key, label }) => {
                  const h = hours[key];
                  return (
                    <div key={key} className={`flex items-center gap-4 p-3 rounded-xl border transition-colors ${h.open ? 'border-red-100 bg-red-50/30' : 'border-gray-100 bg-gray-50'}`}>
                      <div className="w-24 flex items-center gap-2 flex-shrink-0">
                        <div
                          onClick={() => setHours((prev) => ({ ...prev, [key]: { ...prev[key], open: !prev[key].open } }))}
                          className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer flex-shrink-0 ${h.open ? 'bg-[#E10600]' : 'bg-gray-300'}`}
                        >
                          <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${h.open ? 'translate-x-5' : ''}`} />
                        </div>
                        <span className={`text-sm font-bold w-8 ${h.open ? 'text-[#E10600]' : 'text-gray-400'}`}>{label}</span>
                      </div>
                      {h.open ? (
                        <div className="flex items-center gap-3 flex-1">
                          <div className="flex items-center gap-2 flex-1">
                            <Icon d={SVG.clock} className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <input type="time" value={h.from}
                              onChange={(e) => setHours((prev) => ({ ...prev, [key]: { ...prev[key], from: e.target.value } }))}
                              className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E10600]" />
                          </div>
                          <span className="text-gray-400 text-xs font-medium">à</span>
                          <div className="flex items-center gap-2 flex-1">
                            <input type="time" value={h.to}
                              onChange={(e) => setHours((prev) => ({ ...prev, [key]: { ...prev[key], to: e.target.value } }))}
                              className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E10600]" />
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

          {step === 3 && (
            <div className="p-6 space-y-5">
              {!savedNode?.id ? (
                <p className="text-sm text-gray-500 text-center py-8">Enregistrez d'abord le nœud pour gérer les créneaux.</p>
              ) : (
                <>
                  <div className="bg-gray-50 rounded-2xl border border-gray-100 p-4">
                    <h3 className="text-sm font-bold text-gray-800 mb-3">{editingSlot ? 'Modifier le créneau' : 'Nouveau créneau'}</h3>
                    <form onSubmit={submitSlot} className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <Fld label="Nom FR" req>
                          <input className={inp} value={slotForm.name_fr}
                            onChange={(e) => setSlotForm((f) => ({ ...f, name_fr: e.target.value }))}
                            required placeholder="Matin" />
                        </Fld>
                        <Fld label="Nom AR">
                          <input className={inp} dir="rtl" value={slotForm.name_ar}
                            onChange={(e) => setSlotForm((f) => ({ ...f, name_ar: e.target.value }))} />
                        </Fld>
                      </div>
                      <div className="grid grid-cols-4 gap-3">
                        <Fld label="Jour">
                          <select className={sel} value={slotForm.day_of_week}
                            onChange={(e) => setSlotForm((f) => ({ ...f, day_of_week: Number(e.target.value) }))}>
                            {DAYS.map(({ key }) => <option key={key} value={key}>{DAY_LABELS[key]}</option>)}
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
                        <Toggle
                          checked={slotForm.is_active}
                          onChange={() => setSlotForm((f) => ({ ...f, is_active: !f.is_active }))}
                          size="sm"
                        />
                        <div className="flex gap-2">
                          {editingSlot && (
                            <button type="button" onClick={() => { setEditingSlot(null); setSlotForm({ ...EMPTY_SLOT }); }}
                              className="px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                              Annuler
                            </button>
                          )}
                          <button type="submit" className="px-4 py-1.5 text-xs font-semibold text-white bg-[#E10600] hover:bg-[#c00500] rounded-lg transition-colors">
                            {editingSlot ? 'Mettre à jour' : '+ Ajouter'}
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>

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
                                    : <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">Inactif</span>}
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

          {step === 4 && (
            <div className="p-6 space-y-4">
              {!savedNode?.id ? (
                <p className="text-sm text-gray-500 text-center py-8">Enregistrez d'abord le nœud pour configurer ses paramètres.</p>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="text-sm font-bold text-gray-800">Configuration du nœud</h3>
                      <p className="text-xs text-gray-500">Paramètres AppConfig spécifiques à ce nœud.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => loadNodeConfigs(savedNode.id)}
                      className="px-3 py-1.5 text-xs font-semibold text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      Rafraîchir
                    </button>
                  </div>

                  {configDefinitions.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 text-sm">Aucune configuration disponible.</div>
                  ) : (
                    <div className="space-y-3">
                      {configDefinitions.map((cfg) => {
                        const value = configValues[cfg.key] ?? cfg.default ?? '';
                        const isBool = cfg.type === 'boolean';
                        const hasOverride = !!(savedNode?.id && cfg.key && configValues[cfg.key] !== undefined && configValues[cfg.key] !== cfg.default);

                        return (
                          <div key={cfg.key} className="border border-gray-200 rounded-xl p-3 bg-gray-50">
                            <div className="flex items-center justify-between gap-3 mb-2">
                              <div>
                                <p className="text-sm font-semibold text-gray-800">{cfg.label_fr}</p>
                                <p className="text-[10px] uppercase tracking-wide text-gray-400">{cfg.key}</p>
                              </div>
                              {hasOverride && (
                                <button
                                  type="button"
                                  onClick={() => removeNodeConfig(cfg.key)}
                                  className="text-[10px] font-semibold text-red-500 hover:text-red-700"
                                >
                                  Supprimer override
                                </button>
                              )}
                            </div>

                            {isBool ? (
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-xs text-gray-500">États</span>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setConfigValues((prev) => ({ ...prev, [cfg.key]: 'true' }))}
                                    className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border ${value === 'true' ? 'bg-[#E10600] text-white border-[#E10600]' : 'bg-white text-gray-600 border-gray-200'}`}
                                  >
                                    Activé
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfigValues((prev) => ({ ...prev, [cfg.key]: 'false' }))}
                                    className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border ${value === 'false' ? 'bg-[#E10600] text-white border-[#E10600]' : 'bg-white text-gray-600 border-gray-200'}`}
                                  >
                                    Désactivé
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <input
                                type={cfg.type === 'number' ? 'number' : 'text'}
                                value={value}
                                onChange={(e) => setConfigValues((prev) => ({ ...prev, [cfg.key]: e.target.value }))}
                                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#E10600]"
                              />
                            )}

                            <div className="mt-3 flex justify-end">
                              <button
                                type="button"
                                onClick={() => saveNodeConfig(cfg.key, cfg.type, configValues[cfg.key] ?? cfg.default ?? '')}
                                disabled={savingConfig[cfg.key]}
                                className="px-3 py-2 text-xs font-semibold text-white bg-[#E10600] hover:bg-[#c00500] rounded-xl disabled:opacity-50"
                              >
                                {savingConfig[cfg.key] ? 'Enregistrement…' : 'Enregistrer'}
                              </button>
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
          {step < 4 ? (
            <button type="button" onClick={handleNext} disabled={saving}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-[#E10600] hover:bg-[#c00500] rounded-xl transition-colors disabled:opacity-50">
              {saving ? 'Enregistrement…' : step === 2 ? (isEdit ? 'Mettre à jour →' : 'Créer & Créneaux →') : step === 3 ? 'Configuration →' : 'Suivant →'}
            </button>
          ) : (
            <button type="button" onClick={onSaved}
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