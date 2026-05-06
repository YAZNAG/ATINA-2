import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getP0Registry } from '../api/p0.api';

const Icon = ({ d, className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={d} />
  </svg>
);

const ICONS = {
  dashboard: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  users: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  roles: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  perms: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z',
  catalog: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  settings: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4',
  geo: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 01.553-.894L9 2m0 18l6-3m-6 3V2m6 15l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 2',
  warehouse: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  node: 'M3 7l9-4 9 4-9 4-9-4zm0 5l9 4 9-4m-18 5l9 4 9-4',
  customers: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  tables: 'M4 7h16M4 12h16M4 17h10',
  chevron: 'M19 9l-7 7-7-7',
  gear: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
};

const navItems = [
  { label: 'Clients', path: '/customers', anyPermissions: ['customers.view', 'dashboard.view'], icon: ICONS.customers },
  { label: 'Tableau de bord', path: '/dashboard', permission: 'dashboard.view', icon: ICONS.dashboard },
  { label: 'Utilisateurs', path: '/users', permission: 'users.view', icon: ICONS.users },
  { label: 'Rôles', path: '/roles', permission: 'roles.view', icon: ICONS.roles },
  { label: 'Permissions', path: '/permissions', permission: 'permissions.view', icon: ICONS.perms },
  {
    label: 'Catalogue', key: 'catalog', group: true, icon: ICONS.catalog,
    children: [
      { label: 'Articles', path: '/catalog/articles', permission: 'articles.view' },
      { label: 'SKU', path: '/catalog/skus', permission: 'skus.view' },
      { label: 'Images SKU', path: '/catalog/sku-images', permission: 'sku_images.view' },
    ],
  },
  {
    label: 'Paramétrage Catalogue', key: 'catalogRef', group: true, icon: ICONS.settings,
    children: [
      { label: 'Taxonomie', path: '/catalog/taxonomy', anyPermissions: ['families.view', 'categories.view', 'sub_categories.view'] },
      { label: 'Références', path: '/catalog/refs', anyPermissions: ['brands.view', 'units.view', 'article_types.view', 'article_statuses.view', 'taxes.view', 'packaging_types.view', 'conservation_types.view'] },
    ],
  },
  {
    label: 'Entrepôt', key: 'warehouse', group: true, icon: ICONS.warehouse,
    children: [
      { label: 'Emplacements & SKU', path: '/warehouse', permission: 'warehouse.view' },
    ],
  },
  {
    label: 'Paramétrage Entrepôt', key: 'warehouseRef', group: true, icon: ICONS.gear,
    children: [
      { label: 'Zones', path: '/warehouse/zones', permission: 'warehouse.view' },
      { label: 'Niveaux', path: '/warehouse/levels', permission: 'warehouse.view' },
    ],
  },
  {
    label: 'Géographie', key: 'geo', group: true, icon: ICONS.geo,
    children: [
      { label: 'Régions', path: '/geo/regions', permission: 'regions.view' },
      { label: 'Provinces', path: '/geo/provinces', permission: 'provinces.view' },
      { label: 'Villes', path: '/geo/cities', permission: 'cities.view' },
    ],
  },
  { label: 'Types de noeud', path: '/node-types', anyPermissions: ['node_types.view'], icon: ICONS.tables },
  { label: 'Noeuds', path: '/nodes', anyPermissions: ['nodes.view'], icon: ICONS.node },
];

function NavItem({ item, isActive }) {
  return (
    <NavLink
      to={item.path}
      className={() =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
          isActive
            ? 'bg-red-600 text-white shadow-sm shadow-red-900/30'
            : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
        }`
      }
    >
      <Icon d={item.icon} />
      <span>{item.label}</span>
    </NavLink>
  );
}

function GroupItem({ item, isPathActive, openGroups, setOpenGroups, hasPermission }) {
  const children = item.children.filter((c) =>
    c.anyPermissions
      ? c.anyPermissions.some((p) => hasPermission(p))
      : hasPermission(c.permission)
  );
  if (!children.length) return null;
  const groupActive = children.some((c) => isPathActive(c.path, c.exact));
  const isOpen = openGroups[item.key] || groupActive;

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={() => setOpenGroups((p) => ({ ...p, [item.key]: !isOpen }))}
        className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
          groupActive
            ? 'bg-red-600 text-white shadow-sm shadow-red-900/30'
            : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
        }`}
      >
        <span className="flex items-center gap-3">
          <Icon d={item.icon} />
          <span>{item.label}</span>
        </span>
        <Icon
          d={ICONS.chevron}
          className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className={`ml-8 space-y-0.5 border-l-2 border-red-800/40 pl-3 ${
          item.key === 'p0tables' ? 'max-h-[min(70vh,28rem)] overflow-y-auto pr-1' : ''
        }`}>
          {children.map((child) => {
            const active = isPathActive(child.path, child.exact);
            return (
              <NavLink
                key={child.path}
                to={child.path}
                title={child.title ?? child.label}
                className={() =>
                  `block px-3 py-2 rounded-lg text-xs font-medium transition-all truncate ${
                    active
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                      : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200'
                  }`
                }
              >
                {child.label}
              </NavLink>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const { pathname } = useLocation();
  const { hasPermission, user } = useAuth();
  const [openGroups, setOpenGroups] = useState({
    catalog: false, catalogRef: false,
    warehouse: false, warehouseRef: false,
    geo: false, p0tables: false,
  });
  const [p0GroupChildren, setP0GroupChildren] = useState([]);

  useEffect(() => {
    if (!hasPermission('dashboard.view')) { setP0GroupChildren([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await getP0Registry();
        const groups = res.data?.data?.groups ?? [];
        const kids = [];
        for (const g of groups) {
          for (const t of g.tables || []) {
            kids.push({ label: t.labelFr || t.sql, path: `/p0/tables/${encodeURIComponent(t.sql)}`, permission: 'dashboard.view', title: `${t.sql} - ${t.model}` });
          }
        }
        if (!cancelled) setP0GroupChildren(kids);
      } catch { if (!cancelled) setP0GroupChildren([]); }
    })();
    return () => { cancelled = true; };
  }, [hasPermission]);

  const navWithP0 = useMemo(() => {
    const head = p0GroupChildren.length > 0
      ? [{ label: 'Référentiel données', key: 'p0tables', group: true, icon: ICONS.tables, children: p0GroupChildren }]
      : [];
    return [...head, ...navItems];
  }, [p0GroupChildren]);

  const canSeeLink = (item) => {
    if (item.group && item.children?.length) {
      return item.children.some((c) =>
        c.anyPermissions
          ? c.anyPermissions.some((p) => hasPermission(p))
          : hasPermission(c.permission)
      );
    }
    if (item.anyPermissions?.length) return item.anyPermissions.some((p) => hasPermission(p));
    return hasPermission(item.permission);
  };

  const visibleItems = useMemo(() => navWithP0.filter(canSeeLink), [hasPermission, navWithP0]);

  const isPathActive = (path, exact) => exact ? pathname === path : pathname === path || pathname.startsWith(`${path}/`);

  useEffect(() => {
    const open = (key) => setOpenGroups((p) => ({ ...p, [key]: true }));
    if (pathname.startsWith('/p0/tables')) open('p0tables');
    if (['/catalog', '/catalog/articles', '/catalog/skus', '/catalog/sku-images'].some((p) => pathname.startsWith(p)) && !pathname.startsWith('/catalog/ref')) open('catalog');
    if (pathname.startsWith('/catalog/ref') || pathname.startsWith('/catalog/taxonomy') || pathname.startsWith('/catalog/refs')) open('catalogRef');
    if (pathname.startsWith('/geo')) open('geo');
    if (pathname.startsWith('/warehouse') && !pathname.startsWith('/warehouse/zones') && !pathname.startsWith('/warehouse/levels')) open('warehouse');
    if (pathname.startsWith('/warehouse/zones') || pathname.startsWith('/warehouse/levels')) open('warehouseRef');
  }, [pathname]);

  const initials = user?.full_name?.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() ?? '?';

  return (
    <aside className="w-64 bg-zinc-950 min-h-screen flex flex-col flex-shrink-0 border-r border-zinc-800/60">
      {/* Brand */}
      <div className="px-4 py-5 border-b border-zinc-800/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-900/40 flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <h1 className="text-white font-bold text-sm tracking-tight">Dark Store</h1>
            <p className="text-zinc-500 text-xs">Management System</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visibleItems.map((item) => {
          if (!item.group) {
            const active = isPathActive(item.path, item.exact);
            return <NavItem key={item.path} item={item} isActive={active} />;
          }
          return (
            <GroupItem
              key={item.key}
              item={item}
              isPathActive={isPathActive}
              openGroups={openGroups}
              setOpenGroups={setOpenGroups}
              hasPermission={hasPermission}
            />
          );
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-3 border-t border-zinc-800/60">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-zinc-800/60 transition-colors cursor-default">
          <div className="w-8 h-8 rounded-lg bg-red-600/20 border border-red-600/30 flex items-center justify-center flex-shrink-0">
            <span className="text-red-400 text-xs font-bold">{initials}</span>
          </div>
          <div className="min-w-0">
            <p className="text-zinc-200 text-xs font-semibold truncate">{user?.full_name}</p>
            <p className="text-zinc-500 text-xs truncate">{user?.email}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
