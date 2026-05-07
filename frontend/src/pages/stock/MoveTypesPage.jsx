import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getMoveTypes, createMoveType, updateMoveType, deleteMoveType } from '../../api/stock.api';
import { getErrorMessage } from '../../utils/helpers';

// ── Icons ─────────────────────────────────────────────────────────────────────

const SVG = {
  plus:   'M12 4v16m8-8H4',
  edit:   'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  trash:  'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  move:   'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
  x:      'M6 18L18 6M6 6l12 12',
  arrowIn:  'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12',
  arrowOut: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4',
  swap:     'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
};

function Icon({ d, className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
    </svg>
  );
}

// ── Operation config ──────────────────────────────────────────────────────────

const OPERATIONS = [
  {
    code: 'IN',
    label_fr: 'Entrée',
    label_ar: 'دخول',
    desc: 'Réception, retour, transfert entrant',
    icon: SVG.arrowIn,
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-700',
    dot: 'bg-emerald-500',
    defaultColor: '#10b981',
  },
  {
    code: 'OUT',
    label_fr: 'Sortie',
    label_ar: 'خروج',
    desc: 'Vente, perte, transfert sortant',
    icon: SVG.arrowOut,
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    badge: 'bg-red-100 text-red-700',
    dot: 'bg-red-500',
    defaultColor: '#ef4444',
  },
  {
    code: 'ADJ',
    label_fr: 'Ajustement',
    label_ar: 'تسوية',
    desc: 'Ajustement positif / négatif, inventaire',
    icon: SVG.swap,
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    text: 'text-slate-600',
    badge: 'bg-slate-100 text-slate-600',
    dot: 'bg-slate-400',
    defaultColor: '#64748b',
  },
  {
    code: 'TRF',
    label_fr: 'Transfert',
    label_ar: 'نقل',
    desc: 'Transfert inter-entrepôts',
    icon: SVG.move,
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    text: 'text-violet-700',
    badge: 'bg-violet-100 text-violet-700',
    dot: 'bg-violet-500',
    defaultColor: '#8b5cf6',
  },
];

const opMap = Object.fromEntries(OPERATIONS.map((o) => [o.code, o]));

const PRESET_COLORS = [
  { label: 'Réception', color: '#10b981' },
  { label: 'Vente',     color: '#ef4444' },
  { label: 'Retour',    color: '#3b82f6' },
  { label: 'Transfert', color: '#f59e0b' },
  { label: 'Perte',     color: '#dc2626' },
  { label: 'Ajust.',    color: '#8b5cf6' },
  { label: 'Flash',     color: '#ec4899' },
  { label: 'Neutre',    color: '#64748b' },
];

// ── OperationBadge ────────────────────────────────────────────────────────────

