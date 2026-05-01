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
    {
      label: 'Utilisateurs',
      value: stats.users,
      color: 'from-blue-500 to-cyan-500',
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
    },
    {
      label: 'Rôles',
      value: stats.roles,
      color: 'from-violet-500 to-fuchsia-500',
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
    },
    {
      label: 'Permissions',
      value: stats.permissions,
      color: 'from-emerald-500 to-green-500',
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>,
    },
  ];

  const groupedPermissions = (user?.permissions || []).reduce((acc, perm) => {
    const [module] = perm.split('.');
    if (!acc[module]) acc[module] = [];
    acc[module].push(perm);
    return acc;
  }, {});

  const roleLabel = user?.roles?.[0]?.name || 'Utilisateur';
  const todayLabel = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="page-shell">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-700 via-indigo-600 to-blue-500 p-6 md:p-8 text-white shadow-lg">
        <div className="absolute -top-14 -right-8 w-52 h-52 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-16 -left-12 w-48 h-48 rounded-full bg-cyan-300/20 blur-2xl" />
        <div className="relative">
          <p className="text-blue-100 text-sm font-medium uppercase tracking-wide">Tableau de bord</p>
          <h2 className="text-2xl md:text-3xl font-bold mt-1">Bienvenue, {user?.full_name || 'Utilisateur'}</h2>
          <p className="text-blue-100 mt-2">
            {roleLabel} - {todayLabel}
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/15 border border-white/20 px-3 py-1.5 text-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-300" />
            Session active
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
          >
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${card.color}`} />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{card.label}</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{card.value}</p>
              </div>
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.color} text-white flex items-center justify-center shadow`}>
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="page-header">
          <div>
            <h3 className="page-title text-base">Vos permissions actives</h3>
            <p className="page-subtitle">Groupées par module pour une lecture plus claire.</p>
          </div>
          <div className="text-sm text-slate-500">
            Total: <span className="font-semibold text-slate-700">{user?.permissions?.length || 0}</span>
          </div>
        </div>

        {Object.keys(groupedPermissions).length === 0 ? (
          <div className="text-sm text-slate-500 py-6">Aucune permission.</div>
        ) : (
          <div className="space-y-4 mt-2">
            {Object.entries(groupedPermissions)
              .sort(([a], [b]) => a.localeCompare(b, 'fr'))
              .map(([module, perms]) => (
                <div key={module} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">{module}</h4>
                  <div className="flex flex-wrap gap-2">
                    {perms.map((perm) => (
                      <span
                        key={perm}
                        className="px-2.5 py-1 rounded-full text-xs font-medium bg-white border border-slate-200 text-slate-700"
                      >
                        {perm}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
