import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Pencil, Trash2, X, Search, Loader2, Lock, Power, PowerOff,
  Layers, Boxes, Tag, ChevronRight, ArrowLeft, ImageOff, Upload, RotateCcw,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import {
  getFamilies, createFamily, updateFamily, deleteFamily, restoreFamily,
  getCategories, createCategory, updateCategory, deleteCategory, restoreCategory,
  getSubCategories, createSubCategory, updateSubCategory, deleteSubCategory, restoreSubCategory,
} from '../../../api/catalog.api';

const LIST_LIMIT = 500;

const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'active', label: 'Actif' },
  { value: 'inactive', label: 'Inactif' },
  { value: 'deleted', label: 'Supprimé' },
];

const buildStatusParams = (status) => (status ? { status } : {});

const LEVELS = {
  family: {
    key: 'family',
    label: 'Famille',
    labelPlural: 'Familles',
    icon: Layers,
    api: { list: getFamilies, create: createFamily, update: updateFamily, remove: deleteFamily, restore: restoreFamily },
    parentKey: null,
    hasMedia: true,
    emptyForm: { code: '', name_fr: '', name_ar: '', description_fr: '', description_ar: '', status: 'active' },
    fields: [
      { name: 'code', label: 'Code', required: true, col: 'full' },
      { name: 'name_fr', label: 'Nom (FR)', required: true, col: 'half' },
      { name: 'name_ar', label: 'Nom (AR)', required: true, col: 'half', dir: 'rtl' },
      { name: 'description_fr', label: 'Description (FR)', type: 'textarea', col: 'full' },
      { name: 'description_ar', label: 'Description (AR)', type: 'textarea', col: 'full', dir: 'rtl' },
    ],
  },
  category: {
    key: 'category',
    label: 'Catégorie',
    labelPlural: 'Catégories',
    icon: Boxes,
    api: { list: getCategories, create: createCategory, update: updateCategory, remove: deleteCategory, restore: restoreCategory },
    parentKey: 'family_id',
    hasMedia: true,
    emptyForm: { code: '', name_fr: '', name_ar: '', description_fr: '', description_ar: '', status: 'active' },
    fields: [
      { name: 'code', label: 'Code', required: true, col: 'full' },
      { name: 'name_fr', label: 'Nom (FR)', required: true, col: 'half' },
      { name: 'name_ar', label: 'Nom (AR)', required: true, col: 'half', dir: 'rtl' },
      { name: 'description_fr', label: 'Description (FR)', type: 'textarea', col: 'full' },
      { name: 'description_ar', label: 'Description (AR)', type: 'textarea', col: 'full', dir: 'rtl' },
    ],
  },
  subcategory: {
    key: 'subcategory',
    label: 'Sous-catégorie',
    labelPlural: 'Sous-catégories',
    icon: Tag,
    api: { list: getSubCategories, create: createSubCategory, update: updateSubCategory, remove: deleteSubCategory, restore: restoreSubCategory },
    parentKey: 'category_id',
    hasMedia: true,
    emptyForm: { code: '', name_fr: '', name_ar: '', description_fr: '', description_ar: '', status: 'active' },
    fields: [
      { name: 'code', label: 'Code', required: true, col: 'full' },
      { name: 'name_fr', label: 'Nom (FR)', required: true, col: 'half' },
      { name: 'name_ar', label: 'Nom (AR)', required: true, col: 'half', dir: 'rtl' },
      { name: 'description_fr', label: 'Description (FR)', type: 'textarea', col: 'full' },
      { name: 'description_ar', label: 'Description (AR)', type: 'textarea', col: 'full', dir: 'rtl' },
    ],
  },
};

const inputClass = (error) =>
  `w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 ${
    error
      ? 'border-[#E10600] focus:ring-[#E10600]/15'
      : 'border-neutral-200 focus:border-[#E10600] focus:ring-[#E10600]/15'
  }`;

