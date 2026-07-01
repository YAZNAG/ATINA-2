import * as SecureStore from 'expo-secure-store';

const KEY     = 'search_history';
const MAX_LEN = 8;

export async function getHistory(): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function addToHistory(term: string): Promise<void> {
  const t = term.trim();
  if (!t) return;
  const prev    = await getHistory();
  const deduped = prev.filter(h => h.toLowerCase() !== t.toLowerCase());
  await SecureStore.setItemAsync(KEY, JSON.stringify([t, ...deduped].slice(0, MAX_LEN)));
}

export async function removeFromHistory(term: string): Promise<void> {
  const prev = await getHistory();
  await SecureStore.setItemAsync(KEY, JSON.stringify(prev.filter(h => h !== term)));
}

export async function clearHistory(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
