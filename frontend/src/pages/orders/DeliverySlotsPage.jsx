import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getDeliverySlots, createDeliverySlot, updateDeliverySlot, deleteDeliverySlot } from '../../api/orders.api';
import { getNodes } from '../../api/locationNode.api';
import { getErrorMessage } from '../../utils/helpers';

const SVG = {
  plus:   'M12 4v16m8-8H4',
  edit:   'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  trash:  'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  x:      'M6 18L18 6M6 6l12 12',
  clock:  'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  node:   'M3 7l9-4 9 4-9 4-9-4zm0 5l9 4 9-4m-18 5l9 4 9-4',
  cal:    'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
};

const DAYS = [
  { v: 0, fr: 'Dimanche', ar: 'الأحد'    },
  { v: 1, fr: 'Lundi',    ar: 'الاثنين'  },
  { v: 2, fr: 'Mardi',    ar: 'الثلاثاء' },
  { v: 3, fr: 'Mercredi', ar: 'الأربعاء' },
  { v: 4, fr: 'Jeudi',    ar: 'الخميس'   },
  { v: 5, fr: 'Vendredi', ar: 'الجمعة'   },
  { v: 6, fr: 'Samedi',   ar: 'السبت'    },
];

const DAY_COLORS = ['bg-purple-100 text-purple-700','bg-blue-100 text-blue-700','bg-indigo-100 text-indigo-700','bg-violet-100 text-violet-700','bg-amber-100 text-amber-700','bg-emerald-100 text-emerald-700','bg-orange-100 text-orange-700'];

function Icon({ d, className = 'w-5 h-5' }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} /></svg>;
}

