import { CatalogRefShell } from '../catalog/CatalogRefPage';
import { PAYMENT_METHODS_CATALOG_ENTITY } from './paymentCatalogEntities';

/** Moyens de paiement — même UI cartes que référentiels catalogue. */
export default function PaymentMethodsRefPage() {
  return (
    <CatalogRefShell
      entities={[PAYMENT_METHODS_CATALOG_ENTITY]}
      defaultEntityKey="payment-methods"
      pageTitle="Moyens de paiement"
      pageSubtitle="Paramétrage paiement — activation plateforme (oui / non) et libellés, comme les référentiels catalogue."
      showEntityTabs={false}
    />
  );
}
