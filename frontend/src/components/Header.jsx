import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { logout as logoutApi } from '../api/auth.api';
import toast from 'react-hot-toast';

export default function Header({ title }) {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try { await logoutApi(); } catch {}
    logout();
    navigate('/login');
    toast.success('Déconnexion réussie');
  };

  return (
    <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
      <h2 className="text-base font-semibold text-gray-800">{title}</h2>
      <div className="flex items-center gap-4">
        <div className="hidden sm:block text-right">
          <p className="text-sm font-medium text-gray-700 leading-none">{user?.full_name}</p>
          <p className="text-xs text-gray-400 mt-0.5">{user?.roles?.[0]?.name || 'Utilisateur'}</p>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-red-500 hover:text-red-600 font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
        >
          Déconnexion
        </button>
      </div>
    </header>
  );
}
