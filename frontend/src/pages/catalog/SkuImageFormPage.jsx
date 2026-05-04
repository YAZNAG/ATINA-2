import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import FormPageShell from '../../components/FormPageShell';
import toast from 'react-hot-toast';
import * as catalog from '../../api/catalog.api';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../utils/helpers';

const initialForm = {
  sku_id: '',
  url: '',
  alt_fr: '',
  alt_ar: '',
  is_primary: false,
  sort_order: 0,
};

export default function SkuImageFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [skus, setSkus] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);

  const canSave = isEdit ? hasPermission('sku_images.update') : hasPermission('sku_images.create');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await catalog.getSkusList();
        if (!cancelled) setSkus(res.data.data ?? []);
      } catch (err) {
        if (!cancelled) toast.error(getErrorMessage(err));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const res = await catalog.getSkuImage(id);
        const row = res.data.data;
        setForm({
          sku_id: row.sku_id ?? '',
          url: row.url ?? '',
          alt_fr: row.alt_fr ?? '',
          alt_ar: row.alt_ar ?? '',
          is_primary: Boolean(row.is_primary),
          sort_order: row.sort_order ?? 0,
        });
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
    if (!form.sku_id) {
      toast.error('Choisissez un SKU');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...form,
        sort_order: form.sort_order === '' ? 0 : Number(form.sort_order),
      };
      if (isEdit) await catalog.updateSkuImage(id, payload);
      else await catalog.createSkuImage(payload);
      toast.success(isEdit ? 'Image mise à jour' : 'Image créée');
      navigate('/catalog/sku-images');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!canSave) {
    return <div className="text-center py-12 text-red-600">Accès refusé.</div>;
  }

  return (
    <FormPageShell
      backTo="/catalog/sku-images"
      segmentLabel={isEdit ? 'Modifier image SKU' : 'Nouvelle image SKU'}
      title={isEdit ? 'Modifier l’image SKU' : 'Nouvelle image SKU'}
    >
      <form onSubmit={onSubmit} className="card space-y-4">
        <div>
          <label className="form-label">SKU *</label>
          <select
            className="form-select"
            required
            value={form.sku_id}
            onChange={(e) => setForm({ ...form, sku_id: e.target.value })}
          >
            <option value="">— Choisir un SKU —</option>
            {skus.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id.slice(0, 8)}… · {s.created_at ? new Date(s.created_at).toLocaleDateString('fr-FR') : ''}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-1">
            Créer un SKU vide depuis{' '}
            <Link to="/catalog/skus" className="text-blue-600 hover:underline">la page SKU</Link>
            {' '}si besoin.
          </p>
        </div>
        <div>
          <label className="form-label">URL *</label>
          <input
            className="form-input"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            required
            placeholder="https://…"
          />
        </div>
        <div>
          <label className="form-label">Alt FR</label>
          <input
            className="form-input"
            value={form.alt_fr}
            onChange={(e) => setForm({ ...form, alt_fr: e.target.value })}
          />
        </div>
        <div>
          <label className="form-label">Alt AR</label>
          <input
            className="form-input"
            dir="rtl"
            value={form.alt_ar}
            onChange={(e) => setForm({ ...form, alt_ar: e.target.value })}
          />
        </div>
        <div>
          <label className="form-label">Ordre</label>
          <input
            type="number"
            className="form-input"
            value={form.sort_order}
            onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
          />
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(form.is_primary)}
            onChange={(e) => setForm({ ...form, is_primary: e.target.checked })}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          Image principale (une seule par SKU)
        </label>
        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <Link to="/catalog/sku-images" className="btn-secondary text-center">
            Annuler
          </Link>
        </div>
      </form>
    </FormPageShell>
  );
}
