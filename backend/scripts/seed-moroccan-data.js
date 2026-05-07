/**
 * seed-moroccan-data.js
 * Seeds Moroccan regions, provinces, cities, brands, reference data, and ~30 articles.
 * Run: node scripts/seed-moroccan-data.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ── Helpers ───────────────────────────────────────────────────────────────────

const upsertRegion    = (data) => prisma.region.upsert({ where: { code: data.code }, update: {}, create: data });
const upsertProvince  = (data) => prisma.province.upsert({ where: { code: data.code }, update: {}, create: data });
const upsertCity      = (data) => prisma.city.upsert({ where: { code: data.code }, update: {}, create: data });
const upsertBrand     = (data) => prisma.brand.upsert({ where: { code: data.code }, update: {}, create: data });
const upsertFamily    = (data) => prisma.family.upsert({ where: { code: data.code }, update: {}, create: data });
const upsertCategory  = (data) => prisma.category.upsert({ where: { code: data.code }, update: {}, create: data });
const upsertSubCat    = (data) => prisma.subCategory.upsert({ where: { code: data.code }, update: {}, create: data });
const upsertUnit      = (data) => prisma.unit.upsert({ where: { code: data.code }, update: {}, create: data });
const upsertArtType   = (data) => prisma.articleType.upsert({ where: { code: data.code }, update: {}, create: data });
const upsertArtStatus = (data) => prisma.articleStatus.upsert({ where: { code: data.code }, update: {}, create: data });
const upsertConsType  = (data) => prisma.conservationType.upsert({ where: { code: data.code }, update: {}, create: data });
const upsertTax       = (data) => prisma.tax.upsert({ where: { code: data.code }, update: {}, create: data });

// ── 1. Regions ────────────────────────────────────────────────────────────────

const REGIONS = [
  { code: 'TTA', name_fr: 'Tanger-Tétouan-Al Hoceïma',   name_ar: 'طنجة-تطوان-الحسيمة' },
  { code: 'ORI', name_fr: "L'Oriental",                   name_ar: 'الشرق' },
  { code: 'FME', name_fr: 'Fès-Meknès',                   name_ar: 'فاس-مكناس' },
  { code: 'RSK', name_fr: 'Rabat-Salé-Kénitra',           name_ar: 'الرباط-سلا-القنيطرة' },
  { code: 'BMK', name_fr: 'Béni Mellal-Khénifra',         name_ar: 'بني ملال-خنيفرة' },
  { code: 'CAS', name_fr: 'Casablanca-Settat',             name_ar: 'الدار البيضاء-سطات' },
  { code: 'MRS', name_fr: 'Marrakech-Safi',               name_ar: 'مراكش-آسفي' },
  { code: 'DTA', name_fr: 'Drâa-Tafilalet',               name_ar: 'درعة-تافيلالت' },
  { code: 'SOM', name_fr: 'Souss-Massa',                  name_ar: 'سوس-ماسة' },
  { code: 'GON', name_fr: 'Guelmim-Oued Noun',            name_ar: 'كلميم-واد نون' },
  { code: 'LSH', name_fr: "Laâyoune-Sakia El Hamra",      name_ar: 'العيون-الساقية الحمراء' },
  { code: 'DOD', name_fr: 'Dakhla-Oued Ed-Dahab',         name_ar: 'الداخلة-وادي الذهب' },
];

// ── 2. Provinces ──────────────────────────────────────────────────────────────

const PROVINCES_BY_REGION = {
  TTA: [
    { code: 'TNG', name_fr: 'Tanger-Assilah',   name_ar: 'طنجة-أصيلة' },
    { code: 'FAH', name_fr: 'Fahs-Anjra',        name_ar: 'الفحص-أنجرة' },
    { code: 'TTN', name_fr: 'Tétouan',           name_ar: 'تطوان' },
    { code: 'ALH', name_fr: 'Al Hoceïma',        name_ar: 'الحسيمة' },
  ],
  ORI: [
    { code: 'OUJ', name_fr: 'Oujda-Angad',       name_ar: 'وجدة-أنكاد' },
    { code: 'BER', name_fr: 'Berkane',            name_ar: 'بركان' },
    { code: 'NAD', name_fr: 'Nador',              name_ar: 'الناظور' },
    { code: 'TAO', name_fr: 'Taourirt',           name_ar: 'تاوريرت' },
  ],
  FME: [
    { code: 'FES', name_fr: 'Fès',               name_ar: 'فاس' },
    { code: 'MEK', name_fr: 'Meknès',            name_ar: 'مكناس' },
    { code: 'IFR', name_fr: 'Ifrane',            name_ar: 'إفران' },
    { code: 'SEF', name_fr: 'Sefrou',            name_ar: 'صفرو' },
  ],
  RSK: [
    { code: 'RBA', name_fr: 'Rabat',             name_ar: 'الرباط' },
    { code: 'SAL', name_fr: 'Salé',              name_ar: 'سلا' },
    { code: 'KEN', name_fr: 'Kénitra',           name_ar: 'القنيطرة' },
    { code: 'SKT', name_fr: 'Skhirate-Témara',   name_ar: 'الصخيرات-تمارة' },
  ],
  BMK: [
    { code: 'BME', name_fr: 'Béni Mellal',       name_ar: 'بني ملال' },
    { code: 'AZI', name_fr: 'Azilal',            name_ar: 'أزيلال' },
    { code: 'FBS', name_fr: 'Fquih Ben Salah',   name_ar: 'الفقيه بن صالح' },
    { code: 'KHE', name_fr: 'Khénifra',          name_ar: 'خنيفرة' },
  ],
  CAS: [
    { code: 'CBA', name_fr: 'Casablanca',        name_ar: 'الدار البيضاء' },
    { code: 'MED', name_fr: 'Médiouna',          name_ar: 'مديونة' },
    { code: 'NOU', name_fr: 'Nouaceur',          name_ar: 'النواصر' },
    { code: 'SET', name_fr: 'Settat',            name_ar: 'سطات' },
    { code: 'EJA', name_fr: 'El Jadida',         name_ar: 'الجديدة' },
  ],
  MRS: [
    { code: 'MAR', name_fr: 'Marrakech',         name_ar: 'مراكش' },
    { code: 'ESS', name_fr: 'Essaouira',         name_ar: 'الصويرة' },
    { code: 'SAF', name_fr: 'Safi',              name_ar: 'آسفي' },
    { code: 'KEL', name_fr: 'El Kelaâ des Sraghna', name_ar: 'قلعة السراغنة' },
  ],
  DTA: [
    { code: 'ERC', name_fr: 'Errachidia',        name_ar: 'الرشيدية' },
    { code: 'OUA', name_fr: 'Ouarzazate',        name_ar: 'ورزازات' },
    { code: 'TIN', name_fr: 'Tinghir',           name_ar: 'تنغير' },
    { code: 'ZAG', name_fr: 'Zagora',            name_ar: 'زاكورة' },
  ],
  SOM: [
    { code: 'AGA', name_fr: 'Agadir-Ida-Outanane', name_ar: 'أكادير-إيدا-أوتنان' },
    { code: 'TAR', name_fr: 'Taroudant',         name_ar: 'تارودانت' },
    { code: 'TIZ', name_fr: 'Tiznit',            name_ar: 'تيزنيت' },
    { code: 'CAB', name_fr: 'Chtouka-Aït Baha',  name_ar: 'شتوكة-آيت باها' },
  ],
  GON: [
    { code: 'GUE', name_fr: 'Guelmim',           name_ar: 'كلميم' },
    { code: 'SIF', name_fr: 'Sidi Ifni',         name_ar: 'سيدي إفني' },
    { code: 'TAN', name_fr: 'Tan-Tan',           name_ar: 'طانطان' },
  ],
  LSH: [
    { code: 'LAA', name_fr: 'Laâyoune',          name_ar: 'العيون' },
    { code: 'BOU', name_fr: 'Boujdour',          name_ar: 'بوجدور' },
    { code: 'SEM', name_fr: 'Es-Semara',         name_ar: 'السمارة' },
  ],
  DOD: [
    { code: 'DAK', name_fr: 'Dakhla',            name_ar: 'الداخلة' },
    { code: 'AOU', name_fr: 'Aousserd',          name_ar: 'أوسرد' },
  ],
};

// ── 3. Cities ─────────────────────────────────────────────────────────────────

const CITIES_BY_PROVINCE = {
  TNG: [
    { code: 'TNG-V', name_fr: 'Tanger',          name_ar: 'طنجة',       postal_code: '90000' },
    { code: 'ASL-V', name_fr: 'Assilah',          name_ar: 'أصيلة',     postal_code: '90050' },
  ],
  FAH: [
    { code: 'FAH-V', name_fr: 'Fahs',             name_ar: 'الفحص',     postal_code: '92000' },
  ],
  TTN: [
    { code: 'TTN-V', name_fr: 'Tétouan',          name_ar: 'تطوان',     postal_code: '93000' },
    { code: 'MDF-V', name_fr: 'Mdiq',             name_ar: 'المضيق',    postal_code: '93150' },
    { code: 'MRT-V', name_fr: 'Martil',           name_ar: 'مرتيل',     postal_code: '93100' },
  ],
  ALH: [
    { code: 'ALH-V', name_fr: 'Al Hoceïma',       name_ar: 'الحسيمة',  postal_code: '32000' },
    { code: 'IMA-V', name_fr: 'Imzouren',         name_ar: 'إمزورن',   postal_code: '32050' },
  ],
  OUJ: [
    { code: 'OUJ-V', name_fr: 'Oujda',            name_ar: 'وجدة',      postal_code: '60000' },
    { code: 'ANG-V', name_fr: 'Angad',            name_ar: 'أنكاد',     postal_code: '60100' },
  ],
  BER: [
    { code: 'BER-V', name_fr: 'Berkane',          name_ar: 'بركان',     postal_code: '63300' },
    { code: 'SAA-V', name_fr: 'Saïdia',           name_ar: 'سعيدية',   postal_code: '63350' },
  ],
  NAD: [
    { code: 'NAD-V', name_fr: 'Nador',            name_ar: 'الناظور',  postal_code: '62000' },
    { code: 'ZEL-V', name_fr: 'Zéghanghan',       name_ar: 'زغنغان',   postal_code: '62050' },
  ],
  TAO: [
    { code: 'TAO-V', name_fr: 'Taourirt',         name_ar: 'تاوريرت',  postal_code: '61000' },
  ],
  FES: [
    { code: 'FES-V', name_fr: 'Fès',              name_ar: 'فاس',       postal_code: '30000' },
    { code: 'BHF-V', name_fr: 'Bhalil',           name_ar: 'بهاليل',   postal_code: '30100' },
  ],
  MEK: [
    { code: 'MEK-V', name_fr: 'Meknès',           name_ar: 'مكناس',    postal_code: '50000' },
    { code: 'EHJ-V', name_fr: 'El Hajeb',         name_ar: 'الحاجب',   postal_code: '50250' },
  ],
  IFR: [
    { code: 'IFR-V', name_fr: 'Ifrane',           name_ar: 'إفران',    postal_code: '53000' },
    { code: 'AZR-V', name_fr: 'Azrou',            name_ar: 'أزرو',     postal_code: '53100' },
  ],
  SEF: [
    { code: 'SEF-V', name_fr: 'Sefrou',           name_ar: 'صفرو',     postal_code: '31000' },
  ],
  RBA: [
    { code: 'RBA-V', name_fr: 'Rabat',            name_ar: 'الرباط',   postal_code: '10000' },
  ],
  SAL: [
    { code: 'SAL-V', name_fr: 'Salé',             name_ar: 'سلا',       postal_code: '11000' },
    { code: 'BOE-V', name_fr: 'Bou El Ftouh',     name_ar: 'بو الفتوح', postal_code: '11100' },
  ],
  KEN: [
    { code: 'KEN-V', name_fr: 'Kénitra',          name_ar: 'القنيطرة', postal_code: '14000' },
    { code: 'MHM-V', name_fr: 'Mehdia',           name_ar: 'المهدية',  postal_code: '14050' },
  ],
  SKT: [
    { code: 'SKT-V', name_fr: 'Skhirate',         name_ar: 'الصخيرات', postal_code: '12060' },
    { code: 'TMA-V', name_fr: 'Témara',           name_ar: 'تمارة',    postal_code: '12000' },
  ],
  BME: [
    { code: 'BME-V', name_fr: 'Béni Mellal',      name_ar: 'بني ملال', postal_code: '23000' },
    { code: 'FOQ-V', name_fr: 'Foum El Anceur',   name_ar: 'فم العنصر', postal_code: '23100' },
  ],
  AZI: [
    { code: 'AZI-V', name_fr: 'Azilal',           name_ar: 'أزيلال',   postal_code: '22000' },
    { code: 'DEM-V', name_fr: 'Demnate',          name_ar: 'دمنات',    postal_code: '22050' },
  ],
  FBS: [
    { code: 'FBS-V', name_fr: 'Fquih Ben Salah',  name_ar: 'الفقيه بن صالح', postal_code: '23200' },
  ],
  KHE: [
    { code: 'KHE-V', name_fr: 'Khénifra',         name_ar: 'خنيفرة',   postal_code: '54000' },
    { code: 'MID-V', name_fr: 'Midelt',           name_ar: 'ميدلت',    postal_code: '54350' },
  ],
  CBA: [
    { code: 'CBA-V', name_fr: 'Casablanca',       name_ar: 'الدار البيضاء', postal_code: '20000' },
    { code: 'MOH-V', name_fr: 'Mohammedia',       name_ar: 'المحمدية', postal_code: '28800' },
    { code: 'AIN-V', name_fr: 'Aïn Sebaâ',        name_ar: 'عين السبع', postal_code: '20250' },
  ],
  MED: [
    { code: 'MED-V', name_fr: 'Médiouna',         name_ar: 'مديونة',   postal_code: '20700' },
  ],
  NOU: [
    { code: 'NOU-V', name_fr: 'Nouaceur',         name_ar: 'النواصر',  postal_code: '27182' },
    { code: 'DAR-V', name_fr: 'Dar Bouazza',      name_ar: 'دار بوعزة', postal_code: '28000' },
  ],
  SET: [
    { code: 'SET-V', name_fr: 'Settat',           name_ar: 'سطات',     postal_code: '26000' },
    { code: 'KHO-V', name_fr: 'Khouribga',        name_ar: 'خريبكة',   postal_code: '25000' },
  ],
  EJA: [
    { code: 'EJA-V', name_fr: 'El Jadida',        name_ar: 'الجديدة',  postal_code: '24000' },
    { code: 'AZE-V', name_fr: 'Azemmour',         name_ar: 'أزمور',    postal_code: '24100' },
  ],
  MAR: [
    { code: 'MAR-V', name_fr: 'Marrakech',        name_ar: 'مراكش',    postal_code: '40000' },
    { code: 'OUT-V', name_fr: 'Ourika',           name_ar: 'أوريكة',   postal_code: '42101' },
  ],
  ESS: [
    { code: 'ESS-V', name_fr: 'Essaouira',        name_ar: 'الصويرة',  postal_code: '44000' },
  ],
  SAF: [
    { code: 'SAF-V', name_fr: 'Safi',             name_ar: 'آسفي',     postal_code: '46000' },
    { code: 'SOU-V', name_fr: 'Souira Guedima',   name_ar: 'صويرة قديمة', postal_code: '46050' },
  ],
  KEL: [
    { code: 'KEL-V', name_fr: 'Kelâa des Sraghna', name_ar: 'قلعة السراغنة', postal_code: '43000' },
  ],
  ERC: [
    { code: 'ERC-V', name_fr: 'Errachidia',       name_ar: 'الرشيدية', postal_code: '52000' },
    { code: 'GOR-V', name_fr: 'Goulmima',         name_ar: 'كلميمة',   postal_code: '52450' },
  ],
  OUA: [
    { code: 'OUA-V', name_fr: 'Ouarzazate',       name_ar: 'ورزازات',  postal_code: '45000' },
    { code: 'BDA-V', name_fr: 'Boumalne Dadès',   name_ar: 'بومالن دادس', postal_code: '45300' },
  ],
  TIN: [
    { code: 'TIN-V', name_fr: 'Tinghir',          name_ar: 'تنغير',    postal_code: '45800' },
  ],
  ZAG: [
    { code: 'ZAG-V', name_fr: 'Zagora',           name_ar: 'زاكورة',   postal_code: '45900' },
    { code: 'MHA-V', name_fr: 'M\'Hamid',         name_ar: 'مسعيد',    postal_code: '45950' },
  ],
  AGA: [
    { code: 'AGA-V', name_fr: 'Agadir',           name_ar: 'أكادير',   postal_code: '80000' },
    { code: 'INE-V', name_fr: 'Inezgane',         name_ar: 'إنزكان',   postal_code: '80350' },
    { code: 'AIT-V', name_fr: 'Aït Melloul',      name_ar: 'آيت ملول', postal_code: '80150' },
  ],
  TAR: [
    { code: 'TAR-V', name_fr: 'Taroudant',        name_ar: 'تارودانت', postal_code: '83000' },
    { code: 'OUT2-V', name_fr: 'Ouled Teïma',     name_ar: 'أولاد تيمة', postal_code: '83400' },
  ],
  TIZ: [
    { code: 'TIZ-V', name_fr: 'Tiznit',           name_ar: 'تيزنيت',   postal_code: '85000' },
  ],
  CAB: [
    { code: 'BIK-V', name_fr: 'Biougra',          name_ar: 'بيوكرى',   postal_code: '82000' },
  ],
  GUE: [
    { code: 'GUE-V', name_fr: 'Guelmim',          name_ar: 'كلميم',    postal_code: '81000' },
  ],
  SIF: [
    { code: 'SIF-V', name_fr: 'Sidi Ifni',        name_ar: 'سيدي إفني', postal_code: '86000' },
  ],
  TAN: [
    { code: 'TAN-V', name_fr: 'Tan-Tan',          name_ar: 'طانطان',   postal_code: '87000' },
  ],
  LAA: [
    { code: 'LAA-V', name_fr: 'Laâyoune',         name_ar: 'العيون',   postal_code: '70000' },
  ],
  BOU: [
    { code: 'BOU-V', name_fr: 'Boujdour',         name_ar: 'بوجدور',   postal_code: '72000' },
  ],
  SEM: [
    { code: 'SEM-V', name_fr: 'Smara',            name_ar: 'السمارة',  postal_code: '74000' },
  ],
  DAK: [
    { code: 'DAK-V', name_fr: 'Dakhla',           name_ar: 'الداخلة',  postal_code: '73000' },
  ],
  AOU: [
    { code: 'AOU-V', name_fr: 'Aousserd',         name_ar: 'أوسرد',    postal_code: '73100' },
  ],
};

// ── 4. Brands ─────────────────────────────────────────────────────────────────

const BRANDS = [
  { code: 'CDANONE',   name_fr: 'Centrale Danone',  name_ar: 'سنترال دانون',    status: 'active' },
  { code: 'LESIEUR',   name_fr: 'Lesieur Cristal',  name_ar: 'ليسيور كريستال',  status: 'active' },
  { code: 'COSUMAR',   name_fr: 'Cosumar',           name_ar: 'كوسومار',         status: 'active' },
  { code: 'BIMO',      name_fr: 'Bimo',              name_ar: 'بيمو',            status: 'active' },
  { code: 'SIDIAMI',   name_fr: 'Sidi Ali',          name_ar: 'سيدي علي',       status: 'active' },
  { code: 'OULMES',    name_fr: 'Oulmès',            name_ar: 'أولمس',           status: 'active' },
  { code: 'TRIA',      name_fr: 'Tria',              name_ar: 'تريا',            status: 'active' },
  { code: 'AICHA',     name_fr: "Aïcha",             name_ar: 'عائشة',           status: 'active' },
  { code: 'KOUTOUBIA', name_fr: 'Koutoubia',         name_ar: 'الكتبية',        status: 'active' },
  { code: 'DELICE',    name_fr: 'Délice',            name_ar: 'ديليس',           status: 'active' },
  { code: 'MARJANE',   name_fr: 'Marjane',           name_ar: 'مرجان',           status: 'active' },
  { code: 'ZINE',      name_fr: 'Zine',              name_ar: 'زين',             status: 'active' },
];

// ── 5. Reference data ─────────────────────────────────────────────────────────

const UNITS = [
  { code: 'PCE',  name_fr: 'Pièce',        name_ar: 'قطعة',    short_name_fr: 'pce', short_name_ar: 'ق' },
  { code: 'KG',   name_fr: 'Kilogramme',   name_ar: 'كيلوغرام', short_name_fr: 'kg', short_name_ar: 'كغ' },
  { code: 'LIT',  name_fr: 'Litre',        name_ar: 'لتر',     short_name_fr: 'L',  short_name_ar: 'ل' },
  { code: 'GR',   name_fr: 'Gramme',       name_ar: 'غرام',    short_name_fr: 'g',  short_name_ar: 'غ' },
  { code: 'ML',   name_fr: 'Millilitre',   name_ar: 'ملليلتر', short_name_fr: 'mL', short_name_ar: 'مل' },
  { code: 'BOT',  name_fr: 'Bouteille',    name_ar: 'قارورة',  short_name_fr: 'bot', short_name_ar: 'ق' },
  { code: 'PKT',  name_fr: 'Paquet',       name_ar: 'علبة',    short_name_fr: 'pkt', short_name_ar: 'علب' },
];

const ARTICLE_TYPES = [
  { code: 'ALIM',    name_fr: 'Alimentaire',       name_ar: 'غذائي' },
  { code: 'NONALIM', name_fr: 'Non Alimentaire',   name_ar: 'غير غذائي' },
  { code: 'LIQ',     name_fr: 'Liquide',           name_ar: 'سائل' },
  { code: 'FRAG',    name_fr: 'Fragile',           name_ar: 'هش' },
];

const ARTICLE_STATUSES = [
  { code: 'ACTIF',    name_fr: 'Actif',        name_ar: 'نشط',          color: '#10b981' },
  { code: 'INACTIF',  name_fr: 'Inactif',      name_ar: 'غير نشط',      color: '#6b7280' },
  { code: 'NOUVEAU',  name_fr: 'Nouveau',      name_ar: 'جديد',         color: '#3b82f6' },
  { code: 'RUPTURE',  name_fr: 'En rupture',   name_ar: 'نفدت الكمية',  color: '#ef4444' },
  { code: 'PROMO',    name_fr: 'En promotion', name_ar: 'في ترويج',     color: '#f59e0b' },
];

const CONSERVATION_TYPES = [
  { code: 'AMBIANTE', name_fr: 'Température ambiante', name_ar: 'درجة حرارة الغرفة' },
  { code: 'REFRIG',   name_fr: 'Réfrigéré',           name_ar: 'مبرد',       min_temperature: 2,  max_temperature: 8  },
  { code: 'SURGELE',  name_fr: 'Surgelé',             name_ar: 'مجمد',       min_temperature: -25, max_temperature: -18 },
  { code: 'SEC',      name_fr: 'Sec',                  name_ar: 'جاف' },
  { code: 'FRAIS',    name_fr: 'Frais',               name_ar: 'طازج',       min_temperature: 4,  max_temperature: 12  },
];

const TAXES = [
  { code: 'TVA20',    name_fr: 'TVA 20%',  name_ar: 'ضريبة القيمة المضافة 20%', rate: 20 },
  { code: 'TVA14',    name_fr: 'TVA 14%',  name_ar: 'ضريبة القيمة المضافة 14%', rate: 14 },
  { code: 'TVA10',    name_fr: 'TVA 10%',  name_ar: 'ضريبة القيمة المضافة 10%', rate: 10 },
  { code: 'TVA7',     name_fr: 'TVA 7%',   name_ar: 'ضريبة القيمة المضافة 7%',  rate: 7  },
  { code: 'EXONERE',  name_fr: 'Exonéré',  name_ar: 'معفى',                     rate: 0  },
];

// ── 6. Families & Categories ──────────────────────────────────────────────────

const FAMILIES = [
  { code: 'EPICERIE',    name_fr: 'Épicerie Sèche',           name_ar: 'المواد الغذائية الجافة' },
  { code: 'BOISSONS',    name_fr: 'Boissons',                 name_ar: 'المشروبات' },
  { code: 'LAITIERS',    name_fr: 'Produits Laitiers',        name_ar: 'منتجات الألبان' },
  { code: 'HYGIENE',     name_fr: 'Hygiène & Beauté',         name_ar: 'النظافة والجمال' },
  { code: 'ENTRETIEN',   name_fr: "Entretien Maison",         name_ar: 'العناية بالمنزل' },
  { code: 'BOULANGERIE', name_fr: 'Boulangerie & Viennoiserie', name_ar: 'المخبزة والمعجنات' },
  { code: 'CONSERVES',   name_fr: 'Conserves & Condiments',   name_ar: 'المحفوظات والتوابل' },
  { code: 'CONFISERIE',  name_fr: 'Confiserie & Biscuits',    name_ar: 'الحلويات والبسكويت' },
];

const CATEGORIES_BY_FAMILY = {
  EPICERIE:    [
    { code: 'HUILES',    name_fr: 'Huiles alimentaires', name_ar: 'الزيوت الغذائية' },
    { code: 'SUCRES',    name_fr: 'Sucres & Édulcorants', name_ar: 'السكر والمحليات' },
    { code: 'PATES',     name_fr: 'Pâtes & Riz',         name_ar: 'المعكرونة والأرز' },
    { code: 'FARINES',   name_fr: 'Farines & Semoules',  name_ar: 'الدقيق والسميد' },
  ],
  BOISSONS:    [
    { code: 'EAUX',      name_fr: 'Eaux minérales',      name_ar: 'المياه المعدنية' },
    { code: 'JUSPURS',   name_fr: 'Jus de fruits',       name_ar: 'عصير الفواكه' },
    { code: 'GAZEUX',    name_fr: 'Boissons gazeuses',   name_ar: 'المشروبات الغازية' },
  ],
  LAITIERS:    [
    { code: 'LAITS',     name_fr: 'Laits',               name_ar: 'الحليب' },
    { code: 'YAOURTS',   name_fr: 'Yaourts',             name_ar: 'الزبادي' },
    { code: 'FROMAGES',  name_fr: 'Fromages',            name_ar: 'الجبن' },
    { code: 'BEURRES',   name_fr: 'Beurres & Crèmes',    name_ar: 'الزبدة والقشدة' },
  ],
  HYGIENE:     [
    { code: 'SHAMPOO',   name_fr: 'Shampooings',         name_ar: 'الشامبو' },
    { code: 'SAVONS',    name_fr: 'Savons & Gels',       name_ar: 'الصابون والجل' },
    { code: 'DENTAIRE',  name_fr: 'Hygiène dentaire',    name_ar: 'العناية بالأسنان' },
  ],
  ENTRETIEN:   [
    { code: 'DETERGENTS', name_fr: 'Détergents',         name_ar: 'المنظفات' },
    { code: 'VAISSELLE',  name_fr: 'Produits vaisselle', name_ar: 'منظفات الأطباق' },
  ],
  BOULANGERIE: [
    { code: 'PAINS',     name_fr: 'Pains & Galettes',    name_ar: 'الخبز والرغائف' },
    { code: 'VIENNOIS',  name_fr: 'Viennoiseries',       name_ar: 'المعجنات' },
  ],
  CONSERVES:   [
    { code: 'SARDINES',  name_fr: 'Sardines & Thon',     name_ar: 'السردين والتونة' },
    { code: 'CONFITURE', name_fr: 'Confitures',          name_ar: 'المربى' },
    { code: 'HARISSA',   name_fr: 'Harissa & Sauces',    name_ar: 'الهريسة والصلصات' },
  ],
  CONFISERIE:  [
    { code: 'BISCUITS',  name_fr: 'Biscuits',            name_ar: 'البسكويت' },
    { code: 'CHOCOLATS', name_fr: 'Chocolats',           name_ar: 'الشوكولاتة' },
    { code: 'BONBONS',   name_fr: 'Bonbons & Caramels',  name_ar: 'الحلوى والكراميل' },
  ],
};

// ── 7. Articles (30 Moroccan products) ───────────────────────────────────────

// Each entry: { sku_code, name_fr, name_ar, brand_code, family_code, category_code, price, weight_g, vat_code }
const ARTICLE_DEFS = [
  // Huiles
  { sku_code: 'HUI-LESIEUR-1L',   name_fr: 'Huile de Tournesol Lesieur 1L',    name_ar: 'زيت دوار الشمس لوسيور 1ل',       brand: 'LESIEUR',   family: 'EPICERIE',    cat: 'HUILES',     price: 25.90,  weight_g: 920,   vat: 'TVA20' },
  { sku_code: 'HUI-CRISTAL-2L',   name_fr: 'Huile de Table Cristal 2L',        name_ar: 'زيت المائدة كريستال 2ل',          brand: 'LESIEUR',   family: 'EPICERIE',    cat: 'HUILES',     price: 48.50,  weight_g: 1840,  vat: 'TVA20' },
  { sku_code: 'HUI-OLIVE-500ML',  name_fr: 'Huile d\'Olive Vierge 500ml',      name_ar: 'زيت الزيتون البكر 500مل',         brand: 'AICHA',     family: 'EPICERIE',    cat: 'HUILES',     price: 65.00,  weight_g: 460,   vat: 'TVA20' },
  // Sucres
  { sku_code: 'SUC-COSUMAR-1KG',  name_fr: 'Sucre en poudre Cosumar 1kg',      name_ar: 'سكر بودرة كوسومار 1كغ',           brand: 'COSUMAR',   family: 'EPICERIE',    cat: 'SUCRES',     price: 8.50,   weight_g: 1000,  vat: 'EXONERE' },
  { sku_code: 'SUC-MORCEAUX-1KG', name_fr: 'Sucre en morceaux 1kg',            name_ar: 'سكر مكعبات 1كغ',                  brand: 'COSUMAR',   family: 'EPICERIE',    cat: 'SUCRES',     price: 9.00,   weight_g: 1000,  vat: 'EXONERE' },
  // Eaux
  { sku_code: 'EAU-SIDIAMI-1.5L', name_fr: 'Eau Minérale Sidi Ali 1.5L',       name_ar: 'ماء معدني سيدي علي 1.5ل',         brand: 'SIDIAMI',   family: 'BOISSONS',    cat: 'EAUX',       price: 5.50,   weight_g: 1500,  vat: 'TVA20' },
  { sku_code: 'EAU-OULMES-1.5L',  name_fr: 'Eau Pétillante Oulmès 1.5L',       name_ar: 'ماء فوار أولمس 1.5ل',             brand: 'OULMES',    family: 'BOISSONS',    cat: 'EAUX',       price: 7.00,   weight_g: 1500,  vat: 'TVA20' },
  { sku_code: 'EAU-SIDIAMI-5L',   name_fr: 'Eau Minérale Sidi Ali 5L',         name_ar: 'ماء معدني سيدي علي 5ل',           brand: 'SIDIAMI',   family: 'BOISSONS',    cat: 'EAUX',       price: 13.00,  weight_g: 5000,  vat: 'TVA20' },
  // Jus
  { sku_code: 'JUS-AICHA-1L-ORA', name_fr: 'Jus d\'Orange Aïcha 1L',           name_ar: 'عصير البرتقال عائشة 1ل',          brand: 'AICHA',     family: 'BOISSONS',    cat: 'JUSPURS',    price: 14.50,  weight_g: 1000,  vat: 'TVA20' },
  { sku_code: 'JUS-AICHA-1L-PEC', name_fr: 'Jus de Pêche Aïcha 1L',            name_ar: 'عصير الخوخ عائشة 1ل',             brand: 'AICHA',     family: 'BOISSONS',    cat: 'JUSPURS',    price: 14.50,  weight_g: 1000,  vat: 'TVA20' },
  // Laits
  { sku_code: 'LAI-DANONE-1L',    name_fr: 'Lait Entier Centrale Danone 1L',   name_ar: 'حليب كامل الدسم سنترال دانون 1ل', brand: 'CDANONE',   family: 'LAITIERS',    cat: 'LAITS',      price: 7.50,   weight_g: 1030,  vat: 'EXONERE' },
  { sku_code: 'LAI-DANONE-1/2L',  name_fr: 'Lait Demi-Écrémé Danone 0.5L',    name_ar: 'حليب نصف دسم دانون 0.5ل',         brand: 'CDANONE',   family: 'LAITIERS',    cat: 'LAITS',      price: 4.50,   weight_g: 515,   vat: 'EXONERE' },
  // Yaourts
  { sku_code: 'YAO-DANONE-125G',  name_fr: 'Yaourt Nature Danone 125g',        name_ar: 'زبادي طبيعي دانون 125غ',          brand: 'CDANONE',   family: 'LAITIERS',    cat: 'YAOURTS',    price: 4.20,   weight_g: 125,   vat: 'TVA10' },
  { sku_code: 'YAO-DANONE-FRAISE',name_fr: 'Yaourt Fraise Danone 4x125g',      name_ar: 'زبادي فراولة دانون 4×125غ',       brand: 'CDANONE',   family: 'LAITIERS',    cat: 'YAOURTS',    price: 16.00,  weight_g: 500,   vat: 'TVA10' },
  // Beurre
  { sku_code: 'BEU-DELICE-200G',  name_fr: 'Beurre Extra Délice 200g',         name_ar: 'زبدة فاخرة ديليس 200غ',           brand: 'DELICE',    family: 'LAITIERS',    cat: 'BEURRES',    price: 18.50,  weight_g: 200,   vat: 'TVA14' },
  // Sardines
  { sku_code: 'SAR-AICHA-125G',   name_fr: 'Sardines à l\'Huile Aïcha 125g',   name_ar: 'سردين بالزيت عائشة 125غ',         brand: 'AICHA',     family: 'CONSERVES',   cat: 'SARDINES',   price: 9.50,   weight_g: 125,   vat: 'TVA20' },
  { sku_code: 'SAR-AICHA-TOMA',   name_fr: 'Sardines à la Tomate Aïcha 125g',  name_ar: 'سردين بالطماطم عائشة 125غ',       brand: 'AICHA',     family: 'CONSERVES',   cat: 'SARDINES',   price: 10.00,  weight_g: 125,   vat: 'TVA20' },
  { sku_code: 'THO-AICHA-160G',   name_fr: 'Thon Albacore Aïcha 160g',         name_ar: 'تونة بيضاء عائشة 160غ',           brand: 'AICHA',     family: 'CONSERVES',   cat: 'SARDINES',   price: 20.00,  weight_g: 160,   vat: 'TVA20' },
  // Confiture
  { sku_code: 'CON-AICHA-250G-AB', name_fr: 'Confiture Abricot Aïcha 250g',    name_ar: 'مربى المشمش عائشة 250غ',          brand: 'AICHA',     family: 'CONSERVES',   cat: 'CONFITURE',  price: 14.00,  weight_g: 250,   vat: 'TVA20' },
  { sku_code: 'CON-AICHA-250G-FR', name_fr: 'Confiture Fraise Aïcha 250g',     name_ar: 'مربى الفراولة عائشة 250غ',        brand: 'AICHA',     family: 'CONSERVES',   cat: 'CONFITURE',  price: 15.00,  weight_g: 250,   vat: 'TVA20' },
  // Biscuits
  { sku_code: 'BIS-BIMO-PETITL',  name_fr: 'Petit Beurre Bimo 200g',           name_ar: 'بيتي بور بيمو 200غ',              brand: 'BIMO',      family: 'CONFISERIE',  cat: 'BISCUITS',   price: 8.50,   weight_g: 200,   vat: 'TVA20' },
  { sku_code: 'BIS-BIMO-CHOCO',   name_fr: 'Biscuits Chocolat Bimo 100g',      name_ar: 'بسكويت شوكولاتة بيمو 100غ',       brand: 'BIMO',      family: 'CONFISERIE',  cat: 'BISCUITS',   price: 6.00,   weight_g: 100,   vat: 'TVA20' },
  { sku_code: 'BIS-TRIA-CREAM',   name_fr: 'Cream Cracker Tria 200g',          name_ar: 'كريم كراكر تريا 200غ',            brand: 'TRIA',      family: 'CONFISERIE',  cat: 'BISCUITS',   price: 9.00,   weight_g: 200,   vat: 'TVA20' },
  // Harissa
  { sku_code: 'HAR-AICHA-135G',   name_fr: 'Harissa Aïcha 135g',               name_ar: 'هريسة عائشة 135غ',                brand: 'AICHA',     family: 'CONSERVES',   cat: 'HARISSA',    price: 7.50,   weight_g: 135,   vat: 'TVA20' },
  // Farines
  { sku_code: 'FAR-TRIA-1KG',     name_fr: 'Farine Tendre Tria 1kg',           name_ar: 'دقيق ليّن تريا 1كغ',              brand: 'TRIA',      family: 'EPICERIE',    cat: 'FARINES',    price: 8.00,   weight_g: 1000,  vat: 'EXONERE' },
  { sku_code: 'SEM-TRIA-1KG',     name_fr: 'Semoule Fine Tria 1kg',            name_ar: 'سميد ناعم تريا 1كغ',              brand: 'TRIA',      family: 'EPICERIE',    cat: 'FARINES',    price: 9.50,   weight_g: 1000,  vat: 'EXONERE' },
  // Koutoubia (viande)
  { sku_code: 'KFR-KOUT-480G',    name_fr: 'Kefta Bœuf Koutoubia 480g',        name_ar: 'كفتة لحم البقر الكتبية 480غ',     brand: 'KOUTOUBIA', family: 'CONSERVES',   cat: 'SARDINES',   price: 42.00,  weight_g: 480,   vat: 'TVA20' },
  // Pâtes
  { sku_code: 'PAT-TRIA-500G-SPG',name_fr: 'Spaghetti Tria 500g',              name_ar: 'سباغيتي تريا 500غ',               brand: 'TRIA',      family: 'EPICERIE',    cat: 'PATES',      price: 7.00,   weight_g: 500,   vat: 'EXONERE' },
  { sku_code: 'PAT-TRIA-500G-MAC',name_fr: 'Macaroni Tria 500g',               name_ar: 'ماكاروني تريا 500غ',              brand: 'TRIA',      family: 'EPICERIE',    cat: 'PATES',      price: 7.00,   weight_g: 500,   vat: 'EXONERE' },
  // Hygiène
  { sku_code: 'SAV-ZINE-100G',    name_fr: 'Savon Zine 100g',                  name_ar: 'صابون زين 100غ',                  brand: 'ZINE',      family: 'HYGIENE',     cat: 'SAVONS',     price: 4.00,   weight_g: 100,   vat: 'TVA20' },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🇲🇦  Seed Moroccan Data — démarrage…\n');

  // ── Regions ──
  console.log('📍 Régions…');
  const regionMap = {};
  for (const r of REGIONS) {
    const rec = await upsertRegion(r);
    regionMap[r.code] = rec.id;
  }
  console.log(`   ✓ ${REGIONS.length} régions`);

  // ── Provinces ──
  console.log('🏙️  Provinces…');
  const provinceMap = {};
  let provCount = 0;
  for (const [regionCode, provinces] of Object.entries(PROVINCES_BY_REGION)) {
    const region_id = regionMap[regionCode];
    for (const p of provinces) {
      const rec = await upsertProvince({ ...p, region_id });
      provinceMap[p.code] = rec.id;
      provCount++;
    }
  }
  console.log(`   ✓ ${provCount} provinces`);

  // ── Cities ──
  console.log('🏘️  Villes…');
  let cityCount = 0;
  for (const [provCode, cities] of Object.entries(CITIES_BY_PROVINCE)) {
    const province_id = provinceMap[provCode];
    if (!province_id) continue;
    for (const c of cities) {
      await upsertCity({ ...c, province_id });
      cityCount++;
    }
  }
  console.log(`   ✓ ${cityCount} villes`);

  // ── Brands ──
  console.log('🏷️  Marques…');
  const brandMap = {};
  for (const b of BRANDS) {
    const rec = await upsertBrand(b);
    brandMap[b.code] = rec.id;
  }
  console.log(`   ✓ ${BRANDS.length} marques`);

  // ── Reference data ──
  console.log('📋 Données de référence…');
  const unitMap = {};
  for (const u of UNITS) { const r = await upsertUnit(u); unitMap[u.code] = r.id; }
  const artTypeMap = {};
  for (const t of ARTICLE_TYPES) { const r = await upsertArtType(t); artTypeMap[t.code] = r.id; }
  const artStatusMap = {};
  for (const s of ARTICLE_STATUSES) { const r = await upsertArtStatus(s); artStatusMap[s.code] = r.id; }
  const consTypeMap = {};
  for (const c of CONSERVATION_TYPES) { const r = await upsertConsType(c); consTypeMap[c.code] = r.id; }
  const taxMap = {};
  for (const t of TAXES) { const r = await upsertTax(t); taxMap[t.code] = r.id; }
  console.log(`   ✓ ${UNITS.length} unités, ${ARTICLE_TYPES.length} types, ${ARTICLE_STATUSES.length} statuts, ${CONSERVATION_TYPES.length} types conservation, ${TAXES.length} taxes`);

  // ── Families & Categories ──
  console.log('📂 Familles & catégories…');
  const familyMap = {};
  const categoryMap = {};
  for (const f of FAMILIES) {
    const rec = await upsertFamily(f);
    familyMap[f.code] = rec.id;
  }
  for (const [famCode, cats] of Object.entries(CATEGORIES_BY_FAMILY)) {
    const family_id = familyMap[famCode];
    for (const c of cats) {
      const rec = await upsertCategory({ ...c, family_id });
      categoryMap[c.code] = rec.id;
    }
  }
  console.log(`   ✓ ${FAMILIES.length} familles, ${Object.values(CATEGORIES_BY_FAMILY).flat().length} catégories`);

  // ── Articles + Skus ──
  console.log('🛒 Articles + SKUs…');
  let created = 0;
  let skipped = 0;
  for (const def of ARTICLE_DEFS) {
    const existing = await prisma.article.findUnique({ where: { sku_code: def.sku_code } });
    if (existing) { skipped++; continue; }

    // Create Sku first (empty — just an ID)
    const sku = await prisma.sku.create({ data: {} });

    await prisma.article.create({
      data: {
        sku_code:        def.sku_code,
        name_fr:         def.name_fr,
        name_ar:         def.name_ar,
        brand_id:        brandMap[def.brand] ?? null,
        family_id:       familyMap[def.family],
        category_id:     categoryMap[def.cat] ?? null,
        price:           def.price,
        weight_g:        def.weight_g ?? null,
        tax_id:          taxMap[def.vat] ?? null,
        article_type_id: artTypeMap['ALIM'],
        article_status_id: artStatusMap['ACTIF'],
        conservation_type_id: def.family === 'LAITIERS' ? consTypeMap['REFRIG'] : consTypeMap['AMBIANTE'],
        is_active:       true,
        sku_uuid:        sku.id,
      },
    });
    created++;
  }
  console.log(`   ✓ ${created} articles créés, ${skipped} ignorés (déjà existants)`);

  console.log('\n✅ Seed terminé avec succès!');
  console.log(`   Régions:   ${REGIONS.length}`);
  console.log(`   Provinces: ${provCount}`);
  console.log(`   Villes:    ${cityCount}`);
  console.log(`   Marques:   ${BRANDS.length}`);
  console.log(`   Articles:  ${created} créés / ${skipped} ignorés`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
