/**
 * Géographie, nodes, personnes FICTIVES (noms marocains courants combinés au hasard,
 * téléphones +212 600000xxx, e-mails @example.com). Aucune donnée personnelle réelle.
 */

/** Villes rattachées aux régions (codes regions.seed.js). */
const CITIES = [
  { code: 'CASABLANCA', name_fr: 'Casablanca', name_ar: 'الدار البيضاء', postal_code: '20000', region: '06', sort_order: 1 },
  { code: 'MOHAMMEDIA', name_fr: 'Mohammedia', name_ar: 'المحمدية', postal_code: '28800', region: '06', sort_order: 2 },
  { code: 'RABAT', name_fr: 'Rabat', name_ar: 'الرباط', postal_code: '10000', region: '04', sort_order: 3 },
  { code: 'SALE', name_fr: 'Salé', name_ar: 'سلا', postal_code: '11000', region: '04', sort_order: 4 },
  { code: 'TEMARA', name_fr: 'Témara', name_ar: 'تمارة', postal_code: '12000', region: '04', sort_order: 5 },
  { code: 'KENITRA', name_fr: 'Kénitra', name_ar: 'القنيطرة', postal_code: '14000', region: '04', sort_order: 6 },
  { code: 'MARRAKECH', name_fr: 'Marrakech', name_ar: 'مراكش', postal_code: '40000', region: '07', sort_order: 7 },
  { code: 'TANGER', name_fr: 'Tanger', name_ar: 'طنجة', postal_code: '90000', region: '01', sort_order: 8 },
  { code: 'FES', name_fr: 'Fès', name_ar: 'فاس', postal_code: '30000', region: '03', sort_order: 9 },
  { code: 'MEKNES', name_fr: 'Meknès', name_ar: 'مكناس', postal_code: '50000', region: '03', sort_order: 10 },
  { code: 'AGADIR', name_fr: 'Agadir', name_ar: 'أكادير', postal_code: '80000', region: '09', sort_order: 11 },
  { code: 'OUJDA', name_fr: 'Oujda', name_ar: 'وجدة', postal_code: '60000', region: '02', sort_order: 12 },
];

const NODE_TYPES = [
  { code: 'dark_store', name_fr: 'Dark store', name_ar: 'متجر مظلم', color_badge: '#dc2626', icon: 'store', description: 'Magasin fermé au public, dédié à la préparation des commandes en ligne.' },
  { code: 'warehouse', name_fr: 'Entrepôt', name_ar: 'مستودع', color_badge: '#2563eb', icon: 'warehouse', description: 'Entrepôt de stockage et de préparation à plus grande capacité.' },
  { code: 'relay_point', name_fr: 'Point relais', name_ar: 'نقطة استلام', color_badge: '#16a34a', icon: 'map-pin', description: 'Point de retrait des commandes, avec petite zone de préparation.' },
];

const HOURS = (from, to, sundayOpen = true) => Object.fromEntries(
  ['0', '1', '2', '3', '4', '5', '6'].map((d) => [d, d === '0' && !sundayOpen ? { open: false } : { open: true, from, to }]),
);

/** 4 nodes : coordonnées GPS des quartiers (approximatives, domaine public). */
const NODES = [
  {
    code: 'CASA-MAARIF', name_fr: 'Casablanca Maârif', name_ar: 'الدار البيضاء المعاريف', type: 'dark_store', city: 'CASABLANCA', region: '06',
    address_line1: '27, rue Ibnou Katir', quartier: 'Maârif', postal_code: '20330', lat: 33.5862, lng: -7.6342, phone: '+212600000901',
    delivery_radius_km: 5, max_daily_orders: 250, opening_hours_json: HOURS('08:00', '23:30'), delivery_fee: 15, min_order_amount: 80, slot_selection_enabled: true,
    short: 'MAA', color: '#dc2626',
  },
  {
    code: 'CASA-AINSEBAA', name_fr: 'Casablanca Aïn Sebaâ', name_ar: 'الدار البيضاء عين السبع', type: 'warehouse', city: 'CASABLANCA', region: '06',
    address_line1: 'Boulevard Chefchaouni, km 7, zone industrielle', quartier: 'Aïn Sebaâ', postal_code: '20250', lat: 33.6045, lng: -7.5398, phone: '+212600000902',
    delivery_radius_km: 8, max_daily_orders: 400, opening_hours_json: HOURS('07:00', '22:00'), delivery_fee: 20, min_order_amount: 100, slot_selection_enabled: true,
    short: 'AIN', color: '#2563eb',
  },
  {
    code: 'RABAT-AGDAL', name_fr: 'Rabat Agdal', name_ar: 'الرباط أكدال', type: 'dark_store', city: 'RABAT', region: '04',
    address_line1: '14, avenue Fal Ould Oumeir', quartier: 'Agdal', postal_code: '10090', lat: 33.9986, lng: -6.8506, phone: '+212600000903',
    delivery_radius_km: 6, max_daily_orders: 200, opening_hours_json: HOURS('08:00', '23:00'), delivery_fee: 12, min_order_amount: 70, slot_selection_enabled: true,
    short: 'AGD', color: '#16a34a',
  },
  {
    code: 'MRK-GUELIZ', name_fr: 'Marrakech Guéliz', name_ar: 'مراكش كيليز', type: 'relay_point', city: 'MARRAKECH', region: '07',
    address_line1: '52, rue de la Liberté', quartier: 'Guéliz', postal_code: '40000', lat: 31.6345, lng: -8.0101, phone: '+212600000904',
    delivery_radius_km: 4, max_daily_orders: 150, opening_hours_json: HOURS('09:00', '22:00', false), delivery_fee: 10, min_order_amount: 50, slot_selection_enabled: false,
    short: 'GLZ', color: '#9333ea',
  },
];

