import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Pencil, Trash2, X, Search, Loader2, Lock, Power, PowerOff, RotateCcw, ArrowUp, ArrowDown, GripVertical,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  getUnits, createUnit, updateUnit, deleteUnit,
  toggleUnitStatus, restoreUnit, reorderUnits,
} from '../../api/catalog.api';

const PAGE_SIZE = 20;

const EMPTY_FORM = {
  name_fr: '',
  name_ar: '',
  short_name_fr: '',
  short_name_ar: '',
  code: '',
  status: 'active',
};

const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'active', label: 'Actif' },
  { value: 'inactive', label: 'Inactif' },
  { value: 'deleted', label: 'Supprimé' },
];

function StatusBadge({ unit }) {
  if (unit.deleted_at) {
    return (
      <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">
        Supprimé
      </span>
    );
  }
  if (unit.status === 'active') {
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

export default function UnitsPage() {
  const { hasPermission } = useAuth();
  const canView = hasPermission('units.view');
  const canCreate = hasPermission('units.create');
  const canUpdate = hasPermission('units.update');
  const canDelete = hasPermission('units.delete');
  const canManage = canCreate || canUpdate || canDelete;

  // ——— Liste ———
  const [units, setUnits] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: PAGE_SIZE, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [togglingId, setTogglingId] = useState(null);
  const [restoringId, setRestoringId] = useState(null);
  const [reordering, setReordering] = useState(false);

  const canReorder = !search && !status;

  // ——— Drawer création / édition ———
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // ——— Suppression ———
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // ——— Notification ———
  const [toast, setToast] = useState(null);
  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  // ——— Chargement liste ———
  const fetchUnits = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const { data } = await getUnits({
        page,
        limit: PAGE_SIZE,
        ...(search && { search }),
        ...(status && { status }),
      });
      setUnits(data.data || []);
      setPagination(data.pagination || { total: 0, page: 1, limit: PAGE_SIZE, pages: 1 });
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Erreur lors du chargement des unités');
    } finally {
      setLoading(false);
    }
  }, [page, search, status, canView]);

  useEffect(() => {
    const t = setTimeout(fetchUnits, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [fetchUnits]);

  useEffect(() => {
    setPage(1);
  }, [search, status]);

  // ——— Ouverture drawer ———
  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setDrawerOpen(true);
  };

  const openEdit = (unit) => {
    setEditingId(unit.id);
    setForm({
      name_fr: unit.name_fr || '',
      name_ar: unit.name_ar || '',
      short_name_fr: unit.short_name_fr || '',
      short_name_ar: unit.short_name_ar || '',
      code: unit.code || '',
      status: unit.status || 'active',
    });
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
      const payload = { ...form };
      if (payload.short_name_fr === '') payload.short_name_fr = null;
      if (payload.short_name_ar === '') payload.short_name_ar = null;

      if (editingId) {
        await updateUnit(editingId, payload);
        showToast('success', 'Unité mise à jour');
      } else {
        await createUnit(payload);
        showToast('success', 'Unité créée');
      }
      setDrawerOpen(false);
      fetchUnits();
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
  const toggleStatus = async (unit) => {
    setTogglingId(unit.id);
    try {
      await toggleUnitStatus(unit.id);
      showToast('success', unit.status === 'active' ? 'Unité désactivée' : 'Unité activée');
      fetchUnits();
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Erreur lors du changement de statut');
    } finally {
      setTogglingId(null);
    }
  };

  // ——— Restauration ———
  const handleRestore = async (unit) => {
    setRestoringId(unit.id);
    try {
      await restoreUnit(unit.id);
      showToast('success', 'Unité restaurée');
      fetchUnits();
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Erreur lors de la restauration');
    } finally {
      setRestoringId(null);
    }
  };

  // ——— Réordonnancement ———
  const moveUnit = async (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= units.length) return;

    const reordered = [...units];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];

    setReordering(true);
    setUnits(reordered);

    const pageOffset = (page - 1) * PAGE_SIZE;
    const items = reordered.map((u, idx) => ({ id: u.id, sort_order: pageOffset + idx }));

    try {
      await reorderUnits(items);
      fetchUnits();
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Erreur lors du réordonnancement');
      fetchUnits();
    } finally {
      setReordering(false);
    }
  };

  // ——— Suppression (soft-delete) ———
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteUnit(deleteTarget.id);
      showToast('success', 'Unité supprimée');
      setDeleteTarget(null);
      if (units.length === 1 && page > 1) {
        setPage((p) => p - 1);
      } else {
        fetchUnits();
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

  const colCount = canManage ? (canReorder ? 8 : 7) : (canReorder ? 7 : 6);

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
          <h1 className="font-poppins text-2xl font-semibold text-neutral-900">Unités</h1>
          <p className="mt-1 text-sm text-neutral-500">Unités de mesure globales (référentiel article).</p>
        </div>
        {canCreate && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-[#E10600] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#c00500] active:scale-[0.98]"
          >
            <Plus size={18} />
            Nouvelle unité
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
            placeholder="Rechercher (nom, code)…"
            className="w-full rounded-lg border border-neutral-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-[#E10600] focus:ring-2 focus:ring-[#E10600]/15"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#E10600] focus:ring-2 focus:ring-[#E10600]/15"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {!canReorder && (
          <span className="text-xs text-neutral-400">
            Réinitialisez la recherche/le filtre pour réordonner
          </span>
        )}
      </div>

      {/* Tableau */}
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              {canReorder && <th className="w-10 px-2 py-3"></th>}
              <th className="px-4 py-3 font-medium">Nom (FR)</th>
              <th className="px-4 py-3 font-medium">Nom (AR)</th>
              <th className="px-4 py-3 font-medium">Abrév. (FR)</th>
              <th className="px-4 py-3 font-medium">Abrév. (AR)</th>
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              {canManage && <th className="px-4 py-3 font-medium text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-12 text-center text-neutral-400">
                  <Loader2 size={20} className="mx-auto animate-spin" />
                </td>
              </tr>
            ) : units.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-12 text-center text-neutral-400">
                  Aucune unité trouvée.
                </td>
              </tr>
            ) : (
              units.map((u, index) => {
                const isDeleted = Boolean(u.deleted_at);
                return (
                  <tr key={u.id} className={`transition hover:bg-neutral-50 ${isDeleted ? 'opacity-60' : ''}`}>
                    {canReorder && (
                      <td className="px-2 py-3">
                        {!isDeleted && (
                          <div className="flex flex-col items-center">
                            <button
                              type="button"
                              onClick={() => moveUnit(index, -1)}
                              disabled={index === 0 || reordering}
                              title="Monter"
                              className="rounded p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30"
                            >
                              <ArrowUp size={14} />
                            </button>
                            <GripVertical size={12} className="text-neutral-300" />
                            <button
                              type="button"
                              onClick={() => moveUnit(index, 1)}
                              disabled={index === units.length - 1 || reordering}
                              title="Descendre"
                              className="rounded p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30"
                            >
                              <ArrowDown size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3 font-medium text-neutral-800">{u.name_fr}</td>
                    <td className="px-4 py-3 text-neutral-600" dir="rtl">{u.name_ar}</td>
                    <td className="px-4 py-3 text-xs text-neutral-500">{u.short_name_fr || '—'}</td>
                    <td className="px-4 py-3 text-xs text-neutral-500" dir="rtl">{u.short_name_ar || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-neutral-500">{u.code}</td>
                    <td className="px-4 py-3">
                      <StatusBadge unit={u} />
                    </td>
                    {canManage && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {isDeleted ? (
                            canDelete && (
                              <button
                                onClick={() => handleRestore(u)}
                                disabled={restoringId === u.id}
                                className="rounded-lg p-2 text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50"
                                title="Restaurer"
                              >
                                {restoringId === u.id ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                              </button>
                            )
                          ) : (
                            <>
                              {canUpdate && (
                                <button
                                  onClick={() => toggleStatus(u)}
                                  disabled={togglingId === u.id}
                                  className={`rounded-lg p-2 transition disabled:opacity-50 ${
                                    u.status === 'active' ? 'text-emerald-600 hover:bg-emerald-50' : 'text-neutral-400 hover:bg-neutral-100'
                                  }`}
                                  title={u.status === 'active' ? 'Désactiver' : 'Activer'}
                                >
                                  {togglingId === u.id ? <Loader2 size={16} className="animate-spin" /> : u.status === 'active' ? <Power size={16} /> : <PowerOff size={16} />}
                                </button>
                              )}
                              {canUpdate && (
                                <button
                                  onClick={() => openEdit(u)}
                                  className="rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
                                  title="Modifier"
                                >
                                  <Pencil size={16} />
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  onClick={() => setDeleteTarget(u)}
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
          <span>{pagination.total} unité{pagination.total > 1 ? 's' : ''} — page {pagination.page}/{pagination.pages}</span>
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
              {editingId ? "Modifier l'unité" : 'Nouvelle unité'}
            </h2>
            <button onClick={closeDrawer} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
            <div className="flex-1 px-5 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nom (FR)" error={formErrors.name_fr}>
                  <input value={form.name_fr} onChange={handleFieldChange('name_fr')} className={inputClass(formErrors.name_fr)} />
                </Field>
                <Field label="Nom (AR)" error={formErrors.name_ar}>
                  <input dir="rtl" value={form.name_ar} onChange={handleFieldChange('name_ar')} className={inputClass(formErrors.name_ar)} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Abréviation (FR)">
                  <input
                    value={form.short_name_fr}
                    onChange={handleFieldChange('short_name_fr')}
                    placeholder="ex: kg, L, pcs"
                    className={inputClass()}
                  />
                </Field>
                <Field label="Abréviation (AR)">
                  <input
                    dir="rtl"
                    value={form.short_name_ar}
                    onChange={handleFieldChange('short_name_ar')}
                    className={inputClass()}
                  />
                </Field>
              </div>

              <Field label="Code" error={formErrors.code}>
                <input value={form.code} onChange={handleFieldChange('code')} className={inputClass(formErrors.code)} />
              </Field>

              <Field label="Statut">
                <select value={form.status} onChange={handleFieldChange('status')} className={inputClass()}>
                  <option value="active">Actif</option>
                  <option value="inactive">Inactif</option>
                </select>
              </Field>
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

      {/* Modal confirmation suppression */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h3 className="font-poppins text-base font-semibold text-neutral-900">Supprimer l'unité ?</h3>
            <p className="mt-2 text-sm text-neutral-500">
              <span className="font-medium text-neutral-700">{deleteTarget.name_fr}</span> passera au statut "Supprimé".
              Vous pourrez la restaurer depuis le filtre "Supprimé".
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