import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getUsers } from '../../api/users.api';
import { getRoles } from '../../api/roles.api';
import { getPermissions } from '../../api/permissions.api';

export default function Dashboard() {
  const { user, hasPermission } = useAuth();
  const [stats, setStats] = useState({ users: '—', roles: '—', permissions: '—' });

  useEffect(() => {
    const load = async () => {
      const next = { users: '—', roles: '—', permissions: '—' };
      try {
        if (hasPermission('users.view')) {
          const res = await getUsers();
          next.users = res.data.data.length;
        }
        if (hasPermission('roles.view')) {
          const res = await getRoles();
          next.roles = res.data.data.length;
        }
        if (hasPermission('permissions.view')) {
          const res = await getPermissions();
          next.permissions = Object.values(res.data.data).flat().length;
        }
      } catch {}
      setStats(next);
    };
    load();
  }, [hasPermission]);

  const cards = [
    { label: 'Utilisateurs', value: stats.users, color: 'bg-blue-50 text-blue-600', border: 'border-blue-100',
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg> },
    { label: 'Rôles', value: stats.roles, color: 'bg-purple-50 text-purple-600', border: 'border-purple-100',
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg> },
    { label: 'Permissions', value: stats.permissions, color: 'bg-green-50 text-green-600', border: 'border-green-100',
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg> },
  ];

  return (
    <div className="space-y-6">
      <div className="card bg-gradient-to-r from-blue-600 to-blue-700 border-0 text-white">
        <h2 className="text-xl font-bold mb-1">Bienvenue, {user?.full_name}</h2>
        <p className="text-blue-100 text-sm">
          {user?.roles?.[0]?.name} — {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((c) => (
          <div key={c.label} className={`card border ${c.border} flex items-center gap-4`}>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${c.color} flex-shrink-0`}>
              {c.icon}
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{c.value}</p>
              <p className="text-sm text-gray-500">{c.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3">
          Vos permissions actives
        </h3>
        <div className="flex flex-wrap gap-2">
          {user?.permissions?.map((perm) => (
            <span key={perm} className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
              {perm}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
