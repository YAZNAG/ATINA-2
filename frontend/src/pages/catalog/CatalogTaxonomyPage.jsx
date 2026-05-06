import { useState, useEffect, useCallback, useRef } from 'react';
import * as catalog from '../../api/catalog.api';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../utils/helpers';
import toast from 'react-hot-toast';

// ── helpers ───────────────────────────────────────────────────────────────────

function imgSrc(p) {
  if (!p || !String(p).trim()) return null;
  const s = String(p).trim();
  return s.startsWith('http') ? s : s.startsWith('/') ? s : `/${s}`;
}

// ── CardImage ─────────────────────────────────────────────────────────────────

function CardImage({ src, name }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center flex-shrink-0">
        <svg className="w-7 h-7 text-red-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={name}
      onError={() => setErr(true)}
      className="w-16 h-16 rounded-2xl object-cover border border-gray-100 flex-shrink-0 shadow-sm"
    />
  );
}

// ── StatusBadge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const active = status === 'active';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-gray-400'}`} />
      {active ? 'Actif' : 'Inactif'}
    </span>
  );
}

// ── TaxonomyCard ──────────────────────────────────────────────────────────────

function TaxonomyCard({ item, childLabel, childCount, clickable, onClick, onEdit, onDelete }) {
  const src = imgSrc(item.image_path) || imgSrc(item.icon_path);
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-red-100 transition-all flex flex-col">
      <div
        className={`p-5 flex-1 ${clickable ? 'cursor-pointer' : ''}`}
        onClick={clickable ? onClick : undefined}
      >
        <div className="flex items-start gap-4">
          <CardImage src={src} name={item.name_fr} />
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-sm leading-tight">{item.name_fr}</h3>
            {item.name_ar && (
              <p className="text-xs text-gray-400 mt-0.5 truncate" dir="rtl">{item.name_ar}</p>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {item.code && (
                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[11px] font-mono rounded-md border border-gray-200">
                  {item.code}
                </span>
              )}
              <StatusBadge status={item.status} />
            </div>
          </div>
        </div>

        {childCount != null && clickable && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-400 font-medium">
            <svg className="w-3.5 h-3.5 text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span>{childCount} {childLabel}</span>
          </div>
        )}

        {item.description_fr && (
          <p className="mt-2 text-xs text-gray-400 leading-relaxed line-clamp-2">{item.description_fr}</p>
        )}
      </div>

      <div className="flex items-center gap-1.5 px-5 pb-4 pt-3 border-t border-gray-50">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(item); }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Modifier
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(item); }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors ml-auto"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Supprimer
        </button>
      </div>
    </div>
  );
}

// ── DeleteModal ───────────────────────────────────────────────────────────────

