import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getOrderSlotStatuses, createOrderSlotStatus, updateOrderSlotStatus, deleteOrderSlotStatus, seedOrderSlotStatuses } from '../../api/orders.api';
import { getErrorMessage } from '../../utils/helpers';

const SVG = {
  plus:   'M12 4v16m8-8H4',
  edit:   'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  trash:  'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  x:      'M6 18L18 6M6 6l12 12',
  seed:   'M4 16s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z M4 12v4',
  slot:   'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
};

function Icon({ d, className = 'w-5 h-5' }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} /></svg>;
}

const PRESET_COLORS = [
  { label: 'Préféré',   color: '#3b82f6' },
  { label: 'Confirmé',  color: '#10b981' },
  { label: 'Refusé',    color: '#ef4444' },
  { label: 'Expiré',    color: '#64748b' },
  { label: 'Orange',    color: '#f97316' },
  { label: 'Violet',    color: '#8b5cf6' },
  { label: 'Cyan',      color: '#06b6d4' },
  { label: 'Jaune',     color: '#eab308' },
];

function hexColor(c) {
  if (!c) return '#64748b';
  if (c.startsWith('#')) return c;
  const map = { blue:'#3b82f6', green:'#10b981', red:'#ef4444', gray:'#64748b',
    orange:'#f97316', purple:'#8b5cf6', cyan:'#06b6d4', yellow:'#eab308', indigo:'#6366f1' };
  return map[c] ?? '#64748b';
}

function StatusBadge({ item }) {
  const hex = hexColor(item.color);
  return (
    <span style={{ backgroundColor: `${hex}18`, color: hex, border: `1px solid ${hex}40` }}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold">
      <span style={{ backgroundColor: hex }} className="w-1.5 h-1.5 rounded-full" />
      {item.code}
    </span>
  );
}

function DeleteModal({ item, onCancel, onConfirm, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <Icon d={SVG.trash} className="w-7 h-7 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 text-center mb-1">Confirmer la suppression</h3>
        <p className="text-sm text-gray-500 text-center mb-6">
          Le statut <span className="font-semibold text-gray-700">«{item?.name_fr}»</span> sera supprimé définitivement.
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

const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 placeholder-gray-300';

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

const EMPTY = { code: '', name_fr: '', name_ar: '', color: '#3b82f6' };

function Drawer({ editItem, onClose, onSaved }) {
  const isEdit = !!editItem;
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(editItem
      ? { code: editItem.code ?? '', name_fr: editItem.name_fr ?? '', name_ar: editItem.name_ar ?? '', color: hexColor(editItem.color) }
      : { ...EMPTY });
  }, [editItem]);

  const hc = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isEdit && !form.code.trim()) return toast.error('Code requis');
    if (!form.name_fr.trim()) return toast.error('Nom (FR) requis');
    if (!form.name_ar.trim()) return toast.error('Nom (AR) requis');
    setSaving(true);
    try {
      if (isEdit) await updateOrderSlotStatus(editItem.id, { name_fr: form.name_fr, name_ar: form.name_ar, color: form.color });
      else        await createOrderSlotStatus(form);
      toast.success(isEdit ? 'Statut mis à jour' : 'Statut créé');
      onSaved();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-40 flex flex-col bg-white shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-teal-700 to-teal-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Icon d={SVG.slot} className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-white/60 text-[11px] font-semibold uppercase tracking-widest">{isEdit ? 'Modifier' : 'Nouveau'}</p>
              <h2 className="text-white font-bold text-xl">Statut créneau</h2>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/25 flex items-center justify-center">
            <Icon d={SVG.x} className="w-5 h-5 text-white" />
          </button>
        </div>

        <form id="oss-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          <Fld label="Code" req>
            {isEdit ? (
              <div className="px-3 py-2.5 text-sm border border-gray-100 rounded-xl bg-gray-50 font-mono text-gray-500 flex items-center gap-2">
                <span style={{ backgroundColor: hexColor(form.color) }} className="w-2 h-2 rounded-full" />
                {form.code}
                <span className="ml-auto text-[11px] text-gray-400">Non modifiable</span>
              </div>
            ) : (
              <>
                <input name="code" className={`${inp} font-mono`} value={form.code}
                  onChange={(e) => hc({ target: { name: 'code', value: e.target.value.toLowerCase().replace(/\s+/g, '_') } })}
                  placeholder="preferred" />
                <p className="text-[11px] text-gray-400 mt-1">Minuscules, tirets bas</p>
              </>
            )}
          </Fld>

          <Fld label="Couleur">
            <div className="flex items-center gap-3">
              <input type="color" name="color" value={form.color} onChange={hc}
                className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5 flex-shrink-0" />
              <input name="color" className={`${inp} flex-1 font-mono uppercase`} value={form.color}
                onChange={hc} maxLength={7} placeholder="#3B82F6" />
              <div className="w-10 h-10 rounded-xl border border-gray-200 flex-shrink-0"
                style={{ background: form.color }} />
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

          <Fld label="Nom (Français)" req>
            <input name="name_fr" className={inp} value={form.name_fr} onChange={hc} placeholder="Préféré" />
          </Fld>
          <Fld label="Nom (Arabe)" req>
            <input name="name_ar" className={inp} value={form.name_ar} onChange={hc} dir="rtl" placeholder="مفضل" />
          </Fld>
        </form>

        <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-100">Annuler</button>
          <button type="submit" form="oss-form" disabled={saving} className="flex-1 py-2.5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl disabled:opacity-50">
            {saving ? 'Enregistrement…' : isEdit ? 'Mettre à jour' : 'Créer'}
          </button>
        </div>
      </div>
    </>
  );
}

