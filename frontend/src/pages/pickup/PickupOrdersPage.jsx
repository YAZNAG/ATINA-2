import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getPickupOrders } from '../../api/pickup.api';

const fmt = (v) => v
  ? new Date(v).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  : '—';

const fmtPrice = (v) => `${Number(v ?? 0).toFixed(2)} MAD`;

function PayBadge({ payments }) {
  const pm = payments?.[0]?.payment_method?.code;
  const colors = { cod: 'bg-amber-100 text-amber-700', wallet: 'bg-violet-100 text-violet-700', card: 'bg-blue-100 text-blue-700' };
  return pm ? (
    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${colors[pm] ?? 'bg-gray-100 text-gray-600'}`}>
      {payments[0]?.payment_method?.name_fr ?? pm}
    </span>
  ) : null;
}

export default function PickupOrdersPage() {
  const [orders,  setOrders]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getPickupOrders({ search: search || undefined });
      setOrders(r.data?.data?.data ?? r.data?.data ?? []);
    } catch { toast.error('Erreur chargement'); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Retrait magasin</h1>
          <p className="text-gray-500 text-sm mt-1">Commandes prêtes à être retirées</p>
        </div>
        <button onClick={load} className="text-sm text-indigo-600 hover:underline">Actualiser</button>
      </div>

      {/* Search */}
      <div className="mb-5">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher client, commande…"
          className="border rounded-xl px-4 py-2.5 w-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      {/* Liste */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Chargement…</div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl border shadow-sm p-16 text-center">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-gray-500 font-semibold">Aucune commande prête au retrait</p>
          <p className="text-gray-400 text-sm mt-1">Les commandes en statut <strong>Prête</strong> (pickup) apparaissent ici</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => (
            <div key={order.id}
              onClick={() => navigate(`/pickup/orders/${order.id}`)}
              className="bg-white rounded-2xl border shadow-sm p-5 cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm font-bold text-gray-700">
                      #{order.id.slice(-8).toUpperCase()}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">
                      {order.status?.name_fr}
                    </span>
                    <PayBadge payments={order.payments} />
                  </div>
                  <p className="font-semibold text-gray-900">{order.customer?.name}</p>
                  <p className="text-xs text-gray-400">{order.customer?.phone_country} {order.customer?.phone_number}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-gray-900">{fmtPrice(order.total_ttc)}</p>
                  <p className="text-xs text-gray-400">{fmt(order.created_at)}</p>
                </div>
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                <div className="flex items-center gap-3">
                  <span>📍 {order.node?.name_fr}</span>
                  <span>{order._count?.items ?? '?'} article(s)</span>
                </div>
                {order.confirmed_slot && (
                  <span>🕐 {order.confirmed_slot.slot_start}–{order.confirmed_slot.slot_end}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
