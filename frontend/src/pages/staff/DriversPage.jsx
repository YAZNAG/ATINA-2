import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getDrivers, createDriver, updateDriver, activateDriver, deactivateDriver, resetDriverPassword, deleteDriver } from '../../api/staff.api';
import { getNodes } from '../../api/locationNode.api';
import { getErrorMessage, formatDate } from '../../utils/helpers';

const SVG = {
  plus:   'M12 4v16m8-8H4',
  edit:   'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  trash:  'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  lock:   'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
  unlock: 'M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z',
  key:    'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z',
  x:      'M6 18L18 6M6 6l12 12',
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  truck:  'M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0',
};

function Icon({ d, className = 'w-5 h-5' }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} /></svg>;
}

const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-300';
function Fld({ label, req, children }) {
  return <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}{req && <span className="text-red-500 ml-1">*</span>}</label>{children}</div>;
}

const EMPTY = { node_id: '', phone_country: '+212', phone_number: '', name: '', password: '', vehicle_type: '', vehicle_plate: '' };

function Drawer({ editItem, nodes, onClose, onSaved }) {
  const isEdit = !!editItem;
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(editItem
      ? { node_id: editItem.node_id ?? '', phone_country: editItem.phone_country ?? '+212', phone_number: editItem.phone_number ?? '', name: editItem.name ?? '', password: '', vehicle_type: editItem.vehicle_type ?? '', vehicle_plate: editItem.vehicle_plate ?? '' }
      : { ...EMPTY });
  }, [editItem]);

  const hc = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault(); setSaving(true);
    try {
      if (isEdit) await updateDriver(editItem.id, { node_id: form.node_id, name: form.name, vehicle_type: form.vehicle_type, vehicle_plate: form.vehicle_plate });
      else        await createDriver(form);
      toast.success(isEdit ? 'Livreur mis à jour' : 'Livreur créé');
      onSaved();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-40 flex flex-col bg-white shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-emerald-700 to-emerald-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center"><Icon d={SVG.truck} className="w-6 h-6 text-white" /></div>
            <div>
              <p className="text-white/60 text-[11px] font-semibold uppercase tracking-widest">{isEdit ? 'Modifier' : 'Nouveau'}</p>
              <h2 className="text-white font-bold text-xl">Livreur</h2>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/25 flex items-center justify-center"><Icon d={SVG.x} className="w-5 h-5 text-white" /></button>
        </div>
        <form id="driver-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <Fld label="Node" req>
            <select name="node_id" value={form.node_id} onChange={hc} className={inp} required>
              <option value="">— Sélectionner un node —</option>
              {nodes.map(n => <option key={n.id} value={n.id}>{n.name_fr} ({n.code})</option>)}
            </select>
          </Fld>
          <Fld label="Nom complet" req><input name="name" className={inp} value={form.name} onChange={hc} required placeholder="Hassan Amrani" /></Fld>
          {!isEdit && (
            <div className="grid grid-cols-3 gap-3">
              <Fld label="Indicatif">
                <select name="phone_country" className={inp} value={form.phone_country} onChange={hc}>
                  <option value="+212">+212</option><option value="+33">+33</option>
                </select>
              </Fld>
              <div className="col-span-2"><Fld label="Téléphone" req><input name="phone_number" className={`${inp} font-mono`} value={form.phone_number} onChange={hc} required placeholder="601234567" /></Fld></div>
            </div>
          )}
          {!isEdit && <Fld label="Mot de passe" req><input type="password" name="password" className={inp} value={form.password} onChange={hc} required minLength={6} placeholder="min 6 caractères" /></Fld>}
          <div className="grid grid-cols-2 gap-3">
            <Fld label="Type véhicule"><input name="vehicle_type" className={inp} value={form.vehicle_type} onChange={hc} placeholder="Moto, Camion…" /></Fld>
            <Fld label="Plaque"><input name="vehicle_plate" className={inp} value={form.vehicle_plate} onChange={hc} placeholder="12345-A-1" /></Fld>
          </div>
        </form>
        <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-100">Annuler</button>
          <button type="submit" form="driver-form" disabled={saving} className="flex-1 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-50">
            {saving ? 'Enregistrement…' : isEdit ? 'Mettre à jour' : 'Créer'}
          </button>
        </div>
      </div>
    </>
  );
}

function ResetModal({ item, onClose }) {
  const [pwd, setPwd] = useState('');
  const [saving, setSaving] = useState(false);
  const handleReset = async () => {
    if (pwd.length < 6) return toast.error('Min 6 caractères');
    setSaving(true);
    try { await resetDriverPassword(item.id, pwd); toast.success('Mot de passe réinitialisé'); onClose(); }
    catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-2">Réinitialiser MDP</h3>
        <p className="text-sm text-gray-500 mb-4"><strong>{item.name}</strong></p>
        <input type="password" value={pwd} onChange={e => setPwd(e.target.value)} placeholder="Nouveau MDP (min 6)" className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-4" />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl">Annuler</button>
          <button onClick={handleReset} disabled={saving} className="flex-1 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl">{saving ? '…' : 'Réinitialiser'}</button>
        </div>
      </div>
    </div>
  );
}

