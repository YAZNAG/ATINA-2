import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getRoles, assignPermissions, getRolePermissions } from '../../api/roles.api';
import { getPermissions } from '../../api/permissions.api';
import { getErrorMessage } from '../../utils/helpers';

const SVG = {
  shield: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  check:  'M5 13l4 4L19 7',
  save:   'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z M19 8l3 3-3 3M16 11h6',
  lock:   'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
};

function Icon({ d, className = 'w-5 h-5' }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} /></svg>;
}

const MODULE_COLORS = {
  dashboard: 'bg-amber-100 text-amber-700 border-amber-200',
  users:     'bg-blue-100 text-blue-700 border-blue-200',
  roles:     'bg-purple-100 text-purple-700 border-purple-200',
  permissions:'bg-green-100 text-green-700 border-green-200',
  customers: 'bg-rose-100 text-rose-700 border-rose-200',
  addresses: 'bg-orange-100 text-orange-700 border-orange-200',
  orders:    'bg-indigo-100 text-indigo-700 border-indigo-200',
  picking:   'bg-cyan-100 text-cyan-700 border-cyan-200',
  delivery:  'bg-teal-100 text-teal-700 border-teal-200',
  stock:     'bg-slate-100 text-slate-700 border-slate-200',
  catalog:   'bg-violet-100 text-violet-700 border-violet-200',
  geography: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  nodes:     'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
  warehouse: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  settings:  'bg-gray-100 text-gray-700 border-gray-200',
};

const modColor = (m) => MODULE_COLORS[m] ?? 'bg-gray-100 text-gray-700 border-gray-200';

const ROLE_SYSTEM_CODES = ['superadmin', 'backoffice_admin'];

