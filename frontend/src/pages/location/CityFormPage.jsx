import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import FormPageShell from '../../components/FormPageShell';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { createCity, getCity, getProvinces, getRegions, updateCity } from '../../api/locationNode.api';
import { getErrorMessage } from '../../utils/helpers';

const initialForm = {
  province_id: '',
  code: '',
  name_fr: '',
  name_ar: '',
  postal_code: '',
  is_active: true,
};

export default function CityFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [regionFilter, setRegionFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const canSave = isEdit ? hasPermission('cities.update') : hasPermission('cities.create');

  useEffect(() => {
    (async () => {
      try {
        const regRes = await getRegions({ limit: 500 });
        setRegions(regRes.data.data || []);
        if (isEdit) {
          const res = await getCity(id);
          const row = res.data.data;
          setForm({ ...initialForm, ...row });
          const rId = row.province?.region?.id || '';
          setRegionFilter(rId);
          const provRes = await getProvinces({ limit: 500, ...(rId ? { region_id: rId } : {}) });
          setProvinces(provRes.data.data || []);
        } else {
          const provRes = await getProvinces({ limit: 500 });
          setProvinces(provRes.data.data || []);
        }
      } catch (err) {
        toast.error(getErrorMessage(err));
      } finally {
        setFetching(false);
      }
    })();
  }, [id, isEdit]);

  useEffect(() => {
    if (fetching) return;
    (async () => {
      try {
        const provRes = await getProvinces({ limit: 500, ...(regionFilter ? { region_id: regionFilter } : {}) });
        const list = provRes.data.data || [];
        setProvinces(list);
        if (form.province_id && !list.some((p) => p.id === form.province_id)) {
          setForm((f) => ({ ...f, province_id: '' }));
        }
      } catch {
        setProvinces([]);
      }
    })();
  }, [regionFilter]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    setLoading(true);
    try {
      if (isEdit) await updateCity(id, form);
      else await createCity(form);
      toast.success(isEdit ? 'Ville mise ù jour' : 'Ville crùùe');
      navigate('/geo/cities');
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
    return <div className="text-center py-12 text-red-600">Accùs refusù.</div>;
  }

  return (
    <FormPageShell
      backTo="/geo/cities"
      segmentLabel={isEdit ? 'Modifier ville' : 'Nouvelle ville'}
      title={isEdit ? 'Modifier la ville' : 'Nouvelle ville'}
    >
      <form onSubmit={onSubmit} className="card space-y-4">
        <div>
          <label className="form-label">Rùgion (filtre)</label>
          <select className="form-select" value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}>
            <option value="">Toutes</option>
            {regions.map((r) => <option key={r.id} value={r.id}>{r.name_fr}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Province *</label>
          <select className="form-select" value={form.province_id} onChange={(e) => setForm({ ...form, province_id: e.target.value })} required>
            <option value="">ù Choisir ù</option>
            {provinces.map((p) => <option key={p.id} value={p.id}>{p.name_fr}</option>)}
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
        <div>
          <label className="form-label">Code postal</label>
          <input className="form-input" value={form.postal_code || ''} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} />
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input type="checkbox" checked={Boolean(form.is_active)} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
          Active
        </label>
        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Enregistrement‚Ä¶' : 'Enregistrer'}
          </button>
          <Link to="/geo/cities" className="btn-secondary text-center">Annuler</Link>
        </div>
      </form>
    </FormPageShell>
  );
}
