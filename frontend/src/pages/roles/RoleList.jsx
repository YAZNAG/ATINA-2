import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getRoles, deleteRole } from '../../api/roles.api';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage, formatDate } from '../../utils/helpers';
import toast from 'react-hot-toast';
import { AddIcon, DeleteButton, EditButton } from '../../components/ui/CrudActions';

export default function RoleList() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  const fetchRoles = async () => {
    try {
      const res = await getRoles();
      setRoles(res.data.data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRoles(); }, []);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Supprimer le rôle "${name}" ?`)) return;
    try {
      await deleteRole(id);
      toast.success('Rôle supprimé');
      fetchRoles();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <h1 className="page-title">
          Rôles <span className="text-slate-400 font-normal">({roles.length})</span>
        </h1>
        {hasPermission('roles.create') && (
          <Link to="/roles/new" className="btn-primary text-sm">
            <AddIcon />
            Nouveau rôle
          </Link>
        )}
      </div>

      <div className="table-wrap">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="table-th">Nom</th>
                <th className="table-th">Code</th>
                <th className="table-th">Description</th>
                <th className="table-th">Permissions</th>
                <th className="table-th">Statut</th>
                <th className="table-th">Créé le</th>
                <th className="table-th">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {roles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400 text-sm">
                    Aucun rôle trouvé
                  </td>
                </tr>
              ) : roles.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="table-td font-medium text-gray-900">{r.name}</td>
                  <td className="table-td">
                    <code className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">
                      {r.code}
                    </code>
                  </td>
                  <td className="table-td text-gray-500 max-w-xs truncate">
                    {r.description || '—'}
                  </td>
                  <td className="table-td">
                    <span className="text-sm text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                      {r.role_permissions?.length || 0}
                    </span>
                  </td>
                  <td className="table-td">
                    <span className={r.status === 'active' ? 'badge-active' : 'badge-inactive'}>
                      {r.status === 'active' ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="table-td text-gray-500">{formatDate(r.created_at)}</td>
                  <td className="table-td">
                    <div className="flex items-center gap-2">
                      {hasPermission('roles.update') && (
                        <EditButton onClick={() => navigate(`/roles/${r.id}/edit`)} />
                      )}
                      {hasPermission('roles.delete') && (
                        <DeleteButton onClick={() => handleDelete(r.id, r.name)} />
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
