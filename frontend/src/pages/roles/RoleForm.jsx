import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { getRole, createRole, updateRole } from '../../api/roles.api';
import { getPermissions } from '../../api/permissions.api';
import { getErrorMessage, groupPermissionsByModule } from '../../utils/helpers';
import toast from 'react-hot-toast';

const initialForm = {
  name: '',
  code: '',
  description: '',
  status: 'active',
  permission_ids: [],
};

export default function RoleForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(initialForm);
  const [permissionGroups, setPermissionGroups] = useState({});
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const permsRes = await getPermissions();
        setPermissionGroups(groupPermissionsByModule(permsRes.data.data));

        if (isEdit) {
          const roleRes = await getRole(id);
          const r = roleRes.data.data;
          setForm({
            name: r.name,
            code: r.code,
            description: r.description || '',
            status: r.status,
            permission_ids: r.role_permissions?.map((rp) => rp.permission_id) || [],
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

  const togglePermission = (permId) => {
    setForm((f) => ({
      ...f,
      permission_ids: f.permission_ids.includes(permId)
        ? f.permission_ids.filter((p) => p !== permId)
        : [...f.permission_ids, permId],
    }));
  };

  const toggleModule = (perms) => {
    const ids = perms.map((p) => p.id);
    const allSelected = ids.every((pid) => form.permission_ids.includes(pid));
    setForm((f) => ({
      ...f,
      permission_ids: allSelected
        ? f.permission_ids.filter((p) => !ids.includes(p))
        : [...new Set([...f.permission_ids, ...ids])],
    }));
  };

  const selectAll = () => {
    const allIds = Object.values(permissionGroups).flat().map((p) => p.id);
    setForm((f) => ({ ...f, permission_ids: allIds }));
  };

  const clearAll = () => setForm((f) => ({ ...f, permission_ids: [] }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) {
        await updateRole(id, form);
        toast.success('Rôle mis à jour avec succès');
      } else {
        await createRole(form);
        toast.success('Rôle créé avec succès');
      }
      navigate('/roles');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (fetchingData) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const totalPerms = Object.values(permissionGroups).flat().length;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/roles" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Retour
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-lg font-semibold text-gray-800">
          {isEdit ? 'Modifier le rôle' : 'Nouveau rôle'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="card space-y-4">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
            Informations du rôle
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Nom du rôle *</label>
              <input name="name" className="form-input" value={form.name} onChange={handleChange} required />
            </div>
            <div>
              <label className="form-label">Code *</label>
              <input
                name="code"
                className="form-input"
                value={form.code}
                onChange={handleChange}
                required
                placeholder="ex: manager"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">Description</label>
              <textarea
                name="description"
                className="form-input"
                rows={2}
                value={form.description}
                onChange={handleChange}
                placeholder="Description du rôle..."
              />
            </div>
            <div>
              <label className="form-label">Statut</label>
              <select name="status" className="form-input" value={form.status} onChange={handleChange}>
                <option value="active">Actif</option>
                <option value="inactive">Inactif</option>
              </select>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Permissions</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {form.permission_ids.length} / {totalPerms} sélectionnée(s)
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={selectAll} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                Tout sélectionner
              </button>
              <span className="text-gray-300">|</span>
              <button type="button" onClick={clearAll} className="text-xs text-gray-500 hover:text-gray-700 font-medium">
                Tout effacer
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {Object.entries(permissionGroups).map(([module, perms]) => {
              const selected = perms.filter((p) => form.permission_ids.includes(p.id)).length;
              const allSelected = selected === perms.length;

              return (
                <div key={module} className="border border-gray-100 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => toggleModule(perms)}
                      className="rounded text-blue-600"
                    />
                    <span className="text-sm font-semibold text-gray-700 capitalize">{module}</span>
                    <span className="ml-auto text-xs text-gray-400">
                      {selected}/{perms.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-gray-100 p-px">
                    {perms.map((perm) => (
                      <label
                        key={perm.id}
                        className={`flex items-start gap-3 p-3 bg-white cursor-pointer transition-colors hover:bg-blue-50 ${
                          form.permission_ids.includes(perm.id) ? 'bg-blue-50' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={form.permission_ids.includes(perm.id)}
                          onChange={() => togglePermission(perm.id)}
                          className="mt-0.5 rounded text-blue-600"
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-700">{perm.name}</p>
                          <p className="text-xs text-gray-400">{perm.code}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Enregistrement...' : 'Enregistrer'}
          </button>
          <Link to="/roles" className="btn-secondary">Annuler</Link>
        </div>
      </form>
    </div>
  );
}
