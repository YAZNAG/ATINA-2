import { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { getRoles, assignPermissions, getRolePermissions } from '../../api/roles.api';
import { getPermissionMatrix } from '../../api/permissions.api';
import { getErrorMessage } from '../../utils/helpers';

/**
 * Admin / Configuration > Rôles & Permissions — onglet « Permissions par rôle ».
 *
 * Matrice du classeur (US-121 / US-122) : lignes = ressources groupées par
 * module, colonnes = read / write / delete / export. Le catalogue des
 * permissions est en LECTURE SEULE — on coche, on ne crée jamais une
 * permission ici. Cocher une case accorde tous les droits qu'elle regroupe.
 */

const SVG = {
  shield: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  check: 'M5 13l4 4L19 7',
  save: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z M19 8l3 3-3 3M16 11h6',
  lock: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
};

function Icon({ d, className = 'w-5 h-5' }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} /></svg>;
}

const MODULE_COLORS = {
  dashboard: 'bg-amber-100 text-amber-700 border-amber-200',
  users: 'bg-blue-100 text-blue-700 border-blue-200',
  roles: 'bg-purple-100 text-purple-700 border-purple-200',
  permissions: 'bg-green-100 text-green-700 border-green-200',
  customers: 'bg-rose-100 text-rose-700 border-rose-200',
  orders: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  picking: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  delivery: 'bg-teal-100 text-teal-700 border-teal-200',
  stock: 'bg-slate-100 text-slate-700 border-slate-200',
  catalog: 'bg-violet-100 text-violet-700 border-violet-200',
  location: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  node: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
  warehouse: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  admin: 'bg-gray-200 text-gray-700 border-gray-300',
};
const modColor = (m) => MODULE_COLORS[m] ?? 'bg-gray-100 text-gray-700 border-gray-200';

const ACTION_LABELS = { read: 'Lecture', write: 'Écriture', delete: 'Suppression', export: 'Export' };

