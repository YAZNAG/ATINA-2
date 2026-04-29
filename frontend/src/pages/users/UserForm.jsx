import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { getUser, createUser, updateUser } from '../../api/users.api';
import { getRoles } from '../../api/roles.api';
import { getErrorMessage } from '../../utils/helpers';
import toast from 'react-hot-toast';

const initialForm = {
  full_name: '',
  email: '',
  password: '',
  phone: '',
  status: 'active',
  role_ids: [],
};

export default function UserForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(initialForm);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const rolesRes = await getRoles();
        setRoles(rolesRes.data.data);

        if (isEdit) {
          const userRes = await getUser(id);
          const u = userRes.data.data;
          setForm({
            full_name: u.full_name,
            email: u.email,
            password: '',
            phone: u.phone || '',
            status: u.status,
            role_ids: u.user_roles?.map((ur) => String(ur.role_id)) || [],
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
      role_ids: f.role_ids.includes(rid)
        ? f.role_ids.filter((r) => r !== rid)
        : [...f.role_ids, rid],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form, role_ids: form.role_ids.map(Number) };
      if (!payload.password) delete payload.password;

      if (isEdit) {
        await updateUser(id, payload);
        toast.success('Utilisateur mis à jour avec succès');
      } else {
        await createUser(payload);
        toast.success('Utilisateur créé avec succès');
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/users" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Retour
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-lg font-semibold text-gray-800">
          {isEdit ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Nom complet *</label>
            <input
              name="full_name"
              className="form-input"
              value={form.full_name}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <label className="form-label">Email *</label>
            <input
              type="email"
              name="email"
              className="form-input"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <label className="form-label">
              {isEdit ? 'Nouveau mot de passe' : 'Mot de passe *'}
            </label>
            <input
              type="password"
              name="password"
              className="form-input"
              value={form.password}
              onChange={handleChange}
              required={!isEdit}
              placeholder={isEdit ? 'Laisser vide pour ne pas changer' : ''}
            />
          </div>
          <div>
            <label className="form-label">Téléphone</label>
            <input
              name="phone"
              className="form-input"
              value={form.phone}
              onChange={handleChange}
              placeholder="+212 6xx xxx xxx"
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

        {roles.length > 0 && (
          <div>
            <label className="form-label mb-2">Rôles assignés</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {roles.map((role) => (
                <label
                  key={role.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    form.role_ids.includes(String(role.id))
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={form.role_ids.includes(String(role.id))}
                    onChange={() => toggleRole(role.id)}
                    className="rounded text-blue-600"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-700">{role.name}</p>
                    <p className="text-xs text-gray-400">{role.code}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2 border-t border-gray-100">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Enregistrement...' : 'Enregistrer'}
          </button>
          <Link to="/users" className="btn-secondary">Annuler</Link>
        </div>
      </form>
    </div>
  );
}
