import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { getLevels, createLevel, updateLevel, deleteLevel } from '../../api/warehouse.api';
import { getErrorMessage } from '../../utils/helpers';

// ── Icons ─────────────────────────────────────────────────────────────────────

const SVG = {
  plus:    'M12 4v16m8-8H4',
  edit:    'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  trash:   'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  search:  'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  level:   'M3 9h18M3 15h18M9 3v18',
  x:       'M6 18L18 6M6 6l12 12',
  sort:    'M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4',
};

function Icon({ d, className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
    </svg>
  );
}

function StatusBadge({ active }) {
  return active ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Actif
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-500">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />Inactif
    </span>
  );
}

// ── Level Card ────────────────────────────────────────────────────────────────

function LevelCard({ level, onEdit, onDelete }) {
  const gradients = ['from-red-600 to-red-500','from-rose-600 to-rose-500','from-pink-600 to-pink-500','from-orange-500 to-orange-400','from-amber-500 to-amber-400'];
  const gradient = gradients[(level.sort_order ?? 0) % gradients.length];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-red-100 transition-all flex flex-col">
      <div className="flex-1 p-5">
        <div className="flex items-start gap-4 mb-3">
          <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0 shadow-sm`}>
            {level.sort_order != null
              ? <span className="text-2xl font-black text-white">{level.sort_order}</span>
              : <Icon d={SVG.level} className="w-7 h-7 text-white" />}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-sm leading-tight">{level.name_fr}</h3>
            {level.name_ar && <p className="text-xs text-gray-400 mt-0.5 truncate" dir="rtl">{level.name_ar}</p>}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[11px] font-mono rounded-md border border-gray-200">{level.code}</span>
              <StatusBadge active={level.is_active} />
            </div>
          </div>
        </div>
        {level.sort_order != null && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-1">
            <Icon d={SVG.sort} className="w-3.5 h-3.5 text-gray-300" />
            <span>Ordre d'affichage : <span className="font-semibold text-gray-600">#{level.sort_order}</span></span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 px-4 pb-4 pt-3 border-t border-gray-50">
        <button onClick={() => onEdit(level)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg">
          <Icon d={SVG.edit} className="w-3.5 h-3.5" />Modifier
        </button>
        <button onClick={() => onDelete(level)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg ml-auto">
          <Icon d={SVG.trash} className="w-3.5 h-3.5" />Supprimer
        </button>
      </div>
    </div>
  );
}

// ── Delete modal ──────────────────────────────────────────────────────────────

function DeleteModal({ item, onCancel, onConfirm, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <Icon d={SVG.trash} className="w-7 h-7 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 text-center mb-1">Confirmer la suppression</h3>
        <p className="text-sm text-gray-500 text-center mb-6">
          Le niveau <span className="font-semibold text-gray-700">«{item?.name_fr}»</span> sera supprimé définitivement.
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

const EMPTY = { code: '', name_fr: '', name_ar: '', sort_order: '', is_active: true };

function LevelDrawer({ editLevel, onClose, onSaved }) {
  const isEdit = !!editLevel;
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(editLevel
      ? { code: editLevel.code ?? '', name_fr: editLevel.name_fr ?? '', name_ar: editLevel.name_ar ?? '',
          sort_order: editLevel.sort_order != null ? String(editLevel.sort_order) : '', is_active: editLevel.is_active ?? true }
      : { ...EMPTY });
  }, [editLevel]);

  const hc = (e) => { const { name, value } = e.target; setForm((f) => ({ ...f, [name]: value })); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.code.trim()) return toast.error('Code requis');
    if (!form.name_fr.trim()) return toast.error('Nom FR requis');
    setSaving(true);
    try {
      const payload = { ...form, sort_order: form.sort_order !== '' ? Number(form.sort_order) : undefined };
      if (isEdit) await updateLevel(editLevel.id, payload);
      else        await createLevel(payload);
      toast.success(isEdit ? 'Niveau mis à jour' : 'Niveau créé');
      onSaved();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-40 flex flex-col bg-white shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-red-700 to-red-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Icon d={SVG.level} className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-white/60 text-[11px] font-semibold uppercase tracking-widest">{isEdit ? 'Modifier' : 'Nouveau'}</p>
              <h2 className="text-white font-bold text-xl">Niveau de rayonnage</h2>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/25 flex items-center justify-center">
            <Icon d={SVG.x} className="w-5 h-5 text-white" />
          </button>
        </div>

        <form id="level-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Fld label="Code" req>
              <input name="code" className={`${inp} lowercase`} value={form.code}
                onChange={(e) => hc({ target: { name: 'code', value: e.target.value.toLowerCase() } })}
                required placeholder="top" />
            </Fld>
            <Fld label="Ordre d'affichage">
              <input name="sort_order" type="number" min={0} className={inp} value={form.sort_order} onChange={hc} placeholder="1" />
            </Fld>
          </div>

          <Fld label="Statut">
            <label className="flex items-center gap-3 cursor-pointer">
              <div onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
                className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${form.is_active ? 'bg-red-600' : 'bg-gray-200'}`}>
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.is_active ? 'translate-x-5' : ''}`} />
              </div>
              <span className={`text-sm font-semibold ${form.is_active ? 'text-red-600' : 'text-gray-400'}`}>{form.is_active ? 'Actif' : 'Inactif'}</span>
            </label>
          </Fld>

          <Fld label="Nom (Français)" req>
            <input name="name_fr" className={inp} value={form.name_fr} onChange={hc} required placeholder="Haut" />
          </Fld>
          <Fld label="Nom (Arabe)">
            <input name="name_ar" className={inp} value={form.name_ar} onChange={hc} dir="rtl" placeholder="أعلى" />
          </Fld>
        </form>

        <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-100">Annuler</button>
          <button type="submit" form="level-form" disabled={saving} className="flex-1 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl disabled:opacity-50">
            {saving ? 'Enregistrement…' : isEdit ? 'Mettre à jour' : 'Créer'}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function LevelsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('warehouse.manage');

  const [levels, setLevels]     = useState([]);
  const [loading, setLoading]   = useState(false);
  const [drawer, setDrawer]     = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [statusFilter, setStatusFilter]   = useState('all');
  const [searchInput, setSearchInput]     = useState('');
  const [search, setSearch]               = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getLevels({ limit: 500 });
      setLevels(res.data.data ?? []);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      await deleteLevel(deleting.id);
      toast.success('Niveau supprimé');
      setDeleting(null);
      load();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setDeleteLoading(false); }
  };

  const q = search.toLowerCase();
  const filtered = [...levels]
    .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999))
    .filter((l) => {
      if (statusFilter === 'active'   && !l.is_active) return false;
      if (statusFilter === 'inactive' &&  l.is_active) return false;
      if (q && !(l.name_fr ?? '').toLowerCase().includes(q) && !(l.code ?? '').toLowerCase().includes(q)) return false;
      return true;
    });

  return (
    <div className="min-h-screen bg-gray-50">
      {deleting && <DeleteModal item={deleting} onCancel={() => setDeleting(null)} onConfirm={handleDelete} loading={deleteLoading} />}
      {drawer && <LevelDrawer editLevel={drawer.editLevel ?? null} onClose={() => setDrawer(null)} onSaved={() => { setDrawer(null); load(); }} />}

      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Niveaux de rayonnage</h1>
              <p className="text-sm text-gray-400 mt-0.5">Haut, milieu, bas… définit la position verticale des emplacements</p>
            </div>
            {canManage && (
              <button onClick={() => setDrawer({ editLevel: null })}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all flex-shrink-0">
                <Icon d={SVG.plus} className="w-4 h-4" />Nouveau niveau
              </button>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
              {[{ v: 'all', l: 'Tous' }, { v: 'active', l: 'Actif' }, { v: 'inactive', l: 'Inactif' }].map((o) => (
                <button key={o.v} onClick={() => setStatusFilter(o.v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${statusFilter === o.v ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
                  {o.l}
                </button>
              ))}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); }} className="flex items-center gap-2 flex-1 min-w-0 max-w-xs">
              <div className="relative flex-1">
                <Icon d={SVG.search} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Rechercher…"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 bg-white" />
              </div>
              <button type="submit" className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-xl">OK</button>
              {search && <button type="button" onClick={() => { setSearch(''); setSearchInput(''); }} className="px-2 py-2 border border-gray-200 text-gray-500 text-sm rounded-xl hover:bg-gray-50">✕</button>}
            </form>
            <span className="text-xs text-gray-400 ml-auto">{filtered.length} niveau{filtered.length !== 1 ? 'x' : ''}</span>
          </div>
        </div>
      </div>

      {levels.length > 0 && (
        <div className="px-6 pt-4 pb-0">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total niveaux', value: levels.length, color: 'bg-red-50 border-red-100 text-red-700' },
              { label: 'Actifs', value: levels.filter((l) => l.is_active).length, color: 'bg-emerald-50 border-emerald-100 text-emerald-700' },
              { label: 'Inactifs', value: levels.filter((l) => !l.is_active).length, color: 'bg-gray-50 border-gray-100 text-gray-600' },
            ].map((s) => (
              <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.color}`}>
                <p className="text-xs font-semibold opacity-70 uppercase tracking-wide">{s.label}</p>
                <p className="text-2xl font-bold mt-0.5">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="px-6 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" />
            <p className="text-sm text-gray-400">Chargement…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center bg-red-50 border border-red-100">
              <Icon d={SVG.level} className="w-10 h-10 text-red-200" />
            </div>
            <div className="text-center">
              <p className="text-gray-600 font-semibold">Aucun niveau</p>
              <p className="text-gray-400 text-sm mt-1">{search || statusFilter !== 'all' ? 'Modifiez vos filtres.' : 'Cliquez sur « Nouveau niveau » pour commencer.'}</p>
            </div>
            {!search && statusFilter === 'all' && canManage && (
              <button onClick={() => setDrawer({ editLevel: null })} className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl">+ Créer le premier niveau</button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((l) => (
              <LevelCard key={l.id} level={l} onEdit={(item) => setDrawer({ editLevel: item })} onDelete={(item) => setDeleting(item)} />
            ))}
            {canManage && (
              <button onClick={() => setDrawer({ editLevel: null })}
                className="rounded-2xl border-2 border-dashed border-red-200 hover:border-red-400 bg-white hover:bg-red-50 text-red-400 hover:text-red-600 transition-all flex flex-col items-center justify-center gap-3 p-8 min-h-[180px]">
                <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                  <Icon d={SVG.plus} className="w-6 h-6 text-red-500" />
                </div>
                <span className="text-sm font-semibold">Ajouter un niveau</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