export default function RolePermissionsPage() {
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelected] = useState(null);
  const [matrix, setMatrix] = useState({ actions: [], modules: [], total: 0 });
  const [checked, setChecked] = useState({});      // { permissionId: bool }
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [query, setQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');

  useEffect(() => {
    Promise.all([
      getRoles().then((r) => r.data?.data ?? []),
      getPermissionMatrix().then((r) => r.data?.data ?? { actions: [], modules: [], total: 0 }),
    ])
      .then(([rolesData, matrixData]) => { setRoles(rolesData); setMatrix(matrixData); })
      .catch((err) => toast.error(getErrorMessage(err)));
  }, []);

  const loadRolePerms = useCallback(async (role) => {
    if (!role) return;
    setLoading(true);
    try {
      const res = await getRolePermissions(role.id);
      const assigned = res.data?.data ?? [];
      const map = {};
      assigned.forEach((p) => { map[p.id] = true; });
      setChecked(map);
      setDirty(false);
    } catch (err) { toast.error(getErrorMessage(err)); } finally { setLoading(false); }
  }, []);

  const handleSelectRole = (role) => {
    if (dirty && !window.confirm('Des modifications non sauvegardées seront perdues. Continuer ?')) return;
    setSelected(role);
    loadRolePerms(role);
  };

  /** Une case = un ou plusieurs codes de permission : on les bascule ensemble. */
  const toggleCell = (cell) => {
    if (!cell) return;
    const allOn = cell.permission_ids.every((id) => checked[id]);
    setChecked((c) => {
      const next = { ...c };
      cell.permission_ids.forEach((id) => { next[id] = !allOn; });
      return next;
    });
    setDirty(true);
  };

  const idsOfModule = (mod) => mod.resources.flatMap((r) => Object.values(r.cells).filter(Boolean).flatMap((c) => c.permission_ids));

  const toggleModule = (mod) => {
    const ids = idsOfModule(mod);
    const allOn = ids.every((id) => checked[id]);
    setChecked((c) => {
      const next = { ...c };
      ids.forEach((id) => { next[id] = !allOn; });
      return next;
    });
    setDirty(true);
  };

  const selectAll = () => {
    const all = {};
    matrix.modules.forEach((m) => idsOfModule(m).forEach((id) => { all[id] = true; }));
    setChecked(all);
    setDirty(true);
  };

  const clearAll = () => { setChecked({}); setDirty(true); };

  const handleSave = async () => {
    if (!selectedRole) return;
    setSaving(true);
    try {
      const ids = Object.entries(checked).filter(([, v]) => v).map(([k]) => parseInt(k, 10));
      await assignPermissions(selectedRole.id, { permission_ids: ids });
      toast.success(`Permissions enregistrées pour ${selectedRole.name_fr || selectedRole.name}`);
      setDirty(false);
      await loadRolePerms(selectedRole);
    } catch (err) { toast.error(getErrorMessage(err)); } finally { setSaving(false); }
  };

  const visibleModules = useMemo(() => {
    const q = query.trim().toLowerCase();
    return matrix.modules
      .filter((m) => !moduleFilter || m.module === moduleFilter)
      .map((m) => ({
        ...m,
        resources: m.resources.filter((r) => !q
          || r.resource.toLowerCase().includes(q)
          || String(r.label).toLowerCase().includes(q)),
      }))
      .filter((m) => m.resources.length > 0);
  }, [matrix, query, moduleFilter]);

  const totalChecked = Object.values(checked).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                <span>Admin / Configuration</span><span>›</span>
                <span className="text-purple-600 font-medium">Permissions par rôle</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Permissions par rôle</h1>
              <p className="text-sm text-gray-400 mt-0.5">
                Ressource (ligne) × action (colonne). Le catalogue est en lecture seule : vous accordez un droit, vous n'en créez pas.
              </p>
            </div>
            {selectedRole && dirty && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm disabled:opacity-50 flex-shrink-0"
              >
                <Icon d={SVG.save} className="w-4 h-4" />{saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-120px)]">
        {/* ── Rôles ─────────────────────────────────────────────────── */}
        <div className="w-64 border-r border-gray-100 bg-white overflow-y-auto flex-shrink-0">
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Rôles</p>
          </div>
          {roles.map((role) => {
            const isSelected = selectedRole?.id === role.id;
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => handleSelectRole(role)}
                className={`w-full text-left px-4 py-3.5 border-b border-gray-50 transition-colors ${isSelected ? 'bg-purple-50 border-l-4 border-l-purple-600' : 'hover:bg-gray-50 border-l-4 border-l-transparent'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold truncate ${isSelected ? 'text-purple-800' : 'text-gray-800'}`}>
                      {role.name_fr || role.name}
                    </p>
                    <p className="text-[11px] font-mono text-gray-400">{role.code}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {role.is_system && <Icon d={SVG.lock} className="w-3.5 h-3.5 text-gray-400" />}
                    <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                      {role.permissions_count ?? role.role_permissions?.length ?? 0}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Matrice ───────────────────────────────────────────────── */}
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
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-xl border border-gray-100 px-5 py-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center">
                    <Icon d={SVG.shield} className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{selectedRole.name_fr || selectedRole.name}</p>
                    <p className="text-xs font-mono text-gray-400">{selectedRole.code}</p>
                  </div>
                  <span className={`ml-2 text-xs font-semibold px-2.5 py-1 rounded-full ${dirty ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-purple-50 text-purple-700 border border-purple-100'}`}>
                    {totalChecked} / {matrix.total} droits
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg w-44"
                    placeholder="Rechercher une ressource…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <select
                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg"
                    value={moduleFilter}
                    onChange={(e) => setModuleFilter(e.target.value)}
                  >
                    <option value="">Tous les modules</option>
                    {matrix.modules.map((m) => <option key={m.module} value={m.module}>{m.module}</option>)}
                  </select>
                  <button type="button" onClick={selectAll} className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100">
                    Tout cocher
                  </button>
                  <button type="button" onClick={clearAll} className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100">
                    Tout décocher
                  </button>
                  {dirty && (
                    <>
                      <button type="button" onClick={() => loadRolePerms(selectedRole)} className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100">
                        Annuler
                      </button>
                      <button type="button" onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50">
                        <Icon d={SVG.save} className="w-3.5 h-3.5" />{saving ? '…' : 'Enregistrer'}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {visibleModules.length === 0 && (
                <p className="bg-white rounded-2xl border border-gray-100 px-5 py-8 text-center text-sm text-gray-400">
                  Aucune ressource pour ces critères.
                </p>
              )}

              {visibleModules.map((mod) => {
                const ids = idsOfModule(mod);
                const modChecked = ids.filter((id) => checked[id]).length;
                const allMod = ids.length > 0 && modChecked === ids.length;
                const someMod = modChecked > 0 && !allMod;
                return (
                  <div key={mod.module} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50 bg-gray-50/50">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => toggleModule(mod)}
                          title="Tout cocher / décocher pour ce module"
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                            allMod ? 'bg-purple-600 border-purple-600' : someMod ? 'bg-purple-200 border-purple-400' : 'border-gray-300'
                          }`}
                        >
                          {(allMod || someMod) && <Icon d={SVG.check} className="w-3 h-3 text-white" />}
                        </button>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${modColor(mod.module)}`}>
                          {mod.module}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">{modChecked}/{ids.length}</span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-50">
                            <th className="px-5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">Ressource</th>
                            {matrix.actions.map((a) => (
                              <th key={a} className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-400 w-28">
                                {ACTION_LABELS[a] || a}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {mod.resources.map((r) => (
                            <tr key={r.resource} className="hover:bg-gray-50/50">
                              <td className="px-5 py-2.5">
                                <p className="text-sm font-semibold text-gray-800">{r.label}</p>
                                <code className="text-[11px] text-gray-400 font-mono">{r.resource}</code>
                              </td>
                              {matrix.actions.map((a) => {
                                const cell = r.cells[a];
                                const on = cell ? cell.permission_ids.every((id) => checked[id]) : false;
                                return (
                                  <td key={a} className="px-3 py-2.5 text-center">
                                    {cell ? (
                                      <button
                                        type="button"
                                        onClick={() => toggleCell(cell)}
                                        title={cell.codes.join(' · ')}
                                        className={`w-5 h-5 mx-auto rounded border-2 flex items-center justify-center transition-all ${
                                          on ? 'bg-purple-600 border-purple-600' : 'border-gray-300 hover:border-purple-400'
                                        }`}
                                      >
                                        {on && <Icon d={SVG.check} className="w-3 h-3 text-white" />}
                                      </button>
                                    ) : (
                                      <span className="text-gray-200">—</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
