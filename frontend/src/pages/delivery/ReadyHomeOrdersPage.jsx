import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getReadyHomeOrders } from '../../api/deliveryMgmt.api';

const fmt    = (v) => v ? new Date(v).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtP   = (v) => `${Number(v ?? 0).toFixed(2)} MAD`;
const fmtSlot = (t) => t ? String(t).match(/(\d{2}:\d{2})/)?.[1] ?? String(t).slice(0,5) : '';

export default function ReadyHomeOrdersPage() {
  const [orders,  setOrders]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [selected, setSelected] = useState([]);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const r = await getReadyHomeOrders({ search: search || undefined });
      setOrders(r.data?.data ?? []);
    } catch { toast.error('Erreur chargement'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search]);

  const toggle = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const toggleAll = () => setSelected(s => s.length === orders.length ? [] : orders.map(o => o.id));

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Commandes home prêtes</h1>
          <p className="text-gray-500 text-sm mt-1">Commandes delivery_type=home, statut=ready, sans tournée</p>
        </div>
        <div className="flex gap-3">
          <button onClick={load} className="text-sm text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-50">Actualiser</button>
          {selected.length > 0 && (
            <button
              onClick={() => navigate('/delivery/tours/new', { state: { order_ids: selected } })}
              className="text-sm bg-indigo-600 text-white px-4 py-1.5 rounded-lg hover:bg-indigo-700 font-semibold">
              Créer tournée ({selected.length})
            </button>
          )}
        </div>
      </div>

      <div className="mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher client, commande…"
          className="border rounded-xl px-4 py-2.5 w-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Chargement…</div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl border shadow-sm p-16 text-center">
          <p className="text-4xl mb-3">🚚</p>
          <p className="text-gray-500 font-semibold">Aucune commande home prête</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-3 text-sm text-gray-500">
            <input type="checkbox" checked={selected.length === orders.length} onChange={toggleAll} className="accent-indigo-600" />
            <span>{selected.length > 0 ? `${selected.length} sélectionnée(s)` : `${orders.length} commande(s)`}</span>
          </div>
          <div className="space-y-3">
            {orders.map(order => (
              <div key={order.id} className={`bg-white rounded-2xl border shadow-sm p-4 cursor-pointer transition-all ${selected.includes(order.id) ? 'border-indigo-400 ring-1 ring-indigo-200' : 'hover:border-indigo-200'}`}
                onClick={() => toggle(order.id)}>
                <div className="flex items-start gap-3">
                  <input type="checkbox" checked={selected.includes(order.id)} onChange={() => toggle(order.id)}
                    onClick={e => e.stopPropagation()} className="mt-1 accent-indigo-600" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-bold text-gray-700">#{order.id.slice(-8).toUpperCase()}</span>
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">{order.status?.name_fr}</span>
                    </div>
                    <p className="font-semibold text-gray-900">{order.customer?.name}</p>
                    <p className="text-xs text-gray-400">{order.customer?.phone_country} {order.customer?.phone_number}</p>
                    {order.address && <p className="text-xs text-gray-500 mt-0.5">📍 {order.address.street_name}, {order.address.city}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-gray-900">{fmtP(order.total_ttc)}</p>
                    <p className="text-xs text-gray-400">{order._count?.items ?? '?'} article(s)</p>
                    <p className="text-xs text-gray-400">{fmt(order.created_at)}</p>
                  </div>
                </div>
                {(order.confirmed_slot || order.node) && (
                  <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
                    {order.node && <span>🏪 {order.node.name_fr}</span>}
                    {order.confirmed_slot && <span>🕐 {order.confirmed_slot.name_fr ?? `${fmtSlot(order.confirmed_slot.slot_start)}–${fmtSlot(order.confirmed_slot.slot_end)}`}</span>}
                    {order.payments?.[0] && <span>💳 {order.payments[0].payment_method?.name_fr}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
