/* États d'une vente flash (US-075) : programmée / en cours / épuisée / terminée (+ désactivée, supprimée). */

export const FLASH_STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'programmee', label: 'Programmée' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'epuisee', label: 'Épuisée' },
  { value: 'terminee', label: 'Terminée (expirée ou désactivée)' },
  { value: 'supprimee', label: 'Supprimée' },
];

const STYLES = {
  programmee: 'bg-sky-50 text-sky-700',
  en_cours: 'bg-emerald-50 text-emerald-700',
  epuisee: 'bg-amber-50 text-amber-700',
  terminee: 'bg-neutral-100 text-neutral-600',
  desactivee: 'bg-neutral-100 text-neutral-500',
  supprimee: 'bg-red-50 text-red-600',
};

export function FlashStatusBadge({ item }) {
  const s = item?.flash_status;
  const label = s === 'desactivee' ? 'Terminée · désactivée' : (item?.flash_status_label ?? s);
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${STYLES[s] ?? STYLES.terminee}`}>{label}</span>;
}
