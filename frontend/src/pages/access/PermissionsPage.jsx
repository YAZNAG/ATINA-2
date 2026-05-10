import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { getPermissions } from '../../api/permissions.api';
import { getErrorMessage } from '../../utils/helpers';

const SVG = {
  plus:   'M12 4v16m8-8H4',
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  lock:   'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z',
};

function Icon({ d, className = 'w-5 h-5' }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} /></svg>;
}

const MODULE_COLORS = {
  dashboard:   { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-400' },
  users:       { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    dot: 'bg-blue-500' },
  roles:       { bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200',  dot: 'bg-purple-500' },
  permissions: { bg: 'bg-green-50',   text: 'text-green-700',   border: 'border-green-200',   dot: 'bg-green-500' },
  customers:   { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200',    dot: 'bg-rose-500' },
  addresses:   { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200',  dot: 'bg-orange-500' },
  orders:      { bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200',  dot: 'bg-indigo-500' },
  picking:     { bg: 'bg-cyan-50',    text: 'text-cyan-700',    border: 'border-cyan-200',    dot: 'bg-cyan-500' },
  delivery:    { bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200',    dot: 'bg-teal-500' },
  stock:       { bg: 'bg-slate-50',   text: 'text-slate-700',   border: 'border-slate-200',   dot: 'bg-slate-500' },
  catalog:     { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200',  dot: 'bg-violet-500' },
  geography:   { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  nodes:       { bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', border: 'border-fuchsia-200', dot: 'bg-fuchsia-500' },
  warehouse:   { bg: 'bg-yellow-50',  text: 'text-yellow-700',  border: 'border-yellow-200',  dot: 'bg-yellow-400' },
  settings:    { bg: 'bg-gray-50',    text: 'text-gray-700',    border: 'border-gray-200',    dot: 'bg-gray-400' },
};
const clr = (m) => MODULE_COLORS[m] ?? { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200', dot: 'bg-gray-400' };

export default function PermissionsPage() {
  const [groups, setGroups]   = useState({});
  const [search, setSearch]   = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPermissions()
      .then(r => setGroups(r.data?.data ?? {}))
      .catch(err => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const total = Object.values(groups).reduce((acc, p) => acc + p.length, 0);
  const q = search.toLowerCase();

  const filtered = Object.fromEntries(
    Object.entries(groups)
      .map(([mod, perms]) => [mod, q ? perms.filter(p => p.code.includes(q) || (p.name_fr || p.name || '').toLowerCase().includes(q)) : perms])
      .filter(([, p]) => p.length > 0)
  );

  const filteredTotal = Object.values(filtered).reduce((acc, p) => acc + p.length, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                <span>Utilisateurs & Accès</span><span>›</span>
                <span className="text-green-600 font-medium">Permissions</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Permissions</h1>
              <p className="text-sm text-gray-400 mt-0.5">{total} permissions réparties en {Object.keys(groups).length} modules</p>
            </div>
          </div>
          <div className="flex items-center gap-2 max-w-sm">
            <div className="relative flex-1">
              <Icon d={SVG.search} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par code ou nom…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 bg-white" />
            </div>
            {search && <button onClick={() => setSearch('')} className="px-2 py-2 border border-gray-200 text-gray-500 text-sm rounded-xl hover:bg-gray-50">✕</button>}
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        {/* Stats bar */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total</p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5">{search ? filteredTotal : total}</p>
          </div>
          {Object.entries(filtered).map(([mod, perms]) => {
            const c = clr(mod);
            return (
              <div key={mod} className={`rounded-xl border px-4 py-3 ${c.bg} ${c.border}`}>
                <p className={`text-xs font-semibold uppercase tracking-wide capitalize ${c.text}`}>{mod}</p>
                <p className={`text-2xl font-bold mt-0.5 ${c.text}`}>{perms.length}</p>
              </div>
            );
          })}
        </div>

        {loading ? (
          <div className="flex justify-center py-24"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" /></div>
        ) : (
          <div className="space-y-4">
            {Object.entries(filtered).map(([mod, perms]) => {
              const c = clr(mod);
              return (
                <div key={mod} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className={`px-5 py-3 border-b border-gray-50 flex items-center justify-between ${c.bg}`}>
                    <div className="flex items-center gap-2.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
                      <span className={`font-semibold text-sm capitalize ${c.text}`}>{mod}</span>
                    </div>
                    <span className={`text-xs font-semibold ${c.text} opacity-70`}>{perms.length} permission{perms.length !== 1 ? 's' : ''}</span>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50/50 border-b border-gray-50">
                        <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Nom</th>
                        <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Code</th>
                        <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                        <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Nom arabe</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {perms.map(p => (
                        <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-5 py-3 font-medium text-gray-800">{p.name_fr || p.name}</td>
                          <td className="px-5 py-3">
                            <code className={`px-2 py-0.5 rounded text-xs font-mono border ${c.bg} ${c.border} ${c.text}`}>{p.code}</code>
                          </td>
                          <td className="px-5 py-3">
                            {p.action && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200 font-mono">{p.action}</span>}
                          </td>
                          <td className="px-5 py-3 text-gray-500 text-xs" dir="rtl">{p.name_ar || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
