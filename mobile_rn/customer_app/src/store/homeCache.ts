import { loadJson, saveJson } from './persistentStore';
import type { Article, Category } from '../services/catalog.service';
import type { Profile } from '../services/profile.service';
import type { BestDeal, EndingSoonResponse, FlashSaleSummary, PackSummary } from '../services/promotions.service';

/**
 * Dernier contenu affiché sur l'accueil, gardé en mémoire pour toute la session.
 * Au retour dans l'application, l'écran s'affiche immédiatement avec ces données
 * pendant que la version fraîche se charge en arrière-plan.
 */
export const homeCache: {
  categories: Category[];
  articles: Article[];
  recommended: Article[];
  popular: Article[];
  topRated: Article[];
  promotions: FlashSaleSummary[];
  packs: PackSummary[];
  bestDeals: BestDeal[];
  endingSoon: EndingSoonResponse;
  user: Profile | null;
  avatarUrl: string | null;
  at: number;
} = {
  categories: [], articles: [], recommended: [], popular: [], topRated: [],
  promotions: [], packs: [], bestDeals: [], endingSoon: { ends_at: null, products: [] },
  user: null, avatarUrl: null, at: 0,
};

/** Les données de plus de 10 minutes sont considérées comme périmées. */
export const homeCacheFresh = () => homeCache.at > 0 && Date.now() - homeCache.at < 10 * 60 * 1000;

const KEY = 'home_cache_v1';
/** Au-delà d'une journée, le contenu enregistré n'est plus affiché au démarrage. */
const MAX_AGE = 24 * 60 * 60 * 1000;

/** Relit le contenu enregistré au lancement : l'accueil s'affiche sans attendre le réseau. */
export async function hydrateHomeCache(): Promise<void> {
  if (homeCache.at) return;
  const saved = await loadJson<typeof homeCache>(KEY);
  if (!saved || !saved.at || Date.now() - saved.at > MAX_AGE) return;
  Object.assign(homeCache, saved);
}

/** Enregistre le contenu courant (appelé après chaque chargement réussi). */
export function persistHomeCache(): void {
  saveJson(KEY, homeCache);
}
