import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyOrders } from '../../api/pickerPortal.api';
import toast from 'react-hot-toast';

const fmt = (v) => v
  ? new Date(v).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  : '—';

const StatusBadge = ({ code, label }) => {
  const colors = {
    open:        'bg-blue-100 text-blue-700',
    in_progress: 'bg-amber-100 text-amber-700',
    completed:   'bg-green-100 text-green-700',
    cancelled:   'bg-red-100 text-red-700',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[code] ?? 'bg-gray-100 text-gray-600'}`}>
      {label}
    </span>
  );
};

const SessionCard = ({ session }) => (
  <Link
    to={`/picker/sessions/${session.id}`}
    className="block bg-white rounded-xl border shadow-sm p-4 hover:bg-indigo-50 transition"
  >
    <div className="flex justify-between items-start mb-2">
      <p className="font-bold text-gray-900">#{session.order?.id?.slice(-8).toUpperCase()}</p>
      <StatusBadge code={session.status?.code} label={session.status?.name_fr} />
    </div>
    <p className="text-gray-500 text-xs mb-3">{session.order?.customer?.name}</p>

    {/* Avancement */}
    <div className="mb-3">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{session.items_picked} / {session.items_count} articles</span>
        <span>{session.items_count > 0 ? Math.round((session.items_picked / session.items_count) * 100) : 0}%</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1.5">
        <div
          className="bg-indigo-500 h-1.5 rounded-full"
          style={{ width: `${session.items_count > 0 ? (session.items_picked / session.items_count) * 100 : 0}%` }}
        />
      </div>
    </div>

    <div className="flex gap-4 text-xs text-gray-400">
      {session.started_at && <span>Démarré : {fmt(session.started_at)}</span>}
      {session.completed_at && <span>Terminé : {fmt(session.completed_at)}</span>}
    </div>
  </Link>
);

export default function MyOrdersPage() {
  const [data,    setData]    = useState({ active: [], completed: [], cancelled: [] });
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState('active');

  useEffect(() => {
    getMyOrders()
      .then(res => setData(res.data.data ?? { active: [], completed: [], cancelled: [] }))
      .catch(() => toast.error('Erreur lors du chargement'))
      .finally(() => setLoading(false));
  }, []);

  const tabs = [
    { key: 'active',    label: `En cours (${data.active?.length ?? 0})` },
    { key: 'completed', label: `Terminées (${data.completed?.length ?? 0})` },
    { key: 'cancelled', label: `Annulées (${data.cancelled?.length ?? 0})` },
  ];

  if (loading) return <div className="text-center py-12 text-gray-400">Chargement...</div>;

  const current = data[tab] ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-gray-900">Mes préparations</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 text-xs py-2 rounded-md font-medium transition-colors ${
              tab === t.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {current.length === 0 ? (
        <div className="bg-white rounded-xl border shadow-sm p-10 text-center">
          <p className="text-gray-400 text-sm">Aucune préparation</p>
        </div>
      ) : (
        <div className="space-y-3">
          {current.map(session => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  );
}
