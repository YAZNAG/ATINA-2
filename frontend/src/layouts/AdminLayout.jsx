import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

const pageTitles = {
  '/dashboard': 'Tableau de bord',
  '/users': 'Gestion des utilisateurs',
  '/users/new': 'Nouvel utilisateur',
  '/roles': 'Gestion des rôles',
  '/roles/new': 'Nouveau rôle',
  '/permissions': 'Permissions système',
  '/customers': 'Clients',
  '/customers/new': 'Nouveau client',
};

const getTitle = (pathname) => {
  if (pageTitles[pathname]) return pageTitles[pathname];
  if (pathname.startsWith('/customers/') && pathname.endsWith('/edit')) return 'Modifier client';
  if (pathname.startsWith('/customers/')) return 'Fiche client';
  if (pathname.includes('/edit')) return 'Modification';
  return 'Dark Store';
};

export default function AdminLayout() {
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header title={getTitle(location.pathname)} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
