import { CatalogRefShell } from '../catalog/CatalogRefPage';
import { PAYMENT_STATUSES_CATALOG_ENTITY, PAYMENT_METHODS_CATALOG_ENTITY } from './paymentCatalogEntities';

/** Statuts paiement — même UI cartes que référentiels catalogue. */
export function PaymentStatusesRefPage() {
  return (
    <CatalogRefShell
      entities={[PAYMENT_STATUSES_CATALOG_ENTITY]}
      defaultEntityKey="payment-statuses"
      pageTitle="Statuts paiement"
      pageSubtitle="Paramétrage paiement — libellés FR / AR et codes (données P0)."
      showEntityTabs={false}
    />
  );
}

/** Moyens de paiement — même UI cartes que référentiels catalogue. */
export function PaymentMethodsRefPage() {
  return (
    <CatalogRefShell
      entities={[PAYMENT_METHODS_CATALOG_ENTITY]}
      defaultEntityKey="payment-methods"
      pageTitle="Moyens de paiement"
      pageSubtitle="Paramétrage paiement — activation plateforme (is_active), comme au catalogue."
      showEntityTabs={false}
    />
  );
}
