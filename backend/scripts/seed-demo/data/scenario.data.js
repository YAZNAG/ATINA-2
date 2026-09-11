/**
 * Scénario stock / vente par node : prix, ruptures volontaires, stocks sous le seuil,
 * vente en rupture, fournisseurs.
 */

const PRICE_FACTOR = { 'CASA-MAARIF': 1, 'CASA-AINSEBAA': 0.97, 'RABAT-AGDAL': 1.02, 'MRK-GUELIZ': 0.98 };

/** SKU non vendables sur un node (is_sellable = false). */
const NOT_SELLABLE = {
  'MRK-GUELIZ': ['VIA-AGN-COT', 'FRO-PRE-CAM', 'LES-ARI-2L'],
  'CASA-AINSEBAA': ['HER-PER-BOT'],
};

/** Ruptures : aucun stock reçu (réappro en cours via un BC ouvert). */
const RUPTURE = {
  'CASA-MAARIF': ['COU-PAM-T4', 'CAP-DOV-SHA', 'AML-ATI-250'],
  'CASA-AINSEBAA': ['FRO-PRE-CAM', 'MIE-ATI-THY', 'SOD-COC-ZER'],
  'RABAT-AGDAL': ['TRA-SEL-500', 'EAU-IFR-150', 'COU-PAM-T4'],
  'MRK-GUELIZ': ['CAF-NES-200', 'LIN-PAM-SEN', 'JUS-JAO-MUL'],
};

/** Stock volontairement sous le point de commande. */
const LOW = {
  'CASA-MAARIF': ['THE-SUL-500', 'FRO-PRE-EDA', 'SUC-COS-MOR'],
  'CASA-AINSEBAA': ['OLV-ATI-VER', 'YAO-JAO-FRU', 'DEN-COL-BRO'],
  'RABAT-AGDAL': ['CFT-AIC-ABR', 'BIS-LUS-GAU', 'SAU-LES-MAY'],
  'MRK-GUELIZ': ['EPI-ATI-RAS', 'VOL-BLA-500', 'SAV-DOV-X2'],
};

/** Vente en rupture autorisée (backorder) : [sku, plafond, délai de réappro en jours]. */
const BACKORDER = {
  'CASA-MAARIF': [['COU-PAM-T4', 10, 2], ['AML-ATI-250', 6, 3], ['CAF-NES-200', 5, 2]],
  'CASA-AINSEBAA': [['FRO-PRE-CAM', 8, 2], ['MIE-ATI-THY', 5, 4]],
  'RABAT-AGDAL': [['TRA-SEL-500', 6, 2], ['COU-PAM-T4', 10, 3]],
  'MRK-GUELIZ': [['CAF-NES-200', 5, 3], ['LIN-PAM-SEN', 10, 2]],
};

/** SKU en rupture + vente en rupture autorisée → commande « en attente de stock ». */
const AWAITING_SKU = { 'CASA-MAARIF': 'COU-PAM-T4', 'CASA-AINSEBAA': 'FRO-PRE-CAM', 'RABAT-AGDAL': 'TRA-SEL-500', 'MRK-GUELIZ': 'CAF-NES-200' };

const SUPPLIERS = [
  { code: 'SUP-DISTRILAIT', name_fr: 'Distrilait Maroc SARL', name_ar: 'ديستريلي المغرب', contact: 'Rachid Tahiri', phone: '600000401', subs: ['LAI-', 'BOI-JUS'], terms: '30 jours fin de mois', lead: 1, score: 9.1, city: 'Casablanca', address: 'Lot 45, zone industrielle Moulay Rachid, Casablanca' },
  { code: 'SUP-ATLASBOISSONS', name_fr: 'Atlas Boissons Distribution', name_ar: 'أطلس لتوزيع المشروبات', contact: 'Khalid Saidi', phone: '600000402', subs: ['BOI-EAU', 'BOI-SOD'], terms: '45 jours date de facture', lead: 2, score: 8.4, city: 'Mohammedia', address: 'Route de Rabat, km 12, Mohammedia' },
  { code: 'SUP-GRANDNORD', name_fr: 'Grand Nord Épicerie SARL', name_ar: 'الشمال الكبير للبقالة', contact: 'Nawal Filali', phone: '600000403', subs: ['EPS-', 'EPU-SUC'], terms: '60 jours date de facture', lead: 3, score: 7.8, city: 'Tanger', address: 'Zone franche Gzenaya, lot 112, Tanger' },
  { code: 'SUP-DOUCEURS', name_fr: 'Douceurs du Maghreb Distribution', name_ar: 'حلويات المغرب للتوزيع', contact: 'Adil Rahmouni', phone: '600000404', subs: ['EPU-'], terms: '30 jours fin de mois', lead: 2, score: 8.2, city: 'Fès', address: 'Quartier industriel Sidi Brahim, Fès' },
  { code: 'SUP-PRIMEURS', name_fr: 'Primeurs du Souss', name_ar: 'بواكير سوس', contact: 'Said Moussaoui', phone: '600000405', subs: ['FRL-'], terms: 'Comptant à la livraison', lead: 1, score: 8.8, city: 'Agadir', address: 'Marché de gros, Inezgane' },
  { code: 'SUP-BOUCHERIE', name_fr: 'Boucherie Centrale Al Baraka', name_ar: 'مجزرة البركة المركزية', contact: 'Mohamed Hajji', phone: '600000406', subs: ['BOU-'], terms: 'Comptant à la livraison', lead: 1, score: 9.4, city: 'Casablanca', address: 'Abattoirs de Casablanca, Hay Mohammadi' },
  { code: 'SUP-FOURNIL', name_fr: 'Fournil Al Andalous', name_ar: 'مخبزة الأندلس', contact: 'Latifa Benali', phone: '600000407', subs: ['BLG-'], terms: '15 jours', lead: 1, score: 8.9, city: 'Rabat', address: '8, rue de Tétouan, Rabat' },
  { code: 'SUP-HYGIPRO', name_fr: 'Hygipro Maroc', name_ar: 'هيجيبرو المغرب', contact: 'Tarik Zerouali', phone: '600000408', subs: ['HYG-', 'ENT-', 'BEB-COU'], terms: '60 jours fin de mois', lead: 4, score: 7.5, city: 'Casablanca', address: 'Parc industriel Ouled Saleh, Bouskoura' },
  { code: 'SUP-BEBECARE', name_fr: 'BébéCare Distribution', name_ar: 'بيبي كير للتوزيع', contact: 'Ghizlane Chakir', phone: '600000409', subs: ['BEB-'], terms: '45 jours date de facture', lead: 3, score: 8.0, city: 'Marrakech', address: 'Zone industrielle Sidi Ghanem, Marrakech' },
];

/** Fournisseur principal d'une sous-famille (le plus spécifique l'emporte). */
function suppliersFor(sub) {
  return SUPPLIERS.filter((s) => s.subs.some((p) => sub.startsWith(p)))
    .sort((a, b) => Math.max(...b.subs.filter((p) => sub.startsWith(p)).map((p) => p.length)) - Math.max(...a.subs.filter((p) => sub.startsWith(p)).map((p) => p.length)));
}

module.exports = { PRICE_FACTOR, NOT_SELLABLE, RUPTURE, LOW, BACKORDER, AWAITING_SKU, SUPPLIERS, suppliersFor };
