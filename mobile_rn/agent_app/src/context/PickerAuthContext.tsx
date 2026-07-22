import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY  = 'picker_auth_token';
const PICKER_KEY = 'picker_profile';

export interface PickerProfile {
  id:           string;
  name:         string;
  phone_number: string;
  phone_country: string;
  node_id:      string;
  is_active:    boolean;
  profile_type: 'picker';
  role:         'picker';
}

interface PickerAuthContextType {
  token:   string | null;
  picker:  PickerProfile | null;
  loading: boolean;
  login:   (token: string, picker: PickerProfile) => Promise<void>;
  logout:  () => Promise<void>;
}

const PickerAuthContext = createContext<PickerAuthContextType>({
  token:   null,
  picker:  null,
  loading: true,
  login:   async () => {},
  logout:  async () => {},
});

export function PickerAuthProvider({ children }: { children: React.ReactNode }) {
  const [token,   setToken]   = useState<string | null>(null);
  const [picker,  setPicker]  = useState<PickerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [t, p] = await Promise.all([
          SecureStore.getItemAsync(TOKEN_KEY),
          SecureStore.getItemAsync(PICKER_KEY),
        ]);
        if (t) setToken(t);
        if (p) setPicker(JSON.parse(p));
      } catch {}
      finally { setLoading(false); }
    })();
  }, []);

  const login = async (newToken: string, newPicker: PickerProfile) => {
    await Promise.all([
      SecureStore.setItemAsync(TOKEN_KEY,  newToken),
      SecureStore.setItemAsync(PICKER_KEY, JSON.stringify(newPicker)),
    ]);
    setToken(newToken);
    setPicker(newPicker);
  };

  const logout = async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY),
      SecureStore.deleteItemAsync(PICKER_KEY),
    ]);
    setToken(null);
    setPicker(null);
  };

  return (
    <PickerAuthContext.Provider value={{ token, picker, loading, login, logout }}>
      {children}
    </PickerAuthContext.Provider>
  );
}

export function usePickerAuth() {
  return useContext(PickerAuthContext);
}
