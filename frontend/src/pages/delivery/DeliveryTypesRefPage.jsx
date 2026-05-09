import { CatalogRefShell } from '../catalog/CatalogRefPage';
import { DELIVERY_TYPES_CATALOG_ENTITY } from './deliveryTypesCatalogEntity';

/**
 * Types de livraison — même UI que « Référentiels catalogue » (cartes, drawer, modales).
 */
export default function DeliveryTypesRefPage() {
  return (
    <CatalogRefShell
      entities={[DELIVERY_TYPES_CATALOG_ENTITY]}
      defaultEntityKey="delivery-types"
      pageTitle="Types de livraison"
      pageSubtitle="Paramétrage livraison — codes et libellés (FR / AR), comme marques / unités au catalogue."
      showEntityTabs={false}
    />
  );
}
