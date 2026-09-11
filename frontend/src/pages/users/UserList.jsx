import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Search, Power, PowerOff, RotateCcw, Loader2 } from 'lucide-react';
import { getUsers, deleteUser, activateUser, deactivateUser, restoreUser } from '../../api/users.api';
import { getRoles } from '../../api/roles.api';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage, formatDate } from '../../utils/helpers';
import { AddIcon, DeleteButton, EditButton } from '../../components/ui/CrudActions';
import Modal from '../../components/Modal';

const PAGE_SIZE = 50;

const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'active', label: 'Actif' },
  { value: 'inactive', label: 'Inactif' },
  { value: 'deleted', label: 'Supprimé' },
];

const fmtDateTime = (d) => (d
  ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : null);

function AccountStatus({ user }) {
  if (user.is_deleted) return <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600">Supprimé</span>;
  const active = user.is_active && user.status === 'active';
  return <span className={active ? 'badge-active' : 'badge-inactive'}>{active ? 'Actif' : 'Inactif'}</span>;
}

export default function UserList() {
  const { hasPermission, user: me } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState([]);
  const [search, setSearch] = useState('');
  const [roleId, setRoleId] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const canUpdate = hasPermission('users.update');
  const canDelete = hasPermission('users.delete');

  useEffect(() => {
    getRoles().then((r) => setRoles(r.data?.data ?? [])).catch(() => setRoles([]));
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getUsers({
        page,
        limit: PAGE_SIZE,
        ...(search.trim() && { search: search.trim() }),
        ...(roleId && { role_id: roleId }),
        ...(status && { status }),
      });
      setUsers(res.data.data || []);
      setPagination(res.data.pagination || { total: (res.data.data || []).length, page: 1, pages: 1 });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, search, roleId, status]);

  useEffect(() => {
    const t = setTimeout(fetchUsers, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [fetchUsers]);

  useEffect(() => { setPage(1); }, [search, roleId, status]);

  const run = async (id, fn, okMsg) => {
    setBusyId(id);
    try {
      await fn();
      toast.success(okMsg);
      fetchUsers();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    const target = deleting;
    setDeleting(null);
    await run(target.id, () => deleteUser(target.id), 'Compte supprimé');
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Liste des comptes <span className="font-normal text-slate-400">({pagination.total ?? users.length})</span>
          </h1>
          <p className="page-subtitle">Comptes Back-Office : rôle, statut et dernière connexion.</p>
        </div>
        {hasPermission('users.create') && (
          <Link to="/users/new" className="btn-primary text-sm">
            <AddIcon />
            Nouveau compte
          </Link>
        )}
      </div>

      <div className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="relative min-w-[220px] flex-1">
          <label className="form-label">Recherche</label>
          <Search size={15} className="pointer-events-none absolute bottom-3 left-3 text-zinc-400" />
          <input
            className="form-input pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom, email, téléphone…"
          />
        </div>
        <div className="min-w-[180px]">
          <label className="form-label">Rôle</label>
          <select className="form-select" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            <option value="">Tous les rôles</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name_fr || r.name}</option>)}
          </select>
        </div>
        <div className="min-w-[160px]">
          <label className="form-label">Statut</label>
          <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div className="table-wrap">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="table-th">Nom complet</th>
                <th className="table-th">Email</th>
                <th className="table-th">Téléphone</th>
                <th className="table-th">Rôle</th>
                <th className="table-th">Statut</th>
                <th className="table-th">Dernière connexion</th>
                <th className="table-th">Créé le</th>
                <th className="table-th">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={8} className="py-12 text-center text-gray-400"><Loader2 size={20} className="mx-auto animate-spin" /></td></tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-sm text-gray-400">Aucun compte trouvé.</td>
                </tr>
              ) : users.map((u) => {
                const active = u.is_active && u.status === 'active';
                const isMe = me?.id === u.id;
                return (
                  <tr key={u.id} className={`transition-colors hover:bg-gray-50 ${u.is_deleted ? 'opacity-60' : ''}`}>
                    <td className="table-td font-medium text-gray-900">
                      <button type="button" onClick={() => navigate(`/users/${u.id}/edit`)} className="text-left hover:text-red-600 hover:underline">
                        {u.full_name}
                      </button>
                      {isMe && <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500">vous</span>}
                    </td>
                    <td className="table-td text-gray-600">{u.email}</td>
                    <td className="table-td text-gray-500">{u.phone || u.phone_number || '—'}</td>
                    <td className="table-td">
                      <div className="flex flex-wrap gap-1">
                        {(u.user_roles || []).length === 0 ? <span className="text-xs text-gray-400">—</span> : u.user_roles.map((ur) => (
                          <span key={ur.id} className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700" title={ur.role?.name_ar || ''}>
                            {ur.role?.name_fr || ur.role?.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="table-td"><AccountStatus user={u} /></td>
                    <td className="table-td whitespace-nowrap text-gray-500">{fmtDateTime(u.last_login_at) || 'Jamais'}</td>
                    <td className="table-td text-gray-500">{formatDate(u.created_at)}</td>
                    <td className="table-td">
                      <div className="flex items-center gap-2">
                        {u.is_deleted ? (
                          canDelete && (
                            <button type="button" disabled={busyId === u.id} onClick={() => run(u.id, () => restoreUser(u.id), 'Compte restauré')}
                              className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50" title="Restaurer">
                              <RotateCcw size={16} />
                            </button>
                          )
                        ) : (
                          <>
                            {canUpdate && <EditButton onClick={() => navigate(`/users/${u.id}/edit`)} />}
                            {canUpdate && (
                              <button
                                type="button"
                                disabled={busyId === u.id}
                                onClick={() => run(u.id, () => (active ? deactivateUser(u.id) : activateUser(u.id)), active ? 'Compte désactivé' : 'Compte activé')}
                                className={`rounded-lg p-1.5 disabled:opacity-50 ${active ? 'text-emerald-600 hover:bg-emerald-50' : 'text-zinc-400 hover:bg-zinc-100'}`}
                                title={active ? 'Désactiver' : 'Activer'}
                              >
                                {busyId === u.id ? <Loader2 size={16} className="animate-spin" /> : active ? <Power size={16} /> : <PowerOff size={16} />}
                              </button>
                            )}
                            {canDelete && <DeleteButton onClick={() => setDeleting(u)} />}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {pagination.pages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2 text-sm">
          <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Précédent</button>
          <span className="text-zinc-500">Page {page} / {pagination.pages}</span>
          <button type="button" className="btn-secondary" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}>Suivant</button>
        </div>
      )}

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Supprimer le compte ?"
        size="sm"
        footer={(
          <>
            <button type="button" className="btn-secondary" onClick={() => setDeleting(null)}>Annuler</button>
            <button type="button" className="btn-danger" onClick={confirmDelete}>Supprimer</button>
          </>
        )}
      >
        {deleting && (
          <p className="text-sm text-zinc-600">
            Le compte <strong>{deleting.full_name}</strong> ({deleting.email}) sera supprimé (suppression logique) :
            il ne pourra plus se connecter et ses sessions actives seront invalidées. Il reste restaurable.
          </p>
        )}
      </Modal>
    </div>
  );
}