export default function DriversPage() {
  const navigate = useNavigate();
  const [items, setItems]   = useState([]);
  const [nodes, setNodes]   = useState([]);
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer]   = useState(null);
  const [resetItem, setResetItem] = useState(null);
  const [deleting, setDeleting]   = useState(null);
  const [acting, setActing]       = useState({});
  const [filters, setFilters] = useState({ node_id: '', is_active: '', search: '' });
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => { getNodes({ all: true, limit: 500 }).then(r => setNodes(r.data?.data ?? r.data ?? [])).catch(() => {}); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getDrivers({ page, limit: 25, ...filters });
      setItems(r.data?.data ?? []);
      const pg = r.data?.pagination;
      if (pg) { setTotal(pg.total ?? 0); setTotalPages(pg.pages ?? 0); }
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, [page, filters]);

  useEffect(() => { load(); }, [load]);

  const act = async (key, fn, msg) => { setActing(a => ({ ...a, [key]: true })); try { await fn(); toast.success(msg); load(); } catch (err) { toast.error(getErrorMessage(err)); } finally { setActing(a => ({ ...a, [key]: false })); } };
  const pf  = (key, val) => { setFilters(f => ({ ...f, [key]: val })); setPage(1); };

  return (
    <div className="min-h-screen bg-gray-50">
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Supprimer {deleting.name} ?</h3>
            <p className="text-sm text-gray-500 mb-5">Suppression logique.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleting(null)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl">Annuler</button>
              <button onClick={() => act(`del-${deleting.id}`, () => deleteDriver(deleting.id), 'Livreur supprimé').then(() => setDeleting(null))} className="flex-1 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl">Supprimer</button>
            </div>
          </div>
        </div>
      )}
      {resetItem && <ResetModal item={resetItem} onClose={() => setResetItem(null)} />}
      {drawer !== null && <Drawer editItem={drawer} nodes={nodes} onClose={() => setDrawer(null)} onSaved={() => { setDrawer(null); load(); }} />}

      <div className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-1"><span>Staff</span><span>›</span><span className="text-emerald-600 font-medium">Livreurs</span></div>
              <h1 className="text-2xl font-bold text-gray-900">Livreurs</h1>
              <p className="text-sm text-gray-400 mt-0.5">Drivers de livraison — {total} au total</p>
            </div>
            <button onClick={() => setDrawer(false)} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm flex-shrink-0">
              <Icon d={SVG.plus} className="w-4 h-4" />Nouveau livreur
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <form onSubmit={e => { e.preventDefault(); pf('search', searchInput); }} className="flex items-center gap-2">
              <div className="relative">
                <Icon d={SVG.search} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Nom, téléphone, plaque…" className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 w-56" />
              </div>
            </form>
            <select value={filters.node_id} onChange={e => pf('node_id', e.target.value)} className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="">Tous les nodes</option>
              {nodes.map(n => <option key={n.id} value={n.id}>{n.code}</option>)}
            </select>
            <select value={filters.is_active} onChange={e => pf('is_active', e.target.value)} className="text-sm border border-gray-200 rounded-xl px-3 py-2">
              <option value="">Tous statuts</option><option value="true">Actifs</option><option value="false">Inactifs</option>
            </select>
          </div>
        </div>
      </div>

      <div className="px-6 py-5">
        {loading ? <div className="flex justify-center py-24"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" /></div> : (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Livreur</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Téléphone</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Node</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Véhicule</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.length === 0 ? <tr><td colSpan={6} className="text-center py-12 text-gray-400">Aucun livreur</td></tr>
                  : items.map(item => (
                    <tr key={item.id} onClick={() => navigate(`/staff/drivers/${item.id}`)} className="hover:bg-emerald-50/50 transition-colors group cursor-pointer">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${item.is_active ? 'bg-emerald-600' : 'bg-gray-400'}`}>{item.name.charAt(0).toUpperCase()}</div>
                          <p className="font-semibold text-gray-900">{item.name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-gray-600">{item.phone_country} {item.phone_number}</td>
                      <td className="px-4 py-3.5"><span className="text-xs font-mono font-semibold text-gray-700">{item.node?.code}</span></td>
                      <td className="px-4 py-3.5">
                        {item.vehicle_type && <p className="text-xs text-gray-700">{item.vehicle_type}</p>}
                        {item.vehicle_plate && <p className="text-[11px] font-mono text-gray-400">{item.vehicle_plate}</p>}
                        {!item.vehicle_type && <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {item.is_active
                          ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Actif</span>
                          : <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-50 text-gray-500 border border-gray-200">Inactif</span>}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                          <button onClick={() => setDrawer(item)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg" title="Modifier"><Icon d={SVG.edit} className="w-4 h-4" /></button>
                          {item.is_active
                            ? <button onClick={() => act(`d-${item.id}`, () => deactivateDriver(item.id), 'Désactivé')} className="p-1.5 text-gray-500 hover:bg-gray-50 rounded-lg"><Icon d={SVG.lock} className="w-4 h-4" /></button>
                            : <button onClick={() => act(`a-${item.id}`, () => activateDriver(item.id), 'Activé')} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"><Icon d={SVG.unlock} className="w-4 h-4" /></button>}
                          <button onClick={() => setResetItem(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><Icon d={SVG.key} className="w-4 h-4" /></button>
                          <button onClick={() => setDeleting(item)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"><Icon d={SVG.trash} className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-gray-400">Page {page}/{totalPages}</p>
                <div className="flex gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page <= 1} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40">←</button>
                  <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page >= totalPages} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40">→</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
