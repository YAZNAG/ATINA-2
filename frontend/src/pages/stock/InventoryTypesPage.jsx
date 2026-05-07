import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getInventoryTypes, createInventoryType, updateInventoryType, deleteInventoryType } from '../../api/stock.api';
import { getErrorMessage } from '../../utils/helpers';

const SVG = {
  plus:      'M12 4v16m8-8H4',
  edit:      'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  trash:     'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  search:    'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  x:         'M6 18L18 6M6 6l12 12',
  clipboard: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  up:        'M5 15l7-7 7 7',
  down:      'M19 9l-7 7-7-7',
};

function Icon({ d, className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
    </svg>
  );
}

const PRESET_COLORS = [
  { label: 'Rouge',    color: '#ef4444' },
  { label: 'Orange',   color: '#f97316' },
  { label: 'Ambre',    color: '#f59e0b' },
  { label: 'Vert',     color: '#10b981' },
  { label: 'Bleu',     color: '#3b82f6' },
  { label: 'Indigo',   color: '#6366f1' },
  { label: 'Violet',   color: '#8b5cf6' },
  { label: 'Rose',     color: '#ec4899' },
];

// ── Card ──────────────────────────────────────────────────────────────────────

function InventoryTypeCard({ item, onEdit, onDelete, onMoveUp, onMoveDown, isFirst, isLast }) {
  const color = item.color || '#6366f1';
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-red-100 transition-all flex flex-col">
      <div className="flex-1 p-5">
        <div className="flex items-start gap-4 mb-3">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm"
            style={{ background: `linear-gradient(135deg, ${color}bb, ${color})` }}>
            <Icon d={SVG.clipboard} className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-sm leading-tight">{item.name_fr}</h3>
            {item.name_ar && (
              <p className="text-xs text-gray-400 mt-0.5 truncate" dir="rtl">{item.name_ar}</p>
            )}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[11px] font-mono rounded-md border border-gray-200">
                {item.code}
              </span>
              {!item.is_active && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-600">Inactif</span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <button onClick={onMoveUp} disabled={isFirst}
              className="w-6 h-6 rounded-md bg-gray-100 hover:bg-gray-200 flex items-center justify-center disabled:opacity-30 transition-colors">
              <Icon d={SVG.up} className="w-3 h-3 text-gray-600" />
            </button>
            <span className="text-[10px] font-bold text-gray-400 tabular-nums">{item.sort_order}</span>
            <button onClick={onMoveDown} disabled={isLast}
              className="w-6 h-6 rounded-md bg-gray-100 hover:bg-gray-200 flex items-center justify-center disabled:opacity-30 transition-colors">
              <Icon d={SVG.down} className="w-3 h-3 text-gray-600" />
            </button>
          </div>
        </div>
        {item.description_fr && (
          <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">{item.description_fr}</p>
        )}
      </div>
      <div className="flex items-center gap-1.5 px-4 pb-4 pt-3 border-t border-gray-50">
        <button onClick={() => onEdit(item)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors">
          <Icon d={SVG.edit} className="w-3.5 h-3.5" />Modifier
        </button>
        <button onClick={() => onDelete(item)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg ml-auto transition-colors">
          <Icon d={SVG.trash} className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Delete Modal ──────────────────────────────────────────────────────────────

function DeleteModal({ item, onCancel, onConfirm, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <Icon d={SVG.trash} className="w-7 h-7 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 text-center mb-1">Confirmer la suppression</h3>
        <p className="text-sm text-gray-500 text-center mb-6">
          Le type <span className="font-semibold text-gray-700">«{item?.name_fr}»</span> sera supprimé définitivement.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50">Annuler</button>
          <button onClick={onConfirm} disabled={loading} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
            {loading ? 'Suppression…' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Drawer ────────────────────────────────────────────────────────────────────

const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-300';
const ta  = `${inp} resize-none`;

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

const EMPTY = { code: '', name_fr: '', name_ar: '', color: '#6366f1', description_fr: '', is_active: true, sort_order: 0 };

function InventoryTypeDrawer({ editItem, onClose, onSaved }) {
  const isEdit = !!editItem;
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(editItem ? {
      code:           editItem.code           ?? '',
      name_fr:        editItem.name_fr        ?? '',
      name_ar:        editItem.name_ar        ?? '',
      color:          editItem.color          ?? '#6366f1',
      description_fr: editItem.description_fr ?? '',
      is_active:      editItem.is_active      ?? true,
      sort_order:     editItem.sort_order     ?? 0,
    } : { ...EMPTY });
  }, [editItem]);

  const hc = (e) => { const { name, value } = e.target; setForm((f) => ({ ...f, [name]: value })); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.code.trim())    return toast.error('Code requis');
    if (!form.name_fr.trim()) return toast.error('Nom (FR) requis');
    setSaving(true);
    try {
      if (isEdit) await updateInventoryType(editItem.id, form);
      else        await createInventoryType(form);
      toast.success(isEdit ? "Type d'inventaire mis à jour" : "Type d'inventaire créé");
      onSaved();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-40 flex flex-col bg-white shadow-2xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-red-700 to-red-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Icon d={SVG.clipboard} className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-white/60 text-[11px] font-semibold uppercase tracking-widest">{isEdit ? 'Modifier' : 'Nouveau'}</p>
              <h2 className="text-white font-bold text-xl">Type d'inventaire</h2>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/25 flex items-center justify-center">
            <Icon d={SVG.x} className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Form */}
        <form id="inv-type-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">

          <div className="grid grid-cols-2 gap-3">
            <Fld label="Code" req>
              <input name="code" className={`${inp} uppercase font-mono`} value={form.code}
                onChange={(e) => hc({ target: { name: 'code', value: e.target.value.toUpperCase() } })}
                placeholder="INV_GLOBAL" />
            </Fld>
            <Fld label="Ordre">
              <input name="sort_order" type="number" min="0" className={inp}
                value={form.sort_order} onChange={hc} placeholder="0" />
            </Fld>
          </div>

          <Fld label="Nom (Français)" req>
            <input name="name_fr" className={inp} value={form.name_fr} onChange={hc}
              placeholder="Inventaire global" />
          </Fld>

          <Fld label="Nom (Arabe)">
            <input name="name_ar" className={inp} value={form.name_ar} onChange={hc}
              dir="rtl" placeholder="جرد شامل" />
          </Fld>

          <Fld label="Description">
            <textarea name="description_fr" className={ta} rows={2} value={form.description_fr}
              onChange={hc} placeholder="Description optionnelle…" />
          </Fld>

          {/* Couleur */}
          <Fld label="Couleur">
            <div className="flex items-center gap-3">
              <input type="color" name="color" value={form.color} onChange={hc}
                className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5" />
              <input name="color" className={`${inp} flex-1 font-mono uppercase`} value={form.color}
                onChange={hc} maxLength={7} placeholder="#6366F1" />
              <div className="w-10 h-10 rounded-xl border border-gray-200 flex-shrink-0" style={{ background: form.color }} />
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {PRESET_COLORS.map(({ label, color }) => (
                <button key={color} type="button" onClick={() => setForm((f) => ({ ...f, color }))}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-semibold transition-colors ${
                    form.color === color ? 'border-gray-400 bg-gray-50' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <span className="w-3 h-3 rounded-full" style={{ background: color }} />
                  {label}
                </button>
              ))}
            </div>
          </Fld>

          {/* Actif toggle */}
          <div className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
            form.is_active ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${form.is_active ? 'bg-red-100' : 'bg-gray-200'}`}>
                <Icon d={SVG.clipboard} className={`w-5 h-5 ${form.is_active ? 'text-red-600' : 'text-gray-400'}`} />
              </div>
              <div>
                <p className={`text-sm font-semibold ${form.is_active ? 'text-red-800' : 'text-gray-600'}`}>Type actif</p>
                <p className="text-xs text-gray-400">Disponible pour créer des inventaires</p>
              </div>
            </div>
            <div onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
              className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0 ${form.is_active ? 'bg-red-600' : 'bg-gray-300'}`}>
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.is_active ? 'translate-x-5' : ''}`} />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-100">Annuler</button>
          <button type="submit" form="inv-type-form" disabled={saving}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl disabled:opacity-50">
            {saving ? 'Enregistrement…' : isEdit ? 'Mettre à jour' : 'Créer'}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function InventoryTypesPage() {
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [drawer, setDrawer]     = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [filter, setFilter]           = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch]           = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getInventoryTypes({ limit: 500 });
      setItems(res.data.data ?? []);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      await deleteInventoryType(deleting.id);
      toast.success("Type d'inventaire supprimé");
      setDeleting(null);
      load();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setDeleteLoading(false); }
  };

  const swap = async (item, dir) => {
    const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order || a.name_fr.localeCompare(b.name_fr));
    const idx = sorted.findIndex((i) => i.id === item.id);
    const neighbor = sorted[idx + dir];
    if (!neighbor) return;
    try {
      await Promise.all([
        updateInventoryType(item.id,     { sort_order: neighbor.sort_order }),
        updateInventoryType(neighbor.id, { sort_order: item.sort_order }),
      ]);
      await load();
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  const q = search.toLowerCase();
  const filtered = items.filter((item) => {
    if (filter === 'active'   && !item.is_active) return false;
    if (filter === 'inactive' &&  item.is_active) return false;
    if (q && !(item.name_fr ?? '').toLowerCase().includes(q) && !(item.code ?? '').toLowerCase().includes(q)) return false;
    return true;
  });
  const sorted = [...filtered].sort((a, b) => a.sort_order - b.sort_order || a.name_fr.localeCompare(b.name_fr));

  const stats = [
    { label: 'Total',    value: items.length,                             color: 'bg-gray-50 border-gray-100 text-gray-700' },
    { label: 'Actifs',   value: items.filter((i) => i.is_active).length,  color: 'bg-emerald-50 border-emerald-100 text-emerald-700' },
    { label: 'Inactifs', value: items.filter((i) => !i.is_active).length, color: 'bg-red-50 border-red-100 text-red-600' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {deleting && (
        <DeleteModal item={deleting} onCancel={() => setDeleting(null)} onConfirm={handleDelete} loading={deleteLoading} />
      )}
      {drawer && (
        <InventoryTypeDrawer
          editItem={drawer.editItem ?? null}
          onClose={() => setDrawer(null)}
          onSaved={() => { setDrawer(null); load(); }}
        />
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Types d'inventaire</h1>
              <p className="text-sm text-gray-400 mt-0.5">Global, tournant, flash, partiel…</p>
            </div>
            <button onClick={() => setDrawer({ editItem: null })}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all flex-shrink-0">
              <Icon d={SVG.plus} className="w-4 h-4" />Nouveau type
            </button>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
              {[{ v: 'all', l: 'Tous' }, { v: 'active', l: 'Actifs' }, { v: 'inactive', l: 'Inactifs' }].map((o) => (
                <button key={o.v} onClick={() => setFilter(o.v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    filter === o.v ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                  }`}>
                  {o.l}
                </button>
              ))}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); }}
              className="flex items-center gap-2 max-w-xs">
              <div className="relative">
                <Icon d={SVG.search} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Rechercher…"
                  className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 bg-white w-48" />
              </div>
              <button type="submit" className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-xl">OK</button>
              {search && (
                <button type="button" onClick={() => { setSearch(''); setSearchInput(''); }}
                  className="px-2 py-2 border border-gray-200 text-gray-500 text-sm rounded-xl hover:bg-gray-50">✕</button>
              )}
            </form>
            <span className="text-xs text-gray-400 ml-auto">{sorted.length} type{sorted.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      {items.length > 0 && (
        <div className="px-6 pt-4 pb-0">
          <div className="grid grid-cols-3 gap-3">
            {stats.map((s) => (
              <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.color}`}>
                <p className="text-xs font-semibold opacity-70 uppercase tracking-wide">{s.label}</p>
                <p className="text-2xl font-bold mt-0.5">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="px-6 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" />
            <p className="text-sm text-gray-400">Chargement…</p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center bg-red-50 border border-red-100">
              <Icon d={SVG.clipboard} className="w-10 h-10 text-red-200" />
            </div>
            <div className="text-center">
              <p className="text-gray-600 font-semibold">Aucun type d'inventaire</p>
              <p className="text-gray-400 text-sm mt-1">
                {search || filter !== 'all' ? 'Modifiez vos filtres.' : "Cliquez sur « Nouveau type » pour commencer."}
              </p>
            </div>
            {!search && filter === 'all' && (
              <button onClick={() => setDrawer({ editItem: null })}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl">
                + Créer le premier type
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sorted.map((item, idx) => (
              <InventoryTypeCard
                key={item.id}
                item={item}
                isFirst={idx === 0}
                isLast={idx === sorted.length - 1}
                onEdit={(i) => setDrawer({ editItem: i })}
                onDelete={(i) => setDeleting(i)}
                onMoveUp={()  => swap(item, -1)}
                onMoveDown={() => swap(item,  1)}
              />
            ))}
            <button onClick={() => setDrawer({ editItem: null })}
              className="rounded-2xl border-2 border-dashed border-red-200 hover:border-red-400 bg-white hover:bg-red-50 text-red-400 hover:text-red-600 transition-all flex flex-col items-center justify-center gap-3 p-8 min-h-[160px]">
              <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                <Icon d={SVG.plus} className="w-6 h-6 text-red-500" />
              </div>
              <span className="text-sm font-semibold">Ajouter un type</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