function DayBadge({ day }) {
  const d = DAYS.find(x => x.v === day);
  return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${DAY_COLORS[day] ?? 'bg-gray-100 text-gray-600'}`}>{d?.fr ?? day}</span>;
}

function ActiveBadge({ value }) {
  return value
    ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">Actif</span>
    : <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-50 text-gray-400 border border-gray-200">Inactif</span>;
}

function DeleteModal({ item, onCancel, onConfirm, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <Icon d={SVG.trash} className="w-7 h-7 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 text-center mb-1">Supprimer ce créneau ?</h3>
        <p className="text-sm text-gray-500 text-center mb-6">
          <span className="font-semibold text-gray-700">«{item?.name_fr}»</span> sera supprimé définitivement.
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

const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-300';
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

const EMPTY = { node_id: '', name_fr: '', name_ar: '', day_of_week: 1, slot_start: '08:00', slot_end: '12:00', max_orders: '', is_active: true };

function Drawer({ editItem, nodes, defaultNodeId, onClose, onSaved }) {
  const isEdit = !!editItem;
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editItem) {
      setForm({ node_id: editItem.node_id ?? '', name_fr: editItem.name_fr ?? '', name_ar: editItem.name_ar ?? '', day_of_week: editItem.day_of_week ?? 1, slot_start: editItem.slot_start ?? '08:00', slot_end: editItem.slot_end ?? '12:00', max_orders: editItem.max_orders ?? '', is_active: editItem.is_active ?? true });
    } else {
      setForm({ ...EMPTY, node_id: defaultNodeId || '' });
    }
  }, [editItem, defaultNodeId]);

  const hc = (e) => { const { name, value } = e.target; setForm(f => ({ ...f, [name]: value })); };
  const toggle = (k) => setForm(f => ({ ...f, [k]: !f[k] }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.node_id) return toast.error('Node requis');
    if (!form.name_fr.trim()) return toast.error('Nom (FR) requis');
    if (!form.name_ar.trim()) return toast.error('Nom (AR) requis');
    if (!form.slot_start) return toast.error('Heure de début requise');
    if (!form.slot_end)   return toast.error('Heure de fin requise');
    setSaving(true);
    try {
      if (isEdit) await updateDeliverySlot(editItem.id, { ...form, day_of_week: parseInt(form.day_of_week), max_orders: form.max_orders || null });
      else        await createDeliverySlot({ ...form, day_of_week: parseInt(form.day_of_week), max_orders: form.max_orders || null });
      toast.success(isEdit ? 'Créneau mis à jour' : 'Créneau créé');
      onSaved();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-40 flex flex-col bg-white shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-blue-700 to-blue-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Icon d={SVG.cal} className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-white/60 text-[11px] font-semibold uppercase tracking-widest">{isEdit ? 'Modifier' : 'Nouveau'}</p>
              <h2 className="text-white font-bold text-xl">Créneau livraison</h2>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/25 flex items-center justify-center">
            <Icon d={SVG.x} className="w-5 h-5 text-white" />
          </button>
        </div>

        <form id="ds-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {!isEdit && (
            <Fld label="Node" req>
              <select name="node_id" value={form.node_id} onChange={hc} className={inp}>
                <option value="">— Sélectionner un node —</option>
                {nodes.map(n => <option key={n.id} value={n.id}>{n.name_fr} ({n.code})</option>)}
              </select>
            </Fld>
          )}

          <Fld label="Jour de la semaine" req>
            <div className="grid grid-cols-4 gap-1.5">
              {DAYS.map(d => (
                <button key={d.v} type="button"
                  onClick={() => setForm(f => ({ ...f, day_of_week: d.v }))}
                  className={`py-2 rounded-xl text-xs font-semibold border transition-all ${form.day_of_week === d.v ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}>
                  {d.fr.slice(0, 3)}
                </button>
              ))}
            </div>
          </Fld>

          <div className="grid grid-cols-2 gap-3">
            <Fld label="Début" req>
              <input type="time" name="slot_start" value={form.slot_start} onChange={hc} className={inp} />
            </Fld>
            <Fld label="Fin" req>
              <input type="time" name="slot_end" value={form.slot_end} onChange={hc} className={inp} />
            </Fld>
          </div>

          <Fld label="Max commandes">
            <input type="number" name="max_orders" value={form.max_orders} onChange={hc} className={inp} min="1" placeholder="Illimité" />
          </Fld>

          <Fld label="Nom (Français)" req>
            <input name="name_fr" value={form.name_fr} onChange={hc} className={inp} placeholder="Matin" />
          </Fld>
          <Fld label="Nom (Arabe)" req>
            <input name="name_ar" value={form.name_ar} onChange={hc} className={inp} dir="rtl" placeholder="صباح" />
          </Fld>

          <div className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${form.is_active ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
            <div>
              <p className={`text-sm font-semibold ${form.is_active ? 'text-emerald-800' : 'text-gray-600'}`}>Créneau actif</p>
              <p className="text-xs text-gray-400">Disponible pour la prise de commande</p>
            </div>
            <div onClick={() => toggle('is_active')}
              className={`relative w-11 h-6 rounded-full cursor-pointer transition-colors ${form.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`}>
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.is_active ? 'translate-x-5' : ''}`} />
            </div>
          </div>
        </form>

        <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-100">Annuler</button>
          <button type="submit" form="ds-form" disabled={saving} className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50">
            {saving ? 'Enregistrement…' : isEdit ? 'Mettre à jour' : 'Créer'}
          </button>
        </div>
      </div>
    </>
  );
}

export default function DeliverySlotsPage() {
  const [nodes, setNodes]   = useState([]);
  const [nodeId, setNodeId] = useState('');
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [drawer, setDrawer]   = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    getNodes({ all: true, limit: 500 }).then(r => setNodes(r.data?.data ?? r.data ?? [])).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (!nodeId) { setItems([]); return; }
    setLoading(true);
    try {
      const res = await getDeliverySlots({ node_id: nodeId, all: true });
      setItems(res.data.data ?? []);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, [nodeId]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    setDeleteLoading(true);
    try { await deleteDeliverySlot(deleting.id); toast.success('Créneau supprimé'); setDeleting(null); load(); }
    catch (err) { toast.error(getErrorMessage(err)); }
    finally { setDeleteLoading(false); }
  };

  const grouped = DAYS.map(d => ({ ...d, slots: items.filter(s => s.day_of_week === d.v) })).filter(d => d.slots.length > 0);
  const selectedNode = nodes.find(n => n.id === nodeId);

  return (
    <div className="min-h-screen bg-gray-50">
      {deleting && <DeleteModal item={deleting} onCancel={() => setDeleting(null)} onConfirm={handleDelete} loading={deleteLoading} />}
      {drawer !== null && (
        <Drawer editItem={drawer} nodes={nodes} defaultNodeId={nodeId}
          onClose={() => setDrawer(null)} onSaved={() => { setDrawer(null); load(); }} />
      )}

      <div className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                <span>Paramétrage</span><span>›</span><span>Commandes</span><span>›</span>
                <span className="text-blue-600 font-medium">Créneaux livraison</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Créneaux livraison</h1>
              <p className="text-sm text-gray-400 mt-0.5">Fenêtres horaires de livraison par node et par jour</p>
            </div>
            {nodeId && (
              <button onClick={() => setDrawer(false)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm flex-shrink-0">
                <Icon d={SVG.plus} className="w-4 h-4" />Nouveau créneau
              </button>
            )}
          </div>

          {/* Node selector */}
          <div className="flex items-center gap-3">
            <Icon d={SVG.node} className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <select value={nodeId} onChange={e => setNodeId(e.target.value)}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[280px]">
              <option value="">— Sélectionner un node —</option>
              {nodes.map(n => <option key={n.id} value={n.id}>{n.name_fr} ({n.code})</option>)}
            </select>
            {selectedNode && (
              <span className="text-xs text-gray-500 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-lg font-medium">
                {items.length} créneau{items.length !== 1 ? 'x' : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        {!nodeId ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-20 h-20 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center">
              <Icon d={SVG.node} className="w-10 h-10 text-blue-200" />
            </div>
            <p className="text-gray-500 font-medium">Sélectionnez un node pour voir ses créneaux</p>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
            <p className="text-sm text-gray-400">Chargement…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-20 h-20 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center">
              <Icon d={SVG.cal} className="w-10 h-10 text-blue-200" />
            </div>
            <p className="text-gray-600 font-semibold">Aucun créneau pour ce node</p>
            <button onClick={() => setDrawer(false)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl">
              <Icon d={SVG.plus} className="w-4 h-4" />Créer le premier créneau
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(({ fr, v, slots }) => (
              <div key={v}>
                <div className="flex items-center gap-3 mb-3">
                  <DayBadge day={v} />
                  <span className="text-xs text-gray-400">{slots.length} créneau{slots.length !== 1 ? 'x' : ''}</span>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Nom</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Horaire</th>
                        <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Max commandes</th>
                        <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
                        <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {slots.map(s => (
                        <tr key={s.id} className="hover:bg-gray-50/50 transition-colors group">
                          <td className="px-5 py-3.5">
                            <p className="font-semibold text-gray-900">{s.name_fr}</p>
                            <p className="text-xs text-gray-400" dir="rtl">{s.name_ar}</p>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-mono font-semibold border border-blue-100">
                              <Icon d={SVG.clock} className="w-3 h-3" />
                              {s.slot_start} → {s.slot_end}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            {s.max_orders
                              ? <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">{s.max_orders}</span>
                              : <span className="text-xs text-gray-400">Illimité</span>}
                          </td>
                          <td className="px-5 py-3.5 text-center"><ActiveBadge value={s.is_active} /></td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => setDrawer(s)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg" title="Modifier">
                                <Icon d={SVG.edit} className="w-4 h-4" />
                              </button>
                              <button onClick={() => setDeleting(s)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg" title="Supprimer">
                                <Icon d={SVG.trash} className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
