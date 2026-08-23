import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Pencil, Trash2, X, Search, ImageOff, Upload, Loader2, Lock, Power, PowerOff, RotateCcw, Star, Eye,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import api from '../../../api/axios';
import {
  getSkus, createSku, updateSku, deleteSku,
  toggleSkuStatus, restoreSku,
  getFamiliesList, getSubFamiliesList, getCategoriesList, getBrandsList,
  getConservationTypesList, getTaxesList,
  getSkuImages, addSkuImages, setSkuPrimaryImage, deleteSkuImage,
  getUnitsList, getPackagingTypesList,
} from '../../../api/catalog.api';

const PAGE_SIZE = 20;

// ——— Résolution des chemins filesystem stockés en DB ———
const API_ORIGIN = (api.defaults.baseURL || '').replace(/\/api\/?$/, '');
const toWebPath = (rawPath) => {
  if (!rawPath) return null;
  if (/^https?:\/\//i.test(rawPath)) return rawPath;
  const normalized = rawPath.replace(/\\/g, '/');
  const idx = normalized.indexOf('storage/');
  const relative = idx >= 0 ? normalized.slice(idx) : normalized.replace(/^(\.\.\/)+/, '');
  return `${API_ORIGIN}/${relative}`;
};

const EMPTY_FORM = {
  name_fr: '',
  name_ar: '',
  description_fr: '',
  description_ar: '',
  sku_code: '',
  ean13: '',
  sku_family_id: '',
  sku_subfamily_id: '',
  category_id: '',
  brand_id: '',
  conservation_type_id: '',
  tax_id: '',
  price: '',
  unit_purchase_id: '',
  unit_sale_id: '',
  packaging_type_id: '',
  coeff: 1,
  weight_g: '',
  volume_ml: '',
  is_active: true,
};

const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'active', label: 'Actif' },
  { value: 'inactive', label: 'Inactif' },
  { value: 'deleted', label: 'Supprimé' },
];

const DRAWER_TABS = [
  { key: 'info', label: 'Informations' },
  { key: 'classification', label: 'Classification' },
  { key: 'pricing', label: 'Tarification' },
  { key: 'logistics', label: 'Logistique & Statut' },
];

const FIELD_TAB = {
  name_fr: 'info', name_ar: 'info', sku_code: 'info', ean13: 'info',
  description_fr: 'info', description_ar: 'info',
  sku_family_id: 'classification', sku_subfamily_id: 'classification', category_id: 'classification',
  brand_id: 'classification', conservation_type_id: 'classification',
  price: 'pricing', tax_id: 'pricing', unit_purchase_id: 'pricing', unit_sale_id: 'pricing',
  packaging_type_id: 'pricing', coeff: 'pricing',
  weight_g: 'logistics', volume_ml: 'logistics', is_active: 'logistics',
};