const PAGE_SIZE = 20;

export default function OrderSlotStatusesPage() {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch]   = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage]       = useState(1);
  const [total, setTotal]     = useState(0);
  const [drawer, setDrawer]   = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getOrderSlotStatuses({ page, limit: PAGE_SIZE, ...(search && { search }) });
      setItems(res.data.data ?? []);
      setTotal(res.data.pagination?.total ?? 0);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    setDeleteLoading(true);
    try { await deleteOrderSlotStatus(deleting.id); toast.success('Statut supprimé'); setDeleting(null); load(); }
    catch (err) { toast.error(getErrorMessage(err)); }
    finally { setDeleteLoading(false); }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try { await seedOrderSlotStatuses(); toast.success('4 statuts seedés'); load(); }
    catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSeeding(false); }
  };

  const pages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-gray-50">
      {deleting && <DeleteModal item={deleting} onCancel={() => setDeleting(null)} onConfirm={handleDelete} loading={deleteLoading} />}
      {drawer !== null && <Drawer editItem={drawer} onClose={() => setDrawer(null)} onSaved={() => { setDrawer(null); load(); }} />}

      <div className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                <span>Paramétrage</span><span>›</span><span>Commandes</span><span>›</span>
                <span className="text-teal-600 font-medium">Statuts créneaux</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Statuts créneaux commande</h1>
              <p className="text-sm text-gray-400 mt-0.5">Statuts des créneaux de livraison — preferred → confirmed ou rejected/expired</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={handleSeed} disabled={seeding} className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl disabled:opacity-50">
                <Icon d={SVG.seed} className="w-4 h-4" />{seeding ? 'Seed…' : 'Seed'}
              </button>
              <button onClick={() => setDrawer(false)} className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm">
                <Icon d={SVG.plus} className="w-4 h-4" />Nouveau statut
              </button>
            </div>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); setPage(1); setSearch(searchInput); }} className="flex items-center gap-2 max-w-sm">
            <div className="relative flex-1">
              <Icon d={SVG.search} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Rechercher…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white" />
            </div>
            <button type="submit" className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-xl">OK</button>
            {search && <button type="button" onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }} className="px-2 py-2 border border-gray-200 text-gray-500 text-sm rounded-xl hover:bg-gray-50">✕</button>}
          </form>
        </div>
      </div>

      <div className="px-6 pt-5">
        <div className="flex flex-wrap gap-3">
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 min-w-[100px]">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total</p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5">{total}</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600" />
            <p className="text-sm text-gray-400">Chargement…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-20 h-20 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center">
              <Icon d={SVG.slot} className="w-10 h-10 text-teal-200" />
            </div>
            <div className="text-center">
              <p className="text-gray-600 font-semibold">Aucun statut créneau</p>
              <p className="text-gray-400 text-sm mt-1">{search ? 'Aucun résultat.' : 'Cliquez sur « Seed » pour initialiser.'}</p>
            </div>
            {!search && (
              <button onClick={handleSeed} disabled={seeding} className="px-5 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 disabled:opacity-50">
                <Icon d={SVG.seed} className="w-4 h-4 inline mr-1.5" />Seed (preferred, confirmed, rejected, expired)
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Code</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Nom français</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Nom arabe</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-5 py-3.5"><StatusBadge item={item} /></td>
                      <td className="px-5 py-3.5 font-semibold text-gray-900">{item.name_fr}</td>
                      <td className="px-5 py-3.5 text-gray-600" dir="rtl">{item.name_ar}</td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setDrawer(item)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg" title="Modifier">
                            <Icon d={SVG.edit} className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDeleting(item)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg" title="Supprimer">
                            <Icon d={SVG.trash} className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-gray-400">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} sur {total}</p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">← Précédent</button>
                  {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
                    <button key={p} onClick={() => setPage(p)} className={`px-3 py-1.5 text-xs rounded-lg border ${page === p ? 'bg-teal-600 text-white border-teal-600' : 'border-gray-200 hover:bg-gray-50'}`}>{p}</button>
                  ))}
                  <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">Suivant →</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
