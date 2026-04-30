import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as catalog from '../../api/catalog.api';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../utils/helpers';
import toast from 'react-hot-toast';
import ArticleImagesPanel from './ArticleImagesPanel';

const empty = {
  sku: '',
  barcode: '',
  name_fr: '',
  name_ar: '',
  short_name_fr: '',
  short_name_ar: '',
  description_fr: '',
  description_ar: '',
  family_id: '',
  category_id: '',
  sub_category_id: '',
  brand_id: '',
  unit_id: '',
  packaging_type_id: '',
  conservation_type_id: '',
  article_type_id: '',
  article_status_id: '',
  tax_id: '',
  purchase_unit_id: '',
  sale_unit_id: '',
  weight: '',
  volume: '',
  min_stock: '',
  reorder_stock: '',
  max_stock: '',
  is_sellable: true,
  is_stockable: true,
  is_perishable: false,
  requires_expiry_date: false,
  requires_batch_number: false,
  is_active: true,
};

function val(v) {
  if (v === '' || v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function toPayload(form) {
  const p = {
    sku: form.sku.trim(),
    name_fr: form.name_fr.trim(),
    name_ar: form.name_ar.trim(),
    short_name_fr: form.short_name_fr || null,
    short_name_ar: form.short_name_ar || null,
    description_fr: form.description_fr || null,
    description_ar: form.description_ar || null,
    barcode: form.barcode?.trim() ? form.barcode.trim() : null,
    family_id: val(form.family_id),
    category_id: val(form.category_id),
    sub_category_id: val(form.sub_category_id),
    brand_id: val(form.brand_id),
    unit_id: val(form.unit_id),
    packaging_type_id: val(form.packaging_type_id),
    conservation_type_id: val(form.conservation_type_id),
    article_type_id: val(form.article_type_id),
    article_status_id: val(form.article_status_id),
    tax_id: val(form.tax_id),
    purchase_unit_id: val(form.purchase_unit_id),
    sale_unit_id: val(form.sale_unit_id),
    weight: form.weight === '' ? null : parseFloat(String(form.weight)),
    volume: form.volume === '' ? null : parseFloat(String(form.volume)),
    min_stock: form.min_stock === '' ? null : parseFloat(String(form.min_stock)),
    reorder_stock: form.reorder_stock === '' ? null : parseFloat(String(form.reorder_stock)),
    max_stock: form.max_stock === '' ? null : parseFloat(String(form.max_stock)),
    is_sellable: !!form.is_sellable,
    is_stockable: !!form.is_stockable,
    is_perishable: !!form.is_perishable,
    requires_expiry_date: !!form.requires_expiry_date,
    requires_batch_number: !!form.requires_batch_number,
    is_active: !!form.is_active,
  };
  return p;
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
  const [units, setUnits] = useState([]);
  const [packagingTypes, setPackagingTypes] = useState([]);
  const [conservationTypes, setConservationTypes] = useState([]);
  const [articleTypes, setArticleTypes] = useState([]);
  const [articleStatuses, setArticleStatuses] = useState([]);
  const [taxes, setTaxes] = useState([]);

  const canSave = isEdit ? hasPermission('articles.update') : hasPermission('articles.create');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [
          fam,
          br,
          un,
          pk,
          ct,
          at,
          ast,
          tx,
        ] = await Promise.all([
          catalog.getFamiliesList(),
          catalog.getBrandsList(),
          catalog.getUnitsList(),
          catalog.getPackagingTypesList(),
          catalog.getConservationTypesList(),
          catalog.getArticleTypesList(),
          catalog.getArticleStatusesList(),
          catalog.getTaxesList(),
        ]);
        if (cancelled) return;
        setFamilies(fam.data.data ?? []);
        setBrands(br.data.data ?? []);
        setUnits(un.data.data ?? []);
        setPackagingTypes(pk.data.data ?? []);
        setConservationTypes(ct.data.data ?? []);
        setArticleTypes(at.data.data ?? []);
        setArticleStatuses(ast.data.data ?? []);
        setTaxes(tx.data.data ?? []);

        if (isEdit) {
          const res = await catalog.getArticle(id);
          const a = res.data.data;
          setForm({
            sku: a.sku ?? '',
            barcode: str(a.barcode),
            name_fr: a.name_fr ?? '',
            name_ar: a.name_ar ?? '',
            short_name_fr: str(a.short_name_fr),
            short_name_ar: str(a.short_name_ar),
            description_fr: str(a.description_fr),
            description_ar: str(a.description_ar),
            family_id: str(a.family_id),
            category_id: str(a.category_id),
            sub_category_id: str(a.sub_category_id),
            brand_id: str(a.brand_id),
            unit_id: str(a.unit_id),
            packaging_type_id: str(a.packaging_type_id),
            conservation_type_id: str(a.conservation_type_id),
            article_type_id: str(a.article_type_id),
            article_status_id: str(a.article_status_id),
            tax_id: str(a.tax_id),
            purchase_unit_id: str(a.purchase_unit_id),
            sale_unit_id: str(a.sale_unit_id),
            weight: str(a.weight),
            volume: str(a.volume),
            min_stock: str(a.min_stock),
            reorder_stock: str(a.reorder_stock),
            max_stock: str(a.max_stock),
            is_sellable: a.is_sellable !== false,
            is_stockable: a.is_stockable !== false,
            is_perishable: !!a.is_perishable,
            requires_expiry_date: !!a.requires_expiry_date,
            requires_batch_number: !!a.requires_batch_number,
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
        await catalog.createArticle(payload);
        toast.success('Article créé');
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
        <p className="text-sm text-gray-500">Toutes les listes sont chargées depuis l’API (aucune valeur métier en dur).</p>
      </div>

      <form onSubmit={submit} className="space-y-6">
        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-800 border-b pb-2">Identification</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">SKU *</label>
              <input name="sku" className="form-input font-mono" value={form.sku} onChange={handleChange} required disabled={isEdit} />
            </div>
            <div>
              <label className="form-label">Code-barres</label>
              <input name="barcode" className="form-input" value={form.barcode} onChange={handleChange} />
            </div>
            <div>
              <label className="form-label">Nom (FR) *</label>
              <input name="name_fr" className="form-input" value={form.name_fr} onChange={handleChange} required />
            </div>
            <div>
              <label className="form-label">Nom (AR) *</label>
              <input name="name_ar" className="form-input" value={form.name_ar} onChange={handleChange} required />
            </div>
            <div>
              <label className="form-label">Nom court (FR)</label>
              <input name="short_name_fr" className="form-input" value={form.short_name_fr} onChange={handleChange} />
            </div>
            <div>
              <label className="form-label">Nom court (AR)</label>
              <input name="short_name_ar" className="form-input" value={form.short_name_ar} onChange={handleChange} />
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
              <label className="form-label">Famille</label>
              <select name="family_id" className="form-input" value={form.family_id} onChange={handleFamily}>
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
          <h2 className="font-semibold text-gray-800 border-b pb-2">Référentiels</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Marque</label>
              <select name="brand_id" className="form-input" value={form.brand_id} onChange={handleChange}>{sel(brands)}</select>
            </div>
            <div>
              <label className="form-label">Unité</label>
              <select name="unit_id" className="form-input" value={form.unit_id} onChange={handleChange}>{sel(units)}</select>
            </div>
            <div>
              <label className="form-label">Unité achat</label>
              <select name="purchase_unit_id" className="form-input" value={form.purchase_unit_id} onChange={handleChange}>{sel(units)}</select>
            </div>
            <div>
              <label className="form-label">Unité vente</label>
              <select name="sale_unit_id" className="form-input" value={form.sale_unit_id} onChange={handleChange}>{sel(units)}</select>
            </div>
            <div>
              <label className="form-label">Conditionnement</label>
              <select name="packaging_type_id" className="form-input" value={form.packaging_type_id} onChange={handleChange}>{sel(packagingTypes)}</select>
            </div>
            <div>
              <label className="form-label">Conservation</label>
              <select name="conservation_type_id" className="form-input" value={form.conservation_type_id} onChange={handleChange}>{sel(conservationTypes)}</select>
            </div>
            <div>
              <label className="form-label">Type article</label>
              <select name="article_type_id" className="form-input" value={form.article_type_id} onChange={handleChange}>{sel(articleTypes)}</select>
            </div>
            <div>
              <label className="form-label">Statut article</label>
              <select name="article_status_id" className="form-input" value={form.article_status_id} onChange={handleChange}>{sel(articleStatuses)}</select>
            </div>
            <div>
              <label className="form-label">TVA</label>
              <select name="tax_id" className="form-input" value={form.tax_id} onChange={handleChange}>
                <option value="">—</option>
                {taxes.map((x) => (
                  <option key={x.id} value={x.id}>{x.name_fr} ({String(x.rate)}%)</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-800 border-b pb-2">Stock & physique</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className="form-label">Poids</label>
              <input name="weight" type="number" step="any" className="form-input" value={form.weight} onChange={handleChange} />
            </div>
            <div>
              <label className="form-label">Volume</label>
              <input name="volume" type="number" step="any" className="form-input" value={form.volume} onChange={handleChange} />
            </div>
            <div>
              <label className="form-label">Stock min</label>
              <input name="min_stock" type="number" step="any" className="form-input" value={form.min_stock} onChange={handleChange} />
            </div>
            <div>
              <label className="form-label">Réappro</label>
              <input name="reorder_stock" type="number" step="any" className="form-input" value={form.reorder_stock} onChange={handleChange} />
            </div>
            <div>
              <label className="form-label">Stock max</label>
              <input name="max_stock" type="number" step="any" className="form-input" value={form.max_stock} onChange={handleChange} />
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="is_sellable" checked={form.is_sellable} onChange={handleChange} />
              Vendable
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="is_stockable" checked={form.is_stockable} onChange={handleChange} />
              Stockable
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="is_perishable" checked={form.is_perishable} onChange={handleChange} />
              Périssable
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="requires_expiry_date" checked={form.requires_expiry_date} onChange={handleChange} />
              DLC obligatoire
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="requires_batch_number" checked={form.requires_batch_number} onChange={handleChange} />
              N° lot obligatoire
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="is_active" checked={form.is_active} onChange={handleChange} />
              Actif
            </label>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" className="btn-primary" disabled={loading}>{loading ? '…' : 'Enregistrer'}</button>
          <Link to="/catalog/articles" className="btn-secondary text-center">Annuler</Link>
        </div>
      </form>

      {isEdit && <ArticleImagesPanel articleId={id} />}
    </div>
  );
}