function StatusBadge({ sku }) {
  if (sku.deleted_at || sku.is_deleted) {
    return (
      <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">
        Supprimé
      </span>
    );
  }
  if (sku.is_active) {
    return (
      <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
        Actif
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-500">
      Inactif
    </span>
  );
}

export default function SkusPage() {
  const { hasPermission } = useAuth();
  const canView = hasPermission('skus.view');
  const canCreate = hasPermission('skus.create');
  const canUpdate = hasPermission('skus.update');
  const canDelete = hasPermission('skus.delete');
  const canManage = canCreate || canUpdate || canDelete;
  const navigate = useNavigate();

  // ——— Référentiels ———
  const [brands, setBrands] = useState([]);
  const [families, setFamilies] = useState([]);
  const [categories, setCategories] = useState([]);
  const [conservationTypes, setConservationTypes] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [units, setUnits] = useState([]);
  const [formPackagingTypes, setFormPackagingTypes] = useState([]);

  // ——— Filtres toolbar ———
  const [filterFamily, setFilterFamily] = useState('');
  const [filterSubFamily, setFilterSubFamily] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterSubFamilies, setFilterSubFamilies] = useState([]);

  // ——— Liste ———
  const [skus, setSkus] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: PAGE_SIZE, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [togglingId, setTogglingId] = useState(null);
  const [restoringId, setRestoringId] = useState(null);

  // ——— Drawer création / édition ———
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [activeTab, setActiveTab] = useState('info');
  const [form, setForm] = useState(EMPTY_FORM);
  const [formSubFamilies, setFormSubFamilies] = useState([]);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // ——— Images SKU ———
  const [skuImages, setSkuImages] = useState([]);
  const [pendingImages, setPendingImages] = useState([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const imageInputRef = useRef(null);

  // ——— Suppression ———
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // ——— Notification ———
  const [toast, setToast] = useState(null);
  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  // ——— Chargement référentiels ———
  useEffect(() => {
    getBrandsList().then(({ data }) => setBrands(data.data || [])).catch(() => setBrands([]));
    getFamiliesList().then(({ data }) => setFamilies(data.data || [])).catch(() => setFamilies([]));
    getCategoriesList().then(({ data }) => setCategories(data.data || [])).catch(() => setCategories([]));
    getConservationTypesList().then(({ data }) => setConservationTypes(data.data || [])).catch(() => setConservationTypes([]));
    getTaxesList().then(({ data }) => setTaxes(data.data || [])).catch(() => setTaxes([]));
    getUnitsList().then(({ data }) => setUnits(data.data || [])).catch(() => setUnits([]));
  }, []);

  // ——— Cascade filtres toolbar (family -> subfamily uniquement) ———
  useEffect(() => {
    if (!filterFamily) { setFilterSubFamilies([]); setFilterSubFamily(''); return; }
    getSubFamiliesList(filterFamily).then(({ data }) => setFilterSubFamilies(data.data || [])).catch(() => setFilterSubFamilies([]));
  }, [filterFamily]);

  // ——— Cascade formulaire drawer (family -> subfamily uniquement) ———
  useEffect(() => {
    if (!form.sku_family_id) { setFormSubFamilies([]); return; }
    getSubFamiliesList(form.sku_family_id).then(({ data }) => setFormSubFamilies(data.data || [])).catch(() => setFormSubFamilies([]));
  }, [form.sku_family_id]);

  useEffect(() => {
    if (!form.unit_purchase_id) { setFormPackagingTypes([]); return; }
    getPackagingTypesList(form.unit_purchase_id).then(({ data }) => setFormPackagingTypes(data.data || [])).catch(() => setFormPackagingTypes([]));
  }, [form.unit_purchase_id]);

  // ——— Chargement liste SKU ———
  const fetchSkus = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const { data } = await getSkus({
        page,
        limit: PAGE_SIZE,
        ...(search && { search }),
        ...(status && { status }),
        ...(filterFamily && { sku_family_id: filterFamily }),
        ...(filterSubFamily && { sku_subfamily_id: filterSubFamily }),
        ...(filterCategory && { category_id: filterCategory }),
        ...(filterBrand && { brand_id: filterBrand }),
      });
      setSkus(data.data || []);
      setPagination(data.pagination || { total: 0, page: 1, limit: PAGE_SIZE, pages: 1 });
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Erreur lors du chargement des SKU');
    } finally {
      setLoading(false);
    }
  }, [page, search, status, filterFamily, filterSubFamily, filterCategory, filterBrand, canView]);

  useEffect(() => {
    const t = setTimeout(fetchSkus, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [fetchSkus]);

  useEffect(() => {
    setPage(1);
  }, [search, status, filterFamily, filterSubFamily, filterCategory, filterBrand]);

  // ——— Images SKU : chargement (édition) ———
  const fetchSkuImages = useCallback(async (skuId) => {
    if (!skuId) { setSkuImages([]); return; }
    setImagesLoading(true);
    try {
      const { data } = await getSkuImages(skuId);
      setSkuImages(data.data || data || []);
    } catch {
      setSkuImages([]);
    } finally {
      setImagesLoading(false);
    }
  }, []);

  // ——— Ouverture drawer ———
  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormSubFamilies([]);
    setFormErrors({});
    setActiveTab('info');
    setSkuImages([]);
    setPendingImages([]);
    setDrawerOpen(true);
  };

  const openEdit = (sku) => {
    setEditingId(sku.id);
    setForm({
      name_fr: sku.name_fr || '',
      name_ar: sku.name_ar || '',
      description_fr: sku.description_fr || '',
      description_ar: sku.description_ar || '',
      sku_code: sku.sku_code || '',
      ean13: sku.ean13 || '',
      sku_family_id: sku.sku_family_id || '',
      sku_subfamily_id: sku.sku_subfamily_id || '',
      category_id: sku.category_id || '',
      brand_id: sku.brand_id || '',
      conservation_type_id: sku.conservation_type_id || '',
      tax_id: sku.tax_id || '',
      price: sku.price ?? '',
      unit_purchase_id: sku.unit_purchase_id || '',
      unit_sale_id: sku.unit_sale_id || '',
      packaging_type_id: sku.packaging_type_id || '',
      coeff: sku.coeff ?? 1,
      weight_g: sku.weight_g ?? '',
      volume_ml: sku.volume_ml ?? '',
      is_active: sku.is_active,
    });
    setFormErrors({});
    setActiveTab('info');
    setPendingImages([]);
    setDrawerOpen(true);
    fetchSkuImages(sku.id);
  };

  const closeDrawer = () => {
    if (saving || uploadingImages) return;
    pendingImages.forEach((p) => URL.revokeObjectURL(p.preview));
    setPendingImages([]);
    setDrawerOpen(false);
  };

  const handleFieldChange = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => {
      const next = { ...f, [field]: value };
      if (field === 'sku_family_id') { next.sku_subfamily_id = ''; }
      if (field === 'unit_purchase_id') { next.packaging_type_id = ''; }
      return next;
    });
    setFormErrors((errs) => ({ ...errs, [field]: undefined }));
  };

  // ——— Gestion image : sélection ———
  const handleImageFilesSelected = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = '';

    if (editingId) {
      setUploadingImages(true);
      try {
        const fd = new FormData();
        files.forEach((f) => fd.append('images', f));
        await addSkuImages(editingId, fd);
        showToast('success', 'Image(s) ajoutée(s)');
        fetchSkuImages(editingId);
      } catch (err) {
        showToast('error', err?.response?.data?.message || "Erreur lors de l'upload de l'image");
      } finally {
        setUploadingImages(false);
      }
    } else {
      const withPreview = files.map((f) => ({ file: f, preview: URL.createObjectURL(f) }));
      setPendingImages((p) => [...p, ...withPreview]);
    }
  };

  const removePendingImage = (index) => {
    setPendingImages((p) => {
      const copy = [...p];
      URL.revokeObjectURL(copy[index].preview);
      copy.splice(index, 1);
      return copy;
    });
  };

  const handleDeleteImage = async (imageId) => {
    try {
      await deleteSkuImage(editingId, imageId);
      showToast('success', 'Image supprimée');
      fetchSkuImages(editingId);
    } catch (err) {
      showToast('error', err?.response?.data?.message || "Erreur lors de la suppression de l'image");
    }
  };

  const handleSetPrimaryImage = async (imageId) => {
    try {
      await setSkuPrimaryImage(editingId, imageId);
      fetchSkuImages(editingId);
    } catch (err) {
      showToast('error', err?.response?.data?.message || "Erreur lors de la mise à jour de l'image principale");
    }
  };

  const validateForm = () => {
    const errs = {};
    if (!form.name_fr.trim()) errs.name_fr = 'Nom français requis';
    if (!form.name_ar.trim()) errs.name_ar = 'Nom arabe requis';
    if (!form.sku_code.trim()) errs.sku_code = 'Code SKU requis';
    if (!form.sku_family_id) errs.sku_family_id = 'Famille SKU requise';
    if (form.price === '' || form.price === null || Number.isNaN(Number(form.price))) errs.price = 'Prix requis';
    setFormErrors(errs);

    const errorKeys = Object.keys(errs);
    if (errorKeys.length > 0) {
      const firstTab = FIELD_TAB[errorKeys[0]] || 'info';
      setActiveTab(firstTab);
    }
    return errorKeys.length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.sku_subfamily_id) delete payload.sku_subfamily_id;
      if (!payload.category_id) delete payload.category_id;
      if (!payload.brand_id) delete payload.brand_id;
      if (!payload.conservation_type_id) delete payload.conservation_type_id;
      if (!payload.tax_id) delete payload.tax_id;
      if (!payload.unit_purchase_id) delete payload.unit_purchase_id;
      if (!payload.unit_sale_id) delete payload.unit_sale_id;
      if (!payload.packaging_type_id) delete payload.packaging_type_id;
      if (payload.ean13 === '') payload.ean13 = null;
      if (payload.weight_g === '') delete payload.weight_g;
      if (payload.volume_ml === '') delete payload.volume_ml;

      let savedSkuId = editingId;

      if (editingId) {
        await updateSku(editingId, payload);
        showToast('success', 'SKU mis à jour');
      } else {
        const { data } = await createSku(payload);
        savedSkuId = data?.data?.id || data?.id;
        showToast('success', 'SKU créé');

        if (savedSkuId && pendingImages.length > 0) {
          const fd = new FormData();
          pendingImages.forEach((p) => fd.append('images', p.file));
          try {
            await addSkuImages(savedSkuId, fd);
          } catch {
            showToast('error', "SKU créé mais l'upload des images a échoué");
          }
          pendingImages.forEach((p) => URL.revokeObjectURL(p.preview));
        }
      }

      setDrawerOpen(false);
      setPendingImages([]);
      fetchSkus();
    } catch (err) {
      const msg = err?.response?.data?.message || "Erreur lors de l'enregistrement";
      showToast('error', msg);
      if (err?.response?.status === 409) {
        setFormErrors((errs) => ({ ...errs, sku_code: msg }));
        setActiveTab('info');
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (sku) => {
    setTogglingId(sku.id);
    try {
      await toggleSkuStatus(sku.id);
      showToast('success', sku.is_active ? 'SKU désactivé' : 'SKU activé');
      fetchSkus();
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Erreur lors du changement de statut');
    } finally {
      setTogglingId(null);
    }
  };

  const handleRestore = async (sku) => {
    setRestoringId(sku.id);
    try {
      await restoreSku(sku.id);
      showToast('success', 'SKU restauré');
      fetchSkus();
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Erreur lors de la restauration');
    } finally {
      setRestoringId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteSku(deleteTarget.id);
      showToast('success', 'SKU supprimé');
      setDeleteTarget(null);
      if (skus.length === 1 && page > 1) {
        setPage((p) => p - 1);
      } else {
        fetchSkus();
      }
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Erreur lors de la suppression');
    } finally {
      setDeleting(false);
    }
  };

  if (!canView) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-neutral-400">
        <Lock size={28} />
        <p className="text-sm">Vous n'avez pas accès à cette page.</p>
      </div>
    );
  }

  const tabHasError = (tabKey) =>
    Object.entries(formErrors).some(([field, msg]) => msg && FIELD_TAB[field] === tabKey);

  const getMainImagePath = (sku) => sku.images?.[0]?.url || null;

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${
            toast.type === 'success' ? 'bg-emerald-600' : 'bg-[#E10600]'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-poppins text-2xl font-semibold text-neutral-900">SKU</h1>
          <p className="mt-1 text-sm text-neutral-500">Gérez le catalogue produit (SKU).</p>
        </div>
        {canCreate && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-[#E10600] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#c00500] active:scale-[0.98]"
          >
            <Plus size={18} />
            Nouveau SKU
          </button>
        )}
      </div>

      {/* Filtres */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher (nom, SKU, EAN)…"
            className="w-full rounded-lg border border-neutral-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-[#E10600] focus:ring-2 focus:ring-[#E10600]/15"
          />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#E10600] focus:ring-2 focus:ring-[#E10600]/15">
          {STATUS_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
        <select value={filterBrand} onChange={(e) => setFilterBrand(e.target.value)}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#E10600] focus:ring-2 focus:ring-[#E10600]/15">
          <option value="">Toutes les marques</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name_fr}</option>)}
        </select>
        <select value={filterFamily} onChange={(e) => setFilterFamily(e.target.value)}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#E10600] focus:ring-2 focus:ring-[#E10600]/15">
          <option value="">Toutes les familles</option>
          {families.map((f) => <option key={f.id} value={f.id}>{f.name_fr}</option>)}
        </select>
        <select value={filterSubFamily} onChange={(e) => setFilterSubFamily(e.target.value)} disabled={!filterFamily}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#E10600] focus:ring-2 focus:ring-[#E10600]/15 disabled:opacity-50">
          <option value="">Toutes les sous-familles</option>
          {filterSubFamilies.map((s) => <option key={s.id} value={s.id}>{s.name_fr}</option>)}
        </select>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#E10600] focus:ring-2 focus:ring-[#E10600]/15">
          <option value="">Toutes les catégories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name_fr}</option>)}
        </select>
      </div>

      {/* Tableau */}
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Image</th>
              <th className="px-4 py-3 font-medium">Nom</th>
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium">Prix</th>
              <th className="px-4 py-3 font-medium">Hiérarchie</th>
              <th className="px-4 py-3 font-medium">Marque</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              {canManage && <th className="px-4 py-3 font-medium text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading ? (
              <tr><td colSpan={canManage ? 8 : 7} className="px-4 py-12 text-center text-neutral-400"><Loader2 size={20} className="mx-auto animate-spin" /></td></tr>
            ) : skus.length === 0 ? (
              <tr><td colSpan={canManage ? 8 : 7} className="px-4 py-12 text-center text-neutral-400">Aucun SKU trouvé.</td></tr>
            ) : (
              skus.map((s) => {
                const isDeleted = Boolean(s.deleted_at || s.is_deleted);
                const imageUrl = toWebPath(getMainImagePath(s));
                return (
                  <tr key={s.id} className={`transition hover:bg-neutral-50 ${isDeleted ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={s.name_fr}
                          className="h-10 w-10 rounded-md object-cover"
                          onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
                        />
                      ) : null}
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-md bg-neutral-100 text-neutral-300"
                        style={{ display: imageUrl ? 'none' : 'flex' }}
                      >
                        <ImageOff size={16} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-neutral-800">{s.name_fr}</p>
                      <p className="text-xs text-neutral-500" dir="rtl">{s.name_ar}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-neutral-500">
                      <p>{s.sku_code}</p>
                      {s.ean13 && <p className="text-neutral-400">{s.ean13}</p>}
                    </td>
                    <td className="px-4 py-3 text-neutral-700">{Number(s.price).toFixed(2)} DH</td>
                    <td className="px-4 py-3 text-xs text-neutral-500">
                      {[s.sku_family?.name_fr, s.sku_subfamily?.name_fr, s.category?.name_fr].filter(Boolean).join(' › ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{s.brand?.name_fr || '—'}</td>
                    <td className="px-4 py-3"><StatusBadge sku={s} /></td>
                    {canManage && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => navigate(`/catalog/skus/${s.id}`)} className="rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800" title="Voir la fiche détaillée">
                            <Eye size={16} />
                          </button>
                          {isDeleted ? (
                            canDelete && (
                              <button onClick={() => handleRestore(s)} disabled={restoringId === s.id}
                                className="rounded-lg p-2 text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50" title="Restaurer">
                                {restoringId === s.id ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                              </button>
                            )
                          ) : (
                            <>
                              {canUpdate && (
                                <button onClick={() => toggleStatus(s)} disabled={togglingId === s.id}
                                  className={`rounded-lg p-2 transition disabled:opacity-50 ${
                                    s.is_active ? 'text-emerald-600 hover:bg-emerald-50' : 'text-neutral-400 hover:bg-neutral-100'
                                  }`} title={s.is_active ? 'Désactiver' : 'Activer'}>
                                  {togglingId === s.id ? <Loader2 size={16} className="animate-spin" /> : s.is_active ? <Power size={16} /> : <PowerOff size={16} />}
                                </button>
                              )}
                              {canUpdate && (
                                <button onClick={() => openEdit(s)} className="rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800" title="Modifier">
                                  <Pencil size={16} />
                                </button>
                              )}
                              {canDelete && (
                                <button onClick={() => setDeleteTarget(s)} className="rounded-lg p-2 text-neutral-500 transition hover:bg-red-50 hover:text-[#E10600]" title="Supprimer">
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-neutral-500">
          <span>{pagination.total} SKU — page {pagination.page}/{pagination.pages}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-neutral-200 px-3 py-1.5 disabled:opacity-40">Précédent</button>
            <button disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-neutral-200 px-3 py-1.5 disabled:opacity-40">Suivant</button>
          </div>
        </div>
      )}

      {/* Drawer création / édition */}
      <div className={`fixed inset-0 z-40 transition-opacity ${drawerOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}>
        <div className="absolute inset-0 bg-black/40" onClick={closeDrawer} />
        <div className={`absolute right-0 top-0 flex h-full w-full max-w-lg flex-col bg-white shadow-2xl transition-transform duration-300 ${drawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
            <h2 className="font-poppins text-lg font-semibold text-neutral-900">
              {editingId ? 'Modifier le SKU' : 'Nouveau SKU'}
            </h2>
            <button onClick={closeDrawer} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100">
              <X size={18} />
            </button>
          </div>

          <div className="flex border-b border-neutral-100 px-5">
            {DRAWER_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                className={`relative px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === t.key
                    ? 'border-[#E10600] text-neutral-900'
                    : 'border-transparent text-neutral-400 hover:text-neutral-600'
                }`}
              >
                {t.label}
                {tabHasError(t.key) && (
                  <span className="absolute -top-0.5 right-0 h-1.5 w-1.5 rounded-full bg-[#E10600]" />
                )}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
            <div className="flex-1 px-5 py-4 space-y-3">
              {activeTab === 'info' && (
                <>
                  <div>
                    <span className="mb-1.5 block text-sm font-medium text-neutral-700">Images</span>
                    <div className="flex flex-wrap gap-3">
                      {editingId && imagesLoading && (
                        <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-neutral-100">
                          <Loader2 size={16} className="animate-spin text-neutral-400" />
                        </div>
                      )}
                      {editingId && !imagesLoading && skuImages.map((img) => {
                        const url = toWebPath(img.url);
                        return (
                          <div key={img.id} className="group relative h-20 w-20 overflow-hidden rounded-lg border border-neutral-200">
                            {url ? (
                              <img src={url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-neutral-100 text-neutral-300">
                                <ImageOff size={16} />
                              </div>
                            )}
                            {img.is_primary && (
                              <span className="absolute left-1 top-1 rounded-full bg-[#E10600] p-1 text-white">
                                <Star size={10} fill="currentColor" />
                              </span>
                            )}
                            <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/50 opacity-0 transition group-hover:opacity-100">
                              {!img.is_primary && (
                                <button
                                  type="button"
                                  onClick={() => handleSetPrimaryImage(img.id)}
                                  title="Définir comme principale"
                                  className="rounded-md bg-white/90 p-1.5 text-neutral-700 hover:bg-white"
                                >
                                  <Star size={12} />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteImage(img.id)}
                                title="Supprimer"
                                className="rounded-md bg-white/90 p-1.5 text-[#E10600] hover:bg-white"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {!editingId && pendingImages.map((p, idx) => (
                        <div key={idx} className="group relative h-20 w-20 overflow-hidden rounded-lg border border-neutral-200">
                          <img src={p.preview} alt="" className="h-full w-full object-cover" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition group-hover:opacity-100">
                            <button
                              type="button"
                              onClick={() => removePendingImage(idx)}
                              title="Retirer"
                              className="rounded-md bg-white/90 p-1.5 text-[#E10600] hover:bg-white"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        disabled={uploadingImages}
                        className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-neutral-300 text-neutral-400 transition hover:border-[#E10600] hover:text-[#E10600] disabled:opacity-50"
                      >
                        {uploadingImages ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                        <span className="text-[10px]">Ajouter</span>
                      </button>
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        hidden
                        onChange={handleImageFilesSelected}
                      />
                    </div>
                    {!editingId && (
                      <p className="mt-1.5 text-xs text-neutral-400">
                        Les images seront envoyées après la création du SKU.
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Nom (FR)" error={formErrors.name_fr}>
                      <input value={form.name_fr} onChange={handleFieldChange('name_fr')} className={inputClass(formErrors.name_fr)} />
                    </Field>
                    <Field label="Nom (AR)" error={formErrors.name_ar}>
                      <input dir="rtl" value={form.name_ar} onChange={handleFieldChange('name_ar')} className={inputClass(formErrors.name_ar)} />
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Code SKU" error={formErrors.sku_code}>
                      <input value={form.sku_code} onChange={handleFieldChange('sku_code')} className={inputClass(formErrors.sku_code)} />
                    </Field>
                    <Field label="EAN-13">
                      <input value={form.ean13} onChange={handleFieldChange('ean13')} className={inputClass()} />
                    </Field>
                  </div>

                  <Field label="Description (FR)">
                    <textarea rows={2} value={form.description_fr} onChange={handleFieldChange('description_fr')} className={inputClass()} />
                  </Field>
                  <Field label="Description (AR)">
                    <textarea dir="rtl" rows={2} value={form.description_ar} onChange={handleFieldChange('description_ar')} className={inputClass()} />
                  </Field>
                </>
              )}

              {activeTab === 'classification' && (
                <>
                  <Field label="Famille SKU" error={formErrors.sku_family_id}>
                    <select value={form.sku_family_id} onChange={handleFieldChange('sku_family_id')} className={inputClass(formErrors.sku_family_id)}>
                      <option value="">— Sélectionner —</option>
                      {families.map((f) => <option key={f.id} value={f.id}>{f.name_fr}</option>)}
                    </select>
                  </Field>

                  <Field label="Sous-famille SKU">
                    <select value={form.sku_subfamily_id} onChange={handleFieldChange('sku_subfamily_id')} disabled={!form.sku_family_id} className={`${inputClass()} disabled:opacity-50`}>
                      <option value="">— Sélectionner —</option>
                      {formSubFamilies.map((s) => <option key={s.id} value={s.id}>{s.name_fr}</option>)}
                    </select>
                  </Field>

                  <Field label="Catégorie">
                    <select value={form.category_id} onChange={handleFieldChange('category_id')} className={inputClass()}>
                      <option value="">— Aucune —</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name_fr}</option>)}
                    </select>
                  </Field>

                  <Field label="Marque">
                    <select value={form.brand_id} onChange={handleFieldChange('brand_id')} className={inputClass()}>
                      <option value="">— Aucune —</option>
                      {brands.map((b) => <option key={b.id} value={b.id}>{b.name_fr}</option>)}
                    </select>
                  </Field>

                  <Field label="Conservation">
                    <select value={form.conservation_type_id} onChange={handleFieldChange('conservation_type_id')} className={inputClass()}>
                      <option value="">— Aucune —</option>
                      {conservationTypes.map((c) => <option key={c.id} value={c.id}>{c.name_fr}</option>)}
                    </select>
                  </Field>
                </>
              )}

              {activeTab === 'pricing' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Prix (DH)" error={formErrors.price}>
                      <input type="number" step="0.01" min="0" value={form.price} onChange={handleFieldChange('price')} className={inputClass(formErrors.price)} />
                    </Field>
                    <Field label="Taxe">
                      <select value={form.tax_id} onChange={handleFieldChange('tax_id')} className={inputClass()}>
                        <option value="">— Aucune —</option>
                        {taxes.map((t) => <option key={t.id} value={t.id}>{t.name_fr} ({t.rate}%)</option>)}
                      </select>
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Unité d'achat">
                      <select value={form.unit_purchase_id} onChange={handleFieldChange('unit_purchase_id')} className={inputClass()}>
                        <option value="">— Sélectionner —</option>
                        {units.map((u) => <option key={u.id} value={u.id}>{u.name_fr}</option>)}
                      </select>
                    </Field>
                    <Field label="Unité de vente">
                      <select value={form.unit_sale_id} onChange={handleFieldChange('unit_sale_id')} className={inputClass()}>
                        <option value="">— Sélectionner —</option>
                        {units.map((u) => <option key={u.id} value={u.id}>{u.name_fr}</option>)}
                      </select>
                    </Field>
                  </div>

                  <Field label="Type de conditionnement">
                    <select
                      value={form.packaging_type_id}
                      onChange={handleFieldChange('packaging_type_id')}
                      disabled={!form.unit_purchase_id}
                      className={`${inputClass()} disabled:opacity-50`}
                    >
                      <option value="">— Sélectionner —</option>
                      {formPackagingTypes.map((p) => <option key={p.id} value={p.id}>{p.name_fr}</option>)}
                    </select>
                  </Field>

                  <Field label="Coefficient">
                    <input type="number" step="0.01" value={form.coeff} onChange={handleFieldChange('coeff')} className={inputClass()} />
                  </Field>
                </>
              )}

              {activeTab === 'logistics' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Poids (g)">
                      <input type="number" value={form.weight_g} onChange={handleFieldChange('weight_g')} className={inputClass()} />
                    </Field>
                    <Field label="Volume (ml)">
                      <input type="number" value={form.volume_ml} onChange={handleFieldChange('volume_ml')} className={inputClass()} />
                    </Field>
                  </div>

                  <label className="flex items-center gap-2 text-sm text-neutral-700">
                    <input type="checkbox" checked={form.is_active} onChange={handleFieldChange('is_active')} className="rounded border-neutral-300 text-[#E10600] focus:ring-[#E10600]/15" />
                    SKU actif
                  </label>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-neutral-100 px-5 py-4">
              <button type="button" onClick={closeDrawer} className="rounded-lg px-4 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100">
                Annuler
              </button>
              <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-lg bg-[#E10600] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#c00500] disabled:opacity-60">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {editingId ? 'Enregistrer' : 'Créer'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h3 className="font-poppins text-base font-semibold text-neutral-900">Supprimer le SKU ?</h3>
            <p className="mt-2 text-sm text-neutral-500">
              <span className="font-medium text-neutral-700">{deleteTarget.name_fr}</span> passera au statut "Supprimé".
              Vous pourrez le restaurer depuis le filtre "Supprimé".
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="rounded-lg px-4 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100">
                Annuler
              </button>
              <button onClick={confirmDelete} disabled={deleting} className="flex items-center gap-2 rounded-lg bg-[#E10600] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#c00500] disabled:opacity-60">
                {deleting && <Loader2 size={14} className="animate-spin" />}
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, error, children, className = '' }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block font-medium text-neutral-700">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-[#E10600]">{error}</span>}
    </label>
  );
}

function inputClass(error) {
  return `w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 ${
    error ? 'border-[#E10600] focus:ring-[#E10600]/15' : 'border-neutral-200 focus:border-[#E10600] focus:ring-[#E10600]/15'
  }`;
}