function OperationBadge({ code, small }) {
  const op = opMap[code];
  if (!op) return <span className="text-xs text-gray-400">{code}</span>;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold ${op.badge} ${small ? 'text-[10px]' : 'text-xs'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${op.dot}`} />
      {op.label_fr}
    </span>
  );
}

// ── MoveType Card ─────────────────────────────────────────────────────────────

function MoveTypeCard({ item, onEdit, onDelete }) {
  const color = item.color || opMap[item.operation]?.defaultColor || '#64748b';
  const op = opMap[item.operation];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-red-100 transition-all flex flex-col">
      <div className="flex-1 p-5">
        <div className="flex items-start gap-4 mb-3">
          {/* Color icon */}
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm"
            style={{ background: `linear-gradient(135deg, ${color}bb, ${color})` }}>
            <Icon d={op?.icon ?? SVG.move} className="w-7 h-7 text-white" />
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
              <OperationBadge code={item.operation} small />
            </div>
          </div>
        </div>
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
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50">
            Annuler
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
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

const EMPTY = { code: '', name_fr: '', name_ar: '', operation: 'IN', color: '#10b981' };

function MoveTypeDrawer({ editItem, onClose, onSaved }) {
  const isEdit = !!editItem;
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editItem) {
      setForm({
        code: editItem.code ?? '',
        name_fr: editItem.name_fr ?? '',
        name_ar: editItem.name_ar ?? '',
        operation: editItem.operation ?? 'IN',
        color: editItem.color ?? opMap[editItem.operation]?.defaultColor ?? '#10b981',
      });
    } else {
      setForm({ ...EMPTY });
    }
  }, [editItem]);

  const hc = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const setOperation = (op) => {
    setForm((f) => ({
      ...f,
      operation: op,
      color: f.color === opMap[f.operation]?.defaultColor
        ? opMap[op]?.defaultColor ?? f.color
        : f.color,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.code.trim()) return toast.error('Code requis');
    if (!form.name_fr.trim()) return toast.error('Nom (FR) requis');
    if (!form.operation) return toast.error('Opération requise');
    setSaving(true);
    try {
      if (isEdit) await updateMoveType(editItem.id, form);
      else        await createMoveType(form);
      toast.success(isEdit ? 'Type mis à jour' : 'Type de mouvement créé');
      onSaved();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  const activeOp = opMap[form.operation];

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-40 flex flex-col bg-white shadow-2xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-red-700 to-red-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Icon d={SVG.move} className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-white/60 text-[11px] font-semibold uppercase tracking-widest">
                {isEdit ? 'Modifier' : 'Nouveau'}
              </p>
              <h2 className="text-white font-bold text-xl">Type de mouvement</h2>
            </div>
          </div>
          <button onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/25 flex items-center justify-center">
            <Icon d={SVG.x} className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Form */}
        <form id="move-type-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">

          <div className="grid grid-cols-2 gap-3">
            <Fld label="Code" req>
              <input name="code" className={`${inp} uppercase font-mono`} value={form.code}
                onChange={(e) => hc({ target: { name: 'code', value: e.target.value.toUpperCase() } })}
                placeholder="RECEIPT" />
            </Fld>
            <Fld label="Opération" req>
              <div className="flex flex-col gap-1.5">
                {OPERATIONS.map((op) => (
                  <button key={op.code} type="button" onClick={() => setOperation(op.code)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                      form.operation === op.code
                        ? `${op.bg} ${op.border} ${op.text} shadow-sm`
                        : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                    }`}>
                    <Icon d={op.icon} className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{op.label_fr}</span>
                    <span className="text-gray-400 font-normal ml-auto hidden sm:inline">{op.code}</span>
                  </button>
                ))}
              </div>
            </Fld>
          </div>

          {/* Operation info banner */}
          {activeOp && (
            <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs ${activeOp.bg} ${activeOp.border}`}>
              <Icon d={activeOp.icon} className={`w-4 h-4 flex-shrink-0 ${activeOp.text}`} />
              <span className={`font-medium ${activeOp.text}`}>{activeOp.desc}</span>
              <span className={`ml-auto text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${activeOp.badge}`}>
                {activeOp.label_ar}
              </span>
            </div>
          )}

          <Fld label="Nom (Français)" req>
            <input name="name_fr" className={inp} value={form.name_fr} onChange={hc} placeholder="Réception marchandise" />
          </Fld>

          <Fld label="Nom (Arabe)">
            <input name="name_ar" className={inp} value={form.name_ar} onChange={hc} dir="rtl" placeholder="استلام البضائع" />
          </Fld>

          <Fld label="Couleur">
            <div className="flex items-center gap-3">
              <input type="color" name="color" value={form.color} onChange={hc}
                className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5" />
              <input name="color" className={`${inp} flex-1 font-mono uppercase`} value={form.color}
                onChange={hc} maxLength={7} placeholder="#10B981" />
              <div className="w-10 h-10 rounded-xl border border-gray-200 flex-shrink-0"
                style={{ background: form.color }} />
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {PRESET_COLORS.map(({ label, color }) => (
                <button key={color} type="button"
                  onClick={() => setForm((f) => ({ ...f, color }))}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-semibold transition-colors ${
                    form.color === color ? 'border-gray-400 bg-gray-50' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <span className="w-3 h-3 rounded-full" style={{ background: color }} />
                  {label}
                </button>
              ))}
            </div>
          </Fld>
        </form>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-100">
            Annuler
          </button>
          <button type="submit" form="move-type-form" disabled={saving}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl disabled:opacity-50">
            {saving ? 'Enregistrement…' : isEdit ? 'Mettre à jour' : 'Créer'}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MoveTypesPage() {

  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [drawer, setDrawer]     = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [opFilter, setOpFilter]     = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch]           = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMoveTypes({ limit: 500 });
      setItems(res.data.data ?? []);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      await deleteMoveType(deleting.id);
      toast.success('Type de mouvement supprimé');
      setDeleting(null);
      load();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setDeleteLoading(false); }
  };

  const q = search.toLowerCase();
  const filtered = items.filter((item) => {
    if (opFilter !== 'all' && item.operation !== opFilter) return false;
    if (q && !(item.name_fr ?? '').toLowerCase().includes(q) && !(item.code ?? '').toLowerCase().includes(q)) return false;
    return true;
  });

  const stats = [
    { label: 'Total',       value: items.length,                                              color: 'bg-gray-50 border-gray-100 text-gray-700' },
    { label: 'Entrées',     value: items.filter((i) => i.operation === 'IN').length,          color: 'bg-emerald-50 border-emerald-100 text-emerald-700' },
    { label: 'Sorties',     value: items.filter((i) => i.operation === 'OUT').length,         color: 'bg-red-50 border-red-100 text-red-700' },
    { label: 'Ajustements', value: items.filter((i) => i.operation === 'ADJ').length,         color: 'bg-slate-50 border-slate-100 text-slate-600' },
    { label: 'Transferts',  value: items.filter((i) => i.operation === 'TRF').length,         color: 'bg-violet-50 border-violet-100 text-violet-700' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {deleting && (
        <DeleteModal
          item={deleting}
          onCancel={() => setDeleting(null)}
          onConfirm={handleDelete}
          loading={deleteLoading}
        />
      )}
      {drawer && (
        <MoveTypeDrawer
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
              <h1 className="text-2xl font-bold text-gray-900">Types de mouvement</h1>
              <p className="text-sm text-gray-400 mt-0.5">
                Entrée, sortie, ajustement, transfert…
              </p>
            </div>
            <button onClick={() => setDrawer({ editItem: null })}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all flex-shrink-0">
              <Icon d={SVG.plus} className="w-4 h-4" />Nouveau type
            </button>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Operation filter */}
            <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
              {[{ v: 'all', l: 'Tous' }, ...OPERATIONS.map((o) => ({ v: o.code, l: o.label_fr }))].map((o) => (
                <button key={o.v} onClick={() => setOpFilter(o.v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    opFilter === o.v ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                  }`}>
                  {o.l}
                </button>
              ))}
            </div>

            {/* Search */}
            <form onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); }}
              className="flex items-center gap-2 flex-1 min-w-0 max-w-xs">
              <div className="relative flex-1">
                <Icon d={SVG.search} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Rechercher…"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 bg-white" />
              </div>
              <button type="submit"
                className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-xl">OK</button>
              {search && (
                <button type="button" onClick={() => { setSearch(''); setSearchInput(''); }}
                  className="px-2 py-2 border border-gray-200 text-gray-500 text-sm rounded-xl hover:bg-gray-50">✕</button>
              )}
            </form>
            <span className="text-xs text-gray-400 ml-auto">
              {filtered.length} type{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      {items.length > 0 && (
        <div className="px-6 pt-4 pb-0">
          <div className="grid grid-cols-5 gap-3">
            {stats.map((s) => (
              <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.color}`}>
                <p className="text-xs font-semibold opacity-70 uppercase tracking-wide">{s.label}</p>
                <p className="text-2xl font-bold mt-0.5">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Operation legend */}
      <div className="px-6 pt-4 pb-0">
        <div className="flex gap-2 flex-wrap">
          {OPERATIONS.map((op) => (
            <div key={op.code}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs ${op.bg} ${op.border}`}>
              <Icon d={op.icon} className={`w-3.5 h-3.5 ${op.text}`} />
              <span className={`font-semibold ${op.text}`}>{op.label_fr}</span>
              <span className="text-gray-400">—</span>
              <span className="text-gray-500">{op.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="px-6 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" />
            <p className="text-sm text-gray-400">Chargement…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center bg-red-50 border border-red-100">
              <Icon d={SVG.move} className="w-10 h-10 text-red-200" />
            </div>
            <div className="text-center">
              <p className="text-gray-600 font-semibold">Aucun type de mouvement</p>
              <p className="text-gray-400 text-sm mt-1">
                {search || opFilter !== 'all'
                  ? 'Modifiez vos filtres.'
                  : 'Cliquez sur « Nouveau type » pour commencer.'}
              </p>
            </div>
            {!search && opFilter === 'all' && (
              <button onClick={() => setDrawer({ editItem: null })}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl">
                + Créer le premier type
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((item) => (
              <MoveTypeCard
                key={item.id}
                item={item}
                onEdit={(i) => setDrawer({ editItem: i })}
                onDelete={(i) => setDeleting(i)}
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
