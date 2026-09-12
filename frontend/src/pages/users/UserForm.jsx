import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import FormPageShell from '../../components/FormPageShell';
import { getUser, createUser, updateUser } from '../../api/users.api';
import { getRoles } from '../../api/roles.api';
import { getNodes } from '../../api/locationNode.api';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage, formatDate } from '../../utils/helpers';

const initialForm = {
  full_name: '',
  email: '',
  password: '',
  phone: '',
  status: 'active',
  role_ids: [],
  node_id: '',   // '' = tous les nœuds (US-124)
};

const isRoleActive = (r) => Boolean(r?.is_active && r?.status === 'active');
const fmtDateTime = (d) => (d
  ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : 'Jamais connecté');

export default function UserForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canEdit = isEdit ? hasPermission('users.update') : hasPermission('users.create');

  const [form, setForm] = useState(initialForm);
  const [account, setAccount] = useState(null);
  const [roles, setRoles] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [heldRoleIds, setHeldRoleIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [rolesRes, nodesRes] = await Promise.all([getRoles(), getNodes({ limit: 500 })]);
        setRoles(rolesRes.data.data || []);
        const nodeData = nodesRes?.data?.data ?? [];
        setNodes(Array.isArray(nodeData) ? nodeData : (nodeData.data ?? []));

        if (isEdit) {
          const userRes = await getUser(id);
          const u = userRes.data.data;
          setAccount(u);
          const held = u.user_roles?.map((ur) => String(ur.role_id)) || [];
          setHeldRoleIds(held);
          setForm({
            full_name: u.full_name,
            email: u.email,
            password: '',
            phone: u.phone || '',
            status: u.is_active && u.status === 'active' ? 'active' : 'inactive',
            role_ids: held,
            node_id: u.node_id || '',
          });
        }
      } catch (err) {
        toast.error(getErrorMessage(err));
      } finally {
        setFetchingData(false);
      }
    };
    loadData();
  }, [id, isEdit]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const toggleRole = (roleId) => {
    const rid = String(roleId);
    setForm((f) => ({
      ...f,
      role_ids: f.role_ids.includes(rid) ? f.role_ids.filter((r) => r !== rid) : [...f.role_ids, rid],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.role_ids.length === 0) {
      toast.error('Assignez au moins un rôle au compte');
      return;
    }
    setLoading(true);
    try {
      const payload = { ...form, role_ids: form.role_ids.map(Number) };
      if (!payload.password) delete payload.password;
      // '' = aucun périmètre : le compte voit tous les nœuds.
      payload.node_id = form.node_id || null;

      if (isEdit) {
        await updateUser(id, payload);
        toast.success('Compte mis à jour');
      } else {
        await createUser(payload);
        toast.success('Compte créé');
      }
      navigate('/users');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (fetchingData) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-red-600" />
      </div>
    );
  }

  // Rôles affichés : actifs (assignables) + rôles déjà portés par le compte (même inactifs, conservés).
  const visibleRoles = roles.filter((r) => isRoleActive(r) || heldRoleIds.includes(String(r.id)));
  const deleted = Boolean(account?.is_deleted);

  return (
    <FormPageShell
      backTo="/users"
      backLabel="Liste des comptes"
      segmentLabel={isEdit ? 'Fiche compte' : 'Nouveau compte'}
      title={isEdit ? 'Fiche compte' : 'Nouveau compte'}
    >
      {isEdit && account && (
        <div className="card grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div>
            <p className="form-label">Statut</p>
            {deleted
              ? <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600">Supprimé</span>
              : <span className={account.is_active && account.status === 'active' ? 'badge-active' : 'badge-inactive'}>
                  {account.is_active && account.status === 'active' ? 'Actif' : 'Inactif'}
                </span>}
          </div>
          <div>
            <p className="form-label">Dernière connexion</p>
            <p className="text-zinc-700">{fmtDateTime(account.last_login_at)}</p>
          </div>
          <div>
            <p className="form-label">Créé le</p>
            <p className="text-zinc-700">{formatDate(account.created_at)}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card space-y-5">
        <fieldset disabled={!canEdit || deleted} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="form-label">Nom complet *</label>
              <input name="full_name" className="form-input" value={form.full_name} onChange={handleChange} required />
            </div>
            <div>
              <label className="form-label">Email * <span className="font-normal text-zinc-400">(unique)</span></label>
              <input type="email" name="email" className="form-input" value={form.email} onChange={handleChange} required />
            </div>
            <div>
              <label className="form-label">{isEdit ? 'Nouveau mot de passe' : 'Mot de passe *'}</label>
              <input
                type="password"
                name="password"
                className="form-input"
                value={form.password}
                onChange={handleChange}
                required={!isEdit}
                minLength={8}
                placeholder={isEdit ? 'Laisser vide pour ne pas changer' : '8 caractères minimum'}
              />
            </div>
            <div>
              <label className="form-label">Téléphone</label>
              <input name="phone" className="form-input" value={form.phone} onChange={handleChange} placeholder="+212 6xx xxx xxx" />
            </div>
            <div>
              <label className="form-label">Périmètre</label>
              <select name="node_id" className="form-select" value={form.node_id} onChange={handleChange} disabled={!canEdit}>
                <option value="">Tous les nœuds</option>
                {nodes.map((n) => <option key={n.id} value={n.id}>{n.name_fr} ({n.code})</option>)}
              </select>
              <p className="mt-1 text-xs text-zinc-400">
                Un compte rattaché à un nœud ne voit que les données de ce nœud.
              </p>
            </div>
            <div>
              <label className="form-label">Statut</label>
              <select name="status" className="form-select" value={form.status} onChange={handleChange}>
                <option value="active">Actif</option>
                <option value="inactive">Inactif</option>
              </select>
            </div>
          </div>

          <div>
            <label className="form-label mb-2">Rôle assigné *</label>
            {visibleRoles.length === 0 ? (
              <p className="text-sm text-zinc-400">Aucun rôle actif disponible.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {visibleRoles.map((role) => {
                  const checked = form.role_ids.includes(String(role.id));
                  const inactive = !isRoleActive(role);
                  return (
                    <label
                      key={role.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                        checked ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input type="checkbox" checked={checked} onChange={() => toggleRole(role.id)} className="rounded text-red-600" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-700">
                          {role.name_fr || role.name}
                          {inactive && <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500">inactif — conservé</span>}
                        </p>
                        <p className="text-xs text-gray-400">
                          {role.code}
                          {role.name_ar && <span className="ml-2" dir="rtl">{role.name_ar}</span>}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
            <p className="mt-1 text-xs text-zinc-400">Seuls les rôles actifs sont assignables.</p>
          </div>
        </fieldset>

        <div className="form-actions">
          {canEdit && !deleted && (
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          )}
          <Link to="/users" className="btn-secondary">
            {canEdit && !deleted ? 'Annuler' : 'Retour'}
          </Link>
        </div>
      </form>
    </FormPageShell>
  );
}
