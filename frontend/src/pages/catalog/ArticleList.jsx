import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import * as catalog from '../../api/catalog.api';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../utils/helpers';
import toast from 'react-hot-toast';

// ── helpers ───────────────────────────────────────────────────────────────────

const str = (v) => (v == null ? '' : String(v));
const val = (v) => { if (v === '' || v == null) return null; const n = Number(v); return Number.isNaN(n) ? null : n; };

const EMPTY_FORM = {
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

function toPayload(form, units) {
  const us = units.find((u) => String(u.id) === String(form.unit_sale_id));
  const up = units.find((u) => String(u.id) === String(form.unit_purchase_id));
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
    unit_sale: us?.code || us?.name_fr || 'unit',
    unit_purchase: up?.code || up?.name_fr || 'unit',
    coeff: form.coeff === '' ? undefined : parseFloat(form.coeff),
    price: parseFloat(form.price),
    vat_rate: form.vat_rate === '' ? undefined : parseFloat(form.vat_rate),
    weight_g: form.weight_g !== '' ? parseInt(form.weight_g, 10) : null,
    volume_ml: form.volume_ml !== '' ? parseInt(form.volume_ml, 10) : null,
    is_active: !!form.is_active,
  };
}

// ── UI primitives ─────────────────────────────────────────────────────────────

const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent placeholder-gray-300 disabled:bg-gray-50 disabled:text-gray-400';
const sel = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-700 disabled:bg-gray-50 disabled:text-gray-400';

