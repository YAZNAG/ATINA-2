import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Stockage du jeton de connexion : coffre sécurisé sur mobile, stockage du navigateur
 * en web (expo-secure-store n'y existe pas et lève une erreur, ce qui faisait échouer
 * tous les appels à l'API depuis l'aperçu web).
 */
export const TOKEN_KEY = 'auth_token';

export async function getToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(TOKEN_KEY) ?? null;
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setToken(token: string): Promise<void> {
  try {
    if (Platform.OS === 'web') { globalThis.localStorage?.setItem(TOKEN_KEY, token); return; }
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch { /* stockage indisponible : la session reste en mémoire */ }
}

export async function clearToken(): Promise<void> {
  try {
    if (Platform.OS === 'web') { globalThis.localStorage?.removeItem(TOKEN_KEY); return; }
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch { /* rien à faire */ }
}
