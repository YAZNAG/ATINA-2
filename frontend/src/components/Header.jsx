import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { logout as logoutApi } from '../api/auth.api';
import toast from 'react-hot-toast';

export default function Header({ title }) {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  const handleLogout = async () => {
    try { await logoutApi(); } catch {}
    logout();
    navigate('/login');
    toast.success('Déconnexion réussie');
  };

  useEffect(() => {
    const onClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const initial = user?.full_name?.charAt(0)?.toUpperCase() || 'U';

  return (
    <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
      <h2 className="text-base font-semibold text-gray-800">{title}</h2>
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpen((s) => !s)}
          className="w-10 h-10 rounded-full bg-blue-600 text-white font-semibold flex items-center justify-center shadow-sm hover:bg-blue-700 transition-colors"
          aria-label="Ouvrir le menu profil"
        >
          {initial}
        </button>

        {open ? (
          <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white shadow-lg p-3 z-20">
            <div className="px-1 pb-2 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-800">{user?.full_name || 'Utilisateur'}</p>
              <p className="text-xs text-slate-500 mt-0.5">{user?.email || '-'}</p>
              <p className="text-xs text-slate-400 mt-0.5">{user?.roles?.[0]?.name || 'Utilisateur'}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full mt-2 text-left text-sm text-red-500 hover:text-red-600 font-medium px-3 py-2 rounded-lg hover:bg-red-50 transition-colors"
            >
              Déconnexion
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
