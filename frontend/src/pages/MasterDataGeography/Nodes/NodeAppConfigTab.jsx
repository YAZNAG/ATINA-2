import { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { getOrderConfigs } from '../../../api/orders.api';

export default function NodeAppConfigTab({ nodeId }) {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await getOrderConfigs({ node_id: nodeId });
      setConfigs(data.data || data || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, [nodeId]);

  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

  if (loading) {
    return <div className="py-10 text-center"><Loader2 size={20} className="mx-auto animate-spin text-neutral-400" /></div>;
  }

  if (error) {
    return <p className="py-10 text-center text-sm text-[#E10600]">{error}</p>;
  }

  if (configs.length === 0) {
    return <p className="py-10 text-center text-sm text-neutral-400">Aucune configuration spécifique à ce node.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-100">
      <table className="w-full">
        <thead className="bg-neutral-50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-500">Clé</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-500">Valeur</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-500">Type</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-500">Description</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-500">Modifié le</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {configs.map((cfg) => (
            <tr key={cfg.id} className="hover:bg-neutral-50">
              <td className="px-3 py-2.5 font-mono text-xs text-neutral-700">{cfg.config_key}</td>
              <td className="px-3 py-2.5 text-sm text-neutral-800">{cfg.config_value}</td>
              <td className="px-3 py-2.5 text-xs text-neutral-500">{cfg.value_type?.name || cfg.value_type_id}</td>
              <td className="px-3 py-2.5 text-xs text-neutral-500">{cfg.description || '—'}</td>
              <td className="px-3 py-2.5 text-xs text-neutral-400">{cfg.updated_at ? new Date(cfg.updated_at).toLocaleDateString('fr-FR') : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}