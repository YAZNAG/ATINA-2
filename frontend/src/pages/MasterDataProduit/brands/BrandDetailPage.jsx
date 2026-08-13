import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Pencil, Trash2, X, ImageOff, Upload, Loader2, Lock,
  Power, PowerOff, AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { getBrand, updateBrand, deleteBrand } from '../../../api/catalog.api';

function StatusBadge({ brand }) {
  if (brand.deleted_at) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-600">
        Supprimé
      </span>
    );
  }
  if (brand.status === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
        Actif
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-500">
      Inactif
    </span>
  );
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function InfoRow({ label, value, dir }) {
  return (
    <div className="flex justify-between gap-4 border-b border-neutral-100 py-2 text-sm last:border-0">
      <span className="text-neutral-500">{label}</span>
      <span className="text-right font-medium text-neutral-800" dir={dir}>
        {value ?? '—'}
      </span>
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

export default function BrandDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canView = hasPermission('brands.view');
  const canUpdate = hasPermission('brands.update');
  const canDelete = hasPermission('brands.delete');

  const [brand, setBrand] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [toggling, setToggling] = useState(false);

  // ——— Drawer édition ———
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const fileInputRef = useRef(null);

  // ——— Suppression ———
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ——— Notification ———
  const [toast, setToast] = useState(null);
  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchBrand = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    setNotFound(false);
    try {
      const { data } = await getBrand(id);
      setBrand(data.data || data);
    } catch (err) {
      if (err?.response?.status === 404) {
        setNotFound(true);
      } else {
        showToast('error', err?.response?.data?.message || 'Erreur lors du chargement de la marque');
      }
    } finally {
      setLoading(false);
    }
  }, [id, canView]);

  useEffect(() => {
    fetchBrand();
  }, [fetchBrand]);

  // ——— Activer / désactiver ———
  const toggleStatus = async () => {
    if (!brand) return;
    const newStatus = brand.status === 'active' ? 'inactive' : 'active';
    setToggling(true);
    try {
      const { data } = await updateBrand(brand.id, { status: newStatus });
      setBrand(data.data || { ...brand, status: newStatus });
      showToast('success', newStatus === 'active' ? 'Marque activée' : 'Marque désactivée');
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Erreur lors du changement de statut');
    } finally {
      setToggling(false);
    }
  };

  // ——— Ouverture drawer édition ———
  const openEdit = () => {
    setForm({
      name_fr: brand.name_fr || '',
      name_ar: brand.name_ar || '',
      code: brand.code || '',
      description_fr: brand.description_fr || '',
      description_ar: brand.description_ar || '',
      status: brand.status || 'active',
    });
    setLogoFile(null);
    setLogoPreview(brand.logo || null);
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

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const validateForm = () => {
    const errs = {};
    if (!form.name_fr.trim()) errs.name_fr = 'Nom français requis';
    if (!form.name_ar.trim()) errs.name_ar = 'Nom arabe requis';
    if (!form.code.trim()) errs.code = 'Code requis';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    try {
      let payload;
      if (logoFile) {
        payload = new FormData();
        Object.entries(form).forEach(([k, v]) => payload.append(k, v ?? ''));
        payload.append('logo', logoFile);
      } else {
        payload = form;
      }

      const { data } = await updateBrand(brand.id, payload);
      setBrand(data.data || { ...brand, ...form });
      showToast('success', 'Marque mise à jour');
      setDrawerOpen(false);
      fetchBrand();
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

  // ——— Suppression (soft-delete) ———
  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await deleteBrand(brand.id);
      showToast('success', 'Marque supprimée');
      navigate('/brands');
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Erreur lors de la suppression');
      setShowDeleteConfirm(false);
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

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={24} className="animate-spin text-neutral-400" />
      </div>
    );
  }

  if (notFound || !brand) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-neutral-400">
        <AlertTriangle size={28} />
        <p className="text-sm">Marque introuvable.</p>
        <Link to="/brands" className="text-sm text-[#E10600] hover:underline">
          Retour aux marques
        </Link>
      </div>
    );
  }

  const isDeleted = Boolean(brand.deleted_at);

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

      <button
        onClick={() => navigate(-1)}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-800"
      >
        <ArrowLeft size={16} />
        Retour aux marques
      </button>

      {/* En-tête */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-neutral-200 bg-white">
            {brand.logo ? (
              <img src={brand.logo} alt={brand.name_fr} className="h-full w-full object-cover" />
            ) : (
              <ImageOff size={20} className="text-neutral-300" />
            )}
          </div>
          <div>
            <h1 className="font-poppins text-2xl font-semibold text-neutral-900">{brand.name_fr}</h1>
            <p className="flex items-center gap-2 text-sm text-neutral-500">
              {brand.code}
              <StatusBadge brand={brand} />
            </p>
          </div>
        </div>

        {!isDeleted && (
          <div className="flex items-center gap-2">
            {canUpdate && (
              <button
                onClick={toggleStatus}
                disabled={toggling}
                className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition disabled:opacity-50 ${
                  brand.status === 'active'
                    ? 'border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                    : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                {toggling ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : brand.status === 'active' ? (
                  <PowerOff size={15} />
                ) : (
                  <Power size={15} />
                )}
                {brand.status === 'active' ? 'Désactiver' : 'Activer'}
              </button>
            )}
            {canUpdate && (
              <button
                onClick={openEdit}
                className="flex items-center gap-2 rounded-lg bg-[#E10600] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#c00500] active:scale-[0.98]"
              >
                <Pencil size={15} />
                Modifier
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 rounded-lg border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-500 transition hover:border-red-200 hover:bg-red-50 hover:text-[#E10600]"
              >
                <Trash2 size={15} />
                Supprimer
              </button>
            )}
          </div>
        )}
      </div>

      {isDeleted && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertTriangle size={16} />
          Cette marque a été supprimée. Elle n'est plus disponible pour être associée à des articles.
        </div>
      )}

      {/* Contenu */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold text-neutral-800">Général</h3>
          <InfoRow label="Nom (FR)" value={brand.name_fr} />
          <InfoRow label="Nom (AR)" value={<span dir="rtl">{brand.name_ar}</span>} />
          <InfoRow label="Code" value={brand.code} />
          <InfoRow label="Statut" value={<StatusBadge brand={brand} />} />
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold text-neutral-800">Description</h3>
          <InfoRow label="Description (FR)" value={brand.description_fr} />
          <InfoRow label="Description (AR)" value={<span dir="rtl">{brand.description_ar}</span>} />
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 lg:col-span-2">
          <h3 className="mb-2 text-sm font-semibold text-neutral-800">Dates</h3>
          <InfoRow label="Créée le" value={formatDate(brand.created_at)} />
          <InfoRow label="Modifiée le" value={formatDate(brand.updated_at)} />
          {isDeleted && (
            <InfoRow label="Supprimée le" value={<span className="text-[#E10600]">{formatDate(brand.deleted_at)}</span>} />
          )}
        </div>
      </div>

      {/* Drawer édition */}
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
            <h2 className="font-poppins text-lg font-semibold text-neutral-900">Modifier la marque</h2>
            <button onClick={closeDrawer} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100">
              <X size={18} />
            </button>
          </div>

          {form && (
            <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
              <div className="flex-1 px-5 py-4">
                <div className="mb-4 flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg bg-neutral-100">
                    {logoPreview ? (
                      <img src={logoPreview} alt="logo" className="h-full w-full object-cover" />
                    ) : (
                      <ImageOff size={20} className="text-neutral-300" />
                    )}
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50"
                    >
                      <Upload size={14} />
                      Choisir un logo
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleLogoChange} />
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
                  Enregistrer
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Modal confirmation suppression */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h3 className="font-poppins text-base font-semibold text-neutral-900">Supprimer la marque ?</h3>
            <p className="mt-2 text-sm text-neutral-500">
              <span className="font-medium text-neutral-700">{brand.name_fr}</span> passera au statut "Supprimé".
              Cette action est réversible uniquement depuis la base de données.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
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