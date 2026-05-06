import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as catalog from '../../api/catalog.api';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../utils/helpers';
import toast from 'react-hot-toast';
import ArticleSkuImagesPanel from './ArticleSkuImagesPanel';

const empty = {
  sku_code: '', ean13: '', name_fr: '', name_ar: '',
  description_fr: '', description_ar: '',
  family_id: '', category_id: '', sub_category_id: '',
  brand_id: '', article_type_id: '', article_status_id: '',
  conservation_type_id: '', tax_id: '',
  unit_sale_id: '', unit_purchase_id: '',
  coeff: '1', price: '', vat_rate: '20',
  weight_g: '', volume_ml: '',
  is_active: true,
};

const val = (v) => {
  if (v === '' || v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};

const str = (v) => (v === null || v === undefined ? '' : String(v));

function toPayload(form, units) {
  const unitSale = units.find((u) => String(u.id) === String(form.unit_sale_id));
  const unitPurchase = units.find((u) => String(u.id) === String(form.unit_purchase_id));
  return {
    sku_code: form.sku_code.trim(),
    ean13: form.ean13?.trim() || null,
    name_fr: form.name_fr.trim(),
    name_ar: form.name_ar.trim(),
    description_fr: form.description_fr?.trim() || null,
    description_ar: form.description_ar?.trim() || null,
    family_id: val(form.family_id),
    category_id: val(form.category_id),
    sub_category_id: val(form.sub_category_id),
    brand_id: val(form.brand_id),
    article_type_id: val(form.article_type_id),
    article_status_id: val(form.article_status_id),
    conservation_type_id: val(form.conservation_type_id),
    tax_id: val(form.tax_id),
    unit_sale: unitSale?.code || unitSale?.name_fr || 'unit',
    unit_purchase: unitPurchase?.code || unitPurchase?.name_fr || 'unit',
    coeff: form.coeff === '' ? undefined : parseFloat(form.coeff),
    price: parseFloat(form.price),
    vat_rate: form.vat_rate === '' ? undefined : parseFloat(form.vat_rate),
    weight_g: form.weight_g !== '' ? parseInt(form.weight_g, 10) : null,
    volume_ml: form.volume_ml !== '' ? parseInt(form.volume_ml, 10) : null,
    is_active: !!form.is_active,
  };
}

function Section({ title, icon, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100 bg-gray-50/60">
        <span className="text-red-500">{icon}</span>
        <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">{title}</h2>
      </div>
      <div className="px-5 py-5">{children}</div>
    </div>
  );
}

function Field({ label, required, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

const inputCls = "w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent placeholder-gray-300 disabled:bg-gray-50 disabled:text-gray-400";
const selectCls = "w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-700 disabled:bg-gray-50 disabled:text-gray-400";

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
  const [articleTypes, setArticleTypes] = useState([]);
  const [articleStatuses, setArticleStatuses] = useState([]);
  const [conservationTypes, setConservationTypes] = useState([]);
  const [taxes, setTaxes] = useState([]);

  const canSave = isEdit ? hasPermission('articles.update') : hasPermission('articles.create');

  // Load referentials + article data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [fam, br, unitList, artTypes, artStatuses, conservation, taxList] = await Promise.all([
          catalog.getFamiliesList(),
          catalog.getBrandsList(),
          catalog.getUnitsList(),
          catalog.getArticleTypesList(),
          catalog.getArticleStatusesList(),
          catalog.getConservationTypesList(),
          catalog.getTaxesList(),
        ]);
        if (cancelled) return;
        setFamilies(fam.data.data ?? []);
        setBrands(br.data.data ?? []);
        setUnits(unitList.data.data ?? []);
        setArticleTypes(artTypes.data.data ?? []);
        setArticleStatuses(artStatuses.data.data ?? []);
        setConservationTypes(conservation.data.data ?? []);
        setTaxes(taxList.data.data ?? []);

        if (isEdit) {
          const res = await catalog.getArticle(id);
          const a = res.data.data;
          const allUnits = unitList.data.data ?? [];
          // Match unit_sale/unit_purchase string back to unit id
          const findUnitId = (code) => allUnits.find((u) => u.code === code || u.name_fr === code)?.id ?? '';
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
            article_type_id: str(a.article_type_id),
            article_status_id: str(a.article_status_id),
            conservation_type_id: str(a.conservation_type_id),
            tax_id: str(a.tax_id),
            unit_sale_id: str(findUnitId(a.unit_sale)),
            unit_purchase_id: str(findUnitId(a.unit_purchase)),
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

  // Cascade family → categories
  useEffect(() => {
    let cancelled = false;
    if (!form.family_id) { setCategories([]); return; }
    catalog.getCategoriesList(form.family_id).then((r) => {
      if (!cancelled) setCategories(r.data.data ?? []);
    });
    return () => { cancelled = true; };
  }, [form.family_id]);

  // Cascade category → sub-categories
  useEffect(() => {
    let cancelled = false;
    if (!form.category_id) { setSubCategories([]); return; }
    catalog.getSubCategoriesList(form.category_id).then((r) => {
      if (!cancelled) setSubCategories(r.data.data ?? []);
    });
    return () => { cancelled = true; };
  }, [form.category_id]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const handleChange = (e) => {
    const { name, type, checked, value } = e.target;
    set(name, type === 'checkbox' ? checked : value);
  };
  const handleFamily = (e) => setForm((f) => ({ ...f, family_id: e.target.value, category_id: '', sub_category_id: '' }));
  const handleCategory = (e) => setForm((f) => ({ ...f, category_id: e.target.value, sub_category_id: '' }));
  const handleTax = (e) => {
    const taxId = e.target.value;
    const selected = taxes.find((t) => String(t.id) === taxId);
    setForm((f) => ({ ...f, tax_id: taxId, vat_rate: selected ? String(selected.rate) : f.vat_rate }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    setLoading(true);
    try {
      const payload = toPayload(form, units);
      if (isEdit) {
        await catalog.updateArticle(id, payload);
        toast.success('Article mis à jour');
      } else {
        const res = await catalog.createArticle(payload);
        toast.success('Article créé');
        const newId = res.data?.data?.id;
        if (newId != null) { navigate(`/catalog/articles/${newId}/edit#article-images-zone`); return; }
      }
      navigate('/catalog/articles');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (!canSave) return <div className="text-center py-12 text-red-600 font-medium">Accès refusé.</div>;

  if (fetching) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" />
      </div>
    );
  }

  const Opts = ({ list }) => (
    <>
      <option value="">—</option>
      {list.map((x) => <option key={x.id} value={x.id}>{x.name_fr}</option>)}
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Page header ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <Link to="/catalog/articles" className="text-xs text-gray-400 hover:text-red-600 transition-colors">← Retour aux produits</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-0.5">
          {isEdit ? "Modifier l'article" : 'Ajouter un nouveau produit'}
        </h1>
        <p className="text-sm text-gray-500">Les champs marqués <span className="text-red-500 font-bold">*</span> sont obligatoires</p>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">
        {/* Images panel (edit only) */}
        {isEdit && (
          <div id="article-images-zone" className="scroll-mt-4">
            <ArticleSkuImagesPanel articleId={id} />
          </div>
        )}

        {!isEdit && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
            <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-amber-800">
              Les images peuvent être ajoutées <strong>après la première sauvegarde</strong> de l'article.
            </p>
          </div>
        )}

        <form onSubmit={submit} className="space-y-5">

          {/* ── Identification ── */}
          <Section title="Identification" icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
          }>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Code article" required hint="Identifiant unique — non modifiable après création">
                <input name="sku_code" className={inputCls + ' font-mono'} value={form.sku_code}
                  onChange={handleChange} required disabled={isEdit} placeholder="ART-001" />
              </Field>
              <Field label="Code EAN-13 (code-barres)">
                <input name="ean13" className={inputCls + ' font-mono'} value={form.ean13}
                  onChange={handleChange} maxLength={13} placeholder="1234567890123" />
              </Field>
              <Field label="Nom français" required>
                <input name="name_fr" className={inputCls} value={form.name_fr}
                  onChange={handleChange} required placeholder="Nom du produit" />
              </Field>
              <Field label="Nom arabe" required>
                <input name="name_ar" className={inputCls} dir="rtl" value={form.name_ar}
                  onChange={handleChange} required placeholder="اسم المنتج" />
              </Field>
              <Field label="Description (français)">
                <textarea name="description_fr" className={inputCls + ' resize-none'} rows={3}
                  value={form.description_fr} onChange={handleChange} />
              </Field>
              <Field label="Description (عربي)">
                <textarea name="description_ar" className={inputCls + ' resize-none'} dir="rtl" rows={3}
                  value={form.description_ar} onChange={handleChange} />
              </Field>
            </div>
          </Section>

          {/* ── Taxonomie ── */}
          <Section title="Taxonomie" icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
          }>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Famille" required>
                <select name="family_id" className={selectCls} value={form.family_id} onChange={handleFamily} required>
                  <option value="">— Choisir —</option>
                  {families.map((x) => <option key={x.id} value={x.id}>{x.name_fr}</option>)}
                </select>
              </Field>
              <Field label="Catégorie" hint={!form.family_id ? "Choisir d'abord une famille" : undefined}>
                <select name="category_id" className={selectCls} value={form.category_id} onChange={handleCategory} disabled={!form.family_id}>
                  <Opts list={categories} />
                </select>
              </Field>
              <Field label="Sous-catégorie" hint={!form.category_id ? "Choisir d'abord une catégorie" : undefined}>
                <select name="sub_category_id" className={selectCls} value={form.sub_category_id} onChange={handleChange} disabled={!form.category_id}>
                  <Opts list={subCategories} />
                </select>
              </Field>
            </div>
          </Section>

          {/* ── Classification ── */}
          <Section title="Classification" icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14-4H5m14 8H5m14 4H5" /></svg>
          }>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Field label="Marque">
                <select name="brand_id" className={selectCls} value={form.brand_id} onChange={handleChange}>
                  <Opts list={brands} />
                </select>
              </Field>
              <Field label="Type d'article">
                <select name="article_type_id" className={selectCls} value={form.article_type_id} onChange={handleChange}>
                  <Opts list={articleTypes} />
                </select>
              </Field>
              <Field label="Statut article">
                <select name="article_status_id" className={selectCls} value={form.article_status_id} onChange={handleChange}>
                  <Opts list={articleStatuses} />
                </select>
              </Field>
              <Field label="Conservation">
                <select name="conservation_type_id" className={selectCls} value={form.conservation_type_id} onChange={handleChange}>
                  <Opts list={conservationTypes} />
                </select>
              </Field>
            </div>
          </Section>

          {/* ── Prix & Taxe ── */}
          <Section title="Prix & Taxe" icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          }>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Prix de vente (MAD)" required>
                <div className="relative">
                  <input name="price" type="number" step="0.01" min="0" className={inputCls + ' pr-12'}
                    value={form.price} onChange={handleChange} required placeholder="0.00" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">MAD</span>
                </div>
              </Field>
              <Field label="Taxe applicable" hint="Remplit automatiquement le taux TVA">
                <select name="tax_id" className={selectCls} value={form.tax_id} onChange={handleTax}>
                  <option value="">— Aucune —</option>
                  {taxes.map((t) => <option key={t.id} value={t.id}>{t.name_fr} ({t.rate}%)</option>)}
                </select>
              </Field>
              <Field label="Taux TVA (%)">
                <div className="relative">
                  <input name="vat_rate" type="number" step="0.01" min="0" max="100" className={inputCls + ' pr-8'}
                    value={form.vat_rate} onChange={handleChange} placeholder="20" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                </div>
              </Field>
            </div>
          </Section>

          {/* ── Unités & Physique ── */}
          <Section title="Unités & Données physiques" icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>
          }>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <Field label="Unité de vente">
                <select name="unit_sale_id" className={selectCls} value={form.unit_sale_id} onChange={handleChange}>
                  <option value="">— Choisir —</option>
                  {units.map((u) => <option key={u.id} value={u.id}>{u.name_fr}{u.code ? ` (${u.code})` : ''}</option>)}
                </select>
              </Field>
              <Field label="Unité d'achat">
                <select name="unit_purchase_id" className={selectCls} value={form.unit_purchase_id} onChange={handleChange}>
                  <option value="">— Choisir —</option>
                  {units.map((u) => <option key={u.id} value={u.id}>{u.name_fr}{u.code ? ` (${u.code})` : ''}</option>)}
                </select>
              </Field>
              <Field label="Coefficient (achat → vente)">
                <input name="coeff" type="number" step="0.0001" min="0" className={inputCls}
                  value={form.coeff} onChange={handleChange} />
              </Field>
              <Field label="Poids (g)">
                <div className="relative">
                  <input name="weight_g" type="number" step="1" min="0" className={inputCls + ' pr-6'}
                    value={form.weight_g} onChange={handleChange} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">g</span>
                </div>
              </Field>
              <Field label="Volume (ml)">
                <div className="relative">
                  <input name="volume_ml" type="number" step="1" min="0" className={inputCls + ' pr-7'}
                    value={form.volume_ml} onChange={handleChange} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">ml</span>
                </div>
              </Field>
            </div>
          </Section>

          {/* ── Statut ── */}
          <Section title="Statut de publication" icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          }>
            <label className="flex items-center gap-4 cursor-pointer select-none">
              <div
                onClick={() => set('is_active', !form.is_active)}
                className={`relative w-12 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${form.is_active ? 'bg-red-600' : 'bg-gray-200'}`}
              >
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${form.is_active ? 'translate-x-6' : 'translate-x-0'}`} />
              </div>
              <div>
                <p className={`text-sm font-semibold ${form.is_active ? 'text-red-600' : 'text-gray-400'}`}>
                  {form.is_active ? 'Actif' : 'Inactif'}
                </p>
                <p className="text-xs text-gray-400">
                  {form.is_active ? "Visible dans l'application mobile" : "Masqué dans l'application mobile"}
                </p>
              </div>
            </label>
          </Section>

          {/* ── Actions ── */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm font-semibold px-6 py-3 rounded-xl shadow-sm transition-colors"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Enregistrement…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {isEdit ? 'Mettre à jour' : "Créer l'article"}
                </>
              )}
            </button>
            <Link
              to="/catalog/articles"
              className="px-5 py-3 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors"
            >
              Annuler
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
