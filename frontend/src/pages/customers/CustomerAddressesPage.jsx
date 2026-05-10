import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  getCustomer,
  getAddresses, createAddress, updateAddress, setDefaultAddress, deleteAddress,
} from '../../api/customers.api';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../utils/helpers';

const SVG = {
  plus:    'M12 4v16m8-8H4',
  edit:    'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  trash:   'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  x:       'M6 18L18 6M6 6l12 12',
  pin:     'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z',
  star:    'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
  back:    'M10 19l-7-7m0 0l7-7m-7 7h18',
};

function Icon({ d, className = 'w-5 h-5' }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} /></svg>;
}

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

const EMPTY = {
  label: '', street_number: '', street_name: '', quartier: '',
  city: 'Rabat', postal_code: '', delivery_notes: '', is_default: false,
};

function DeleteModal({ addr, onCancel, onConfirm, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <Icon d={SVG.trash} className="w-7 h-7 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 text-center mb-1">Supprimer l'adresse ?</h3>
        <p className="text-sm text-gray-500 text-center mb-6">
          <span className="font-semibold text-gray-700">{addr?.street_name}, {addr?.city}</span> sera supprimée définitivement.
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

function Drawer({ editAddr, customerId, onClose, onSaved }) {
  const isEdit = !!editAddr;
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(editAddr ? {
      label:          editAddr.label          ?? '',
      street_number:  editAddr.street_number  ?? '',
      street_name:    editAddr.street_name    ?? '',
      quartier:       editAddr.quartier       ?? '',
      city:           editAddr.city           ?? 'Rabat',
      postal_code:    editAddr.postal_code    ?? '',
      delivery_notes: editAddr.delivery_notes ?? '',
      is_default:     editAddr.is_default     ?? false,
    } : { ...EMPTY });
  }, [editAddr]);

  const hc = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.street_name.trim()) return toast.error('Nom de rue requis');
    if (!form.city.trim()) return toast.error('Ville requise');
    setSaving(true);
    try {
      if (isEdit) await updateAddress(editAddr.id, form);
      else        await createAddress(customerId, form);
      toast.success(isEdit ? 'Adresse mise à jour' : 'Adresse créée');
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
              <Icon d={SVG.pin} className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-white/60 text-[11px] font-semibold uppercase tracking-widest">{isEdit ? 'Modifier' : 'Nouvelle'}</p>
              <h2 className="text-white font-bold text-xl">Adresse</h2>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/25 flex items-center justify-center">
            <Icon d={SVG.x} className="w-5 h-5 text-white" />
          </button>
        </div>

        <form id="addr-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Fld label="Libellé">
              <input name="label" className={inp} value={form.label} onChange={hc} placeholder="Maison, Bureau…" />
            </Fld>
            <Fld label="N° rue">
              <input name="street_number" className={inp} value={form.street_number} onChange={hc} placeholder="12B" />
            </Fld>
          </div>
          <Fld label="Nom de rue" req>
            <input name="street_name" className={inp} value={form.street_name} onChange={hc} placeholder="Rue Mohammed V" />
          </Fld>
          <div className="grid grid-cols-2 gap-3">
            <Fld label="Quartier">
              <input name="quartier" className={inp} value={form.quartier} onChange={hc} placeholder="Agdal" />
            </Fld>
            <Fld label="Ville" req>
              <input name="city" className={inp} value={form.city} onChange={hc} placeholder="Rabat" />
            </Fld>
          </div>
          <Fld label="Code postal">
            <input name="postal_code" className={inp} value={form.postal_code} onChange={hc} placeholder="10000" maxLength={5} />
          </Fld>
          <Fld label="Instructions livraison">
            <textarea name="delivery_notes" className={inp} value={form.delivery_notes} onChange={hc} rows={2} placeholder="Sonner 2 fois, 3ème étage…" />
          </Fld>
          {!isEdit && (
            <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50">
              <input type="checkbox" checked={form.is_default}
                onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))}
                className="w-4 h-4 rounded accent-red-600" />
              <span className="text-sm font-medium text-gray-700">Définir comme adresse par défaut</span>
            </label>
          )}
        </form>

        <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-100">Annuler</button>
          <button type="submit" form="addr-form" disabled={saving} className="flex-1 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl disabled:opacity-50">
            {saving ? 'Enregistrement…' : isEdit ? 'Mettre à jour' : 'Créer'}
          </button>
        </div>
      </div>
    </>
  );
}