/** Plages de créneaux par node (3 à 5 par jour). */
const SLOT_TEMPLATES = {
  'CASA-MAARIF': [['09:00', '11:00', 25], ['11:00', '13:00', 25], ['14:00', '16:00', 20], ['17:00', '19:00', 30], ['19:00', '21:00', 30]],
  'CASA-AINSEBAA': [['08:00', '11:00', 30], ['12:00', '15:00', 25], ['16:00', '19:00', 30], ['19:00', '21:00', 20]],
  'RABAT-AGDAL': [['09:00', '11:00', 20], ['12:00', '14:00', 15], ['17:00', '19:00', 25], ['19:00', '21:00', 25]],
  'MRK-GUELIZ': [['10:00', '13:00', 15], ['15:00', '18:00', 15], ['18:00', '21:00', 10]],
};

const FIRST_M = ['Youssef', 'Mohamed', 'Amine', 'Hamza', 'Omar', 'Karim', 'Mehdi', 'Anas', 'Reda', 'Ayoub', 'Soufiane', 'Ilyas', 'Othmane', 'Hicham', 'Adil', 'Yassir', 'Tarik', 'Badr', 'Nabil', 'Rachid', 'Said', 'Khalid'];
const FIRST_F = ['Fatima Zahra', 'Khadija', 'Salma', 'Imane', 'Nadia', 'Houda', 'Sanaa', 'Meryem', 'Loubna', 'Hajar', 'Zineb', 'Asmae', 'Kawtar', 'Samira', 'Najat', 'Rim', 'Ghizlane', 'Siham', 'Latifa', 'Nawal', 'Hind', 'Wiam'];
const LAST = ['El Amrani', 'Bennani', 'Alaoui', 'Tazi', 'Berrada', 'El Idrissi', 'Chraibi', 'Benjelloun', 'Lahlou', 'Ouazzani', 'El Fassi', 'Sqalli', 'Bouzid', 'Naciri', 'Ziani', 'Haddad', 'Mansouri', 'Tahiri', 'Filali', 'Kettani', 'Belhaj', 'Saidi', 'Rahmouni', 'El Mansouri', 'Chakir', 'Benali', 'Zerouali', 'Hajji', 'Moussaoui', 'Lamrani'];

/** Rues fictives par quartier (noms de rues courants). */
const STREETS = {
  'CASA-MAARIF': [['Maârif', 'rue Abou Bakr Ibnou Koutia'], ['Maârif', 'rue Rembrandt'], ['Racine', 'boulevard Ghandi'], ['Bourgogne', 'rue Ibnou Bajja'], ['Gauthier', 'rue Jean Jaurès'], ['Oasis', 'rue des Hirondelles']],
  'CASA-AINSEBAA': [['Aïn Sebaâ', 'rue de Fès'], ['Hay Mohammadi', 'boulevard Ali Yata'], ['Sidi Bernoussi', 'rue 12'], ['Roches Noires', 'rue de la Corniche'], ['Mohammedia centre', 'avenue Hassan II']],
  'RABAT-AGDAL': [['Agdal', 'rue Oued Fès'], ['Hassan', 'avenue Allal Ben Abdellah'], ['Hay Riad', 'avenue Annakhil'], ['Souissi', 'rue Jaafar Essadik'], ['Salé Tabriquet', 'boulevard Kennedy'], ['Témara Wifaq', 'avenue Hassan II']],
  'MRK-GUELIZ': [['Guéliz', 'rue Tarik Ibn Ziad'], ['Hivernage', 'avenue Echouhada'], ['Majorelle', 'rue Yves Saint Laurent'], ['Daoudiate', 'avenue Allal El Fassi'], ['Semlalia', 'boulevard Abdelkrim Khattabi']],
};

/** Ville réelle de chaque quartier (adresse client). */
const QUARTIER_CITY = { 'Mohammedia centre': 'MOHAMMEDIA', 'Salé Tabriquet': 'SALE', 'Témara Wifaq': 'TEMARA' };

module.exports = { CITIES, NODE_TYPES, NODES, SLOT_TEMPLATES, FIRST_M, FIRST_F, LAST, STREETS, QUARTIER_CITY };
