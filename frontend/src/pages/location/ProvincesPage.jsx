import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../utils/helpers';
import { deleteProvince, getProvinces, getRegions } from '../../api/locationNode.api';
import { AddIcon, DeleteButton, EditButton } from '../../components/ui/CrudActions';

export default function ProvincesPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [regions, setRegions] = useState([]);
  const [rows, setRows] = useState([]);

  const regionId = searchParams.get('region_id') || '';

  const load = async () => {
    const [regRes, provRes] = await Promise.all([
      getRegions({ limit: 500 }),
      getProvinces({ limit: 500, ...(regionId ? { region_id: regionId } : {}) }),
    ]);
    setRegions(regRes.data.data || []);
    setRows(provRes.data.data || []);
  };

  useEffect(() => {
    load().catch((err) => toast.error(getErrorMessage(err)));
  }, [regionId]);

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <Link to="/geo" className="text-sm text-gray-500 hover:text-gray-700">{'<-'} Geographie</Link>
          <h1 className="page-title mt-1">Provinces</h1>
          <p className="page-subtitle">Rattachees a une region.</p>
        </div>
        {hasPermission('provinces.create') && (
          <Link to="/geo/provinces/new" className="btn-primary text-sm">
            <AddIcon />
            Nouvelle province
          </Link>
        )}
      </div>

      <div className="card py-4">
        <label className="form-label">Filtrer par region</label>
        <select
          className="form-input max-w-md"
          value={regionId}
          onChange={(e) => {
            const next = new URLSearchParams(searchParams);
            if (e.target.value) next.set('region_id', e.target.value);
            else next.delete('region_id');
            setSearchParams(next);
          }}
        >
          <option value="">Toutes les regions</option>
          {regions.map((r) => <option key={r.id} value={r.id}>{r.name_fr}</option>)}
        </select>
      </div>

      <div className="table-wrap">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="table-th">Code</th>
                <th className="table-th">Nom FR</th>
                <th className="table-th">Region</th>
                <th className="table-th">Statut</th>
                <th className="table-th">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-gray-400 text-sm">Aucune province</td>
                </tr>
              ) : rows.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="table-td">{p.code}</td>
                  <td className="table-td">{p.name_fr}</td>
                  <td className="table-td">{p.region?.name_fr || '-'}</td>
                  <td className="table-td">
                    <span className={p.is_active ? 'badge-active' : 'badge-inactive'}>
                      {p.is_active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="table-td">
                    <div className="flex items-center gap-2">
                      {hasPermission('provinces.update') && (
                        <EditButton onClick={() => navigate(`/geo/provinces/${p.id}/edit`)} />
                      )}
                      {hasPermission('provinces.delete') && (
                        <DeleteButton onClick={async () => {
                          if (!window.confirm(`Supprimer la province "${p.name_fr}" ?`)) return;
                          try {
                            await deleteProvince(p.id);
                            toast.success('Province supprimee');
                            load();
                          } catch (err) {
                            toast.error(getErrorMessage(err));
                          }
                        }} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
