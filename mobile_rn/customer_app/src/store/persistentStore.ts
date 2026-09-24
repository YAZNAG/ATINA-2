import { Platform } from 'react-native';

/**
 * Petit stockage persistant, tolérant à l'absence du module natif.
 *
 * L'APK construit avant l'ajout d'AsyncStorage ne contient pas le module : une mise à
 * jour à distance partagée par les deux versions doit donc fonctionner sans lui. On le
 * charge dynamiquement et, s'il manque, on retombe sur le stockage du navigateur (web)
 * ou sur la mémoire de la session, sans jamais lever d'erreur.
 */
type Store = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

const memory = new Map<string, string>();

const memoryStore: Store = {
  async getItem(k) { return memory.get(k) ?? null; },
  async setItem(k, v) { memory.set(k, v); },
  async removeItem(k) { memory.delete(k); },
};

const webStore: Store = {
  async getItem(k) { try { return globalThis.localStorage?.getItem(k) ?? null; } catch { return null; } },
  async setItem(k, v) { try { globalThis.localStorage?.setItem(k, v); } catch { /* quota */ } },
  async removeItem(k) { try { globalThis.localStorage?.removeItem(k); } catch { /* rien */ } },
};

function resolve(): Store {
  if (Platform.OS === 'web') return webStore;
  try {
    // eslint-disable-next-line global-require
    const mod = require('@react-native-async-storage/async-storage');
    const native = mod?.default ?? mod;
    if (native?.getItem) return native as Store;
  } catch { /* module absent de cette version de l'app */ }
  return memoryStore;
}

const store = resolve();

/** true quand les données survivent à la fermeture de l'application. */
export const isPersistent = store !== memoryStore;

export async function loadJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await store.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function saveJson(key: string, value: unknown): Promise<void> {
  try {
    await store.setItem(key, JSON.stringify(value));
  } catch { /* stockage plein ou indisponible : on garde la mémoire */ }
}

export async function removeKey(key: string): Promise<void> {
  await store.removeItem(key);
}
