import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getWalletTxnTypes, createWalletTxnType, updateWalletTxnType, deleteWalletTxnType, seedWalletTxnTypes } from '../../api/wallet.api';
import { getErrorMessage } from '../../utils/helpers';

const SVG = {
  plus:   'M12 4v16m8-8H4',
  edit:   'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  trash:  'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  x:      'M6 18L18 6M6 6l12 12',
  seed:   'M4 16s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z M4 12v4',
  wallet: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  arrowIn:  'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12',
  arrowOut: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4',
};

function Icon({ d, className = 'w-5 h-5' }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} /></svg>;
}

const DIR = {
  IN:  { label: 'Crédit',  badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', icon: SVG.arrowIn,  iconBg: 'from-emerald-500 to-emerald-600', desc: 'Augmente le solde wallet' },
  OUT: { label: 'Débit',   badge: 'bg-red-100 text-red-700',         dot: 'bg-red-500',     bg: 'bg-red-50 border-red-200',         text: 'text-red-700',     icon: SVG.arrowOut, iconBg: 'from-red-500 to-red-600',         desc: 'Diminue le solde wallet' },
};

function DirBadge({ direction }) {
  const d = DIR[direction?.toUpperCase()] ?? { badge: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400', label: direction };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${d.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${d.dot}`} />
      {direction?.toUpperCase()} — {d.label}
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

const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder-gray-300';

function Fld({ label, req, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}{req && <span className="text-red-500 ml-1">*</span>}</label>
      {children}
    </div>
  );
}

const EMPTY = { code: '', name_fr: '', name_ar: '', direction: 'IN' };

function Drawer({ editItem, onClose, onSaved }) {
  const isEdit = !!editItem;
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(editItem
      ? { code: editItem.code ?? '', name_fr: editItem.name_fr ?? '', name_ar: editItem.name_ar ?? '', direction: editItem.direction ?? 'IN' }
      : { ...EMPTY }
    );
  }, [editItem]);

  const hc = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isEdit && !form.code.trim()) return toast.error('Code requis');
    if (!form.name_fr.trim()) return toast.error('Nom (FR) requis');
    if (!form.name_ar.trim()) return toast.error('Nom (AR) requis');
    setSaving(true);
    try {
      if (isEdit) await updateWalletTxnType(editItem.id, { name_fr: form.name_fr, name_ar: form.name_ar, direction: form.direction });
      else        await createWalletTxnType(form);
      toast.success(isEdit ? 'Type mis à jour' : 'Type créé');
      onSaved();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  const dir = DIR[form.direction?.toUpperCase()] ?? DIR.IN;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-40 flex flex-col bg-white shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-violet-700 to-violet-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Icon d={SVG.wallet} className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-white/60 text-[11px] font-semibold uppercase tracking-widest">{isEdit ? 'Modifier' : 'Nouveau'}</p>
              <h2 className="text-white font-bold text-xl">Type transaction wallet</h2>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/25 flex items-center justify-center">
            <Icon d={SVG.x} className="w-5 h-5 text-white" />
          </button>
        </div>
        <form id="wt-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          <Fld label="Code" req>
            {isEdit ? (
              <div className="px-3 py-2.5 text-sm border border-gray-100 rounded-xl bg-gray-50 font-mono text-gray-500 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${dir.dot}`} />
                {form.code}
                <span className="ml-auto text-[11px] text-gray-400">Non modifiable</span>
              </div>
            ) : (
              <>
                <input name="code" className={`${inp} font-mono`} value={form.code}
                  onChange={(e) => hc({ target: { name: 'code', value: e.target.value.toLowerCase().replace(/\s+/g, '_') } })}
                  placeholder="order_payment" />
                <p className="text-[11px] text-gray-400 mt-1">Minuscules, tirets bas — ex: refund, promo_credit</p>
              </>
            )}
          </Fld>
          <Fld label="Direction" req>
            <div className="grid grid-cols-2 gap-3">
              {['IN','OUT'].map(d => (
                <button key={d} type="button" onClick={() => setForm(f => ({ ...f, direction: d }))}
                  className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${
                    form.direction === d
                      ? `${DIR[d].bg} ${DIR[d].text} shadow-sm border-current`
                      : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                  }`}>
                  <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${DIR[d].iconBg} flex items-center justify-center flex-shrink-0`}>
                    <Icon d={DIR[d].icon} className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold">{d}</p>
                    <p className="text-[10px] font-normal opacity-70">{DIR[d].label}</p>
                  </div>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5">{dir.desc}</p>
          </Fld>
          <Fld label="Nom (Français)" req>
            <input name="name_fr" className={inp} value={form.name_fr} onChange={hc} placeholder="Paiement commande" />
          </Fld>
          <Fld label="Nom (Arabe)" req>
            <input name="name_ar" className={inp} value={form.name_ar} onChange={hc} dir="rtl" placeholder="دفع الطلب" />
          </Fld>
          <div className={`px-4 py-3 rounded-xl border text-xs ${dir.bg} ${dir.text}`}>
            <p className="font-semibold mb-1">Règle métier :</p>
            <p>{form.direction === 'IN' ? '↑ Augmente wallet_balance du client' : '↓ Diminue wallet_balance — jamais en négatif'}</p>
          </div>
        </form>
        <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-100">Annuler</button>
          <button type="submit" form="wt-form" disabled={saving} className="flex-1 py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl disabled:opacity-50">
            {saving ? 'Enregistrement…' : isEdit ? 'Mettre à jour' : 'Créer'}
          </button>
        </div>
      </div>
    </>
  );
}

const PAGE_SIZE = 20;

export default function WalletTxnTypesPage() {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch]   = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [dirFilter, setDirFilter] = useState('all');
  const [page, setPage]       = useState(1);
  const [total, setTotal]     = useState(0);
  const [drawer, setDrawer]   = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getWalletTxnTypes({ page, limit: PAGE_SIZE, ...(search && { search }), ...(dirFilter !== 'all' && { direction: dirFilter }) });
      setItems(res.data.data ?? []);
      setTotal(res.data.pagination?.total ?? 0);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, [page, search, dirFilter]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    setDeleteLoading(true);
    try { await deleteWalletTxnType(deleting.id); toast.success('Type supprimé'); setDeleting(null); load(); }
    catch (err) { toast.error(getErrorMessage(err)); }
    finally { setDeleteLoading(false); }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try { await seedWalletTxnTypes(); toast.success('7 types wallet seedés'); load(); }
    catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSeeding(false); }
  };

  const pages = Math.ceil(total / PAGE_SIZE);
  const inCount  = items.filter(i => i.direction === 'IN').length;
  const outCount = items.filter(i => i.direction === 'OUT').length;

  return (
    <div className="min-h-screen bg-gray-50">
      {deleting && <DeleteModal item={deleting} onCancel={() => setDeleting(null)} onConfirm={handleDelete} loading={deleteLoading} />}
      {drawer !== null && <Drawer editItem={drawer} onClose={() => setDrawer(null)} onSaved={() => { setDrawer(null); load(); }} />}

      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                <span>Paramétrage</span><span>›</span><span>Wallet</span><span>›</span>
                <span className="text-violet-600 font-medium">Types transactions wallet</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Types de transactions wallet</h1>
              <p className="text-sm text-gray-400 mt-0.5">Crédit (IN) et débit (OUT) — parrainage, remboursements, promotions, jeux</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={handleSeed} disabled={seeding} className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl disabled:opacity-50">
                <Icon d={SVG.seed} className="w-4 h-4" />{seeding ? 'Seed…' : 'Seed'}
              </button>
              <button onClick={() => setDrawer(false)} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm">
                <Icon d={SVG.plus} className="w-4 h-4" />Nouveau type
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
              {[{ v: 'all', l: 'Tous' }, { v: 'IN', l: 'Crédit IN' }, { v: 'OUT', l: 'Débit OUT' }].map(o => (
                <button key={o.v} onClick={() => { setDirFilter(o.v); setPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${dirFilter === o.v ? 'bg-white text-violet-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
                  {o.l}
                </button>
              ))}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); setPage(1); setSearch(searchInput); }} className="flex items-center gap-2 max-w-sm">
              <div className="relative flex-1">
                <Icon d={SVG.search} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Rechercher…"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white" />
              </div>
              <button type="submit" className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-xl">OK</button>
              {search && <button type="button" onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }} className="px-2 py-2 border border-gray-200 text-gray-500 text-sm rounded-xl hover:bg-gray-50">✕</button>}
            </form>
          </div>
        </div>
      </div>

      <div className="px-6 pt-5">
        <div className="flex flex-wrap gap-3">
          {[
            { label: 'Total',           value: total,    cls: 'bg-white border-gray-100 text-gray-900' },
            { label: 'Crédit IN ↑',     value: inCount,  cls: 'bg-emerald-50 border-emerald-100 text-emerald-700' },
            { label: 'Débit OUT ↓',     value: outCount, cls: 'bg-red-50 border-red-100 text-red-700' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border px-4 py-3 min-w-[110px] ${s.cls}`}>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{s.label}</p>
              <p className="text-2xl font-bold mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-6 py-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-600" />
            <p className="text-sm text-gray-400">Chargement…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-20 h-20 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center">
              <Icon d={SVG.wallet} className="w-10 h-10 text-violet-200" />
            </div>
            <div className="text-center">
              <p className="text-gray-600 font-semibold">Aucun type de transaction wallet</p>
              <p className="text-gray-400 text-sm mt-1">{search || dirFilter !== 'all' ? 'Aucun résultat.' : 'Cliquez sur « Seed » pour initialiser.'}</p>
            </div>
            {!search && dirFilter === 'all' && (
              <button onClick={handleSeed} disabled={seeding} className="px-5 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 disabled:opacity-50">
                <Icon d={SVG.seed} className="w-4 h-4 inline mr-1.5" />Seed (7 types — order_payment, refund, parrainage…)
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Code<div className="text-[10px] font-normal normal-case text-gray-400 mt-0.5">Identifiant technique</div>
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Nom français<div className="text-[10px] font-normal normal-case text-gray-400 mt-0.5">Affiché dans l'app</div>
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Nom arabe<div className="text-[10px] font-normal normal-case text-gray-400 mt-0.5">Version AR</div>
                    </th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Direction<div className="text-[10px] font-normal normal-case text-gray-400 mt-0.5">Sens transaction</div>
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map((item) => {
                    const d = DIR[item.direction?.toUpperCase()] ?? {};
                    return (
                      <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${d.iconBg ?? 'from-gray-400 to-gray-500'} flex items-center justify-center flex-shrink-0`}>
                              <Icon d={d.icon ?? SVG.wallet} className="w-4 h-4 text-white" />
                            </div>
                            <span className="font-mono text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md">{item.code}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-gray-900">{item.name_fr}</td>
                        <td className="px-5 py-3.5 text-gray-600" dir="rtl">{item.name_ar}</td>
                        <td className="px-5 py-3.5 text-center"><DirBadge direction={item.direction} /></td>
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
                    <button key={p} onClick={() => setPage(p)} className={`px-3 py-1.5 text-xs rounded-lg border ${page === p ? 'bg-violet-600 text-white border-violet-600' : 'border-gray-200 hover:bg-gray-50'}`}>{p}</button>
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
