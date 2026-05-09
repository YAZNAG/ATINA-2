/**
 * Paramétrage Paiement — tables P0 (registre backend : commandes & paiements).
 */
export const PAYMENT_PARAM_ITEMS = [
  { slug: 'payment-statuses', label: 'Statuts paiement' },
  { slug: 'payment-methods', label: 'Moyens de paiement' },
];

export function slugToSql(slug) {
  if (!slug || typeof slug !== 'string') return null;
  return slug.trim().replace(/-/g, '_');
}

export function isAllowedPaymentSlug(slug) {
  return PAYMENT_PARAM_ITEMS.some((x) => x.slug === slug);
}
