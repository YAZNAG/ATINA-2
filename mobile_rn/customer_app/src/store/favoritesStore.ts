type Listener = () => void;

let favoriteIds = new Set<number>();
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

export const favoritesStore = {
  getIds(): Set<number> {
    return favoriteIds;
  },
  setIds(ids: Set<number>) {
    favoriteIds = new Set(ids);
    emit();
  },
  isFavorite(id: number): boolean {
    return favoriteIds.has(id);
  },
  toggle(id: number, next: boolean) {
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