export default function RolePermissionsPage() {
  const [roles, setRoles]           = useState([]);
  const [selectedRole, setSelected] = useState(null);
  const [groups, setGroups]         = useState({});      // { module: [Permission] }
  const [checked, setChecked]       = useState({});      // { permId: bool }
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [dirty, setDirty]           = useState(false);

  // Load roles + all permissions on mount
  useEffect(() => {
    Promise.all([
      getRoles().then(r => r.data?.data ?? []),
      getPermissions().then(r => r.data?.data ?? {}),
    ]).then(([rolesData, groupsData]) => {
      setRoles(rolesData);
      setGroups(groupsData);
    }).catch(err => toast.error(getErrorMessage(err)));
  }, []);

  // Load role's current permissions when role changes
  const loadRolePerms = useCallback(async (role) => {
    if (!role) return;
    setLoading(true);
    try {
      const res = await getRolePermissions(role.id);
      const assigned = res.data?.data ?? [];
      const map = {};
      assigned.forEach(p => { map[p.id] = true; });
      setChecked(map);
      setDirty(false);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, []);

  const handleSelectRole = (role) => {
    if (dirty && !window.confirm('Des modifications non sauvegardées seront perdues. Continuer ?')) return;
    setSelected(role);
    loadRolePerms(role);
  };

  const toggle = (permId) => {
    setChecked(c => ({ ...c, [permId]: !c[permId] }));
    setDirty(true);
  };

  const toggleModule = (perms) => {
    const allChecked = perms.every(p => checked[p.id]);
    const newChecked = { ...checked };
    perms.forEach(p => { newChecked[p.id] = !allChecked; });
    setChecked(newChecked);
    setDirty(true);
  };

  const selectAll = () => {
    const all = {};
    Object.values(groups).flat().forEach(p => { all[p.id] = true; });
    setChecked(all);
    setDirty(true);
  };

  const clearAll = () => {
    setChecked({});
    setDirty(true);
  };

  const handleSave = async () => {
    if (!selectedRole) return;
    setSaving(true);
    try {
      const ids = Object.entries(checked).filter(([, v]) => v).map(([k]) => parseInt(k));
      await assignPermissions(selectedRole.id, { permission_ids: ids });
      toast.success(`Permissions sauvegardées pour ${selectedRole.name_fr || selectedRole.name}`);
      setDirty(false);
      await loadRolePerms(selectedRole);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  const totalChecked = Object.values(checked).filter(Boolean).length;
  const totalPerms = Object.values(groups).flat().length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                <span>Utilisateurs & Accès</span><span>›</span>
                <span className="text-purple-600 font-medium">Attribution permissions</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Attribution des permissions</h1>
              <p className="text-sm text-gray-400 mt-0.5">Sélectionnez un rôle puis cochez les permissions à accorder</p>
            </div>
            {selectedRole && dirty && (
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm disabled:opacity-50 flex-shrink-0">
                <Icon d={SVG.save} className="w-4 h-4" />{saving ? 'Sauvegarde…' : 'Sauvegarder'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-120px)]">
        {/* ── Left: Role list ──────────────────────────────────────────── */}
        <div className="w-64 border-r border-gray-100 bg-white overflow-y-auto flex-shrink-0">
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Rôles</p>
          </div>
          {roles.map(role => {
            const isSelected = selectedRole?.id === role.id;
            const isSystem   = ROLE_SYSTEM_CODES.includes(role.code);
            return (
              <button key={role.id} onClick={() => handleSelectRole(role)}
                className={`w-full text-left px-4 py-3.5 border-b border-gray-50 transition-colors ${isSelected ? 'bg-purple-50 border-l-4 border-l-purple-600' : 'hover:bg-gray-50 border-l-4 border-l-transparent'}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold truncate ${isSelected ? 'text-purple-800' : 'text-gray-800'}`}>
                      {role.name_fr || role.name}
                    </p>
                    <p className="text-[11px] font-mono text-gray-400">{role.code}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {isSystem && (
                      <Icon d={SVG.lock} className="w-3.5 h-3.5 text-gray-400" />
                    )}
                    <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                      {role.role_permissions?.length ?? 0}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Right: Permissions ────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {!selectedRole ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="w-20 h-20 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center">
                <Icon d={SVG.shield} className="w-10 h-10 text-purple-200" />
              </div>
              <p className="text-gray-500 font-medium">Sélectionnez un rôle pour gérer ses permissions</p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-full gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
            </div>
          ) : (
            <div className="p-6 space-y-4">
              {/* Header actions */}
              <div className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-5 py-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center">
                    <Icon d={SVG.shield} className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{selectedRole.name_fr || selectedRole.name}</p>
                    <p className="text-xs font-mono text-gray-400">{selectedRole.code}</p>
                  </div>
                  <span className={`ml-2 text-xs font-semibold px-2.5 py-1 rounded-full ${dirty ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-purple-50 text-purple-700 border border-purple-100'}`}>
                    {totalChecked} / {totalPerms} permissions
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={selectAll}
                    className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100">
                    Tout cocher
                  </button>
                  <button onClick={clearAll}
                    className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100">
                    Tout décocher
                  </button>
                  {dirty && (
                    <button onClick={handleSave} disabled={saving}
                      className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50">
                      <Icon d={SVG.save} className="w-3.5 h-3.5" />{saving ? '…' : 'Sauvegarder'}
                    </button>
                  )}
                </div>
              </div>

              {/* Permissions grouped by module */}
              {Object.entries(groups).map(([module, perms]) => {
                const moduleChecked = perms.filter(p => checked[p.id]).length;
                const allMod = moduleChecked === perms.length;
                const someMod = moduleChecked > 0 && !allMod;
                return (
                  <div key={module} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {/* Module header */}
                    <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50 bg-gray-50/50">
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer" onClick={() => toggleModule(perms)}>
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                            allMod ? 'bg-purple-600 border-purple-600' : someMod ? 'bg-purple-200 border-purple-400' : 'border-gray-300'
                          }`}>
                            {(allMod || someMod) && <Icon d={SVG.check} className="w-3 h-3 text-white" />}
                          </div>
                        </label>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${modColor(module)}`}>
                          {module}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">{moduleChecked}/{perms.length}</span>
                    </div>

                    {/* Permissions rows */}
                    <div className="divide-y divide-gray-50">
                      {perms.map(perm => (
                        <label key={perm.id}
                          className={`flex items-center gap-4 px-5 py-3 cursor-pointer transition-colors hover:bg-gray-50/50 ${checked[perm.id] ? 'bg-purple-50/30' : ''}`}>
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                            checked[perm.id] ? 'bg-purple-600 border-purple-600' : 'border-gray-300'
                          }`} onClick={() => toggle(perm.id)}>
                            {checked[perm.id] && <Icon d={SVG.check} className="w-3 h-3 text-white" />}
                          </div>
                          <div className="flex-1 min-w-0" onClick={() => toggle(perm.id)}>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-gray-800">
                                {perm.name_fr || perm.name}
                              </p>
                              {perm.action && (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200">{perm.action}</span>
                              )}
                            </div>
                            {perm.name_ar && (
                              <p className="text-xs text-gray-400 mt-0.5" dir="rtl">{perm.name_ar}</p>
                            )}
                          </div>
                          <code className="text-[11px] text-gray-400 font-mono flex-shrink-0">{perm.code}</code>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
