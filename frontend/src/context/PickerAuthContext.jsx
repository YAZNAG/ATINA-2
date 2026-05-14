import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { pickerLogin as apiPickerLogin } from '../api/pickerPortal.api';

const PickerAuthContext = createContext(null);

// Clés localStorage — ne jamais mélanger avec l'auth admin ('token') ou customer
const TOKEN_KEY = 'picker_token';
const USER_KEY  = 'picker_user';

export function PickerAuthProvider({ children }) {
  const [picker, setPicker]   = useState(null);
  const [loading, setLoading] = useState(true);

  // Lecture initiale depuis localStorage (synchrone)
  const loadPicker = useCallback(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const raw   = localStorage.getItem(USER_KEY);
    if (token && raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.id) setPicker(parsed);
      } catch {
        // JSON corrompu → on nettoie
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadPicker(); }, [loadPicker]);

  const login = async ({ phone_country, phone_number, password }) => {
    const res = await apiPickerLogin({ phone_country, phone_number, password });

    // Le backend renvoie { success, data: { token, picker } }
    const payload    = res.data?.data ?? res.data;
    const token      = payload?.token;
    const pickerData = payload?.picker;

    if (!token)      throw new Error('Token manquant dans la réponse');
    if (!pickerData) throw new Error('Données picker manquantes dans la réponse');

    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY,  JSON.stringify(pickerData));
    setPicker(pickerData);
    return pickerData;
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setPicker(null);
  };

  return (
    <PickerAuthContext.Provider value={{
      picker,
      loading,
      login,
      logout,
      isAuthenticated: !!picker,
    }}>
      {children}
    </PickerAuthContext.Provider>
  );
}

export const usePickerAuth = () => {
  const ctx = useContext(PickerAuthContext);
  if (!ctx) throw new Error('usePickerAuth must be used within PickerAuthProvider');
  return ctx;
};
