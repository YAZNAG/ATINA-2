import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  {
    label: 'Tableau de bord',
    path: '/dashboard',
    permission: 'dashboard.view',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    label: 'Utilisateurs',
    path: '/users',
    permission: 'users.view',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    label: 'Rôles',
    path: '/roles',
    permission: 'roles.view',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    label: 'Permissions',
    path: '/permissions',
    permission: 'permissions.view',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
      </svg>
    ),
  },
  {
    label: 'Catalogue',
    key: 'catalog',
    group: true,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
    children: [
      { label: 'Articles', path: '/catalog/articles', permission: 'articles.view' },
      { label: 'SKU', path: '/catalog/skus', permission: 'skus.view' },
      { label: 'Images SKU', path: '/catalog/sku-images', permission: 'sku_images.view' },
      { label: 'Families', path: '/catalog/ref/families', permission: 'families.view' },
      { label: 'Categories', path: '/catalog/ref/categories', permission: 'categories.view' },
      { label: 'SubCategories', path: '/catalog/ref/sub-categories', permission: 'sub_categories.view' },
      { label: 'Marques', path: '/catalog/ref/brands', permission: 'brands.view' },
      { label: 'Unités', path: '/catalog/ref/units', permission: 'units.view' },
      { label: 'Conditionnements', path: '/catalog/ref/packaging-types', permission: 'packaging_types.view' },
      { label: 'Conservations', path: '/catalog/ref/conservation-types', permission: 'conservation_types.view' },
      { label: "Types d'article", path: '/catalog/ref/article-types', permission: 'article_types.view' },
      { label: 'Statuts article', path: '/catalog/ref/article-statuses', permission: 'article_statuses.view' },
      { label: 'TVA', path: '/catalog/ref/taxes', permission: 'taxes.view' },
    ],
  },
  {
    label: 'Géographie',
    key: 'geo',
    group: true,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 01.553-.894L9 2m0 18l6-3m-6 3V2m6 15l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 2" />
      </svg>
    ),
    children: [
      { label: 'Régions', path: '/geo/regions', permission: 'regions.view' },
      { label: 'Provinces', path: '/geo/provinces', permission: 'provinces.view' },
      { label: 'Villes', path: '/geo/cities', permission: 'cities.view' },
    ],
  },
  {
    label: 'Types node',
    path: '/node-types',
    anyPermissions: ['node_types.view'],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14-4H5m14 8H5m14 4H5" />
      </svg>
    ),
  },
  {
    label: 'Nodes',
    path: '/nodes',
    anyPermissions: ['nodes.view'],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7l9-4 9 4-9 4-9-4zm0 5l9 4 9-4m-18 5l9 4 9-4" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const { pathname } = useLocation();
  const { hasPermission, user } = useAuth();
  const [openGroups, setOpenGroups] = useState({ catalog: false, geo: false });

  const canSeeLink = (item) => {
    if (item.group && item.children?.length) {
      return item.children.some((child) => hasPermission(child.permission));
    }
    if (item.anyPermissions?.length) return item.anyPermissions.some((p) => hasPermission(p));
    return hasPermission(item.permission);
  };

  const visibleItems = useMemo(() => navItems.filter(canSeeLink), [hasPermission]);

  useEffect(() => {
    if (pathname.startsWith('/catalog')) {
      setOpenGroups((prev) => ({ ...prev, catalog: true }));
    }
    if (pathname.startsWith('/geo')) {
      setOpenGroups((prev) => ({ ...prev, geo: true }));
    }
  }, [pathname]);

  const isPathActive = (path) => pathname === path || pathname.startsWith(`${path}/`);

  return (
    <aside className="w-64 bg-slate-900 min-h-screen flex flex-col flex-shrink-0">
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">DS</span>
          </div>
          <div>
            <h1 className="text-white font-bold text-sm">Dark Store</h1>
            <p className="text-slate-400 text-xs">Management System</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {visibleItems.map((item) => {
          if (!item.group) {
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={() => {
                  const active = isPathActive(item.path);
                  return `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                    active
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`;
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            );
          }

          const children = item.children.filter((child) => hasPermission(child.permission));
          if (!children.length) return null;

          const groupActive = children.some((child) => isPathActive(child.path));
          const isOpen = openGroups[item.key] || groupActive;

          return (
            <div key={item.key} className="space-y-1">
              <button
                type="button"
                onClick={() => setOpenGroups((prev) => ({ ...prev, [item.key]: !isOpen }))}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                  groupActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3">
                  {item.icon}
                  <span>{item.label}</span>
                </span>
                <svg
                  className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isOpen ? (
                <div className="ml-7 space-y-1 border-l border-slate-700 pl-3">
                  {children.map((child) => (
                    <NavLink
                      key={child.path}
                      to={child.path}
                      className={() => {
                        const active = isPathActive(child.path);
                        return `block px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                          active
                            ? 'bg-blue-500 text-white'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                        }`;
                      }}
                    >
                      {child.label}
                    </NavLink>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
            <span className="text-slate-300 text-xs font-medium">
              {user?.full_name?.charAt(0)?.toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-slate-300 text-xs font-medium truncate">{user?.full_name}</p>
            <p className="text-slate-500 text-xs truncate">{user?.email}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
