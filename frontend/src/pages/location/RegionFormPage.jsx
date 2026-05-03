import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { createRegion, getRegion, updateRegion } from '../../api/locationNode.api';
import { getErrorMessage } from '../../utils/helpers';

const initialForm = {
  code: '',
  name_fr: '',
  name_ar: '',
  description_fr: '',
  description_ar: '',
  is_active: true,
};

export default function RegionFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);

  const canSave = isEdit ? hasPermission('regions.update') : hasPermission('regions.create');

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const res = await getRegion(id);
        const row = res.data.data;
        setForm({ ...initialForm, ...row });
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
      if (isEdit) await updateRegion(id, form);
      else await createRegion(form);
      toast.success(isEdit ? 'Region mise a jour' : 'Region creee');
      navigate('/geo/regions');
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
    return <div className="text-center py-12 text-red-600">Acces refuse.</div>;
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div>
        <Link to="/geo/regions" className="text-sm text-gray-500 hover:text-gray-700">{'<-'} Regions</Link>
        <h1 className="text-lg font-semibold text-gray-800 mt-2">{isEdit ? 'Modifier' : 'Nouvelle'} region</h1>
      </div>

      <form onSubmit={onSubmit} className="card space-y-4">
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
          <label className="form-label">Description FR</label>
          <textarea
            className="form-input min-h-[88px]"
            value={form.description_fr ?? ''}
            onChange={(e) => setForm({ ...form, description_fr: e.target.value })}
            placeholder="Optionnel"
            rows={3}
          />
        </div>
        <div>
          <label className="form-label">Description AR</label>
          <textarea
            className="form-input min-h-[88px]"
            dir="rtl"
            value={form.description_ar ?? ''}
            onChange={(e) => setForm({ ...form, description_ar: e.target.value })}
            placeholder="اختياري"
            rows={3}
          />
        </div>
        {isEdit && (form.created_at || form.created_by_user || form.updated_by_user) && (
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs text-slate-600 space-y-1">
            {form.created_at && (
              <p>
                <span className="font-medium text-slate-700">Créé :</span>{' '}
                {new Date(form.created_at).toLocaleString('fr-FR')}
                {form.created_by_user?.full_name && ` — ${form.created_by_user.full_name}`}
              </p>
            )}
            {form.updated_at && (
              <p>
                <span className="font-medium text-slate-700">Modifié :</span>{' '}
                {new Date(form.updated_at).toLocaleString('fr-FR')}
                {form.updated_by_user?.full_name && ` — ${form.updated_by_user.full_name}`}
              </p>
            )}
          </div>
        )}
        <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input type="checkbox" checked={Boolean(form.is_active)} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
          Active
        </label>
        <div className="flex gap-3 pt-2">
          <button type="submit" className="btn-primary" disabled={loading}>{loading ? '…' : 'Enregistrer'}</button>
          <Link to="/geo/regions" className="btn-secondary text-center">Annuler</Link>
        </div>
      </form>
    </div>
  );
}
