import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getRoles, createRole, updateRole, deleteRole, assignPermissions, getRolePermissions } from '../../api/roles.api';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../utils/helpers';

const SVG = {
  plus:   'M12 4v16m8-8H4',
  edit:   'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  trash:  'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  x:      'M6 18L18 6M6 6l12 12',
  lock:   'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
  perms:  'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
};

function Icon({ d, className = 'w-5 h-5' }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} /></svg>;
}

const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-300';

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

const EMPTY = { name: '', name_fr: '', name_ar: '', code: '', description: '' };

function DeleteModal({ role, onCancel, onConfirm, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        {role?.is_system ? (
          <>
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <Icon d={SVG.lock} className="w-7 h-7 text-amber-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 text-center mb-2">Rôle système protégé</h3>
            <p className="text-sm text-gray-500 text-center mb-6">Le rôle <strong>{role.name_fr || role.name}</strong> est un rôle système et ne peut pas être supprimé.</p>
            <button onClick={onCancel} className="w-full py-2.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200">Fermer</button>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Icon d={SVG.trash} className="w-7 h-7 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 text-center mb-1">Supprimer le rôle ?</h3>
            <p className="text-sm text-gray-500 text-center mb-6">Le rôle <strong>«{role?.name_fr || role?.name}»</strong> sera supprimé définitivement.</p>
            <div className="flex gap-3">
              <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50">Annuler</button>
              <button onClick={onConfirm} disabled={loading} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                {loading ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Drawer({ editRole, onClose, onSaved }) {
  const isEdit = !!editRole;
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(editRole ? {
      name: editRole.name ?? '', name_fr: editRole.name_fr ?? '', name_ar: editRole.name_ar ?? '',
      code: editRole.code ?? '', description: editRole.description ?? '',
    } : { ...EMPTY });
  }, [editRole]);

  const hc = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name_fr.trim()) return toast.error('Nom (FR) requis');
    if (!isEdit && !form.code.trim()) return toast.error('Code requis');
    setSaving(true);
    try {
      const payload = { ...form, name: form.name_fr };
      if (isEdit) await updateRole(editRole.id, payload);
      else        await createRole(payload);
      toast.success(isEdit ? 'Rôle mis à jour' : 'Rôle créé');
      onSaved();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-40 flex flex-col bg-white shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-purple-700 to-purple-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Icon d={SVG.perms} className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-white/60 text-[11px] font-semibold uppercase tracking-widest">{isEdit ? 'Modifier' : 'Nouveau'}</p>
              <h2 className="text-white font-bold text-xl">Rôle</h2>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/25 flex items-center justify-center">
            <Icon d={SVG.x} className="w-5 h-5 text-white" />
          </button>
        </div>
        <form id="role-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          <Fld label="Code" req>
            {isEdit ? (
              <div className="px-3 py-2.5 text-sm border border-gray-100 rounded-xl bg-gray-50 font-mono text-gray-500 flex items-center gap-2">
                {form.code}<span className="ml-auto text-[11px] text-gray-400">Non modifiable</span>
              </div>
            ) : (
              <>
                <input name="code" className={`${inp} font-mono`} value={form.code}
                  onChange={e => hc({ target: { name: 'code', value: e.target.value.toLowerCase().replace(/\s+/g, '_') } })}
                  placeholder="manager_node" />
                <p className="text-[11px] text-gray-400 mt-1">Minuscules, tirets bas — ex: manager_node</p>
              </>
            )}
          </Fld>
          <Fld label="Nom (Français)" req>
            <input name="name_fr" className={inp} value={form.name_fr} onChange={hc} placeholder="Responsable Node" />
          </Fld>
          <Fld label="Nom (Arabe)">
            <input name="name_ar" className={inp} value={form.name_ar} onChange={hc} dir="rtl" placeholder="مسؤول النود" />
          </Fld>
          <Fld label="Description">
            <textarea name="description" className={inp} value={form.description} onChange={hc} rows={3} placeholder="Description du rôle…" />
          </Fld>
        </form>
        <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-100">Annuler</button>
          <button type="submit" form="role-form" disabled={saving} className="flex-1 py-2.5 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl disabled:opacity-50">
            {saving ? 'Enregistrement…' : isEdit ? 'Mettre à jour' : 'Créer'}
          </button>
        </div>
      </div>
    </>
  );
}

export default function RolesPage() {
  const [roles, setRoles]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer]   = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await getRoles(); setRoles(r.data?.data ?? []); }
    catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (deleting?.is_system) { setDeleting(null); return; }
    setDeleteLoading(true);
    try { await deleteRole(deleting.id); toast.success('Rôle supprimé'); setDeleting(null); load(); }
    catch (err) { toast.error(getErrorMessage(err)); }
    finally { setDeleteLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {deleting && <DeleteModal role={deleting} onCancel={() => setDeleting(null)} onConfirm={handleDelete} loading={deleteLoading} />}
      {drawer !== null && <Drawer editRole={drawer} onClose={() => setDrawer(null)} onSaved={() => { setDrawer(null); load(); }} />}

      <div className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="px-6 pt-5 pb-4 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
              <span>Utilisateurs & Accès</span><span>›</span>
              <span className="text-purple-600 font-medium">Rôles</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Rôles</h1>
            <p className="text-sm text-gray-400 mt-0.5">{roles.length} rôle{roles.length !== 1 ? 's' : ''} — dont {roles.filter(r => r.is_system).length} système</p>
          </div>
          {hasPermission('roles.create') && (
            <button onClick={() => setDrawer(false)} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm flex-shrink-0">
              <Icon d={SVG.plus} className="w-4 h-4" />Nouveau rôle
            </button>
          )}
        </div>
      </div>

      <div className="px-6 py-6">
        {loading ? (
          <div className="flex justify-center py-24"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" /></div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Rôle</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Code</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Nom arabe</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Permissions</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {roles.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400 text-sm">Aucun rôle</td></tr>
                ) : roles.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-gray-900">{r.name_fr || r.name}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{r.description || '—'}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <code className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded text-xs font-mono border border-purple-100">{r.code}</code>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs" dir="rtl">{r.name_ar || '—'}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700">
                        {r.role_permissions?.length ?? 0}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {r.is_system
                        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200"><Icon d={SVG.lock} className="w-3 h-3" />Système</span>
                        : <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">Custom</span>}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {(r.is_active && r.status === 'active')
                        ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">Actif</span>
                        : <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-50 text-gray-400 border border-gray-200">Inactif</span>}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => navigate('/access/role-permissions')}
                          title="Gérer permissions"
                          className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg">
                          <Icon d={SVG.perms} className="w-4 h-4" />
                        </button>
                        {hasPermission('roles.update') && (
                          <button onClick={() => setDrawer(r)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg" title="Modifier">
                            <Icon d={SVG.edit} className="w-4 h-4" />
                          </button>
                        )}
                        {hasPermission('roles.delete') && (
                          <button onClick={() => setDeleting(r)}
                            title={r.is_system ? 'Rôle système' : 'Supprimer'}
                            className={`p-1.5 rounded-lg ${r.is_system ? 'text-gray-300 cursor-not-allowed' : 'text-red-600 hover:bg-red-50'}`}>
                            <Icon d={r.is_system ? SVG.lock : SVG.trash} className="w-4 h-4" />
                          </button>
                        )}
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
