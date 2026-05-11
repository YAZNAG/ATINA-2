import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getPickItemStatuses, createPickItemStatus, updatePickItemStatus, deletePickItemStatus, seedPickItemStatuses } from '../../api/picking.api';
import { getErrorMessage } from '../../utils/helpers';

const SVG = {
  plus:  'M12 4v16m8-8H4',
  edit:  'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  trash: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  seed:  'M4 16s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z M4 12v4',
  x:     'M6 18L18 6M6 6l12 12',
  item:  'M4 6h16M4 10h16M4 14h10M4 18h6',
};
function Icon({ d, className = 'w-5 h-5' }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} /></svg>;
}

const ITEM_COLORS = {
  pending:      { bg: 'bg-gray-100 text-gray-600',       dot: 'bg-gray-400'    },
  picked:       { bg: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  substituted:  { bg: 'bg-blue-100 text-blue-700',       dot: 'bg-blue-500'    },
  out_of_stock: { bg: 'bg-red-100 text-red-700',         dot: 'bg-red-500'     },
};
function ItemBadge({ code }) {
  const s = ITEM_COLORS[code] ?? { bg: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' };
  return <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.bg}`}><span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}/>{code}</span>;
}

const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-gray-300';
function Fld({ label, req, children }) {
  return <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}{req&&<span className="text-red-500 ml-1">*</span>}</label>{children}</div>;
}
const EMPTY = { code: '', name_fr: '', name_ar: '' };

function Drawer({ editItem, onClose, onSaved }) {
  const isEdit = !!editItem;
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  useEffect(() => { setForm(editItem ? { code: editItem.code ?? '', name_fr: editItem.name_fr ?? '', name_ar: editItem.name_ar ?? '' } : { ...EMPTY }); }, [editItem]);
  const hc = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  const handleSubmit = async e => {
    e.preventDefault(); setSaving(true);
    try {
      if (isEdit) await updatePickItemStatus(editItem.id, { name_fr: form.name_fr, name_ar: form.name_ar });
      else        await createPickItemStatus(form);
      toast.success(isEdit ? 'Statut mis à jour' : 'Statut créé'); onSaved();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };
  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-40 flex flex-col bg-white shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-cyan-700 to-cyan-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center"><Icon d={SVG.item} className="w-6 h-6 text-white" /></div>
            <div><p className="text-white/60 text-[11px] font-semibold uppercase tracking-widest">{isEdit?'Modifier':'Nouveau'}</p><h2 className="text-white font-bold text-xl">Statut article picking</h2></div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/25 flex items-center justify-center"><Icon d={SVG.x} className="w-5 h-5 text-white" /></button>
        </div>
        <form id="pis-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          <Fld label="Code" req>
            {isEdit ? (
              <div className="px-3 py-2.5 text-sm border border-gray-100 rounded-xl bg-gray-50 font-mono text-gray-500 flex items-center gap-2">{form.code}<span className="ml-auto text-[11px] text-gray-400">Non modifiable</span></div>
            ) : (
              <>
                <input name="code" className={`${inp} font-mono`} value={form.code} onChange={e => hc({ target: { name: 'code', value: e.target.value.toLowerCase().replace(/\s+/g,'_') } })} placeholder="out_of_stock" />
                <p className="text-[11px] text-gray-400 mt-1">Minuscules, tirets bas</p>
              </>
            )}
          </Fld>
          <Fld label="Nom (Français)" req><input name="name_fr" className={inp} value={form.name_fr} onChange={hc} placeholder="Rupture stock" /></Fld>
          <Fld label="Nom (Arabe)" req><input name="name_ar" className={inp} value={form.name_ar} onChange={hc} dir="rtl" placeholder="نفاد المخزون" /></Fld>
        </form>
        <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-100">Annuler</button>
          <button type="submit" form="pis-form" disabled={saving} className="flex-1 py-2.5 text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-700 rounded-xl disabled:opacity-50">{saving?'Enregistrement…':isEdit?'Mettre à jour':'Créer'}</button>
        </div>
      </div>
    </>
  );
}

export default function PickItemStatusesPage() {
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(1);
  const [drawer, setDrawer] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const PAGE_SIZE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await getPickItemStatuses({ page, limit: PAGE_SIZE }); setItems(r.data?.data ?? []); setTotal(r.data?.pagination?.total ?? 0); }
    catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    setDeleteLoading(true);
    try { await deletePickItemStatus(deleting.id); toast.success('Statut supprimé'); setDeleting(null); load(); }
    catch (err) { toast.error(getErrorMessage(err)); }
    finally { setDeleteLoading(false); }
  };

  const pages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-gray-50">
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 text-center mb-2">Supprimer «{deleting.name_fr}» ?</h3>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setDeleting(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700">Annuler</button>
              <button onClick={handleDelete} disabled={deleteLoading} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white disabled:opacity-50">{deleteLoading?'…':'Supprimer'}</button>
            </div>
          </div>
        </div>
      )}
      {drawer !== null && <Drawer editItem={drawer} onClose={() => setDrawer(null)} onSaved={() => { setDrawer(null); load(); }} />}

      <div className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="px-6 pt-5 pb-4 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-1"><span>Paramétrage</span><span>›</span><span>Picking</span><span>›</span><span className="text-cyan-600 font-medium">Statuts articles</span></div>
            <h1 className="text-2xl font-bold text-gray-900">Statuts articles picking</h1>
            <p className="text-sm text-gray-400 mt-0.5">État de chaque article à préparer — pending, picked, substituted, out_of_stock</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={async () => { setSeeding(true); try { await seedPickItemStatuses(); toast.success('4 statuts seedés'); load(); } catch(e){toast.error(getErrorMessage(e));} finally{setSeeding(false);} }} disabled={seeding} className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl disabled:opacity-50"><Icon d={SVG.seed} className="w-4 h-4" />{seeding?'Seed…':'Seed'}</button>
            <button onClick={() => setDrawer(false)} className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm"><Icon d={SVG.plus} className="w-4 h-4" />Nouveau statut</button>
          </div>
        </div>
      </div>

      <div className="px-6 py-5">
        {loading ? <div className="flex justify-center py-24"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600" /></div> : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Code</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Nom français</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Nom arabe</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Articles</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.length === 0 ? <tr><td colSpan={5} className="text-center py-12 text-gray-400">Aucun statut article picking</td></tr>
                : items.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-5 py-3.5"><ItemBadge code={item.code} /></td>
                    <td className="px-5 py-3.5 font-semibold text-gray-900">{item.name_fr}</td>
                    <td className="px-5 py-3.5 text-gray-600" dir="rtl">{item.name_ar}</td>
                    <td className="px-5 py-3.5 text-right"><span className={`text-xs font-bold px-2.5 py-1 rounded-full ${(item.items_count??0)>0?'bg-cyan-50 text-cyan-700':'bg-gray-100 text-gray-400'}`}>{item.items_count??0}</span></td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setDrawer(item)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg"><Icon d={SVG.edit} className="w-4 h-4" /></button>
                        <button onClick={() => setDeleting(item)} disabled={(item.items_count??0)>0} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"><Icon d={SVG.trash} className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
