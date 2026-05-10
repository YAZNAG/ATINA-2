import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getOrderStatuses, createOrderStatus, updateOrderStatus, deleteOrderStatus, seedOrderStatuses } from '../../api/orders.api';
import { getErrorMessage } from '../../utils/helpers';

const SVG = {
  plus:   'M12 4v16m8-8H4',
  edit:   'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  trash:  'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  x:      'M6 18L18 6M6 6l12 12',
  seed:   'M4 16s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z M4 12v4',
  order:  'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
  lock:   'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
};

function Icon({ d, className = 'w-5 h-5' }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} /></svg>;
}

const COLOR_MAP = {
  gray:    { badge: 'bg-gray-100 text-gray-700',       dot: 'bg-gray-400',    ring: 'ring-gray-200'    },
  red:     { badge: 'bg-red-100 text-red-700',         dot: 'bg-red-500',     ring: 'ring-red-200'     },
  orange:  { badge: 'bg-orange-100 text-orange-700',   dot: 'bg-orange-400',  ring: 'ring-orange-200'  },
  yellow:  { badge: 'bg-yellow-100 text-yellow-700',   dot: 'bg-yellow-400',  ring: 'ring-yellow-200'  },
  green:   { badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', ring: 'ring-emerald-200' },
  blue:    { badge: 'bg-blue-100 text-blue-700',       dot: 'bg-blue-500',    ring: 'ring-blue-200'    },
  indigo:  { badge: 'bg-indigo-100 text-indigo-700',   dot: 'bg-indigo-500',  ring: 'ring-indigo-200'  },
  purple:  { badge: 'bg-violet-100 text-violet-700',   dot: 'bg-violet-500',  ring: 'ring-violet-200'  },
  cyan:    { badge: 'bg-cyan-100 text-cyan-700',       dot: 'bg-cyan-500',    ring: 'ring-cyan-200'    },
};

function StatusBadge({ color, children }) {
  const cfg = COLOR_MAP[color] ?? COLOR_MAP.gray;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {children}
    </span>
  );
}

