/**
 * Sous-menus « Paramétrage Livraison » — tables P0 (@@map) alignées avec le registre backend.
 * URL : /delivery/:slug où slug = nom SQL avec tirets (ex. order-statuses → order_statuses).
 */
export const DELIVERY_PARAM_ITEMS = [
  { slug: 'order-statuses', label: 'Statuts commande' },
  { slug: 'order-item-statuses', label: 'Statuts ligne commande' },
  { slug: 'order-slot-statuses', label: 'Statuts créneau' },
  { slug: 'delivery-types', label: 'Types de livraison' },
  { slug: 'tour-statuses', label: 'Statuts tournée' },
  { slug: 'stop-statuses', label: 'Statuts arrêt' },
];

export function slugToSql(slug) {
  if (!slug || typeof slug !== 'string') return null;
  return slug.trim().replace(/-/g, '_');
}

export function isAllowedDeliverySlug(slug) {
  return DELIVERY_PARAM_ITEMS.some((x) => x.slug === slug);
}
