import { useSyncExternalStore, useCallback } from 'react';
import { favoritesStore } from './favoritesStore';
import { ProfileService } from '../services/profile.service';

export function useIsFavorite(articleId: number): boolean {
  return useSyncExternalStore(
    favoritesStore.subscribe,
    () => favoritesStore.isFavorite(articleId)
  );
}

// Bascule optimiste + appel API + rollback en cas d'échec.
export function useToggleFavorite(articleId: number) {
  return useCallback(async () => {
    const current = favoritesStore.isFavorite(articleId);
    const next = !current;
    favoritesStore.toggle(articleId, next);
    try {
      if (next) await ProfileService.addFavorite(articleId);
      else      await ProfileService.removeFavorite(articleId);
    } catch {
      favoritesStore.toggle(articleId, current);
    }
  }, [articleId]);
}