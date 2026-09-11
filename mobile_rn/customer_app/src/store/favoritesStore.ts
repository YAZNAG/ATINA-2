type Listener = () => void;

let favoriteIds = new Set<string | number>();
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

export const favoritesStore = {
  getIds(): Set<string | number> {
    return favoriteIds;
  },
  setIds(ids: Set<string | number>) {
    favoriteIds = new Set(ids);
    emit();
  },
  isFavorite(id: string | number): boolean {
    return favoriteIds.has(id);
  },
  toggle(id: string | number, next: boolean) {
    const s = new Set(favoriteIds);
    if (next) s.add(id); else s.delete(id);
    favoriteIds = s;
    emit();
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};