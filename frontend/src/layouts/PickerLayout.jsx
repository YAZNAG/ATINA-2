import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { usePickerAuth } from '../context/PickerAuthContext';

export default function PickerLayout() {
  const { picker, logout } = usePickerAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/picker/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-indigo-700 text-white shadow-md">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <p className="font-bold text-lg leading-tight">Picker Portal</p>
            <p className="text-indigo-200 text-xs">{picker?.name}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-indigo-200 hover:text-white text-sm underline"
          >
            Déconnexion
          </button>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b shadow-sm">
        <div className="max-w-2xl mx-auto px-4 flex gap-1 py-1">
          {[
            { to: '/picker/dashboard',        label: 'Tableau de bord' },
            { to: '/picker/available-orders', label: 'Disponibles' },
            { to: '/picker/my-orders',        label: 'Mes préparations' },
          ].map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `px-3 py-2 rounded text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
