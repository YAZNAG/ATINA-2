import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePickerAuth } from '../../context/PickerAuthContext';
import toast from 'react-hot-toast';

export default function PickerLoginPage() {
  const { login, isAuthenticated } = usePickerAuth();
  const navigate  = useNavigate();
  const [form, setForm] = useState({ phone_country: '+212', phone_number: '', password: '' });
  const [loading, setLoading] = useState(false);

  // Dès que le contexte confirme l'auth, on navigue
  useEffect(() => {
    if (isAuthenticated) navigate('/picker/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form);
      // La navigation est gérée par le useEffect ci-dessus
    } catch (err) {
      const msg = err?.response?.data?.message ?? 'Identifiants invalides';
      toast.error(msg);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-indigo-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-white text-2xl">📦</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Picker Portal</h1>
          <p className="text-gray-500 text-sm mt-1">Connectez-vous à votre espace</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={form.phone_country}
              onChange={e => setForm({ ...form, phone_country: e.target.value })}
              className="border rounded-lg px-3 py-2 w-20 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="+212"
            />
            <input
              type="text"
              value={form.phone_number}
              onChange={e => setForm({ ...form, phone_number: e.target.value })}
              className="border rounded-lg px-3 py-2 flex-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="6XXXXXXXX"
              required
            />
          </div>

          <input
            type="password"
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
            className="border rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="Mot de passe"
            autoComplete="current-password"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}
