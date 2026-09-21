import { prefGet, prefSet } from '../components/onboarding/onboardingKit';

/**
 * Point de distribution (node) choisi par le client sur « Complétez votre profil ».
 * Conservé côté app et envoyé au backend dans l'en-tête X-Node-Id : le catalogue,
 * les prix et le stock sont ceux de ce node (aucune colonne ajoutée au Schema_V3).
 */
export const NODE_KEY = 'distribution_node_id';

let cached: string | null | undefined;

export async function getNodeId(): Promise<string | null> {
  if (cached === undefined) cached = await prefGet(NODE_KEY);
  return cached || null;
}

export async function setNodeId(id: string | null): Promise<void> {
  cached = id;
  await prefSet(NODE_KEY, id ?? '');
}
