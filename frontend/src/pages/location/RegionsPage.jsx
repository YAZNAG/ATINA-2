import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../utils/helpers';
import { deleteRegion, getRegions } from '../../api/locationNode.api';
import { AddIcon, DeleteButton, EditButton } from '../../components/ui/CrudActions';

function descCell(value, max = 56) {
  if (value == null || String(value).trim() === '') return '—';
  const s = String(value);
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

export default function RegionsPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);

  const load = async () => {
    const res = await getRegions({ limit: 500 });
    setRows(res.data.data || []);
  };

  useEffect(() => {
    load().catch((err) => toast.error(getErrorMessage(err)));
  }, []);

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <Link to="/geo" className="text-sm text-gray-500 hover:text-gray-700">{'<-'} Geographie</Link>
          <h1 className="page-title mt-1">Regions</h1>
          <p className="page-subtitle">Niveau superieur geographique.</p>
        </div>
        {hasPermission('regions.create') && (
          <Link to="/geo/regions/new" className="btn-primary text-sm">
            <AddIcon />
            Nouvelle region
          </Link>
        )}
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
                <th className="table-th">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400 text-sm">Aucune region</td>
                </tr>
              ) : rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="table-td">{r.code}</td>
                  <td className="table-td">{r.name_fr}</td>
                  <td className="table-td">{r.name_ar}</td>
                  <td className="table-td text-sm text-slate-600 max-w-[14rem] align-top" title={r.description_fr || ''}>
                    {descCell(r.description_fr)}
                  </td>
                  <td className="table-td text-sm text-slate-600 max-w-[14rem] align-top" dir="rtl" title={r.description_ar || ''}>
                    {descCell(r.description_ar)}
                  </td>
                  <td className="table-td">
                    <span className={r.is_active ? 'badge-active' : 'badge-inactive'}>
                      {r.is_active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="table-td">
                    <div className="flex items-center gap-2">
                      {hasPermission('regions.update') && (
                        <EditButton onClick={() => navigate(`/geo/regions/${r.id}/edit`)} />
                      )}
                      {hasPermission('regions.delete') && (
                        <DeleteButton onClick={async () => {
                          if (!window.confirm(`Supprimer la region "${r.name_fr}" ?`)) return;
                          try {
                            await deleteRegion(r.id);
                            toast.success('Region supprimee');
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
