import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAvailableOrders, getMyOrders } from '../../api/pickerPortal.api';
import { usePickerAuth } from '../../context/PickerAuthContext';

const StatCard = ({ label, value, color, to }) => (
  <Link to={to} className={`block rounded-xl p-5 text-white shadow ${color} hover:opacity-90 transition`}>
    <p className="text-3xl font-bold">{value}</p>
    <p className="text-sm mt-1 opacity-90">{label}</p>
  </Link>
);

export default function PickerDashboardPage() {
  const { picker } = usePickerAuth();
  const [available, setAvailable] = useState([]);
  const [myOrders,  setMyOrders]  = useState({ active: [], completed: [] });
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([getAvailableOrders(), getMyOrders()])
      .then(([avail, mine]) => {
        setAvailable(avail.data.data ?? []);
        setMyOrders(mine.data.data ?? { active: [], completed: [] });
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-12 text-gray-400">Chargement...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Bonjour, {picker?.name} 👋</h1>
        <p className="text-gray-500 text-sm mt-1">Node : {picker?.node_id}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Commandes disponibles"
          value={available.length}
          color="bg-indigo-600"
          to="/picker/available-orders"
        />
        <StatCard
          label="En cours"
          value={myOrders.active?.length ?? 0}
          color="bg-amber-500"
          to="/picker/my-orders"
        />
        <StatCard
          label="Terminées"
          value={myOrders.completed?.length ?? 0}
          color="bg-green-600"
          to="/picker/my-orders"
        />
      </div>

      {/* Commandes disponibles */}
      {available.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
            Nouvelles commandes
          </h2>
          <div className="space-y-2">
            {available.slice(0, 3).map(order => (
              <div key={order.id} className="bg-white rounded-xl shadow-sm border p-4 flex justify-between items-center">
                <div>
                  <p className="font-semibold text-gray-800 text-sm">#{order.id.slice(-8).toUpperCase()}</p>
                  <p className="text-gray-500 text-xs">{order.customer?.name} — {order.items_count} article(s)</p>
                </div>
                <Link
                  to="/picker/available-orders"
                  className="bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-indigo-700"
                >
                  Voir
                </Link>
              </div>
            ))}
            {available.length > 3 && (
              <Link to="/picker/available-orders" className="block text-center text-indigo-600 text-sm py-2">
                Voir toutes les commandes ({available.length})
              </Link>
            )}
          </div>
        </section>
      )}

      {/* En cours */}
      {myOrders.active?.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
            Préparations en cours
          </h2>
          <div className="space-y-2">
            {myOrders.active.map(session => (
              <Link
                key={session.id}
                to={`/picker/sessions/${session.id}`}
                className="block bg-white rounded-xl shadow-sm border p-4 hover:bg-indigo-50 transition"
              >
                <div className="flex justify-between items-center">
                  <p className="font-semibold text-gray-800 text-sm">
                    #{session.order?.id?.slice(-8).toUpperCase()}
                  </p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    session.status?.code === 'in_progress'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {session.status?.name_fr}
                  </span>
                </div>
                <p className="text-gray-500 text-xs mt-1">
                  {session.items_picked}/{session.items_count} article(s) prélevés
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
