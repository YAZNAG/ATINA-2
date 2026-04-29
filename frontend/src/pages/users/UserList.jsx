import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getUsers, deleteUser } from '../../api/users.api';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage, formatDate } from '../../utils/helpers';
import toast from 'react-hot-toast';

export default function UserList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  const fetchUsers = async () => {
    try {
      const res = await getUsers();
      setUsers(res.data.data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Supprimer l'utilisateur "${name}" ?`)) return;
    try {
      await deleteUser(id);
      toast.success('Utilisateur supprimé');
      fetchUsers();
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-800">
          Utilisateurs <span className="text-gray-400 font-normal">({users.length})</span>
        </h1>
        {hasPermission('users.create') && (
          <Link to="/users/new" className="btn-primary text-sm">
            + Nouvel utilisateur
          </Link>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="table-th">Nom complet</th>
                <th className="table-th">Email</th>
                <th className="table-th">Téléphone</th>
                <th className="table-th">Rôles</th>
                <th className="table-th">Statut</th>
                <th className="table-th">Créé le</th>
                <th className="table-th">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400 text-sm">
                    Aucun utilisateur trouvé
                  </td>
                </tr>
              ) : users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="table-td font-medium text-gray-900">{u.full_name}</td>
                  <td className="table-td text-gray-600">{u.email}</td>
                  <td className="table-td text-gray-500">{u.phone || '—'}</td>
                  <td className="table-td">
                    <div className="flex flex-wrap gap-1">
                      {u.user_roles?.map((ur) => (
                        <span key={ur.id} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                          {ur.role.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="table-td">
                    <span className={u.status === 'active' ? 'badge-active' : 'badge-inactive'}>
                      {u.status === 'active' ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="table-td text-gray-500">{formatDate(u.created_at)}</td>
                  <td className="table-td">
                    <div className="flex items-center gap-3">
                      {hasPermission('users.update') && (
                        <button
                          onClick={() => navigate(`/users/${u.id}/edit`)}
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                        >
                          Modifier
                        </button>
                      )}
                      {hasPermission('users.delete') && (
                        <button
                          onClick={() => handleDelete(u.id, u.full_name)}
                          className="text-red-500 hover:text-red-600 text-sm font-medium"
                        >
                          Supprimer
                        </button>
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
