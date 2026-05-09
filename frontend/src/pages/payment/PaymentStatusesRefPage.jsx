import { CatalogRefShell } from '../catalog/CatalogRefPage';
import { PAYMENT_STATUSES_CATALOG_ENTITY } from './paymentCatalogEntities';

/** Statuts paiement — même UI cartes que référentiels catalogue. */
export default function PaymentStatusesRefPage() {
  return (
    <CatalogRefShell
      entities={[PAYMENT_STATUSES_CATALOG_ENTITY]}
      defaultEntityKey="payment-statuses"
      pageTitle="Statuts paiement"
      pageSubtitle="Paramétrage paiement — codes et libellés (FR / AR), comme les référentiels catalogue."
      showEntityTabs={false}
    />
  );
}