function Fld({ label, req, hint, half, children }) {
  return (
    <div className={half ? 'col-span-1' : ''}>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
        {label}{req && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

function Thumb({ url, size = 'h-12 w-12' }) {
  const [err, setErr] = useState(false);
  if (!url || err) return (
    <div className={`${size} rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0`}>
      <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    </div>
  );
  return <img src={url} alt="" className={`${size} object-cover rounded-xl border border-gray-200 flex-shrink-0`} loading="lazy" onError={() => setErr(true)} />;
}

// ── Step 2: Image Upload ──────────────────────────────────────────────────────

function ImageStep({ articleId, onDone }) {
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [primaryId, setPrimaryId] = useState(null);

  const loadImages = useCallback(async () => {
    try {
      const res = await catalog.getArticleSkuImages(articleId);
      const imgs = res.data.data ?? [];
      setImages(imgs);
      const first = imgs.find((_, i) => i === 0);
      if (first && !primaryId) setPrimaryId(first.id);
    } catch { }
    setLoading(false);
  }, [articleId]);

  useEffect(() => { loadImages(); }, [loadImages]);

  const handleUpload = async (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    const fd = new FormData();
    for (let i = 0; i < files.length; i++) fd.append('images', files[i]);
    setUploading(true);
    try {
      await catalog.addArticleSkuImages(articleId, fd);
      toast.success('Images ajoutées');
      await loadImages();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setUploading(false); e.target.value = ''; }
  };

  const handleSetPrimary = async (imgId) => {
    try {
      await catalog.setArticleSkuPrimaryImage(articleId, imgId);
      setPrimaryId(imgId);
      await loadImages();
      toast.success('Image principale définie');
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  const handleDelete = async (imgId) => {
    if (!window.confirm('Supprimer cette image ?')) return;
    try {
      await catalog.deleteArticleSkuImage(articleId, imgId);
      await loadImages();
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  return (
    <div className="space-y-5">
      {/* Upload zone */}
      <label className="group block cursor-pointer">
        <div className="rounded-xl border-2 border-dashed border-red-200 bg-red-50/40 px-4 py-8 text-center hover:bg-red-50 transition-colors">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
            {uploading
              ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-600" />
              : <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
            }
          </div>
          <p className="text-sm font-semibold text-gray-700">{uploading ? 'Envoi en cours…' : 'Cliquer pour ajouter des images'}</p>
          <p className="text-xs text-gray-400 mt-1">JPG, PNG, WEBP — plusieurs fichiers acceptés</p>
        </div>
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
      </label>

      {/* Images grid */}
      {loading ? (
        <div className="flex justify-center py-6"><div className="animate-spin rounded-full h-7 w-7 border-b-2 border-red-600" /></div>
      ) : images.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-4">Aucune image — ajoutez-en ci-dessus</p>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {images.map((img, idx) => {
            const isPrimary = idx === 0;
            return (
              <div key={img.id} className={`relative rounded-xl overflow-hidden border-2 ${isPrimary ? 'border-red-500' : 'border-gray-200'}`}>
                <img src={img.url} alt="" className="w-full aspect-square object-cover" />
                {isPrimary && (
                  <div className="absolute top-1.5 left-1.5 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    Principale
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 flex gap-1 justify-end">
                  {!isPrimary && (
                    <button
                      type="button"
                      onClick={() => handleSetPrimary(img.id)}
                      className="text-[10px] bg-red-600 text-white px-2 py-1 rounded-lg font-semibold hover:bg-red-500"
                      title="Définir comme principale"
                    >
                      ★ Principale
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(img.id)}
                    className="text-[10px] bg-white/20 text-white px-2 py-1 rounded-lg hover:bg-white/30"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="pt-2">
        <button
          type="button"
          onClick={onDone}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          Terminer
        </button>
      </div>
    </div>
  );
}

// ── Article Drawer ────────────────────────────────────────────────────────────

function ArticleDrawer({ mode, articleId: editId, onClose, onSaved, refs }) {
  const { families, brands, units, articleTypes, articleStatuses, conservationTypes, taxes } = refs;
  const [step, setStep] = useState(1);
  const [createdId, setCreatedId] = useState(editId || null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(mode === 'edit');

  // Load article for edit
  useEffect(() => {
    if (mode !== 'edit' || !editId) return;
    (async () => {
      try {
        const res = await catalog.getArticle(editId);
        const a = res.data.data;
        const findUnitId = (code) => units.find((u) => u.code === code || u.name_fr === code)?.id ?? '';
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
          setCategories(cats);
        }
        if (a.category_id) {
          const subs = (await catalog.getSubCategoriesList(a.category_id)).data.data ?? [];
          setSubCategories(subs);
        }
      } catch (err) { toast.error(getErrorMessage(err)); }
      finally { setFetching(false); }
    })();
  }, [mode, editId]);

  useEffect(() => {
    if (!form.family_id) { setCategories([]); return; }
    catalog.getCategoriesList(form.family_id).then((r) => setCategories(r.data.data ?? []));
  }, [form.family_id]);

  useEffect(() => {
    if (!form.category_id) { setSubCategories([]); return; }
    catalog.getSubCategoriesList(form.category_id).then((r) => setSubCategories(r.data.data ?? []));
  }, [form.category_id]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const hc = (e) => { const { name, type, checked, value } = e.target; set(name, type === 'checkbox' ? checked : value); };
  const hFamily = (e) => setForm((f) => ({ ...f, family_id: e.target.value, category_id: '', sub_category_id: '' }));
  const hCategory = (e) => setForm((f) => ({ ...f, category_id: e.target.value, sub_category_id: '' }));
  const hTax = (e) => {
    const t = taxes.find((x) => String(x.id) === e.target.value);
    setForm((f) => ({ ...f, tax_id: e.target.value, vat_rate: t ? String(t.rate) : f.vat_rate }));
  };

  const Opts = ({ list }) => (<><option value="">—</option>{list.map((x) => <option key={x.id} value={x.id}>{x.name_fr}</option>)}</>);

  const submitStep1 = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = toPayload(form, units);
      if (mode === 'edit') {
        await catalog.updateArticle(editId, payload);
        toast.success('Article mis à jour');
        onSaved();
      } else {
        const res = await catalog.createArticle(payload);
        const newId = res.data?.data?.id;
        setCreatedId(newId);
        toast.success('Article créé — ajoutez vos images');
        setStep(2);
      }
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  const isEdit = mode === 'edit';
  const title = isEdit ? "Modifier l'article" : (step === 1 ? 'Nouveau produit' : 'Images du produit');

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-white z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div>
            {!isEdit && (
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step >= 1 ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-400'}`}>1</span>
                <div className={`h-0.5 w-8 ${step >= 2 ? 'bg-red-600' : 'bg-gray-200'}`} />
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step >= 2 ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-400'}`}>2</span>
              </div>
            )}
            <h2 className="text-base font-bold text-gray-900">{title}</h2>
            <p className="text-xs text-gray-500">
              {!isEdit && step === 1 && 'Informations du produit'}
              {!isEdit && step === 2 && 'Photos & image principale'}
              {isEdit && 'Modifier les informations'}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-200 text-gray-500 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {fetching ? (
            <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" /></div>
          ) : step === 1 ? (
            <form id="art-form" onSubmit={submitStep1} className="p-6 space-y-6">
              {/* Identification */}
              <div>
                <h3 className="text-xs font-bold text-red-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <span className="block h-px flex-1 bg-red-100" /> Identification <span className="block h-px flex-1 bg-red-100" />
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <Fld label="Code article" req hint="Non modifiable après création">
                    <input name="sku_code" className={inp + ' font-mono'} value={form.sku_code} onChange={hc} required disabled={isEdit} placeholder="ART-001" />
                  </Fld>
                  <Fld label="EAN-13">
                    <input name="ean13" className={inp + ' font-mono'} value={form.ean13} onChange={hc} maxLength={13} placeholder="1234567890123" />
                  </Fld>
                  <Fld label="Nom FR" req>
                    <input name="name_fr" className={inp} value={form.name_fr} onChange={hc} required placeholder="Nom du produit" />
                  </Fld>
                  <Fld label="Nom AR" req>
                    <input name="name_ar" className={inp} dir="rtl" value={form.name_ar} onChange={hc} required placeholder="اسم المنتج" />
                  </Fld>
                </div>
              </div>

              {/* Taxonomie */}
              <div>
                <h3 className="text-xs font-bold text-red-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <span className="block h-px flex-1 bg-red-100" /> Taxonomie <span className="block h-px flex-1 bg-red-100" />
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <Fld label="Famille" req>
                    <select name="family_id" className={sel} value={form.family_id} onChange={hFamily} required>
                      <option value="">—</option>
                      {families.map((x) => <option key={x.id} value={x.id}>{x.name_fr}</option>)}
                    </select>
                  </Fld>
                  <Fld label="Catégorie">
                    <select name="category_id" className={sel} value={form.category_id} onChange={hCategory} disabled={!form.family_id}>
                      <Opts list={categories} />
                    </select>
                  </Fld>
                  <Fld label="Sous-catégorie">
                    <select name="sub_category_id" className={sel} value={form.sub_category_id} onChange={hc} disabled={!form.category_id}>
                      <Opts list={subCategories} />
                    </select>
                  </Fld>
                </div>
              </div>

              {/* Classification */}
              <div>
                <h3 className="text-xs font-bold text-red-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <span className="block h-px flex-1 bg-red-100" /> Classification <span className="block h-px flex-1 bg-red-100" />
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <Fld label="Marque"><select name="brand_id" className={sel} value={form.brand_id} onChange={hc}><Opts list={brands} /></select></Fld>
                  <Fld label="Type article"><select name="article_type_id" className={sel} value={form.article_type_id} onChange={hc}><Opts list={articleTypes} /></select></Fld>
                  <Fld label="Statut article"><select name="article_status_id" className={sel} value={form.article_status_id} onChange={hc}><Opts list={articleStatuses} /></select></Fld>
                  <Fld label="Conservation"><select name="conservation_type_id" className={sel} value={form.conservation_type_id} onChange={hc}><Opts list={conservationTypes} /></select></Fld>
                </div>
              </div>

              {/* Prix */}
              <div>
                <h3 className="text-xs font-bold text-red-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <span className="block h-px flex-1 bg-red-100" /> Prix & Taxe <span className="block h-px flex-1 bg-red-100" />
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <Fld label="Prix (MAD)" req>
                    <input name="price" type="number" step="0.01" min="0" className={inp} value={form.price} onChange={hc} required placeholder="0.00" />
                  </Fld>
                  <Fld label="Taxe">
                    <select name="tax_id" className={sel} value={form.tax_id} onChange={hTax}>
                      <option value="">— Aucune —</option>
                      {taxes.map((t) => <option key={t.id} value={t.id}>{t.name_fr} ({t.rate}%)</option>)}
                    </select>
                  </Fld>
                  <Fld label="TVA (%)">
                    <input name="vat_rate" type="number" step="0.01" min="0" max="100" className={inp} value={form.vat_rate} onChange={hc} placeholder="20" />
                  </Fld>
                </div>
              </div>

              {/* Unités */}
              <div>
                <h3 className="text-xs font-bold text-red-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <span className="block h-px flex-1 bg-red-100" /> Unités & Physique <span className="block h-px flex-1 bg-red-100" />
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <Fld label="Unité de vente">
                    <select name="unit_sale_id" className={sel} value={form.unit_sale_id} onChange={hc}>
                      <option value="">— Choisir —</option>
                      {units.map((u) => <option key={u.id} value={u.id}>{u.name_fr}{u.code ? ` (${u.code})` : ''}</option>)}
                    </select>
                  </Fld>
                  <Fld label="Unité d'achat">
                    <select name="unit_purchase_id" className={sel} value={form.unit_purchase_id} onChange={hc}>
                      <option value="">— Choisir —</option>
                      {units.map((u) => <option key={u.id} value={u.id}>{u.name_fr}{u.code ? ` (${u.code})` : ''}</option>)}
                    </select>
                  </Fld>
                  <Fld label="Coeff"><input name="coeff" type="number" step="0.001" min="0" className={inp} value={form.coeff} onChange={hc} /></Fld>
                  <Fld label="Poids (g)"><input name="weight_g" type="number" step="1" min="0" className={inp} value={form.weight_g} onChange={hc} /></Fld>
                  <Fld label="Volume (ml)"><input name="volume_ml" type="number" step="1" min="0" className={inp} value={form.volume_ml} onChange={hc} /></Fld>
                </div>
              </div>

              {/* Statut */}
              <div>
                <h3 className="text-xs font-bold text-red-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <span className="block h-px flex-1 bg-red-100" /> Statut <span className="block h-px flex-1 bg-red-100" />
                </h3>
                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => set('is_active', !form.is_active)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${form.is_active ? 'bg-red-600' : 'bg-gray-200'}`}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                  <span className={`text-sm font-medium ${form.is_active ? 'text-red-600' : 'text-gray-400'}`}>
                    {form.is_active ? 'Actif' : 'Inactif'}
                  </span>
                </label>
              </div>
            </form>
          ) : (
            <div className="p-6">
              <ImageStep articleId={createdId} onDone={() => { onSaved(); onClose(); }} />
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 1 && (
          <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors">
              Annuler
            </button>
            <button type="submit" form="art-form" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">
              {saving
                ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Enregistrement…</>
                : isEdit ? 'Mettre à jour' : 'Suivant — Images →'
              }
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ── Delete confirm ────────────────────────────────────────────────────────────

function DeleteConfirm({ article, onCancel, onConfirm }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={onCancel} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <h3 className="text-center font-bold text-gray-900 mb-1">Supprimer ce produit ?</h3>
          <p className="text-center text-sm text-gray-500 mb-6">
            <span className="font-semibold text-gray-700">{article.name_fr}</span> ({article.sku_code}) sera supprimé définitivement.
          </p>
          <div className="flex gap-3">
            <button onClick={onCancel} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
              Annuler
            </button>
            <button onClick={onConfirm} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-colors">
              Supprimer
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ArticleList() {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission } = useAuth();

  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [page, setPage] = useState(1);

  const [drawer, setDrawer] = useState(null); // { mode: 'add'|'edit', articleId? }
  const [deleting, setDeleting] = useState(null); // article to delete

  // Open edit drawer when navigating back from detail page with editId state
  useEffect(() => {
    if (location.state?.editId) {
      setDrawer({ mode: 'edit', articleId: location.state.editId });
      window.history.replaceState({}, '', location.pathname);
    }
  }, [location.state]);

  // Referentials for the form
  const [refs, setRefs] = useState({ families: [], brands: [], units: [], articleTypes: [], articleStatuses: [], conservationTypes: [], taxes: [] });

  useEffect(() => {
    Promise.all([
      catalog.getFamiliesList(),
      catalog.getBrandsList(),
      catalog.getUnitsList(),
      catalog.getArticleTypesList(),
      catalog.getArticleStatusesList(),
      catalog.getConservationTypesList(),
      catalog.getTaxesList(),
    ]).then(([fam, br, unitList, at, as_, ct, tx]) => {
      setRefs({
        families: fam.data.data ?? [],
        brands: br.data.data ?? [],
        units: unitList.data.data ?? [],
        articleTypes: at.data.data ?? [],
        articleStatuses: as_.data.data ?? [],
        conservationTypes: ct.data.data ?? [],
        taxes: tx.data.data ?? [],
      });
    }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await catalog.getArticles({ page, limit: 20, ...(searchFilter.trim() ? { search: searchFilter.trim() } : {}) });
      setRows(res.data.data ?? []);
      setPagination(res.data.pagination ?? { total: 0, page: 1, limit: 20, pages: 0 });
    } catch (err) { toast.error(getErrorMessage(err)); setRows([]); }
    finally { setLoading(false); }
  }, [page, searchFilter]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await catalog.deleteArticle(deleting.id);
      toast.success('Article supprimé');
      setDeleting(null);
      load();
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  if (!hasPermission('articles.view')) {
    return <div className="text-center py-12 text-red-600 font-medium">Accès refusé.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Produits</h1>
            <p className="text-sm text-gray-500">Gérer le catalogue de produits</p>
          </div>
          {hasPermission('articles.create') && (
            <button
              onClick={() => setDrawer({ mode: 'add' })}
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Ajouter Produit
            </button>
          )}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); setSearchFilter(searchInput); setPage(1); }} className="flex gap-2 max-w-lg">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="Rechercher un produit, code SKU, EAN…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <button type="submit" className="px-4 py-2.5 bg-gray-900 hover:bg-gray-700 text-white text-sm font-medium rounded-xl transition-colors">Rechercher</button>
          {searchFilter && (
            <button type="button" onClick={() => { setSearchInput(''); setSearchFilter(''); setPage(1); }} className="px-3 py-2.5 border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-100">Effacer</button>
          )}
        </form>
      </div>

      {/* ── List ── */}
      <div className="p-6">
        {loading ? (
          <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" /></div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 text-center py-20">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
              </svg>
            </div>
            <p className="text-gray-500 font-medium">Aucun produit trouvé</p>
            {hasPermission('articles.create') && (
              <button onClick={() => setDrawer({ mode: 'add' })} className="mt-4 inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                Ajouter le premier produit
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="hidden md:grid grid-cols-[3fr_1.5fr_1fr_1fr_auto] gap-4 px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <span>Produit</span><span>Catégorie / Marque</span><span>Prix</span><span>Statut</span><span>Actions</span>
            </div>

            <div className="divide-y divide-gray-100">
              {rows.map((a) => {
                const thumbUrl = a.catalog_sku?.images?.[0]?.url;
                return (
                  <div key={a.id} className="grid grid-cols-1 md:grid-cols-[3fr_1.5fr_1fr_1fr_auto] gap-4 items-center px-5 py-4 hover:bg-red-50/20 transition-colors group">
                    {/* Produit */}
                    <div className="flex items-center gap-4 min-w-0">
                      <Thumb url={thumbUrl} />
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{a.name_fr}</p>
                        <p className="text-xs text-gray-400 truncate" dir="rtl">{a.name_ar}</p>
                        <span className="font-mono text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded mt-1 inline-block">{a.sku_code}</span>
                      </div>
                    </div>
                    {/* Catégorie */}
                    <div className="min-w-0 hidden md:block">
                      {a.family && <p className="text-xs font-medium text-gray-700 truncate">{a.family.name_fr}</p>}
                      {a.category && <p className="text-xs text-gray-500 truncate">{a.category.name_fr}</p>}
                      {a.brand && <span className="inline-block mt-1 text-xs bg-red-50 text-red-700 border border-red-100 px-1.5 py-0.5 rounded-full font-medium">{a.brand.name_fr}</span>}
                    </div>
                    {/* Prix */}
                    <div className="hidden md:block">
                      {a.price != null ? (
                        <p className="font-bold text-red-600">{Number(a.price).toFixed(2)} <span className="text-xs font-normal text-gray-400">MAD</span></p>
                      ) : <span className="text-gray-300">—</span>}
                    </div>
                    {/* Statut */}
                    <div className="hidden md:block">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${a.is_active ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${a.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                        {a.is_active ? 'Actif' : 'Inactif'}
                      </span>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      {/* Show */}
                      <button
                        onClick={() => navigate(`/catalog/articles/${a.id}`)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                        title="Voir le détail"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      </button>
                      {/* Edit */}
                      {hasPermission('articles.update') && (
                        <button
                          onClick={() => setDrawer({ mode: 'edit', articleId: a.id })}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-600 transition-colors"
                          title="Modifier"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                      )}
                      {/* Delete */}
                      {hasPermission('articles.delete') && (
                        <button
                          onClick={() => setDeleting(a)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                          title="Supprimer"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
                <span className="text-sm text-gray-500">
                  <span className="font-semibold text-gray-700">{pagination.total}</span> produits · Page {pagination.page}/{pagination.pages}
                </span>
                <div className="flex gap-2">
                  <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed">← Précédent</button>
                  <button disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed">Suivant →</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Drawer ── */}
      {drawer && (
        <ArticleDrawer
          mode={drawer.mode}
          articleId={drawer.articleId}
          refs={refs}
          onClose={() => setDrawer(null)}
          onSaved={() => { setDrawer(null); load(); }}
        />
      )}

      {/* ── Delete confirm ── */}
      {deleting && (
        <DeleteConfirm
          article={deleting}
          onCancel={() => setDeleting(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
