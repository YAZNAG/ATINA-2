import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { createProvince, getProvince, getRegions, updateProvince } from '../../api/locationNode.api';
import { getErrorMessage } from '../../utils/helpers';

const initialForm = {
  region_id: '',
  code: '',
  name_fr: '',
  name_ar: '',
  is_active: true,
};

export default function ProvinceFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const canSave = isEdit ? hasPermission('provinces.update') : hasPermission('provinces.create');

  useEffect(() => {
    (async () => {
      try {
        const regRes = await getRegions({ limit: 500 });
        setRegions(regRes.data.data || []);
        if (isEdit) {
          const res = await getProvince(id);
          setForm({ ...initialForm, ...res.data.data });
        }
      } catch (err) {
        toast.error(getErrorMessage(err));
      } finally {
        setFetching(false);
      }
    })();
  }, [id, isEdit]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    setLoading(true);
    try {
      if (isEdit) await updateProvince(id, form);
      else await createProvince(form);
      toast.success(isEdit ? 'Province mise à jour' : 'Province créée');
      navigate('/geo/provinces');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  }

  if (!canSave) {
    return <div className="text-center py-12 text-red-600">Accès refusé.</div>;
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div>
        <Link to="/geo/provinces" className="text-sm text-gray-500 hover:text-gray-700">{'<-'} Provinces</Link>
        <h1 className="text-lg font-semibold text-gray-800 mt-2">{isEdit ? 'Modifier' : 'Nouvelle'} province</h1>
      </div>

      <form onSubmit={onSubmit} className="card space-y-4">
        <div>
          <label className="form-label">Région *</label>
          <select className="form-input" value={form.region_id} onChange={(e) => setForm({ ...form, region_id: e.target.value })} required>
            <option value="">— Choisir —</option>
            {regions.map((r) => <option key={r.id} value={r.id}>{r.name_fr}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Code *</label>
          <input className="form-input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
        </div>
        <div>
          <label className="form-label">Nom FR *</label>
          <input className="form-input" value={form.name_fr} onChange={(e) => setForm({ ...form, name_fr: e.target.value })} required />
        </div>
        <div>
          <label className="form-label">Nom AR *</label>
          <input className="form-input" value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} required />
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input type="checkbox" checked={Boolean(form.is_active)} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
          Active
        </label>
        <div className="flex gap-3 pt-2">
          <button type="submit" className="btn-primary" disabled={loading}>{loading ? '…' : 'Enregistrer'}</button>
          <Link to="/geo/provinces" className="btn-secondary text-center">Annuler</Link>
        </div>
      </form>
    </div>
  );
}
