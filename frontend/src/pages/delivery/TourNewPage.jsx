import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getReadyHomeOrders, getDrivers, createTour, getDeliveryMeta } from '../../api/deliveryMgmt.api';

const fmtP = (v) => `${Number(v ?? 0).toFixed(2)} MAD`;

export default function TourNewPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const preselected = location.state?.order_ids ?? [];

  const [nodes,    setNodes]    = useState([]);
  const [drivers,  setDrivers]  = useState([]);
  const [orders,   setOrders]   = useState([]);
  const [selected, setSelected] = useState(preselected);
  const [form, setForm] = useState({ node_id: '', driver_id: '', date: '', slot_start: '', slot_end: '', zone: '', notes: '' });
  const [loading,  setLoading]  = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);

  useEffect(() => {
    getDeliveryMeta().then(r => setNodes(r.data?.data?.nodes ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.node_id) { setDrivers([]); setOrders([]); setSelected(preselected); return; }
    Promise.all([
      getDrivers({ node_id: form.node_id }),
      getReadyHomeOrders({ node_id: form.node_id }),
    ]).then(([d, o]) => {
      setDrivers(d.data?.data ?? []);
      const ords = o.data?.data ?? [];
      setOrders(ords);
      // Auto-select pre-specified orders that belong to this node
      setSelected(preselected.filter(id => ords.some(o => o.id === id)));
    }).catch(() => {});
  }, [form.node_id]);

  const toggle = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.node_id)          return toast.error('Node requis');
    if (selected.length === 0)  return toast.error('Sélectionnez au moins une commande');
    setLoading(true);
    try {
      const r = await createTour({ ...form, order_ids: selected });
      toast.success(`Tournée créée — ${r.data?.data?.stops?.length ?? 0} stops`);
      navigate(`/delivery/tours/${r.data?.data?.id}`);
    } catch (e) {
      toast.error(e?.response?.data?.message ?? 'Erreur création', { duration: 6000 });
    } finally { setLoading(false); }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/delivery/tours')} className="text-gray-400 hover:text-gray-600 text-lg">←</button>
        <h1 className="text-2xl font-bold text-gray-900">Nouvelle tournée</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Node */}
        <div className="bg-white rounded-2xl border shadow-sm p-5">
          <h2 className="font-bold text-gray-800 mb-4">Configuration</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Node *</label>
              <select value={form.node_id} onChange={e => setForm(f => ({ ...f, node_id: e.target.value, driver_id: '' }))}
                className="border rounded-xl px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                <option value="">Choisir un node</option>
                {nodes.map(n => <option key={n.id} value={n.id}>{n.name_fr}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Chauffeur</label>
              <select value={form.driver_id} onChange={e => setForm(f => ({ ...f, driver_id: e.target.value }))}
                disabled={!form.node_id}
                className="border rounded-xl px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50">
                <option value="">Affecter plus tard</option>
                {drivers.map(d => <option key={d.id} value={d.id}>{d.name} — {d.vehicle_type ?? 'véhicule'}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Date</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="border rounded-xl px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Zone</label>
              <input type="text" value={form.zone} onChange={e => setForm(f => ({ ...f, zone: e.target.value }))}
                placeholder="ex: Agdal Centre"
                className="border rounded-xl px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Créneau début</label>
              <input type="time" value={form.slot_start} onChange={e => setForm(f => ({ ...f, slot_start: e.target.value }))}
                className="border rounded-xl px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Créneau fin</label>
              <input type="time" value={form.slot_end} onChange={e => setForm(f => ({ ...f, slot_end: e.target.value }))}
                className="border rounded-xl px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
          </div>
          <div className="mt-3">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Notes</label>
            <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Notes tournée…"
              className="border rounded-xl px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
        </div>

        {/* Orders */}
        {form.node_id && (
          <div className="bg-white rounded-2xl border shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-800">Commandes ({selected.length} sélectionnées)</h2>
              {orders.length > 0 && (
                <button type="button" onClick={() => setSelected(s => s.length === orders.length ? [] : orders.map(o => o.id))}
                  className="text-xs text-indigo-600 hover:underline">
                  {selected.length === orders.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                </button>
              )}
            </div>
            {orders.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Aucune commande home ready pour ce node</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {orders.map(order => (
                  <label key={order.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selected.includes(order.id) ? 'border-indigo-400 bg-indigo-50' : 'border-gray-100 hover:bg-gray-50'}`}>
                    <input type="checkbox" checked={selected.includes(order.id)} onChange={() => toggle(order.id)} className="accent-indigo-600" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{order.customer?.name}</p>
                      <p className="text-xs text-gray-400">{order.address?.street_name}, {order.address?.city}</p>
                    </div>
                    <span className="text-sm font-bold text-gray-700 shrink-0">{fmtP(order.total_ttc)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        <button type="submit" disabled={loading || !form.node_id || selected.length === 0}
          className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl text-base">
          {loading ? 'Création…' : `✓ Créer tournée — ${selected.length} commande(s)`}
        </button>
      </form>
    </div>
  );
}
