import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Pencil, Trash2, X, Search, ImageOff, Upload, Loader2, Lock, Power, PowerOff, RotateCcw,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  restoreCategory,
  getFamiliesList,
} from '../../../api/catalog.api';

const PAGE_SIZE = 20;

const EMPTY_FORM = {
  name_fr: '',
  name_ar: '',
  code: '',
  family_id: '',
  description_fr: '',
  description_ar: '',
  status: 'active',
};

const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'active', label: 'Actif' },
  { value: 'inactive', label: 'Inactif' },
  { value: 'deleted', label: 'Supprimé' },
];

function StatusBadge({ category }) {
  if (category.deleted_at) {
    return (
      <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">
        Supprimé
      </span>
    );
  }
  if (category.status === 'active') {
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

export default function CategoriesPage() {
  const { hasPermission } = useAuth();
  const canView = hasPermission('categories.view');
  const canCreate = hasPermission('categories.create');
  const canUpdate = hasPermission('categories.update');
  const canDelete = hasPermission('categories.delete');
  const canManage = canCreate || canUpdate || canDelete;

  // ——— Liste ———
  const [categories, setCategories] = useState([]);
  const [families, setFamilies] = useState([]);
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
  const [form, setForm] = useState(EMPTY_FORM);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [iconFile, setIconFile] = useState(null);
  const [iconPreview, setIconPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const imageInputRef = useRef(null);
  const iconInputRef = useRef(null);

  // ——— Suppression ———
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // ——— Notification ———
  const [toast, setToast] = useState(null);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  // ——— Familles (pour le select du formulaire) ———
  useEffect(() => {
    getFamiliesList()
      .then(({ data }) => setFamilies(data.data || []))
      .catch(() => setFamilies([]));
  }, []);

  // ——— Chargement liste ———
  const fetchCategories = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const { data } = await getCategories({
        page,
        limit: PAGE_SIZE,
        ...(search && { search }),
        ...(status && { status }),
      });
      setCategories(data.data || []);
      setPagination(data.pagination || { total: 0, page: 1, limit: PAGE_SIZE, pages: 1 });
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Erreur lors du chargement des catégories');
    } finally {
      setLoading(false);
    }
  }, [page, search, status, canView]);

  useEffect(() => {
    const t = setTimeout(fetchCategories, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [fetchCategories]);

  useEffect(() => {
    setPage(1);
  }, [search, status]);

  // ——— Ouverture drawer ———
  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setImageFile(null);
    setImagePreview(null);
    setIconFile(null);
    setIconPreview(null);
    setFormErrors({});
    setDrawerOpen(true);
  };

  const openEdit = (category) => {
    setEditingId(category.id);
    setForm({
      name_fr: category.name_fr || '',
      name_ar: category.name_ar || '',
      code: category.code || '',
      family_id: category.family_id || '',
      description_fr: category.description_fr || '',
      description_ar: category.description_ar || '',
      status: category.status || 'active',
    });
    setImageFile(null);
    setImagePreview(category.image_path || null);
    setIconFile(null);
    setIconPreview(category.icon_path || null);
    setFormErrors({});
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    if (saving) return;
    setDrawerOpen(false);
  };

  const handleFieldChange = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setFormErrors((errs) => ({ ...errs, [field]: undefined }));
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

  const validateForm = () => {
    const errs = {};
    if (!form.name_fr.trim()) errs.name_fr = 'Nom français requis';
    if (!form.name_ar.trim()) errs.name_ar = 'Nom arabe requis';
    if (!form.code.trim()) errs.code = 'Code requis';
    if (!form.family_id) errs.family_id = 'Famille requise';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    try {
      let payload;
      if (imageFile || iconFile) {
        payload = new FormData();
        Object.entries(form).forEach(([k, v]) => payload.append(k, v ?? ''));
        if (imageFile) payload.append('image', imageFile);
        if (iconFile) payload.append('icon', iconFile);
      } else {
        payload = form;
      }

      if (editingId) {
        await updateCategory(editingId, payload);
        showToast('success', 'Catégorie mise à jour');
      } else {
        await createCategory(payload);
        showToast('success', 'Catégorie créée');
      }
      setDrawerOpen(false);
      fetchCategories();
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

  // ——— Activer / désactiver ———
  const toggleStatus = async (category) => {
    const newStatus = category.status === 'active' ? 'inactive' : 'active';
    setTogglingId(category.id);
    try {
      await updateCategory(category.id, { status: newStatus });
      showToast('success', newStatus === 'active' ? 'Catégorie activée' : 'Catégorie désactivée');
      fetchCategories();
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Erreur lors du changement de statut');
    } finally {
      setTogglingId(null);
    }
  };

  // ——— Restauration ———
  const handleRestore = async (category) => {
    setRestoringId(category.id);
    try {
      await restoreCategory(category.id);
      showToast('success', 'Catégorie restaurée');
      fetchCategories();
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Erreur lors de la restauration');
    } finally {
      setRestoringId(null);
    }
  };

  // ——— Suppression (soft-delete) ———
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteCategory(deleteTarget.id);
      showToast('success', 'Catégorie supprimée');
      setDeleteTarget(null);
      if (categories.length === 1 && page > 1) {
        setPage((p) => p - 1);
      } else {
        fetchCategories();
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

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${
            toast.type === 'success' ? 'bg-emerald-600' : 'bg-[#E10600]'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* En-tête */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-poppins text-2xl font-semibold text-neutral-900">Catégories</h1>
          <p className="mt-1 text-sm text-neutral-500">Gérez les catégories de la hiérarchie produit.</p>
        </div>
        {canCreate && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-[#E10600] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#c00500] active:scale-[0.98]"
          >
            <Plus size={18} />
            Nouvelle catégorie
          </button>
        )}
      </div>

      {/* Filtres */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher (nom, code, description)…"
            className="w-full rounded-lg border border-neutral-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-[#E10600] focus:ring-2 focus:ring-[#E10600]/15"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#E10600] focus:ring-2 focus:ring-[#E10600]/15"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Tableau */}
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Image</th>
              <th className="px-4 py-3 font-medium">Icône</th>
              <th className="px-4 py-3 font-medium">Nom (FR)</th>
              <th className="px-4 py-3 font-medium">Nom (AR)</th>
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="px-4 py-3 font-medium">Famille</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              {canManage && <th className="px-4 py-3 font-medium text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading ? (
              <tr>
                <td colSpan={canManage ? 9 : 8} className="px-4 py-12 text-center text-neutral-400">
                  <Loader2 size={20} className="mx-auto animate-spin" />
                </td>
              </tr>
            ) : categories.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 9 : 8} className="px-4 py-12 text-center text-neutral-400">
                  Aucune catégorie trouvée.
                </td>
              </tr>
            ) : (
              categories.map((cat) => {
                const isDeleted = Boolean(cat.deleted_at);
                return (
                  <tr key={cat.id} className={`transition hover:bg-neutral-50 ${isDeleted ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3">
                      {cat.image_path ? (
                        <img src={cat.image_path} alt={cat.name_fr} className="h-10 w-10 rounded-md object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-neutral-100 text-neutral-300">
                          <ImageOff size={16} />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {cat.icon_path ? (
                        <img src={cat.icon_path} alt={`${cat.name_fr} icône`} className="h-10 w-10 rounded-md object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-neutral-100 text-neutral-300">
                          <ImageOff size={16} />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-neutral-800">{cat.name_fr}</td>
                    <td className="px-4 py-3 text-neutral-600" dir="rtl">{cat.name_ar}</td>
                    <td className="px-4 py-3 font-mono text-xs text-neutral-500">{cat.code}</td>
                    <td className="px-4 py-3 max-w-[240px] text-neutral-500">
                      <p className="truncate" title={cat.description_fr || ''}>
                        {cat.description_fr || '—'}
                      </p>
                      <p className="truncate text-xs text-neutral-400" dir="rtl" title={cat.description_ar || ''}>
                        {cat.description_ar || '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{cat.family?.name_fr || '—'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge category={cat} />
                    </td>
                    {canManage && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {isDeleted ? (
                            canDelete && (
                              <button
                                onClick={() => handleRestore(cat)}
                                disabled={restoringId === cat.id}
                                className="rounded-lg p-2 text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50"
                                title="Restaurer"
                              >
                                {restoringId === cat.id ? (
                                  <Loader2 size={16} className="animate-spin" />
                                ) : (
                                  <RotateCcw size={16} />
                                )}
                              </button>
                            )
                          ) : (
                            <>
                              {canUpdate && (
                                <button
                                  onClick={() => toggleStatus(cat)}
                                  disabled={togglingId === cat.id}
                                  className={`rounded-lg p-2 transition disabled:opacity-50 ${
                                    cat.status === 'active'
                                      ? 'text-emerald-600 hover:bg-emerald-50'
                                      : 'text-neutral-400 hover:bg-neutral-100'
                                  }`}
                                  title={cat.status === 'active' ? 'Désactiver' : 'Activer'}
                                >
                                  {togglingId === cat.id ? (
                                    <Loader2 size={16} className="animate-spin" />
                                  ) : cat.status === 'active' ? (
                                    <Power size={16} />
                                  ) : (
                                    <PowerOff size={16} />
                                  )}
                                </button>
                              )}
                              {canUpdate && (
                                <button
                                  onClick={() => openEdit(cat)}
                                  className="rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
                                  title="Modifier"
                                >
                                  <Pencil size={16} />
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  onClick={() => setDeleteTarget(cat)}
                                  className="rounded-lg p-2 text-neutral-500 transition hover:bg-red-50 hover:text-[#E10600]"
                                  title="Supprimer"
                                >
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
          <span>
            {pagination.total} catégorie{pagination.total > 1 ? 's' : ''} — page {pagination.page}/{pagination.pages}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-neutral-200 px-3 py-1.5 disabled:opacity-40"
            >
              Précédent
            </button>
            <button
              disabled={page >= pagination.pages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-neutral-200 px-3 py-1.5 disabled:opacity-40"
            >
              Suivant
            </button>
          </div>
        </div>
      )}

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
              {editingId ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
            </h2>
            <button onClick={closeDrawer} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
            <div className="flex-1 px-5 py-4">
              {/* Image + Icône */}
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

              <div className="grid grid-cols-2 gap-3">
                <Field label="Nom (FR)" error={formErrors.name_fr}>
                  <input
                    value={form.name_fr}
                    onChange={handleFieldChange('name_fr')}
                    className={inputClass(formErrors.name_fr)}
                  />
                </Field>
                <Field label="Nom (AR)" error={formErrors.name_ar}>
                  <input
                    dir="rtl"
                    value={form.name_ar}
                    onChange={handleFieldChange('name_ar')}
                    className={inputClass(formErrors.name_ar)}
                  />
                </Field>
              </div>

              <Field label="Code" error={formErrors.code} className="mt-3">
                <input
                  value={form.code}
                  onChange={handleFieldChange('code')}
                  className={inputClass(formErrors.code)}
                />
              </Field>

              <Field label="Famille" error={formErrors.family_id} className="mt-3">
                <select
                  value={form.family_id}
                  onChange={handleFieldChange('family_id')}
                  className={inputClass(formErrors.family_id)}
                >
                  <option value="">— Sélectionner —</option>
                  {families.map((f) => (
                    <option key={f.id} value={f.id}>{f.name_fr}</option>
                  ))}
                </select>
              </Field>

              <Field label="Description (FR)" className="mt-3">
                <textarea
                  rows={2}
                  value={form.description_fr}
                  onChange={handleFieldChange('description_fr')}
                  className={inputClass()}
                />
              </Field>

              <Field label="Description (AR)" className="mt-3">
                <textarea
                  dir="rtl"
                  rows={2}
                  value={form.description_ar}
                  onChange={handleFieldChange('description_ar')}
                  className={inputClass()}
                />
              </Field>

              <Field label="Statut" className="mt-3">
                <select value={form.status} onChange={handleFieldChange('status')} className={inputClass()}>
                  <option value="active">Actif</option>
                  <option value="inactive">Inactif</option>
                </select>
              </Field>
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
                {editingId ? 'Enregistrer' : 'Créer'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Modal confirmation suppression */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h3 className="font-poppins text-base font-semibold text-neutral-900">Supprimer la catégorie ?</h3>
            <p className="mt-2 text-sm text-neutral-500">
              <span className="font-medium text-neutral-700">{deleteTarget.name_fr}</span> passera au statut
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
    error
      ? 'border-[#E10600] focus:ring-[#E10600]/15'
      : 'border-neutral-200 focus:border-[#E10600] focus:ring-[#E10600]/15'
  }`;
}