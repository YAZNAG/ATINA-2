import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../utils/helpers';
import { deleteCity, getCities, getProvinces, getRegions } from '../../api/locationNode.api';
import { AddIcon, DeleteButton, EditButton } from '../../components/ui/CrudActions';

export default function CitiesPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [rows, setRows] = useState([]);

  const regionId = searchParams.get('region_id') || '';
  const provinceId = searchParams.get('province_id') || '';

  const load = async () => {
    const [regRes, provRes, cityRes] = await Promise.all([
      getRegions({ limit: 500 }),
      getProvinces({ limit: 500, ...(regionId ? { region_id: regionId } : {}) }),
      getCities({ limit: 500, ...(provinceId ? { province_id: provinceId } : {}) }),
    ]);
    setRegions(regRes.data.data || []);
    setProvinces(provRes.data.data || []);
    setRows(cityRes.data.data || []);
  };

  useEffect(() => {
    load().catch((err) => toast.error(getErrorMessage(err)));
  }, [regionId, provinceId]);

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <Link to="/geo" className="text-sm text-gray-500 hover:text-gray-700">{'<-'} Geographie</Link>
          <h1 className="page-title mt-1">Villes</h1>
          <p className="page-subtitle">Rattachees a une province.</p>
        </div>
        {hasPermission('cities.create') && (
          <Link to="/geo/cities/new" className="btn-primary text-sm">
            <AddIcon />
            Nouvelle ville
          </Link>
        )}
      </div>

      <div className="card py-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Filtrer par region</label>
            <select
              className="form-input"
              value={regionId}
              onChange={(e) => {
                const next = new URLSearchParams(searchParams);
                if (e.target.value) next.set('region_id', e.target.value);
                else next.delete('region_id');
                next.delete('province_id');
                setSearchParams(next);
              }}
            >
              <option value="">Toutes</option>
              {regions.map((r) => <option key={r.id} value={r.id}>{r.name_fr}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Filtrer par province</label>
            <select
              className="form-input"
              value={provinceId}
              onChange={(e) => {
                const next = new URLSearchParams(searchParams);
                if (e.target.value) next.set('province_id', e.target.value);
                else next.delete('province_id');
                setSearchParams(next);
              }}
            >
              <option value="">Toutes</option>
              {provinces.map((p) => <option key={p.id} value={p.id}>{p.name_fr}</option>)}
            </select>
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
                <th className="table-th">Province</th>
                <th className="table-th">Code postal</th>
                <th className="table-th">Statut</th>
                <th className="table-th">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400 text-sm">Aucune ville</td>
                </tr>
              ) : rows.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="table-td">{c.code}</td>
                  <td className="table-td">{c.name_fr}</td>
                  <td className="table-td">{c.province?.name_fr || '-'}</td>
                  <td className="table-td">{c.postal_code || '-'}</td>
                  <td className="table-td">
                    <span className={c.is_active ? 'badge-active' : 'badge-inactive'}>
                      {c.is_active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="table-td">
                    <div className="flex items-center gap-2">
                      {hasPermission('cities.update') && (
                        <EditButton onClick={() => navigate(`/geo/cities/${c.id}/edit`)} />
                      )}
                      {hasPermission('cities.delete') && (
                        <DeleteButton onClick={async () => {
                          if (!window.confirm(`Supprimer la ville "${c.name_fr}" ?`)) return;
                          try {
                            await deleteCity(c.id);
                            toast.success('Ville supprime');
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
