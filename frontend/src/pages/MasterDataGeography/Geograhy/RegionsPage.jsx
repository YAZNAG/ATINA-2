import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../../context/AuthContext';
import { getErrorMessage } from '../../../utils/helpers';
import { deleteRegion, getRegions } from '../../../api/locationNode.api';
import { DeleteButton } from '../../../components/ui/CrudActions';

function descCell(value, max = 56) {
  if (value == null || String(value).trim() === '') return '—';
  const str = String(value);
  return str.length <= max ? str : `${str.slice(0, max)}…`;
}

export default function RegionsPage({ embedded = false }) {
  const { hasPermission } = useAuth();
  const canView = hasPermission('regions.view');
  const canDelete = hasPermission('regions.delete');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');

  const buildStatusParams = (value) => {
    if (value === 'active') return { is_active: true };
    if (value === 'inactive') return { is_active: false };
    if (value === 'deleted') return { is_deleted: true };
    return {};
  };

  const loadRegions = async () => {
    setLoading(true);
    try {
      const res = await getRegions({ limit: 500, ...buildStatusParams(status) });
      setRows(res.data.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRegions();
  }, [status]);

  if (!canView) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-neutral-400">
        <p className="text-sm">Vous n'avez pas acc�s � cette page.</p>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
        {!embedded && (
            <Link to="/geo" className="text-sm text-gray-500 hover:text-gray-700">{'<'}- Géographie</Link>
          )}
          <h1 className={`page-title ${embedded ? '' : 'mt-1'}`}>Régions</h1>
          <p className="page-subtitle">Liste des régions de référence.</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="text-sm text-neutral-600">
              Statut :
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="ml-2 rounded border border-neutral-200 bg-white px-2 py-1 text-sm"
              >
                <option value="all">Tous</option>
                <option value="active">Actif</option>
                <option value="inactive">Inactif</option>
                <option value="deleted">Supprimé</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className="table-wrap">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="table-th">Code</th>
                <th className="table-th">Nom FR</th>
                <th className="table-th">Nom AR</th>
                <th className="table-th">Description FR</th>
                <th className="table-th">Description AR</th>
                <th className="table-th">Statut</th>
                {canDelete && <th className="table-th">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={canDelete ? 7 : 6} className="text-center py-12 text-gray-400 text-sm">
                    Chargement�
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={canDelete ? 7 : 6} className="text-center py-12 text-gray-400 text-sm">
                    Aucune r�gion
                  </td>
                </tr>
              ) : (
                rows.map((region) => (
                  <tr key={region.id} className="hover:bg-gray-50 transition-colors">
                    <td className="table-td font-mono text-sm">{region.code || '�'}</td>
                    <td className="table-td">{region.name_fr || '�'}</td>
                    <td className="table-td" dir="rtl">{region.name_ar || '�'}</td>
                    <td className="table-td text-sm text-slate-600 max-w-[14rem] align-top" title={region.description_fr || ''}>
                      {descCell(region.description_fr)}
                    </td>
                    <td className="table-td text-sm text-slate-600 max-w-[14rem] align-top" dir="rtl" title={region.description_ar || ''}>
                      {descCell(region.description_ar)}
                    </td>
                    <td className="table-td">
                      {region.is_deleted ? (
                        <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">
                          Supprimé
                        </span>
                      ) : (
                        <span className={region.is_active ? 'badge-active' : 'badge-inactive'}>
                          {region.is_active ? 'Actif' : 'Inactif'}
                        </span>
                      )}
                    </td>
                    {canDelete && (
                      <td className="table-td">
                        <div className="flex items-center gap-2">
                          <DeleteButton
                            onClick={async () => {
                              if (!window.confirm(`Supprimer la r�gion "${region.name_fr}" ?`)) return;
                              try {
                                await deleteRegion(region.id);
                                toast.success('R�gion supprim�e');
                                loadRegions();
                              } catch (err) {
                                toast.error(getErrorMessage(err));
                              }
                            }}
                          />
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