export default function CustomerAddressesPage() {
  const { id: customerId } = useParams();
  const { hasPermission } = useAuth();
  const [customer, setCustomer] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const canUpdate = hasPermission('customers.update') || hasPermission('dashboard.view');
  const canCreate = hasPermission('customers.create') || hasPermission('dashboard.view');
  const canDelete = hasPermission('customers.delete') || hasPermission('dashboard.view');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [custRes, addrRes] = await Promise.all([
        getCustomer(customerId),
        getAddresses(customerId),
      ]);
      setCustomer(custRes.data?.data ?? null);
      setAddresses(addrRes.data?.data ?? []);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  const handleSetDefault = async (addr) => {
    try {
      await setDefaultAddress(addr.id);
      toast.success('Adresse par défaut définie');
      load();
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try { await deleteAddress(deleting.id); toast.success('Adresse supprimée'); setDeleting(null); load(); }
    catch (err) { toast.error(getErrorMessage(err)); }
    finally { setDeleteLoading(false); }
  };

  const active = addresses.filter(a => !a.is_deleted);
  const deleted = addresses.filter(a => a.is_deleted);

  return (
    <div className="min-h-screen bg-gray-50">
      {deleting && <DeleteModal addr={deleting} onCancel={() => setDeleting(null)} onConfirm={handleDelete} loading={deleteLoading} />}
      {drawer !== null && (
        <Drawer editAddr={drawer} customerId={customerId}
          onClose={() => setDrawer(null)} onSaved={() => { setDrawer(null); load(); }} />
      )}

      <div className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-start justify-between gap-4 mb-1">
            <div>
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                <Link to="/customers" className="hover:text-red-600 transition-colors">Clients</Link>
                <span>›</span>
                <Link to={`/customers/${customerId}`} className="hover:text-red-600 transition-colors">
                  {customer?.name ?? '…'}
                </Link>
                <span>›</span>
                <span className="text-red-600 font-medium">Adresses</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Adresses de livraison</h1>
              {customer && (
                <p className="text-sm text-gray-400 mt-0.5">
                  {customer.name} · {customer.phone_country} {customer.phone_number} · {active.length} adresse{active.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
            {canCreate && (
              <button onClick={() => setDrawer(false)} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm flex-shrink-0">
                <Icon d={SVG.plus} className="w-4 h-4" />Nouvelle adresse
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        {loading ? (
          <div className="flex justify-center py-24"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" /></div>
        ) : active.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-20 h-20 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
              <Icon d={SVG.pin} className="w-10 h-10 text-red-200" />
            </div>
            <p className="text-gray-600 font-semibold">Aucune adresse enregistrée</p>
            {canCreate && (
              <button onClick={() => setDrawer(false)} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl">
                <Icon d={SVG.plus} className="w-4 h-4" />Créer la première adresse
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {/* Active addresses */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {active.map(addr => (
                <div key={addr.id} className={`bg-white rounded-2xl border shadow-sm transition-all ${addr.is_default ? 'border-red-200 ring-2 ring-red-100' : 'border-gray-100'}`}>
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${addr.is_default ? 'bg-red-50' : 'bg-gray-100'}`}>
                          <Icon d={SVG.pin} className={`w-5 h-5 ${addr.is_default ? 'text-red-600' : 'text-gray-400'}`} />
                        </div>
                        <div>
                          {addr.label && <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{addr.label}</p>}
                          {addr.is_default && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600">
                              <Icon d={SVG.star} className="w-3 h-3" />Par défaut
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-700 space-y-0.5">
                      <p className="font-medium">
                        {addr.street_number && `${addr.street_number} `}{addr.street_name}
                      </p>
                      {addr.quartier && <p className="text-gray-400">{addr.quartier}</p>}
                      <p className="text-gray-500">{addr.postal_code ? `${addr.postal_code} ` : ''}{addr.city}</p>
                      {addr.delivery_notes && (
                        <p className="text-xs text-gray-400 italic mt-2 border-t border-gray-50 pt-2">{addr.delivery_notes}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 px-4 pb-4 pt-3 border-t border-gray-50">
                    {canUpdate && !addr.is_default && (
                      <button onClick={() => handleSetDefault(addr)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg">
                        <Icon d={SVG.star} className="w-3.5 h-3.5" />Défaut
                      </button>
                    )}
                    {canUpdate && (
                      <button onClick={() => setDrawer(addr)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg">
                        <Icon d={SVG.edit} className="w-3.5 h-3.5" />Modifier
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => setDeleting(addr)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg ml-auto">
                        <Icon d={SVG.trash} className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* Add card */}
              {canCreate && (
                <button onClick={() => setDrawer(false)}
                  className="rounded-2xl border-2 border-dashed border-red-200 hover:border-red-400 bg-white hover:bg-red-50 transition-all flex flex-col items-center justify-center gap-3 p-8 text-red-400 hover:text-red-600 min-h-[160px]">
                  <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                    <Icon d={SVG.plus} className="w-6 h-6 text-red-500" />
                  </div>
                  <span className="text-sm font-semibold">Ajouter une adresse</span>
                </button>
              )}
            </div>

            {/* Deleted addresses (collapsed) */}
            {deleted.length > 0 && (
              <details className="group">
                <summary className="cursor-pointer text-xs font-semibold text-gray-400 uppercase tracking-wide list-none flex items-center gap-2">
                  <span className="w-4 h-4 rounded bg-gray-100 flex items-center justify-center text-gray-500 group-open:rotate-90 transition-transform">›</span>
                  {deleted.length} adresse{deleted.length !== 1 ? 's' : ''} supprimée{deleted.length !== 1 ? 's' : ''} (historique)
                </summary>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {deleted.map(addr => (
                    <div key={addr.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 opacity-50">
                      <p className="text-sm font-medium text-gray-600 line-through">
                        {addr.street_number && `${addr.street_number} `}{addr.street_name}
                      </p>
                      <p className="text-xs text-gray-400">{addr.city}</p>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