function TerminalBadge({ value }) {
  return value
    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-100"><Icon d={SVG.lock} className="w-3 h-3" />Terminal</span>
    : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-50 text-gray-400 border border-gray-100">Transitoire</span>;
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

const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-gray-300';

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

const EMPTY = { code: '', name_fr: '', name_ar: '', color: 'gray' };

function Drawer({ editItem, onClose, onSaved }) {
  const isEdit = !!editItem;
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(editItem ? { code: editItem.code ?? '', name_fr: editItem.name_fr ?? '', name_ar: editItem.name_ar ?? '', color: editItem.color ?? 'gray' } : { ...EMPTY });
  }, [editItem]);

  const hc = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isEdit && !form.code.trim()) return toast.error('Code requis');
    if (!form.name_fr.trim()) return toast.error('Nom (FR) requis');
    if (!form.name_ar.trim()) return toast.error('Nom (AR) requis');
    setSaving(true);
    try {
      if (isEdit) await updateOrderStatus(editItem.id, { name_fr: form.name_fr, name_ar: form.name_ar, color: form.color });
      else        await createOrderStatus(form);
      toast.success(isEdit ? 'Statut mis à jour' : 'Statut créé');
      onSaved();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  const colorCfg = COLOR_MAP[form.color] ?? COLOR_MAP.gray;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-40 flex flex-col bg-white shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-amber-600 to-amber-400">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Icon d={SVG.order} className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-white/60 text-[11px] font-semibold uppercase tracking-widest">{isEdit ? 'Modifier' : 'Nouveau'}</p>
              <h2 className="text-white font-bold text-xl">Statut commande</h2>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/25 flex items-center justify-center">
            <Icon d={SVG.x} className="w-5 h-5 text-white" />
          </button>
        </div>
        <form id="os-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          <Fld label="Code" req>
            {isEdit ? (
              <div className="px-3 py-2.5 text-sm border border-gray-100 rounded-xl bg-gray-50 font-mono text-gray-500 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${colorCfg.dot}`} />
                {form.code}
                <span className="ml-auto text-[11px] text-gray-400">Non modifiable</span>
              </div>
            ) : (
              <>
                <input name="code" className={`${inp} font-mono`} value={form.code}
                  onChange={(e) => hc({ target: { name: 'code', value: e.target.value.toLowerCase().replace(/\s+/g, '_') } })}
                  placeholder="pending" />
                <p className="text-[11px] text-gray-400 mt-1">Minuscules, tirets bas — ex: pending, confirmed, in_delivery</p>
              </>
            )}
          </Fld>
          {form.color && (
            <div className={`px-4 py-2.5 rounded-xl border ring-1 ${colorCfg.ring} flex items-center gap-2`}>
              <span className={`w-2 h-2 rounded-full ${colorCfg.dot}`} />
              <span className={`text-sm font-semibold ${colorCfg.badge?.split(' ').find(c => c.startsWith('text-'))}`}>{form.name_fr || 'Aperçu'}</span>
            </div>
          )}
          <Fld label="Couleur">
            <div className="flex flex-wrap gap-2">
              {Object.keys(COLOR_MAP).map((c) => {
                const cfg = COLOR_MAP[c];
                const active = form.color === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                      active
                        ? `${cfg.badge} border-transparent`
                        : `bg-white border-gray-200 hover:border-gray-300 text-gray-700`
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                    {c}
                  </button>
                );
              })}
            </div>
          </Fld>
          {isEdit && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
              <div className="flex-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut terminal</p>
                <p className="text-xs text-gray-400 mt-0.5">Aucune transition autorisée si activé</p>
              </div>
              <TerminalBadge value={editItem?.is_terminal} />
            </div>
          )}
          <Fld label="Nom (Français)" req>
            <input name="name_fr" className={inp} value={form.name_fr} onChange={hc} placeholder="En attente" />
          </Fld>
          <Fld label="Nom (Arabe)" req>
            <input name="name_ar" className={inp} value={form.name_ar} onChange={hc} dir="rtl" placeholder="في الانتظار" />
          </Fld>
        </form>
        <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-100">Annuler</button>
          <button type="submit" form="os-form" disabled={saving} className="flex-1 py-2.5 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl disabled:opacity-50">
            {saving ? 'Enregistrement…' : isEdit ? 'Mettre à jour' : 'Créer'}
          </button>
        </div>
      </div>
    </>
  );
}

const PAGE_SIZE = 20;