function DeleteModal({ item, onCancel, onConfirm, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-gray-900 text-center mb-1">Confirmer la suppression</h3>
        <p className="text-sm text-gray-500 text-center mb-6">
          <span className="font-semibold text-gray-700">{item?.name_fr}</span> sera supprimé définitivement.
          Cette action est irréversible.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Suppression…' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Drawer ────────────────────────────────────────────────────────────────────

const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-300';
const sel = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-700';
const ta = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-300 resize-none';

function Fld({ label, req, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
        {label}{req && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

function ImgFld({ label, preview, remotePath, onPick }) {
  const src = preview || imgSrc(remotePath);
  const [err, setErr] = useState(false);
  useEffect(() => { setErr(false); }, [src]);
  return (
    <Fld label={label}>
      <label className="flex items-center gap-3 cursor-pointer group">
        <div className={`w-16 h-16 rounded-xl border-2 border-dashed flex items-center justify-center flex-shrink-0 overflow-hidden transition-colors ${src && !err ? 'border-transparent' : 'border-gray-200 group-hover:border-red-300 group-hover:bg-red-50'}`}>
          {src && !err ? (
            <img src={src} alt="" onError={() => setErr(true)} className="w-full h-full object-cover rounded-xl" />
          ) : (
            <svg className="w-6 h-6 text-gray-300 group-hover:text-red-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
          )}
        </div>
        <span className="text-xs text-gray-500 group-hover:text-red-600 transition-colors">
          {src && !err ? 'Changer le fichier…' : 'Choisir un fichier…'}
        </span>
        <input type="file" accept="image/*" className="hidden" onChange={onPick} />
      </label>
    </Fld>
  );
}

const EMPTY_FORM = { name_fr: '', name_ar: '', code: '', description_fr: '', description_ar: '', status: 'active', sort_order: '0' };

function TaxonomyDrawer({ level, familyId, categoryId, editItem, onClose, onSaved }) {
  const isEdit = !!editItem;
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [imgFile, setImgFile] = useState(null);
  const [iconFile, setIconFile] = useState(null);
  const [imgPreview, setImgPreview] = useState(null);
  const [iconPreview, setIconPreview] = useState(null);
  const imgRef = useRef(null);
  const iconRef = useRef(null);

  useEffect(() => {
    setForm(editItem ? {
      name_fr: editItem.name_fr ?? '',
      name_ar: editItem.name_ar ?? '',
      code: editItem.code ?? '',
      description_fr: editItem.description_fr ?? '',
      description_ar: editItem.description_ar ?? '',
      status: editItem.status ?? 'active',
      sort_order: String(editItem.sort_order ?? 0),
    } : EMPTY_FORM);
    setImgFile(null); setIconFile(null);
    setImgPreview(null); setIconPreview(null);
  }, [editItem]);

  useEffect(() => () => {
    if (imgRef.current) URL.revokeObjectURL(imgRef.current);
    if (iconRef.current) URL.revokeObjectURL(iconRef.current);
  }, []);

  const hc = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const pickFile = (setter, previewSetter, ref) => (e) => {
    const f = e.target.files?.[0] ?? null;
    if (ref.current) { URL.revokeObjectURL(ref.current); ref.current = null; }
    setter(f);
    if (f) { const u = URL.createObjectURL(f); ref.current = u; previewSetter(u); }
    else previewSetter(null);
  };

  const buildFd = () => {
    const fd = new FormData();
    const keys = ['name_fr', 'name_ar', 'code', 'description_fr', 'description_ar', 'status', 'sort_order'];
    for (const k of keys) {
      if (form[k] !== '' && form[k] != null) fd.append(k, form[k]);
    }
    if (level === 'categories' && familyId) fd.append('family_id', String(familyId));
    if (level === 'sub-categories' && categoryId) fd.append('category_id', String(categoryId));
    if (imgFile) fd.append('image', imgFile);
    if (iconFile) fd.append('icon', iconFile);
    return fd;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = buildFd();
      if (level === 'families') {
        isEdit ? await catalog.updateFamily(editItem.id, fd) : await catalog.createFamily(fd);
      } else if (level === 'categories') {
        isEdit ? await catalog.updateCategory(editItem.id, fd) : await catalog.createCategory(fd);
      } else {
        isEdit ? await catalog.updateSubCategory(editItem.id, fd) : await catalog.createSubCategory(fd);
      }
      toast.success(isEdit ? 'Mis à jour' : 'Créé avec succès');
      onSaved();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const levelLabel = { families: 'Famille', categories: 'Catégorie', 'sub-categories': 'Sous-catégorie' }[level];

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-40 flex flex-col bg-white shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-red-700 to-red-500">
          <div>
            <p className="text-red-200 text-xs font-semibold uppercase tracking-widest mb-0.5">
              {isEdit ? 'Modifier' : 'Nouveau'}
            </p>
            <h2 className="text-white font-bold text-xl">{levelLabel}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/25 flex items-center justify-center transition-colors"
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form id="taxo-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <Fld label="Nom (Français)" req>
            <input
              name="name_fr"
              className={inp}
              value={form.name_fr}
              onChange={hc}
              required
              placeholder="Nom en français"
            />
          </Fld>
          <Fld label="Nom (Arabe)">
            <input
              name="name_ar"
              className={inp}
              value={form.name_ar}
              onChange={hc}
              dir="rtl"
              placeholder="الاسم بالعربية"
            />
          </Fld>
          <Fld label="Code" req>
            <input
              name="code"
              className={`${inp} uppercase`}
              value={form.code}
              onChange={(e) => hc({ target: { name: 'code', value: e.target.value.toUpperCase() } })}
              required
              placeholder="EX: FAM-01"
            />
          </Fld>
          <Fld label="Description (FR)">
            <textarea
              name="description_fr"
              className={ta}
              rows={2}
              value={form.description_fr}
              onChange={hc}
              placeholder="Description optionnelle…"
            />
          </Fld>
          <Fld label="Description (AR)">
            <textarea
              name="description_ar"
              className={ta}
              rows={2}
              value={form.description_ar}
              onChange={hc}
              dir="rtl"
            />
          </Fld>
          <div className="grid grid-cols-2 gap-3">
            <Fld label="Statut">
              <select name="status" className={sel} value={form.status} onChange={hc}>
                <option value="active">Actif</option>
                <option value="inactive">Inactif</option>
              </select>
            </Fld>
            <Fld label="Ordre">
              <input
                name="sort_order"
                type="number"
                min="0"
                className={inp}
                value={form.sort_order}
                onChange={hc}
              />
            </Fld>
          </div>

          <div className="border-t border-gray-100 pt-4 space-y-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Médias</p>
            <ImgFld
              label="Image"
              preview={imgPreview}
              remotePath={editItem?.image_path}
              onPick={pickFile(setImgFile, setImgPreview, imgRef)}
            />
            <ImgFld
              label="Icône"
              preview={iconPreview}
              remotePath={editItem?.icon_path}
              onPick={pickFile(setIconFile, setIconPreview, iconRef)}
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            form="taxo-form"
            disabled={saving}
            className="flex-1 py-2.5 text-sm font-semibold bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl transition-colors"
          >
            {saving ? 'Enregistrement…' : isEdit ? 'Mettre à jour' : 'Créer'}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

const LEVEL_CFG = {
  families: {
    label: 'Familles',
    subtitle: 'Niveau 1 de la taxonomie catalogue',
    childLabel: 'catégories',
    createPerm: 'families.create',
    viewPerm: 'families.view',
  },
  categories: {
    label: 'Catégories',
    childLabel: 'sous-catégories',
    createPerm: 'categories.create',
    viewPerm: 'categories.view',
  },
  'sub-categories': {
    label: 'Sous-catégories',
    childLabel: null,
    createPerm: 'sub_categories.create',
    viewPerm: 'sub_categories.view',
  },
};

export default function CatalogTaxonomyPage() {
  const { hasPermission } = useAuth();

  const [level, setLevel] = useState('families');
  const [selectedFamily, setSelectedFamily] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);

  const [families, setFamilies] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [catCounts, setCatCounts] = useState({});
  const [subCounts, setSubCounts] = useState({});
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [drawer, setDrawer] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── loaders ──────────────────────────────────────────────────────────────────

  const loadFamilies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await catalog.getFamilies({ all: true });
      const list = res.data.data ?? [];
      setFamilies(list);
      const counts = {};
      await Promise.all(
        list.map(async (f) => {
          try {
            const r = await catalog.getCategories({ all: true, family_id: f.id });
            counts[f.id] = (r.data.data ?? []).length;
          } catch { counts[f.id] = 0; }
        })
      );
      setCatCounts(counts);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, []);

  const loadCategories = useCallback(async () => {
    if (!selectedFamily) return;
    setLoading(true);
    try {
      const res = await catalog.getCategories({ all: true, family_id: selectedFamily.id });
      const list = res.data.data ?? [];
      setCategories(list);
      const counts = {};
      await Promise.all(
        list.map(async (c) => {
          try {
            const r = await catalog.getSubCategories({ all: true, category_id: c.id });
            counts[c.id] = (r.data.data ?? []).length;
          } catch { counts[c.id] = 0; }
        })
      );
      setSubCounts(counts);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, [selectedFamily]);

  const loadSubCategories = useCallback(async () => {
    if (!selectedCategory) return;
    setLoading(true);
    try {
      const res = await catalog.getSubCategories({ all: true, category_id: selectedCategory.id });
      setSubCategories(res.data.data ?? []);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, [selectedCategory]);

  useEffect(() => {
    if (level === 'families') loadFamilies();
    else if (level === 'categories') loadCategories();
    else loadSubCategories();
  }, [level, loadFamilies, loadCategories, loadSubCategories]);

  const refresh = useCallback(() => {
    if (level === 'families') loadFamilies();
    else if (level === 'categories') loadCategories();
    else loadSubCategories();
  }, [level, loadFamilies, loadCategories, loadSubCategories]);

  // ── navigation ───────────────────────────────────────────────────────────────

  const goToFamilies = () => {
    setLevel('families');
    setSelectedFamily(null);
    setSelectedCategory(null);
    setSearch(''); setSearchInput('');
  };

  const goToCategories = () => {
    setLevel('categories');
    setSelectedCategory(null);
    setSearch(''); setSearchInput('');
  };

  const drillFamily = (f) => {
    setSelectedFamily(f);
    setLevel('categories');
    setSearch(''); setSearchInput('');
  };

  const drillCategory = (c) => {
    setSelectedCategory(c);
    setLevel('sub-categories');
    setSearch(''); setSearchInput('');
  };

  // ── delete ───────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      if (level === 'families') await catalog.deleteFamily(deleting.id);
      else if (level === 'categories') await catalog.deleteCategory(deleting.id);
      else await catalog.deleteSubCategory(deleting.id);
      toast.success('Supprimé');
      setDeleting(null);
      refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── derived ──────────────────────────────────────────────────────────────────

  const lc = LEVEL_CFG[level];
  const rows = level === 'families' ? families : level === 'categories' ? categories : subCategories;
  const q = search.toLowerCase();
  const filtered = rows.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (q && !(r.name_fr ?? '').toLowerCase().includes(q) && !(r.code ?? '').toLowerCase().includes(q)) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Modals */}
      {deleting && (
        <DeleteModal
          item={deleting}
          onCancel={() => setDeleting(null)}
          onConfirm={handleDelete}
          loading={deleteLoading}
        />
      )}
      {drawer && (
        <TaxonomyDrawer
          level={level}
          familyId={selectedFamily?.id}
          categoryId={selectedCategory?.id}
          editItem={drawer.editItem ?? null}
          onClose={() => setDrawer(null)}
          onSaved={() => { setDrawer(null); refresh(); }}
        />
      )}

      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="px-6 pt-5 pb-4">
          {/* Top row */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              {/* Breadcrumb */}
              <nav className="flex items-center gap-2 text-sm mb-2">
                <button
                  onClick={goToFamilies}
                  className={`font-semibold transition-colors ${level === 'families' ? 'text-red-600' : 'text-gray-400 hover:text-red-500'}`}
                >
                  Familles
                </button>

                {(level === 'categories' || level === 'sub-categories') && selectedFamily && (
                  <>
                    <svg className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                    <button
                      onClick={goToCategories}
                      className={`font-semibold transition-colors max-w-[150px] truncate ${level === 'categories' ? 'text-red-600' : 'text-gray-400 hover:text-red-500'}`}
                    >
                      {selectedFamily.name_fr}
                    </button>
                  </>
                )}

                {level === 'sub-categories' && selectedCategory && (
                  <>
                    <svg className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="font-semibold text-red-600 max-w-[150px] truncate">
                      {selectedCategory.name_fr}
                    </span>
                  </>
                )}
              </nav>

              <h1 className="text-2xl font-bold text-gray-900">{lc.label}</h1>
              <p className="text-sm text-gray-400 mt-0.5">
                {level === 'families' && 'Niveau 1 de la taxonomie catalogue'}
                {level === 'categories' && `Catégories de la famille « ${selectedFamily?.name_fr} »`}
                {level === 'sub-categories' && `Sous-catégories de la catégorie « ${selectedCategory?.name_fr} »`}
              </p>
            </div>

            {hasPermission(lc.createPerm) && (
              <button
                onClick={() => setDrawer({ editItem: null })}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-colors flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                Ajouter
              </button>
            )}
          </div>

          {/* Level tabs + search */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Tabs */}
            <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
              {[
                { key: 'families', label: 'Familles', disabled: false },
                { key: 'categories', label: 'Catégories', disabled: !selectedFamily },
                { key: 'sub-categories', label: 'Sous-catégories', disabled: !selectedCategory },
              ].map((tab) => (
                <button
                  key={tab.key}
                  disabled={tab.disabled}
                  onClick={() => {
                    if (tab.key === 'families') goToFamilies();
                    else if (tab.key === 'categories') goToCategories();
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    level === tab.key
                      ? 'bg-white text-red-600 shadow-sm'
                      : tab.disabled
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-500 hover:text-gray-800 cursor-pointer'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Status filter */}
            <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
              {[{ v: 'all', l: 'Tous' }, { v: 'active', l: 'Actif' }, { v: 'inactive', l: 'Inactif' }].map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => setStatusFilter(opt.v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${statusFilter === opt.v ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                >
                  {opt.l}
                </button>
              ))}
            </div>

            {/* Search */}
            <form
              onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); }}
              className="flex items-center gap-2 flex-1 min-w-0 max-w-sm"
            >
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Rechercher par nom, code…"
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
                />
              </div>
              <button type="submit" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-xl transition-colors flex-shrink-0">
                Filtrer
              </button>
              {search && (
                <button
                  type="button"
                  onClick={() => { setSearch(''); setSearchInput(''); }}
                  className="px-3 py-2 border border-gray-200 text-gray-500 text-sm rounded-xl hover:bg-gray-50 flex-shrink-0"
                >
                  ✕
                </button>
              )}
            </form>

            <span className="text-xs text-gray-400 ml-auto">
              {filtered.length} élément{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" />
              <p className="text-sm text-gray-400">Chargement…</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-20 h-20 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
              <svg className="w-10 h-10 text-red-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-gray-600 font-semibold">Aucun élément</p>
              <p className="text-gray-400 text-sm mt-1">
                {search
                  ? `Aucun résultat pour « ${search} »`
                  : hasPermission(lc.createPerm)
                  ? 'Cliquez sur « Ajouter » pour créer le premier.'
                  : 'Aucun élément disponible.'}
              </p>
            </div>
            {!search && hasPermission(lc.createPerm) && (
              <button
                onClick={() => setDrawer({ editItem: null })}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                + Créer le premier
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((item) => (
              <TaxonomyCard
                key={item.id}
                item={item}
                childLabel={lc.childLabel}
                childCount={
                  level === 'families'
                    ? (catCounts[item.id] ?? 0)
                    : level === 'categories'
                    ? (subCounts[item.id] ?? 0)
                    : null
                }
                clickable={level !== 'sub-categories'}
                onClick={() => {
                  if (level === 'families') drillFamily(item);
                  else if (level === 'categories') drillCategory(item);
                }}
                onEdit={(it) => setDrawer({ editItem: it })}
                onDelete={(it) => setDeleting(it)}
              />
            ))}

            {/* Add new card */}
            {hasPermission(lc.createPerm) && (
              <button
                onClick={() => setDrawer({ editItem: null })}
                className="rounded-2xl border-2 border-dashed border-red-200 hover:border-red-400 bg-white hover:bg-red-50 transition-all flex flex-col items-center justify-center gap-3 p-8 text-red-400 hover:text-red-600 min-h-[160px]"
              >
                <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <span className="text-sm font-semibold">Ajouter</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
