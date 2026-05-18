import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getTours, getDeliveryMeta } from '../../api/deliveryMgmt.api';

const fmt = (v) => v ? new Date(v).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

const STATUS_COLOR = { planned: 'bg-blue-100 text-blue-700', in_progress: 'bg-amber-100 text-amber-700', completed: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700' };

export default function ToursListPage() {
  const [tours,    setTours]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [statuses, setStatuses] = useState([]);
  const [filter,   setFilter]   = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [tr, meta] = await Promise.all([
        getTours({ status_code: filter || undefined, limit: 50 }),
        getDeliveryMeta(),
      ]);
      setTours(tr.data?.data ?? []);
      setStatuses(meta.data?.data?.statuses ?? []);
    } catch { toast.error('Erreur'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filter]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tournées de livraison</h1>
          <p className="text-sm text-gray-500 mt-1">Gestion des tournées home delivery</p>
        </div>
        <div className="flex gap-3">
          <button onClick={load} className="text-sm text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-50">Actualiser</button>
          <Link to="/delivery/tours/new" className="text-sm bg-indigo-600 text-white px-4 py-1.5 rounded-lg hover:bg-indigo-700 font-semibold">+ Créer tournée</Link>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {[{ code: '', name_fr: 'Toutes' }, ...statuses].map(s => (
          <button key={s.code} onClick={() => setFilter(s.code)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${filter === s.code ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'}`}>
            {s.name_fr}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Chargement…</div>
      ) : tours.length === 0 ? (
        <div className="bg-white rounded-2xl border shadow-sm p-16 text-center">
          <p className="text-4xl mb-3">🗺</p>
          <p className="text-gray-500">Aucune tournée</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tours.map(tour => (
            <Link key={tour.id} to={`/delivery/tours/${tour.id}`}
              className="block bg-white rounded-2xl border shadow-sm p-5 hover:border-indigo-300 hover:shadow-md transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm font-bold text-gray-700">#{tour.id.slice(-8).toUpperCase()}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_COLOR[tour.status?.code] ?? 'bg-gray-100 text-gray-600'}`}>
                      {tour.status?.name_fr}
                    </span>
                    {tour.zone && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{tour.zone}</span>}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>🏪 {tour.node?.name_fr ?? '—'}</span>
                    {tour.driver && <span>🚗 {tour.driver.name}</span>}
                    <span>📦 {tour.stops?.length ?? 0} stops</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {(tour.date || tour.slot_start) && (
                    <p className="text-xs text-gray-600 font-medium">{tour.date ?? ''} {tour.slot_start ? tour.slot_start + '–' + tour.slot_end : ''}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">{fmt(tour.created_at)}</p>
                </div>
              </div>
              {tour.stops?.length > 0 && (
                <div className="flex items-center gap-1 mt-3 pt-3 border-t border-gray-100">
                  {tour.stops.map(s => (
                    <span key={s.id} className={`w-3 h-3 rounded-full ${
                      s.status?.code === 'delivered' ? 'bg-green-500' :
                      s.status?.code === 'failed'    ? 'bg-red-400' :
                      s.status?.code === 'arrived'   ? 'bg-amber-400' :
                      'bg-gray-200'
                    }`} title={s.status?.name_fr} />
                  ))}
                  <span className="text-xs text-gray-400 ml-2">
                    {tour.stops.filter(s => s.status?.code === 'delivered').length}/{tour.stops.length} livrés
                  </span>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
