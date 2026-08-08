import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../../context/AuthContext';
import { getErrorMessage } from '../../../utils/helpers';
import { deleteProvince, getProvinces, getRegions } from '../../../api/locationNode.api';
import { DeleteButton } from '../../../components/ui/CrudActions';

function descCell(value, max = 56) {
  if (value == null || String(value).trim() === '') return '�';
  const str = String(value);
  return str.length <= max ? str : `${str.slice(0, max)}�`;
}

export default function ProvincesPage({ embedded = false }) {
  const { hasPermission } = useAuth();
  const canView = hasPermission('provinces.view');
  const canDelete = hasPermission('provinces.delete');
  const [rows, setRows] = useState([]);
  const [regionMap, setRegionMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');

  const buildStatusParams = (value) => {
    if (value === 'active') return { is_active: true };
    if (value === 'inactive') return { is_active: false };
    if (value === 'deleted') return { is_deleted: true };
    return {};
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [provinceRes, regionRes] = await Promise.all([
        getProvinces({ limit: 500, ...buildStatusParams(status) }),
        getRegions({ limit: 500 }),
      ]);
      setRows(provinceRes.data.data || []);
      const regions = regionRes.data.data || [];
      setRegionMap(Object.fromEntries(regions.map((region) => [region.id, region])));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
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
          <h1 className={`page-title ${embedded ? '' : 'mt-1'}`}>Provinces</h1>
          <p className="page-subtitle">Liste des provinces de r�f�rence.</p>
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
                <th className="table-th">R�gion</th>
                <th className="table-th">Statut</th>
                {canDelete && <th className="table-th">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={canDelete ? 6 : 5} className="text-center py-12 text-gray-400 text-sm">
                    Chargement�
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={canDelete ? 6 : 5} className="text-center py-12 text-gray-400 text-sm">
                    Aucune province
                  </td>
                </tr>
              ) : (
                rows.map((province) => (
                  <tr key={province.id} className="hover:bg-gray-50 transition-colors">
                    <td className="table-td font-mono text-sm">{province.code || '�'}</td>
                    <td className="table-td">{province.name_fr || '�'}</td>
                    <td className="table-td" dir="rtl">{province.name_ar || '�'}</td>
                    <td className="table-td">{regionMap[province.region_id]?.name_fr || province.region_id || '�'}</td>
                    <td className="table-td">
                      {province.is_deleted ? (
                        <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">
                          Supprimé
                        </span>
                      ) : (
                        <span className={province.is_active ? 'badge-active' : 'badge-inactive'}>
                          {province.is_active ? 'Actif' : 'Inactif'}
                        </span>
                      )}
                    </td>
                    {canDelete && (
                      <td className="table-td">
                        <div className="flex items-center gap-2">
                          <DeleteButton
                            onClick={async () => {
                              if (!window.confirm(`Supprimer la province "${province.name_fr}" ?`)) return;
                              try {
                                await deleteProvince(province.id);
                                toast.success('Province supprim�e');
                                loadData();
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