export default function OrderStatusesPage() {
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
      const res = await getOrderStatuses({ page, limit: PAGE_SIZE, ...(search && { search }) });
      setItems(res.data.data ?? []);
      setTotal(res.data.pagination?.total ?? 0);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    setDeleteLoading(true);
    try { await deleteOrderStatus(deleting.id); toast.success('Statut supprimé'); setDeleting(null); load(); }
    catch (err) { toast.error(getErrorMessage(err)); }
    finally { setDeleteLoading(false); }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try { await seedOrderStatuses(); toast.success('9 statuts seedés'); load(); }
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
                <span className="text-amber-600 font-medium">Statuts commande</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Statuts commande</h1>
              <p className="text-sm text-gray-400 mt-0.5">Cycle de vie — pending → confirmed → picking → ready → in_delivery → delivered</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={handleSeed} disabled={seeding} className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl disabled:opacity-50">
                <Icon d={SVG.seed} className="w-4 h-4" />{seeding ? 'Seed…' : 'Seed'}
              </button>
              <button onClick={() => setDrawer(false)} className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm">
                <Icon d={SVG.plus} className="w-4 h-4" />Nouveau statut
              </button>
            </div>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); setPage(1); setSearch(searchInput); }} className="flex items-center gap-2 max-w-sm">
            <div className="relative flex-1">
              <Icon d={SVG.search} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Rechercher…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white" />
            </div>
            <button type="submit" className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-xl">OK</button>
            {search && <button type="button" onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }} className="px-2 py-2 border border-gray-200 text-gray-500 text-sm rounded-xl hover:bg-gray-50">✕</button>}
          </form>
        </div>
      </div>

      <div className="px-6 pt-5">
        <div className="flex flex-wrap gap-3">
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 min-w-[90px]">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total</p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5">{total}</p>
          </div>
          <div className="bg-red-50 rounded-xl border border-red-100 px-4 py-3 min-w-[90px] ring-1 ring-red-200">
            <p className="text-xs font-semibold text-red-400 uppercase tracking-wide">Terminaux</p>
            <p className="text-2xl font-bold text-red-700 mt-0.5">{items.filter(i => i.is_terminal).length}</p>
          </div>
          <div className="bg-emerald-50 rounded-xl border border-emerald-100 px-4 py-3 min-w-[100px] ring-1 ring-emerald-200">
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">Transitoires</p>
            <p className="text-2xl font-bold text-emerald-700 mt-0.5">{items.filter(i => !i.is_terminal).length}</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-600" />
            <p className="text-sm text-gray-400">Chargement…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-20 h-20 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center">
              <Icon d={SVG.order} className="w-10 h-10 text-amber-200" />
            </div>
            <div className="text-center">
              <p className="text-gray-600 font-semibold">Aucun statut commande</p>
              <p className="text-gray-400 text-sm mt-1">{search ? 'Aucun résultat.' : 'Cliquez sur « Seed » pour initialiser.'}</p>
            </div>
            {!search && (
              <button onClick={handleSeed} disabled={seeding} className="px-5 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 disabled:opacity-50">
                <Icon d={SVG.seed} className="w-4 h-4 inline mr-1.5" />Seed (9 statuts)
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide w-10">
                      #<div className="text-[10px] font-normal normal-case text-gray-400 mt-0.5">Ordre</div>
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Code<div className="text-[10px] font-normal normal-case text-gray-400 mt-0.5">Identifiant technique</div>
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Badge<div className="text-[10px] font-normal normal-case text-gray-400 mt-0.5">Aperçu couleur</div>
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Nom français<div className="text-[10px] font-normal normal-case text-gray-400 mt-0.5">Affiché dans l'app</div>
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Nom arabe<div className="text-[10px] font-normal normal-case text-gray-400 mt-0.5">Version AR</div>
                    </th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Couleur<div className="text-[10px] font-normal normal-case text-gray-400 mt-0.5">Badge UI</div>
                    </th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Terminal<div className="text-[10px] font-normal normal-case text-gray-400 mt-0.5">Fin de cycle</div>
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Commandes<div className="text-[10px] font-normal normal-case text-gray-400 mt-0.5">Utilisations</div>
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map((item) => {
                    const count = item.orders_count ?? 0;
                    return (
                      <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-4 py-3.5 text-center">
                          <span className="text-xs font-mono font-bold text-gray-400">{item.sort_order}</span>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs text-gray-500">{item.code}</td>
                        <td className="px-5 py-3.5"><StatusBadge color={item.color}>{item.name_fr}</StatusBadge></td>
                        <td className="px-5 py-3.5 font-semibold text-gray-900">{item.name_fr}</td>
                        <td className="px-5 py-3.5 text-gray-600" dir="rtl">{item.name_ar}</td>
                        <td className="px-5 py-3.5 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${(COLOR_MAP[item.color] ?? COLOR_MAP.gray).badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${(COLOR_MAP[item.color] ?? COLOR_MAP.gray).dot}`} />
                            {item.color}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-center"><TerminalBadge value={item.is_terminal} /></td>
                        <td className="px-5 py-3.5 text-right">
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${count > 0 ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-400'}`}>{count}</span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setDrawer(item)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg" title="Modifier">
                              <Icon d={SVG.edit} className="w-4 h-4" />
                            </button>
                            <button onClick={() => setDeleting(item)} disabled={count > 0}
                              title={count > 0 ? `Utilisé par ${count} commande(s)` : 'Supprimer'}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed">
                              <Icon d={SVG.trash} className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-gray-400">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} sur {total}</p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">← Précédent</button>
                  {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
                    <button key={p} onClick={() => setPage(p)} className={`px-3 py-1.5 text-xs rounded-lg border ${page === p ? 'bg-amber-600 text-white border-amber-600' : 'border-gray-200 hover:bg-gray-50'}`}>{p}</button>
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