function Field({ label, error, children, className = '' }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block font-medium text-neutral-700">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-[#E10600]">{error}</span>}
    </label>
  );
}

function StatusDot({ item }) {
  if (item.deleted_at) {
    return <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">Supprimé</span>;
  }
  if (item.status === 'active') {
    return <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Actif</span>;
  }
  return <span className="inline-flex rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-500">Inactif</span>;
}

export default function HierarchyCascadePage({ embedded = false }) {
  const { hasPermission } = useAuth();

  const PERMS = {
    family: {
      view: hasPermission('families.view'),
      create: hasPermission('families.create'),
      update: hasPermission('families.update'),
      delete: hasPermission('families.delete'),
    },
    category: {
      view: hasPermission('categories.view'),
      create: hasPermission('categories.create'),
      update: hasPermission('categories.update'),
      delete: hasPermission('categories.delete'),
    },
    subcategory: {
      view: hasPermission('sub_categories.view'),
      create: hasPermission('sub_categories.create'),
      update: hasPermission('sub_categories.update'),
      delete: hasPermission('sub_categories.delete'),
    },
  };

  const canView = PERMS.family.view;

  const [families, setFamilies] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState({ family: true, category: false, subcategory: false });
  const [search, setSearch] = useState({ family: '', category: '', subcategory: '' });
  const [status, setStatus] = useState({ family: '', category: '', subcategory: '' });

  const [selectedFamily, setSelectedFamily] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawer, setDrawer] = useState(null); // { level, mode, id, form }
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [iconFile, setIconFile] = useState(null);
  const [iconPreview, setIconPreview] = useState(null);
  const imageInputRef = useRef(null);
  const iconInputRef = useRef(null);

  const [deleteTarget, setDeleteTarget] = useState(null); // { level, item }
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [restoringId, setRestoringId] = useState(null);

  const [mobileStep, setMobileStep] = useState('family');

  const [toast, setToast] = useState(null);
  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchFamilies = useCallback(async () => {
    if (!canView) return;
    setLoading((l) => ({ ...l, family: true }));
    try {
      const { data } = await getFamilies({
        limit: LIST_LIMIT,
        ...(search.family && { search: search.family }),
        ...buildStatusParams(status.family),
      });
      setFamilies(data.data || []);
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Erreur lors du chargement des familles');
    } finally {
      setLoading((l) => ({ ...l, family: false }));
    }
  }, [search.family, status.family, canView]);

  const fetchCategories = useCallback(async (familyId) => {
    if (!familyId || !PERMS.category.view) { setCategories([]); return; }
    setLoading((l) => ({ ...l, category: true }));
    try {
      const { data } = await getCategories({
        limit: LIST_LIMIT,
        family_id: familyId,
        ...(search.category && { search: search.category }),
        ...buildStatusParams(status.category),
      });
      setCategories(data.data || []);
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Erreur lors du chargement des catégories');
    } finally {
      setLoading((l) => ({ ...l, category: false }));
    }
  }, [search.category, status.category]);

  const fetchSubcategories = useCallback(async (categoryId) => {
    if (!categoryId || !PERMS.subcategory.view) { setSubcategories([]); return; }
    setLoading((l) => ({ ...l, subcategory: true }));
    try {
      const { data } = await getSubCategories({
        limit: LIST_LIMIT,
        category_id: categoryId,
        ...(search.subcategory && { search: search.subcategory }),
        ...buildStatusParams(status.subcategory),
      });
      setSubcategories(data.data || []);
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Erreur lors du chargement des sous-catégories');
    } finally {
      setLoading((l) => ({ ...l, subcategory: false }));
    }
  }, [search.subcategory, status.subcategory]);

  useEffect(() => {
    const t = setTimeout(fetchFamilies, search.family || status.family ? 350 : 0);
    return () => clearTimeout(t);
  }, [fetchFamilies]);

  useEffect(() => {
    const t = setTimeout(() => fetchCategories(selectedFamily?.id), search.category || status.category ? 350 : 0);
    return () => clearTimeout(t);
  }, [fetchCategories, selectedFamily, status.category]);

  useEffect(() => {
    const t = setTimeout(() => fetchSubcategories(selectedCategory?.id), search.subcategory || status.subcategory ? 350 : 0);
    return () => clearTimeout(t);
  }, [fetchSubcategories, selectedCategory, status.subcategory]);

  const selectFamily = (family) => {
    setSelectedFamily(family);
    setSelectedCategory(null);
    setSubcategories([]);
    setMobileStep('category');
  };

  const selectCategory = (category) => {
    setSelectedCategory(category);
    setMobileStep('subcategory');
  };

  const resetMediaState = () => {
    setImageFile(null); setImagePreview(null);
    setIconFile(null); setIconPreview(null);
  };

  const openCreate = (level) => {
    setFormErrors({});
    resetMediaState();
    setDrawer({ level, mode: 'create', id: null, form: { ...LEVELS[level].emptyForm } });
    setDrawerOpen(true);
  };

  const openEdit = (level, item) => {
    setFormErrors({});
    const cfg = LEVELS[level];
    const form = {};
    cfg.fields.forEach((f) => { form[f.name] = item[f.name] ?? ''; });
    form.status = item.status || 'active';
    setImageFile(null); setImagePreview(item.image_path || null);
    setIconFile(null); setIconPreview(item.icon_path || null);
    setDrawer({ level, mode: 'edit', id: item.id, form });
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    if (saving) return;
    setDrawerOpen(false);
  };

  const handleFieldChange = (name) => (e) => {
    setDrawer((d) => ({ ...d, form: { ...d.form, [name]: e.target.value } }));
    setFormErrors((errs) => ({ ...errs, [name]: undefined }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleIconChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIconFile(file);
    setIconPreview(URL.createObjectURL(file));
  };

  const validate = () => {
    const cfg = LEVELS[drawer.level];
    const errs = {};
    cfg.fields.forEach((f) => {
      if (f.required && !String(drawer.form[f.name] || '').trim()) {
        errs[f.name] = `${f.label} requis`;
      }
    });
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const refreshLevel = (level) => {
    if (level === 'family') fetchFamilies();
    if (level === 'category') fetchCategories(selectedFamily?.id);
    if (level === 'subcategory') fetchSubcategories(selectedCategory?.id);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const cfg = LEVELS[drawer.level];
    const form = { ...drawer.form };
    if (cfg.parentKey === 'family_id') form.family_id = selectedFamily.id;
    if (cfg.parentKey === 'category_id') form.category_id = selectedCategory.id;

    setSaving(true);
    try {
      let payload = form;
      if (cfg.hasMedia && (imageFile || iconFile)) {
        payload = new FormData();
        Object.entries(form).forEach(([k, v]) => payload.append(k, v ?? ''));
        if (imageFile) payload.append('image', imageFile);
        if (iconFile) payload.append('icon', iconFile);
      }

      if (drawer.mode === 'edit') {
        await cfg.api.update(drawer.id, payload);
        showToast('success', `${cfg.label} mise à jour`);
      } else {
        await cfg.api.create(payload);
        showToast('success', `${cfg.label} créée`);
      }
      setDrawerOpen(false);
      refreshLevel(drawer.level);
    } catch (err) {
      const msg = err?.response?.data?.message || "Erreur lors de l'enregistrement";
      showToast('error', msg);
      if (err?.response?.status === 409) {
        setFormErrors((errs) => ({ ...errs, code: msg }));
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (level, item) => {
    const cfg = LEVELS[level];
    setTogglingId(item.id);
    try {
      const newStatus = item.status === 'active' ? 'inactive' : 'active';
      await cfg.api.update(item.id, { status: newStatus });
      showToast('success', newStatus === 'active' ? `${cfg.label} activée` : `${cfg.label} désactivée`);
      refreshLevel(level);
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Erreur lors du changement de statut');
    } finally {
      setTogglingId(null);
    }
  };

  const handleRestore = async (level, item) => {
    const cfg = LEVELS[level];
    setRestoringId(item.id);
    try {
      await cfg.api.restore(item.id);
      showToast('success', `${cfg.label} restaurée`);
      refreshLevel(level);
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Erreur lors de la restauration');
    } finally {
      setRestoringId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { level, item } = deleteTarget;
    const cfg = LEVELS[level];
    setDeleting(true);
    try {
      await cfg.api.remove(item.id);
      showToast('success', `${cfg.label} supprimée`);
      setDeleteTarget(null);
      if (level === 'family' && selectedFamily?.id === item.id) {
        setSelectedFamily(null); setSelectedCategory(null); setSubcategories([]);
      }
      if (level === 'category' && selectedCategory?.id === item.id) {
        setSelectedCategory(null); setSubcategories([]);
      }
      refreshLevel(level);
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

  const drawerCfg = drawer ? LEVELS[drawer.level] : null;

  return (
    <div className={embedded ? 'p-6' : 'min-h-screen bg-neutral-50 p-6'}>
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${
            toast.type === 'success' ? 'bg-emerald-600' : 'bg-[#E10600]'
          }`}
        >
          {toast.message}
        </div>
      )}
      {!embedded && (
        <div className="mb-6">
          <h1 className="font-poppins text-2xl font-semibold text-neutral-900">Hiérarchie Produit</h1>
          <p className="mt-1 text-sm text-neutral-500">Familles, catégories et sous-catégories du catalogue.</p>
        </div>
      )}

      {/* Fil d'ariane */}
      <div className="mb-4 flex items-center gap-1.5 text-sm text-neutral-500">
        <button
          onClick={() => { setSelectedFamily(null); setSelectedCategory(null); setSubcategories([]); setMobileStep('family'); }}
          className={`rounded-md px-2 py-1 hover:bg-neutral-100 ${!selectedFamily ? 'font-medium text-neutral-900' : ''}`}
        >
          Familles
        </button>
        {selectedFamily && (
          <>
            <ChevronRight size={14} />
            <button
              onClick={() => { setSelectedCategory(null); setMobileStep('category'); }}
              className={`rounded-md px-2 py-1 hover:bg-neutral-100 ${!selectedCategory ? 'font-medium text-neutral-900' : ''}`}
            >
              {selectedFamily.name_fr}
            </button>
          </>
        )}
        {selectedCategory && (
          <>
            <ChevronRight size={14} />
            <span className="rounded-md px-2 py-1 font-medium text-neutral-900">{selectedCategory.name_fr}</span>
          </>
        )}
      </div>

      {/* 3 colonnes en cascade */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Column
          level="family"
          mobileVisible={mobileStep === 'family'}
          title="Familles"
          icon={Layers}
          items={families}
          loading={loading.family}
          search={search.family}
          onSearchChange={(v) => setSearch((s) => ({ ...s, family: v }))}
          status={status.family}
          onStatusChange={(v) => setStatus((s) => ({ ...s, family: v }))}
          selectedId={selectedFamily?.id}
          onSelect={selectFamily}
          canView={PERMS.family.view}
          canCreate={PERMS.family.create}
          canUpdate={PERMS.family.update}
          canDelete={PERMS.family.delete}
          togglingId={togglingId}
          restoringId={restoringId}
          onCreate={() => openCreate('family')}
          onEdit={(item) => openEdit('family', item)}
          onDelete={(item) => setDeleteTarget({ level: 'family', item })}
          onToggle={(item) => toggleActive('family', item)}
          onRestore={(item) => handleRestore('family', item)}
          emptyLabel="Aucune famille."
        />

        <Column
          level="category"
          mobileVisible={mobileStep === 'category'}
          title={selectedFamily ? `Catégories — ${selectedFamily.name_fr}` : 'Catégories'}
          icon={Boxes}
          items={categories}
          loading={loading.category}
          search={search.category}
          onSearchChange={(v) => setSearch((s) => ({ ...s, category: v }))}
          status={status.category}
          onStatusChange={(v) => setStatus((s) => ({ ...s, category: v }))}
          selectedId={selectedCategory?.id}
          onSelect={selectCategory}
          canView={PERMS.category.view}
          canCreate={PERMS.category.create}
          canUpdate={PERMS.category.update}
          canDelete={PERMS.category.delete}
          togglingId={togglingId}
          restoringId={restoringId}
          onCreate={() => openCreate('category')}
          onEdit={(item) => openEdit('category', item)}
          onDelete={(item) => setDeleteTarget({ level: 'category', item })}
          onToggle={(item) => toggleActive('category', item)}
          onRestore={(item) => handleRestore('category', item)}
          disabled={!selectedFamily}
          disabledMessage="Sélectionnez une famille pour voir ses catégories."
          onBack={() => setMobileStep('family')}
          emptyLabel="Aucune catégorie pour cette famille."
        />

        <Column
          level="subcategory"
          mobileVisible={mobileStep === 'subcategory'}
          title={selectedCategory ? `Sous-catégories — ${selectedCategory.name_fr}` : 'Sous-catégories'}
          icon={Tag}
          items={subcategories}
          loading={loading.subcategory}
          search={search.subcategory}
          onSearchChange={(v) => setSearch((s) => ({ ...s, subcategory: v }))}
          status={status.subcategory}
          onStatusChange={(v) => setStatus((s) => ({ ...s, subcategory: v }))}
          canView={PERMS.subcategory.view}
          canCreate={PERMS.subcategory.create}
          canUpdate={PERMS.subcategory.update}
          canDelete={PERMS.subcategory.delete}
          togglingId={togglingId}
          restoringId={restoringId}
          onCreate={() => openCreate('subcategory')}
          onEdit={(item) => openEdit('subcategory', item)}
          onDelete={(item) => setDeleteTarget({ level: 'subcategory', item })}
          onToggle={(item) => toggleActive('subcategory', item)}
          onRestore={(item) => handleRestore('subcategory', item)}
          disabled={!selectedCategory}
          disabledMessage="Sélectionnez une catégorie pour voir ses sous-catégories."
          onBack={() => setMobileStep('category')}
          emptyLabel="Aucune sous-catégorie pour cette catégorie."
          selectable={false}
        />
      </div>

      {/* Drawer création / édition */}
      <div
        className={`fixed inset-0 z-40 transition-opacity ${
          drawerOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <div className="absolute inset-0 bg-black/40" onClick={closeDrawer} />

        <div
          className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ${
            drawerOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
            <h2 className="font-poppins text-lg font-semibold text-neutral-900">
              {drawer?.mode === 'edit'
                ? `Modifier — ${drawerCfg?.label}`
                : `Nouvelle ${drawerCfg?.label?.toLowerCase() ?? ''}`}
            </h2>
            <button onClick={closeDrawer} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100">
              <X size={18} />
            </button>
          </div>

          {drawer && drawerCfg && (
            <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto px-5 py-4">
                {drawer.level === 'category' && (
                  <p className="mb-3 rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
                    Famille parente : <span className="font-medium text-neutral-700">{selectedFamily?.name_fr}</span>
                  </p>
                )}
                {drawer.level === 'subcategory' && (
                  <p className="mb-3 rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
                    Catégorie parente : <span className="font-medium text-neutral-700">{selectedCategory?.name_fr}</span>
                  </p>
                )}

                {drawerCfg.hasMedia && (
                  <div className="mb-4 flex items-center gap-6">
                    <div>
                      <div className="mb-1.5 flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg bg-neutral-100">
                        {imagePreview ? (
                          <img src={imagePreview} alt="image" className="h-full w-full object-cover" />
                        ) : (
                          <ImageOff size={20} className="text-neutral-300" />
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50"
                      >
                        <Upload size={12} /> Image
                      </button>
                      <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={handleImageChange} />
                    </div>
                    <div>
                      <div className="mb-1.5 flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg bg-neutral-100">
                        {iconPreview ? (
                          <img src={iconPreview} alt="icône" className="h-full w-full object-cover" />
                        ) : (
                          <ImageOff size={20} className="text-neutral-300" />
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => iconInputRef.current?.click()}
                        className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50"
                      >
                        <Upload size={12} /> Icône
                      </button>
                      <input ref={iconInputRef} type="file" accept="image/*" hidden onChange={handleIconChange} />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {drawerCfg.fields.map((f) => {
                    const wrapperClass = f.col === 'full' ? 'col-span-2' : 'col-span-1';
                    return (
                      <Field key={f.name} label={f.label} error={formErrors[f.name]} className={wrapperClass}>
                        {f.type === 'textarea' ? (
                          <textarea
                            rows={2}
                            dir={f.dir}
                            value={drawer.form[f.name]}
                            onChange={handleFieldChange(f.name)}
                            className={inputClass(formErrors[f.name])}
                          />
                        ) : (
                          <input
                            dir={f.dir}
                            value={drawer.form[f.name]}
                            onChange={handleFieldChange(f.name)}
                            className={inputClass(formErrors[f.name])}
                          />
                        )}
                      </Field>
                    );
                  })}

                  <Field label="Statut" className="col-span-2">
                    <select value={drawer.form.status} onChange={handleFieldChange('status')} className={inputClass()}>
                      <option value="active">Actif</option>
                      <option value="inactive">Inactif</option>
                    </select>
                  </Field>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-neutral-100 px-5 py-4">
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="rounded-lg px-4 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-[#E10600] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#c00500] disabled:opacity-60"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {drawer.mode === 'edit' ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Modale suppression */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h3 className="font-poppins text-base font-semibold text-neutral-900">
              Supprimer {LEVELS[deleteTarget.level].label.toLowerCase()} ?
            </h3>
            <p className="mt-2 text-sm text-neutral-500">
              <span className="font-medium text-neutral-700">{deleteTarget.item.name_fr}</span> passera au statut
              "Supprimé". Vous pourrez la restaurer depuis le filtre "Supprimé".
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="rounded-lg px-4 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
              >
                Annuler
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex items-center gap-2 rounded-lg bg-[#E10600] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#c00500] disabled:opacity-60"
              >
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

/* ------------------------------------------------------------------ */
/* Colonne générique (Familles / Catégories / Sous-catégories)        */
/* ------------------------------------------------------------------ */

function Column({
  level, title, icon: Icon, items, loading, search, onSearchChange, status, onStatusChange,
  selectedId, onSelect, canView = true, canCreate, canUpdate, canDelete, togglingId, restoringId,
  onCreate, onEdit, onDelete, onToggle, onRestore, disabled, disabledMessage,
  onBack, emptyLabel, mobileVisible = true, selectable = true,
}) {
  if (!canView) {
    return (
      <div className={`flex flex-col rounded-xl border border-neutral-200 bg-white ${mobileVisible ? '' : 'hidden lg:flex'}`}>
        <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3">
          <Icon size={16} className="text-neutral-400" />
          <h2 className="font-poppins text-sm font-semibold text-neutral-800">{title}</h2>
        </div>
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 px-4 text-center text-xs text-neutral-400">
          <Lock size={20} />
          Vous n'avez pas accès à cette section.
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col rounded-xl border border-neutral-200 bg-white ${mobileVisible ? '' : 'hidden lg:flex'}`}>
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
        <div className="flex items-center gap-2">
          {onBack && (
            <button onClick={onBack} className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 lg:hidden">
              <ArrowLeft size={16} />
            </button>
          )}
          <Icon size={16} className="text-neutral-400" />
          <h2 className="font-poppins text-sm font-semibold text-neutral-800">{title}</h2>
        </div>
        {canCreate && (
          <button
            onClick={onCreate}
            disabled={disabled}
            title={disabled ? disabledMessage : undefined}
            className="flex items-center gap-1.5 rounded-lg bg-[#E10600] px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-[#c00500] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400"
          >
            <Plus size={14} />
            Nouvelle
          </button>
        )}
      </div>

      {!disabled && (
        <div className="space-y-2 border-b border-neutral-100 px-3 py-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Rechercher (nom, code)…"
              className="w-full rounded-md border border-neutral-200 bg-neutral-50 py-1.5 pl-8 pr-3 text-xs outline-none transition focus:border-[#E10600] focus:bg-white focus:ring-2 focus:ring-[#E10600]/15"
            />
          </div>
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
            className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs outline-none transition focus:border-[#E10600] focus:bg-white focus:ring-2 focus:ring-[#E10600]/15"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="max-h-[65vh] min-h-[200px] overflow-y-auto">
        {disabled ? (
          <div className="flex h-full min-h-[200px] items-center justify-center px-4 text-center text-xs text-neutral-400">
            {disabledMessage}
          </div>
        ) : loading ? (
          <div className="flex min-h-[200px] items-center justify-center text-neutral-400">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex min-h-[200px] items-center justify-center px-4 text-center text-xs text-neutral-400">
            {emptyLabel}
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {items.map((item) => {
              const isDeleted = Boolean(item.deleted_at);
              const isSelected = selectable && selectedId === item.id;
              return (
                <li key={item.id}>
                  <div
                    onClick={() => selectable && !isDeleted && onSelect(item)}
                    className={`group flex items-center justify-between gap-2 px-4 py-2.5 transition ${
                      selectable ? 'cursor-pointer' : ''
                    } ${isSelected ? 'bg-red-50/60' : 'hover:bg-neutral-50'} ${isDeleted ? 'opacity-50' : ''}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`truncate text-sm ${isSelected ? 'font-semibold text-neutral-900' : 'text-neutral-700'}`}>
                          {item.name_fr}
                        </span>
                        <StatusDot item={item} />
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-neutral-400">
                        <span className="font-mono">{item.code}</span>
                        <span dir="rtl">{item.name_ar}</span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                      {isDeleted ? (
                        canDelete && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onRestore(item); }}
                            disabled={restoringId === item.id}
                            title="Restaurer"
                            className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                          >
                            {restoringId === item.id ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                          </button>
                        )
                      ) : (
                        (canUpdate || canDelete) && (
                          <>
                            {canUpdate && (
                              <button
                                onClick={(e) => { e.stopPropagation(); onToggle(item); }}
                                disabled={togglingId === item.id}
                                title={item.status === 'active' ? 'Désactiver' : 'Activer'}
                                className={`rounded-md p-1.5 transition disabled:opacity-50 ${
                                  item.status === 'active' ? 'text-emerald-600 hover:bg-emerald-50' : 'text-neutral-400 hover:bg-neutral-100'
                                }`}
                              >
                                {togglingId === item.id ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : item.status === 'active' ? (
                                  <Power size={14} />
                                ) : (
                                  <PowerOff size={14} />
                                )}
                              </button>
                            )}
                            {canUpdate && (
                              <button
                                onClick={(e) => { e.stopPropagation(); onEdit(item); }}
                                title="Modifier"
                                className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
                              >
                                <Pencil size={14} />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={(e) => { e.stopPropagation(); onDelete(item); }}
                                title="Supprimer"
                                className="rounded-md p-1.5 text-neutral-500 hover:bg-red-50 hover:text-[#E10600]"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </>
                        )
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}