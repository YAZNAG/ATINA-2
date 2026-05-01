import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../utils/helpers';
import {
  createNode,
  createNodeSlot,
  deleteSlot,
  getCities,
  getNode,
  getNodeSlots,
  getNodeTypes,
  getProvinces,
  getRegions,
  updateNode,
  updateSlot,
} from '../../api/locationNode.api';
import { AddIcon, DeleteButton, EditButton } from '../../components/ui/CrudActions';

const initNode = {
  code: '', name_fr: '', name_ar: '', node_type_id: '', region_id: '', province_id: '', city_id: '',
  address_line1: '', quartier: '', postal_code: '', lat: '', lng: '', phone: '',
  timezone: 'Africa/Casablanca', delivery_radius_km: '', max_daily_orders: '', opening_hours_json: '',
  is_active: true,
};
const initSlot = { name_fr: '', name_ar: '', day_of_week: 1, slot_start: '08:00', slot_end: '10:00', max_orders: 0, is_active: true };

export default function NodeForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [tab, setTab] = useState('info');
  const [node, setNode] = useState(initNode);
  const [nodeTypes, setNodeTypes] = useState([]);
  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [cities, setCities] = useState([]);
  const [slots, setSlots] = useState([]);
  const [slotForm, setSlotForm] = useState(initSlot);

  const loadLookups = async () => {
    const [typeRes, regRes] = await Promise.all([getNodeTypes(), getRegions({ limit: 100 })]);
    setNodeTypes(typeRes.data.data || []);
    setRegions(regRes.data.data || []);
  };

  const loadDependent = async (regionId, provinceId) => {
    const [p, c] = await Promise.all([
      getProvinces({ region_id: regionId || undefined, limit: 200 }),
      getCities({ province_id: provinceId || undefined, limit: 200 }),
    ]);
    setProvinces(p.data.data || []);
    setCities(c.data.data || []);
  };

  const loadSlots = async (nodeId) => {
    const res = await getNodeSlots(nodeId);
    setSlots(res.data.data || []);
  };

  useEffect(() => {
    (async () => {
      try {
        await loadLookups();
        if (isEdit) {
          const res = await getNode(id);
          const row = res.data.data;
          setNode({
            ...initNode,
            ...row,
            lat: row.lat ?? '',
            lng: row.lng ?? '',
            delivery_radius_km: row.delivery_radius_km ?? '',
            max_daily_orders: row.max_daily_orders ?? '',
            opening_hours_json: row.opening_hours_json ? JSON.stringify(row.opening_hours_json, null, 2) : '',
          });
          await loadDependent(row.region_id, row.province_id);
          await loadSlots(id);
        }
      } catch (err) { toast.error(getErrorMessage(err)); }
    })();
  }, [id, isEdit]);

  const submitNode = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...node };
      if (isEdit) await updateNode(id, payload);
      else {
        const res = await createNode(payload);
        navigate(`/nodes/${res.data.data.id}/edit`);
      }
      toast.success('Node enregistré');
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  return (
    <div className="page-shell">
      <div className="flex items-center gap-3">
        <Link to="/nodes" className="text-sm text-gray-500 hover:text-gray-700">← Nodes</Link>
        <h1 className="page-title">{isEdit ? 'Modifier node' : 'Ajouter node'}</h1>
      </div>
      <div className="flex gap-2">
        {['info', 'slots', 'team'].map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-1 rounded ${tab === t ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>{t.toUpperCase()}</button>
        ))}
      </div>

      {tab === 'info' && (
        <form onSubmit={submitNode} className="card space-y-4">
          <div className="grid md:grid-cols-3 gap-3">
            <input className="form-input" placeholder="Code" value={node.code} onChange={(e) => setNode({ ...node, code: e.target.value })} required />
            <input className="form-input" placeholder="Nom FR" value={node.name_fr} onChange={(e) => setNode({ ...node, name_fr: e.target.value })} required />
            <input className="form-input" placeholder="Nom AR" value={node.name_ar} onChange={(e) => setNode({ ...node, name_ar: e.target.value })} required />
            <select className="form-input" value={node.node_type_id} onChange={(e) => setNode({ ...node, node_type_id: e.target.value })} required>
              <option value="">Type node</option>{nodeTypes.map((t) => <option key={t.id} value={t.id}>{t.name_fr}</option>)}
            </select>
            <select className="form-input" value={node.region_id} onChange={async (e) => { const v = e.target.value; setNode({ ...node, region_id: v, province_id: '', city_id: '' }); await loadDependent(v, null); }} required>
              <option value="">Région</option>{regions.map((r) => <option key={r.id} value={r.id}>{r.name_fr}</option>)}
            </select>
            <select className="form-input" value={node.province_id} onChange={async (e) => { const v = e.target.value; setNode({ ...node, province_id: v, city_id: '' }); await loadDependent(node.region_id, v); }} required>
              <option value="">Province</option>{provinces.map((p) => <option key={p.id} value={p.id}>{p.name_fr}</option>)}
            </select>
            <select className="form-input" value={node.city_id} onChange={(e) => setNode({ ...node, city_id: e.target.value })} required>
              <option value="">Ville</option>{cities.map((c) => <option key={c.id} value={c.id}>{c.name_fr}</option>)}
            </select>
            <input className="form-input" placeholder="Rue" value={node.address_line1} onChange={(e) => setNode({ ...node, address_line1: e.target.value })} />
            <input className="form-input" placeholder="Quartier" value={node.quartier} onChange={(e) => setNode({ ...node, quartier: e.target.value })} />
            <input className="form-input" placeholder="Code postal" value={node.postal_code} onChange={(e) => setNode({ ...node, postal_code: e.target.value })} />
            <input className="form-input" placeholder="Latitude" value={node.lat} onChange={(e) => setNode({ ...node, lat: e.target.value })} />
            <input className="form-input" placeholder="Longitude" value={node.lng} onChange={(e) => setNode({ ...node, lng: e.target.value })} />
            <input className="form-input" placeholder="Téléphone" value={node.phone} onChange={(e) => setNode({ ...node, phone: e.target.value })} />
            <input className="form-input" placeholder="Timezone" value={node.timezone} onChange={(e) => setNode({ ...node, timezone: e.target.value })} />
            <input className="form-input" placeholder="Rayon livraison km" value={node.delivery_radius_km} onChange={(e) => setNode({ ...node, delivery_radius_km: e.target.value })} />
            <input className="form-input" placeholder="Capacité max / jour" value={node.max_daily_orders} onChange={(e) => setNode({ ...node, max_daily_orders: e.target.value })} />
          </div>
          <textarea className="form-input" rows={4} placeholder="opening_hours_json" value={node.opening_hours_json} onChange={(e) => setNode({ ...node, opening_hours_json: e.target.value })} />
          <button className="btn-primary"><AddIcon />Sauvegarder</button>
        </form>
      )}

      {tab === 'slots' && (
        <div className="card space-y-4">
          {!isEdit ? <p className="text-sm text-gray-500">Enregistre d'abord le node pour gérer les créneaux.</p> : (
            <>
              <form
                className="grid md:grid-cols-7 gap-2 items-end"
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    if (slotForm.id) await updateSlot(slotForm.id, slotForm);
                    else await createNodeSlot(id, slotForm);
                    setSlotForm(initSlot);
                    await loadSlots(id);
                    toast.success('Créneau enregistré');
                  } catch (err) { toast.error(getErrorMessage(err)); }
                }}
              >
                <input className="form-input" placeholder="Nom FR" value={slotForm.name_fr} onChange={(e) => setSlotForm({ ...slotForm, name_fr: e.target.value })} required />
                <input className="form-input" placeholder="Nom AR" value={slotForm.name_ar} onChange={(e) => setSlotForm({ ...slotForm, name_ar: e.target.value })} required />
                <input className="form-input" type="number" min="0" max="6" value={slotForm.day_of_week} onChange={(e) => setSlotForm({ ...slotForm, day_of_week: Number(e.target.value) })} />
                <input className="form-input" type="time" value={slotForm.slot_start} onChange={(e) => setSlotForm({ ...slotForm, slot_start: e.target.value })} />
                <input className="form-input" type="time" value={slotForm.slot_end} onChange={(e) => setSlotForm({ ...slotForm, slot_end: e.target.value })} />
                <input className="form-input" type="number" value={slotForm.max_orders} onChange={(e) => setSlotForm({ ...slotForm, max_orders: Number(e.target.value) })} />
                <button className="btn-primary">{slotForm.id ? <><AddIcon />Maj</> : <><AddIcon />Ajouter</>}</button>
              </form>
              <table className="w-full">
                <thead><tr><th className="table-th">Jour</th><th className="table-th">Nom</th><th className="table-th">Heures</th><th className="table-th">Cap.</th><th className="table-th">Actions</th></tr></thead>
                <tbody>
                  {slots.map((s) => (
                    <tr key={s.id}>
                      <td className="table-td">{s.day_of_week}</td>
                      <td className="table-td">{s.name_fr}</td>
                      <td className="table-td">{s.slot_start} - {s.slot_end}</td>
                      <td className="table-td">{s.max_orders ?? '-'}</td>
                      <td className="table-td">
                        <div className="flex items-center gap-2">
                          <EditButton onClick={() => setSlotForm(s)} />
                          <DeleteButton onClick={async () => { await deleteSlot(s.id); await loadSlots(id); }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {tab === 'team' && (
        <div className="card">
          <p className="text-sm text-gray-600">Affectation équipe (Pickers / Drivers) - placeholder prêt pour liaison future avec module utilisateurs.</p>
        </div>
      )}
    </div>
  );
}
