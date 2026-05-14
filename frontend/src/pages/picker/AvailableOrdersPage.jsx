import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAvailableOrders, acceptOrder } from '../../api/pickerPortal.api';
import toast from 'react-hot-toast';

const fmt = (v) => v ? new Date(v).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtPrice = (v) => v != null ? `${Number(v).toFixed(2)} MAD` : '—';

export default function AvailableOrdersPage() {
  const [orders,  setOrders]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(null);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    getAvailableOrders()
      .then(res => setOrders(res.data.data ?? []))
      .catch(() => toast.error('Erreur lors du chargement'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleAccept = async (orderId) => {
    if (accepting) return;
    setAccepting(orderId);
    try {
      const res = await acceptOrder(orderId);
      const session = res.data.data;
      toast.success('Commande acceptée !');
      navigate(`/picker/sessions/${session.id}`);
    } catch (err) {
      const msg = err?.response?.data?.message ?? 'Erreur lors de l\'acceptation';
      toast.error(msg);
      load();
    } finally {
      setAccepting(null);
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-400">Chargement...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">Commandes disponibles</h1>
        <button onClick={load} className="text-indigo-600 text-sm hover:underline">Actualiser</button>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white rounded-xl border shadow-sm p-10 text-center">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-gray-500">Aucune commande disponible pour votre node</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => (
            <div key={order.id} className="bg-white rounded-xl border shadow-sm p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-bold text-gray-900">#{order.id.slice(-8).toUpperCase()}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{fmt(order.created_at)}</p>
                </div>
                <span className="text-sm font-semibold text-indigo-700">{fmtPrice(order.total_ttc)}</span>
              </div>

              <div className="text-sm text-gray-700 space-y-1 mb-4">
                <div className="flex gap-2">
                  <span className="text-gray-400 w-20 shrink-0">Client</span>
                  <span>{order.customer?.name ?? '—'}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-gray-400 w-20 shrink-0">Articles</span>
                  <span>{order.items_count} article(s)</span>
                </div>
                {order.slot && (
                  <div className="flex gap-2">
                    <span className="text-gray-400 w-20 shrink-0">Créneau</span>
                    <span>{fmt(order.slot.starts_at)} – {fmt(order.slot.ends_at)}</span>
                  </div>
                )}
              </div>

              <button
                onClick={() => handleAccept(order.id)}
                disabled={accepting === order.id}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors"
              >
                {accepting === order.id ? 'Acceptation...' : '✓ Accepter cette commande'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
