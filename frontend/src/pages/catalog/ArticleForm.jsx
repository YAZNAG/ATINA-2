import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as catalog from '../../api/catalog.api';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../utils/helpers';
import toast from 'react-hot-toast';
import ArticleSkuImagesPanel from './ArticleSkuImagesPanel';

const empty = {
  sku_code: '',
  ean13: '',
  name_fr: '',
  name_ar: '',
  description_fr: '',
  description_ar: '',
  family_id: '',
  category_id: '',
  sub_category_id: '',
  brand_id: '',
  unit_sale: 'unit',
  unit_purchase: 'unit',
  coeff: '1',
  price: '',
  vat_rate: '20',
  weight_g: '',
  volume_ml: '',
  is_active: true,
};

function val(v) {
  if (v === '' || v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function toPayload(form) {
  const weightRaw = form.weight_g === '' ? null : parseInt(String(form.weight_g), 10);
  const volumeRaw = form.volume_ml === '' ? null : parseInt(String(form.volume_ml), 10);
  return {
    sku_code: form.sku_code.trim(),
    ean13: form.ean13?.trim() ? form.ean13.trim() : null,
    name_fr: form.name_fr.trim(),
    name_ar: form.name_ar.trim(),
    description_fr: form.description_fr?.trim() || null,
    description_ar: form.description_ar?.trim() || null,
    family_id: val(form.family_id),
    category_id: val(form.category_id),
    sub_category_id: val(form.sub_category_id),
    brand_id: val(form.brand_id),
    unit_sale: (form.unit_sale || 'unit').trim(),
    unit_purchase: (form.unit_purchase || 'unit').trim(),
    coeff: form.coeff === '' ? undefined : parseFloat(String(form.coeff)),
    price: parseFloat(String(form.price)),
    vat_rate: form.vat_rate === '' ? undefined : parseFloat(String(form.vat_rate)),
    weight_g: weightRaw != null && !Number.isNaN(weightRaw) ? weightRaw : null,
    volume_ml: volumeRaw != null && !Number.isNaN(volumeRaw) ? volumeRaw : null,
    is_active: !!form.is_active,
  };
}

function str(v) {
  if (v === null || v === undefined) return '';
  return String(v);
}

export default function ArticleForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const [families, setFamilies] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [brands, setBrands] = useState([]);

  const canSave = isEdit ? hasPermission('articles.update') : hasPermission('articles.create');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [fam, br] = await Promise.all([catalog.getFamiliesList(), catalog.getBrandsList()]);
        if (cancelled) return;
        setFamilies(fam.data.data ?? []);
        setBrands(br.data.data ?? []);

        if (isEdit) {
          const res = await catalog.getArticle(id);
          const a = res.data.data;
          setForm({
            sku_code: a.sku_code ?? '',
            ean13: str(a.ean13),
            name_fr: a.name_fr ?? '',
            name_ar: a.name_ar ?? '',
            description_fr: str(a.description_fr),
            description_ar: str(a.description_ar),
            family_id: str(a.family_id),
            category_id: str(a.category_id),
            sub_category_id: str(a.sub_category_id),
            brand_id: str(a.brand_id),
            unit_sale: str(a.unit_sale) || 'unit',
            unit_purchase: str(a.unit_purchase) || 'unit',
            coeff: a.coeff != null ? str(a.coeff) : '1',
            price: a.price != null ? str(a.price) : '',
            vat_rate: a.vat_rate != null ? str(a.vat_rate) : '20',
            weight_g: a.weight_g != null ? String(a.weight_g) : '',
            volume_ml: a.volume_ml != null ? String(a.volume_ml) : '',
            is_active: a.is_active !== false,
          });
          if (a.family_id) {
            const cats = (await catalog.getCategoriesList(a.family_id)).data.data ?? [];
            if (!cancelled) setCategories(cats);
          }
          if (a.category_id) {
            const subs = (await catalog.getSubCategoriesList(a.category_id)).data.data ?? [];
            if (!cancelled) setSubCategories(subs);
          }
        }
      } catch (err) {
        if (!cancelled) toast.error(getErrorMessage(err));
      } finally {
        if (!cancelled) setFetching(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, isEdit]);

  useEffect(() => {
    let cancelled = false;
    const fid = form.family_id;
    if (!fid) {
      setCategories([]);
      return;
    }
    (async () => {
      const cats = (await catalog.getCategoriesList(fid)).data.data ?? [];
      if (!cancelled) setCategories(cats);
    })();
    return () => { cancelled = true; };
  }, [form.family_id]);

  useEffect(() => {
    let cancelled = false;
    const cid = form.category_id;
    if (!cid) {
      setSubCategories([]);
      return;
    }
    (async () => {
      const subs = (await catalog.getSubCategoriesList(cid)).data.data ?? [];
      if (!cancelled) setSubCategories(subs);
    })();
    return () => { cancelled = true; };
  }, [form.category_id]);

  const handleChange = (e) => {
    const { name, type, checked, value } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleFamily = (e) => {
    const v = e.target.value;
    setForm((f) => ({
      ...f,
      family_id: v,
      category_id: '',
      sub_category_id: '',
    }));
  };

  const handleCategory = (e) => {
    const v = e.target.value;
    setForm((f) => ({
      ...f,
      category_id: v,
      sub_category_id: '',
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    setLoading(true);
    try {
      const payload = toPayload(form);
      if (isEdit) {
        await catalog.updateArticle(id, payload);
        toast.success('Article mis à jour');
      } else {
        const res = await catalog.createArticle(payload);
        toast.success('Article créé');
        const newId = res.data?.data?.id;
        if (newId != null) {
          navigate(`/catalog/articles/${newId}/edit#article-images-zone`);
          return;
        }
      }
      navigate('/catalog/articles');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (!canSave) {
    return <div className="text-center py-12 text-red-600">Accès refusé.</div>;
  }

  if (fetching) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const sel = (list) => (
    <>
      <option value="">—</option>
      {list.map((x) => (
        <option key={x.id} value={x.id}>{x.name_fr}</option>
      ))}
    </>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <Link to="/catalog/articles" className="text-sm text-gray-500 hover:text-gray-700">← Articles</Link>
        <h1 className="text-lg font-semibold text-gray-800 mt-2">
          {isEdit ? 'Modifier l’article' : 'Nouvel article'}
        </h1>
        <p className="text-sm text-gray-500">Champs alignés sur le modèle article (SKU, EAN-13, prix, TVA, unités).</p>
      </div>

      {isEdit && (
        <div id="article-images-zone" className="scroll-mt-4">
          <ArticleSkuImagesPanel articleId={id} />
        </div>
      )}

      {!isEdit && (
        <div
          id="article-images-zone"
          className="card border-amber-200 bg-amber-50/60 scroll-mt-4 space-y-2"
        >
          <h2 className="font-semibold text-amber-900">Où ajouter les images ?</h2>
          <ol className="text-sm text-amber-950/90 list-decimal list-inside space-y-1">
            <li>Remplissez le formulaire ci-dessous (SKU, noms, prix…).</li>
            <li>
              Cliquez sur <a href="#save-article" className="font-semibold underline decoration-amber-700">Enregistrer</a>{' '}
              (en bas du formulaire) : vous serez renvoyé sur cette page en édition.
            </li>
            <li>
              La zone <strong>« Images du produit »</strong> apparaît alors <strong>en haut</strong>, juste au-dessus du
              formulaire : c’est là que vous uploadez les fichiers (stockés sur le serveur sous{' '}
              <code className="text-xs bg-white/80 px-1 rounded">storage/image/article/{'{id}'}/</code>).
            </li>
          </ol>
          <p className="text-xs text-amber-900/80">
            L’image en <strong>1re position</strong> (plus petit ordre d’affichage) est l’image <strong>principale</strong>{' '}
            (vignette catalogue).
          </p>
        </div>
      )}

      <form onSubmit={submit} className="space-y-6">
        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-800 border-b pb-2">Identification</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Code SKU *</label>
              <input name="sku_code" className="form-input font-mono" value={form.sku_code} onChange={handleChange} required disabled={isEdit} />
            </div>
            <div>
              <label className="form-label">EAN-13</label>
              <input name="ean13" className="form-input" value={form.ean13} onChange={handleChange} maxLength={13} />
            </div>
            <div>
              <label className="form-label">Nom (FR) *</label>
              <input name="name_fr" className="form-input" value={form.name_fr} onChange={handleChange} required />
            </div>
            <div>
              <label className="form-label">Nom (AR) *</label>
              <input name="name_ar" className="form-input" value={form.name_ar} onChange={handleChange} required />
            </div>
            <div className="md:col-span-2">
              <label className="form-label">Description (FR)</label>
              <textarea name="description_fr" className="form-input" rows={2} value={form.description_fr} onChange={handleChange} />
            </div>
            <div className="md:col-span-2">
              <label className="form-label">Description (AR)</label>
              <textarea name="description_ar" className="form-input" rows={2} value={form.description_ar} onChange={handleChange} />
            </div>
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-800 border-b pb-2">Taxonomie</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="form-label">Famille *</label>
              <select name="family_id" className="form-input" value={form.family_id} onChange={handleFamily} required>
                {sel(families)}
              </select>
            </div>
            <div>
              <label className="form-label">Catégorie</label>
              <select name="category_id" className="form-input" value={form.category_id} onChange={handleCategory} disabled={!form.family_id}>
                {sel(categories)}
              </select>
            </div>
            <div>
              <label className="form-label">Sous-catégorie</label>
              <select name="sub_category_id" className="form-input" value={form.sub_category_id} onChange={handleChange} disabled={!form.category_id}>
                {sel(subCategories)}
              </select>
            </div>
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-800 border-b pb-2">Marque</h2>
          <div>
            <label className="form-label">Marque</label>
            <select name="brand_id" className="form-input max-w-md" value={form.brand_id} onChange={handleChange}>{sel(brands)}</select>
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-800 border-b pb-2">Prix, TVA & unités</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Prix (MAD) *</label>
              <input name="price" type="number" step="0.01" min="0" className="form-input" value={form.price} onChange={handleChange} required />
            </div>
            <div>
              <label className="form-label">TVA (%)</label>
              <input name="vat_rate" type="number" step="0.01" className="form-input" value={form.vat_rate} onChange={handleChange} />
            </div>
            <div>
              <label className="form-label">Unité vente</label>
              <input name="unit_sale" className="form-input" value={form.unit_sale} onChange={handleChange} placeholder="unit" />
            </div>
            <div>
              <label className="form-label">Unité achat</label>
              <input name="unit_purchase" className="form-input" value={form.unit_purchase} onChange={handleChange} placeholder="unit" />
            </div>
            <div>
              <label className="form-label">Coefficient (achat → vente)</label>
              <input name="coeff" type="number" step="0.0001" min="0" className="form-input" value={form.coeff} onChange={handleChange} />
            </div>
            <div>
              <label className="form-label">Poids (g)</label>
              <input name="weight_g" type="number" step="1" min="0" className="form-input" value={form.weight_g} onChange={handleChange} />
            </div>
            <div>
              <label className="form-label">Volume (ml)</label>
              <input name="volume_ml" type="number" step="1" min="0" className="form-input" value={form.volume_ml} onChange={handleChange} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_active" checked={form.is_active} onChange={handleChange} />
            Actif (visible app mobile si oui)
          </label>
        </div>

        <div id="save-article" className="flex gap-3 scroll-mt-24">
          <button type="submit" className="btn-primary" disabled={loading}>{loading ? '…' : 'Enregistrer'}</button>
          <Link to="/catalog/articles" className="btn-secondary text-center">Annuler</Link>
        </div>
      </form>
    </div>
  );
}
