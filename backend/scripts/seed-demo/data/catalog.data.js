/**
 * Données de démonstration : référentiels catalogue, hiérarchie, marques et SKU.
 * Marques : noms de marques vendues au Maroc, logos TEXTE générés (aucun logo réel).
 */

const UNITS = [
  { code: 'PCE', name_fr: 'Pièce', name_ar: 'قطعة', short_name_fr: 'pce', short_name_ar: 'قطعة', sort_order: 1 },
  { code: 'KG', name_fr: 'Kilogramme', name_ar: 'كيلوغرام', short_name_fr: 'kg', short_name_ar: 'كلغ', sort_order: 2 },
  { code: 'G', name_fr: 'Gramme', name_ar: 'غرام', short_name_fr: 'g', short_name_ar: 'غ', sort_order: 3 },
  { code: 'L', name_fr: 'Litre', name_ar: 'لتر', short_name_fr: 'L', short_name_ar: 'ل', sort_order: 4 },
  { code: 'ML', name_fr: 'Millilitre', name_ar: 'مليلتر', short_name_fr: 'ml', short_name_ar: 'مل', sort_order: 5 },
  { code: 'PACK', name_fr: 'Pack', name_ar: 'حزمة', short_name_fr: 'pack', short_name_ar: 'حزمة', sort_order: 6 },
  { code: 'CART', name_fr: 'Carton', name_ar: 'كرتونة', short_name_fr: 'ctn', short_name_ar: 'كرتونة', sort_order: 7 },
];

const TAXES = [
  { code: 'TVA20', name_fr: 'TVA 20 %', name_ar: 'الضريبة على القيمة المضافة 20%', rate: 20 },
  { code: 'TVA14', name_fr: 'TVA 14 %', name_ar: 'الضريبة على القيمة المضافة 14%', rate: 14 },
  { code: 'TVA10', name_fr: 'TVA 10 %', name_ar: 'الضريبة على القيمة المضافة 10%', rate: 10 },
  { code: 'TVA7', name_fr: 'TVA 7 %', name_ar: 'الضريبة على القيمة المضافة 7%', rate: 7 },
  { code: 'TVA0', name_fr: 'Exonéré (TVA 0 %)', name_ar: 'معفى (0%)', rate: 0 },
];

const CONSERVATIONS = [
  { code: 'AMB', name_fr: 'Ambiant', name_ar: 'درجة حرارة الغرفة', min_temperature: 15, max_temperature: 25 },
  { code: 'FRAIS', name_fr: 'Frais', name_ar: 'طازج (مبرد)', min_temperature: 0, max_temperature: 4 },
  { code: 'SURG', name_fr: 'Surgelé', name_ar: 'مجمد', min_temperature: -25, max_temperature: -18 },
];

const PACKAGINGS = [
  { code: 'BOUT', name_fr: 'Bouteille', name_ar: 'قنينة', unit: 'PCE', quantity: 1 },
  { code: 'BRIQ', name_fr: 'Brique', name_ar: 'علبة كرتونية', unit: 'PCE', quantity: 1 },
  { code: 'POT', name_fr: 'Pot / bocal', name_ar: 'برطمان', unit: 'PCE', quantity: 1 },
  { code: 'SACH', name_fr: 'Sachet', name_ar: 'كيس', unit: 'PCE', quantity: 1 },
  { code: 'BOIT', name_fr: 'Boîte carton', name_ar: 'علبة', unit: 'PCE', quantity: 1 },
  { code: 'CAN', name_fr: 'Canette / boîte métal', name_ar: 'علبة معدنية', unit: 'PCE', quantity: 1 },
  { code: 'BARQ', name_fr: 'Barquette', name_ar: 'صينية', unit: 'PCE', quantity: 1 },
  { code: 'VRAC', name_fr: 'Vrac (au kilo)', name_ar: 'بالكيلو', unit: 'KG', quantity: 1 },
  { code: 'FARD6', name_fr: 'Fardeau de 6', name_ar: 'حزمة من 6', unit: 'PACK', quantity: 6 },
  { code: 'CART12', name_fr: 'Carton de 12', name_ar: 'كرتونة من 12', unit: 'CART', quantity: 12 },
];

/** Familles (couleur = fond des packshots). */
const FAMILIES = [
  { code: 'EPS', name_fr: 'Épicerie salée', name_ar: 'البقالة المالحة', color: '#c0392b', shape: 'jar', subs: [
    ['EPS-HUI', 'Huiles & vinaigres', 'الزيوت والخل'],
    ['EPS-FEC', 'Pâtes, riz & couscous', 'المعجنات والأرز والكسكس'],
    ['EPS-CON', 'Conserves', 'المعلبات'],
    ['EPS-EPI', 'Épices & condiments', 'التوابل'],
    ['EPS-SAU', 'Sauces & bouillons', 'الصلصات والمرق'],
  ] },
  { code: 'EPU', name_fr: 'Épicerie sucrée', name_ar: 'البقالة الحلوة', color: '#d35400', shape: 'box', subs: [
    ['EPU-BIS', 'Biscuits & gâteaux', 'البسكويت والحلويات'],
    ['EPU-THE', 'Thé, café & infusions', 'الشاي والقهوة والأعشاب'],
    ['EPU-CFT', 'Confitures, miel & pâtes à tartiner', 'المربى والعسل'],
    ['EPU-SUC', 'Sucre & farine', 'السكر والدقيق'],
  ] },
  { code: 'BOI', name_fr: 'Boissons', name_ar: 'المشروبات', color: '#1f6fb2', shape: 'bottle', subs: [
    ['BOI-EAU', 'Eaux', 'المياه'],
    ['BOI-SOD', 'Sodas', 'المشروبات الغازية'],
    ['BOI-JUS', 'Jus & nectars', 'العصائر'],
  ] },
  { code: 'LAI', name_fr: 'Produits laitiers & œufs', name_ar: 'منتجات الألبان والبيض', color: '#3a8fd6', shape: 'brick', subs: [
    ['LAI-LAI', 'Laits & lben', 'الحليب واللبن'],
    ['LAI-YAO', 'Yaourts & desserts', 'الياغورت'],
    ['LAI-FRO', 'Fromages', 'الأجبان'],
    ['LAI-BEU', 'Beurre & œufs', 'الزبدة والبيض'],
  ] },
  { code: 'FRL', name_fr: 'Fruits & légumes', name_ar: 'الفواكه والخضر', color: '#27ae60', shape: 'fruit', subs: [
    ['FRL-LEG', 'Légumes', 'الخضر'],
    ['FRL-FRU', 'Fruits & fruits secs', 'الفواكه والتمور'],
    ['FRL-HER', 'Herbes fraîches', 'الأعشاب الطازجة'],
  ] },
  { code: 'BOU', name_fr: 'Boucherie & volaille', name_ar: 'اللحوم والدواجن', color: '#922b21', shape: 'tray', subs: [
    ['BOU-VOL', 'Volaille', 'الدواجن'],
    ['BOU-VIA', 'Viande rouge', 'اللحوم الحمراء'],
    ['BOU-CHA', 'Charcuterie halal', 'اللحوم المصنعة الحلال'],
  ] },
  { code: 'BLG', name_fr: 'Boulangerie', name_ar: 'المخبزة', color: '#b9770e', shape: 'loaf', subs: [
    ['BLG-PAI', 'Pains', 'الخبز'],
    ['BLG-VIE', 'Viennoiseries', 'المعجنات الصباحية'],
    ['BLG-TRA', 'Pâtisserie marocaine', 'الحلويات المغربية'],
  ] },
  { code: 'HYG', name_fr: 'Hygiène & beauté', name_ar: 'النظافة والتجميل', color: '#8e44ad', shape: 'tube', subs: [
    ['HYG-DOU', 'Douche & bain', 'الاستحمام'],
    ['HYG-DEN', 'Soin dentaire', 'العناية بالأسنان'],
    ['HYG-CAP', 'Soin des cheveux', 'العناية بالشعر'],
  ] },
  { code: 'ENT', name_fr: 'Entretien de la maison', name_ar: 'منظفات المنزل', color: '#16a085', shape: 'jug', subs: [
    ['ENT-LES', 'Lessive', 'مسحوق الغسيل'],
    ['ENT-VAI', 'Vaisselle', 'غسيل الأواني'],
    ['ENT-SUR', 'Nettoyants surfaces', 'منظفات الأسطح'],
  ] },
  { code: 'BEB', name_fr: 'Bébé', name_ar: 'الرضيع', color: '#d63384', shape: 'box', subs: [
    ['BEB-COU', 'Couches & lingettes', 'الحفاضات والمناديل'],
    ['BEB-ALI', 'Alimentation bébé', 'تغذية الرضيع'],
    ['BEB-SOI', 'Soins bébé', 'العناية بالرضيع'],
  ] },
];

/** Catégories plates (thématiques) — image, ordre et code GPC (segment/famille GS1) quand pertinent. */
const CATEGORIES = [
  { code: 'PETIT_DEJ', name_fr: 'Petit-déjeuner', name_ar: 'الفطور', gpc: '50000000', color: '#e67e22', shapes: ['brick', 'jar', 'loaf'], sub: 'Tout pour bien commencer la journée' },
  { code: 'APERO', name_fr: 'Apéritif', name_ar: 'المقبلات', gpc: '50000000', color: '#c0392b', shapes: ['can', 'jar', 'bottle'], sub: 'Olives, fromages, boissons fraîches' },
  { code: 'BIO', name_fr: 'Bio', name_ar: 'منتجات عضوية', gpc: '50350000', color: '#2e8b57', shapes: ['fruit', 'bunch', 'jar'], sub: 'Produits frais issus de l’agriculture biologique' },
  { code: 'NOUVEAUTES', name_fr: 'Nouveautés', name_ar: 'جديد', gpc: null, color: '#6c3483', shapes: ['box', 'bottle', 'tube'], sub: 'Les derniers arrivés dans votre dark store' },
  { code: 'RAMADAN', name_fr: 'Ramadan', name_ar: 'رمضان', gpc: '50000000', color: '#7d3c98', shapes: ['jar', 'box', 'brick'], sub: 'Dattes, chebakia, harira : votre ftour livré' },
  { code: 'ENFANTS', name_fr: 'Spécial enfants', name_ar: 'خاص بالأطفال', gpc: null, color: '#f39c12', shapes: ['box', 'brick', 'can'], sub: 'Goûters et essentiels pour les petits' },
  { code: 'PRIX_MINI', name_fr: 'Prix mini', name_ar: 'أسعار منخفضة', gpc: null, color: '#e74c3c', shapes: ['bag', 'bottle', 'jug'], sub: 'Les essentiels au meilleur prix' },
  { code: 'FAIT_MAISON', name_fr: 'Fait maison', name_ar: 'صنع منزلي', gpc: '50000000', color: '#a04000', shapes: ['bag', 'tray', 'bunch'], sub: 'Ingrédients pour cuisiner comme à la maison' },
];

/** Marques : code, nom, couleur du logo texte, style (0 rectangle, 1 ellipse, 2 contour). */
const BRANDS = [
  ['CENTRALE', 'Centrale Danone', 'سنطرال دانون', '#1565c0', 1],
  ['JAOUDA', 'Jaouda', 'جودة', '#2e7d32', 0],
  ['SIDI_ALI', 'Sidi Ali', 'سيدي علي', '#0277bd', 1],
  ['OULMES', 'Oulmès', 'والماس', '#00838f', 0],
  ['AIN_SAISS', 'Aïn Saïss', 'عين سايس', '#0288d1', 2],
  ['SIDI_HARAZEM', 'Sidi Harazem', 'سيدي حرازم', '#01579b', 0],
  ['IFRANE', 'Ifrane', 'إفران', '#26a69a', 1],
  ['LESIEUR', 'Lesieur', 'لوسيور', '#f9a825', 0],
  ['DARI', 'Dari', 'داري', '#c62828', 1],
  ['AICHA', 'Aïcha', 'عائشة', '#d84315', 2],
  ['KNORR', 'Knorr', 'كنور', '#2e7d32', 0],
  ['MAGGI', 'Maggi', 'ماجي', '#e53935', 0],
  ['NESTLE', 'Nestlé', 'نستله', '#5d4037', 2],
  ['COCA_COLA', 'Coca-Cola', 'كوكاكولا', '#c62828', 1],
  ['TIDE', 'Tide', 'تايد', '#ef6c00', 1],
  ['ARIEL', 'Ariel', 'أريال', '#1b5e20', 0],
  ['DOVE', 'Dove', 'دوف', '#283593', 2],
  ['COLGATE', 'Colgate', 'كولجيت', '#d32f2f', 0],
  ['PAMPERS', 'Pampers', 'بامبرز', '#00897b', 1],
  ['PRESIDENT', 'Président', 'بريزيدون', '#1a237e', 0],
  ['VACHE_QUI_RIT', 'La Vache qui rit', 'البقرة الضاحكة', '#c62828', 1],
  ['BIMO', 'Bimo', 'بيمو', '#6a1b9a', 0],
  ['MERENDINA', 'Merendina', 'ميرندينا', '#4e342e', 2],
  ['LUSINE', 'Lusine', 'لوزين', '#ad1457', 1],
  ['BONDUELLE', 'Bonduelle', 'بونديال', '#388e3c', 0],
  ['SULTAN', 'Sultan', 'السلطان', '#b71c1c', 2],
  ['COSUMAR', 'Cosumar', 'كوزيمار', '#0d47a1', 0],
  ['KOUTOUBIA', 'Koutoubia', 'الكتبية', '#8d6e63', 1],
  ['ATINA', 'Atina Sélection', 'أتينا', '#e53935', 0],
  ['CIEL', 'Ciel', 'سييل', '#039be5', 1],
  ['BAHIA', 'Bahia', 'باهية', '#0288d1', 0],
  ['POMS', 'Poms', 'بومس', '#e64a19', 2],
  ['HAWAI', 'Hawaï', 'هاواي', '#f4511e', 1],
  ['MARRAKECH', 'Marrakech', 'مراكش', '#ef6c00', 0],
  ['CHERGUI', 'Chergui', 'الشرقي', '#00695c', 1],
  ['TRIA', 'Tria', 'تريا', '#1565c0', 0],
  ['EXCELO', 'Excelo', 'إكسيلو', '#6d4c41', 2],
  ['CRISTAL', 'Cristal', 'كريستال', '#fbc02d', 0],
  ['ZIZ', 'Ziz', 'زيز', '#8d6e63', 1],
  ['OMO', 'Omo', 'أومو', '#1e88e5', 0],
  ['FLUFFY', 'Fluffy', 'فلافي', '#ec407a', 2],

];

/**
 * SKU : [code, nom FR, nom AR, marque, sous-famille, catégorie, forme, unité vente, unité achat, coeff,
 *        contenance, TVA, poids g, volume ml, conservation, emballage, prix TTC (Casablanca), statut?]
 */
const SKUS = [
  // Épicerie salée
  ['HUI-LES-1L', 'Huile de table Lesieur 1 L', 'زيت المائدة لوسيور 1 لتر', 'LESIEUR', 'EPS-HUI', 'PRIX_MINI', 'bottle', 'PCE', 'CART', 12, '1 L', 'TVA10', 920, 1000, 'AMB', 'BOUT', 21.5],
  ['HUI-LES-5L', 'Huile de table Lesieur 5 L', 'زيت المائدة لوسيور 5 لتر', 'LESIEUR', 'EPS-HUI', 'PRIX_MINI', 'jug', 'PCE', 'PCE', 1, '5 L', 'TVA10', 4600, 5000, 'AMB', 'BOUT', 99],
  ['HUI-OLV-75', 'Huile d’olive vierge extra Lesieur 75 cl', 'زيت الزيتون البكر الممتاز لوسيور 75 سل', 'LESIEUR', 'EPS-HUI', 'FAIT_MAISON', 'bottle', 'PCE', 'CART', 12, '75 cl', 'TVA10', 690, 750, 'AMB', 'BOUT', 89],
  ['VIN-ATI-1L', 'Vinaigre d’alcool Atina 1 L', 'خل أتينا 1 لتر', 'ATINA', 'EPS-HUI', 'PRIX_MINI', 'bottle', 'PCE', 'CART', 12, '1 L', 'TVA20', 1000, 1000, 'AMB', 'BOUT', 9.5],
  ['CSC-DAR-MOY', 'Couscous moyen Dari 1 kg', 'كسكس متوسط داري 1 كلغ', 'DARI', 'EPS-FEC', 'FAIT_MAISON', 'bag', 'PCE', 'CART', 12, '1 kg', 'TVA7', 1000, null, 'AMB', 'SACH', 16.5],
  ['CSC-DAR-FIN', 'Couscous fin Dari 1 kg', 'كسكس رقيق داري 1 كلغ', 'DARI', 'EPS-FEC', 'FAIT_MAISON', 'bag', 'PCE', 'CART', 12, '1 kg', 'TVA7', 1000, null, 'AMB', 'SACH', 16.5],
  ['PAT-DAR-SPA', 'Spaghetti Dari 500 g', 'سباغيتي داري 500 غ', 'DARI', 'EPS-FEC', 'PRIX_MINI', 'sachet', 'PCE', 'CART', 20, '500 g', 'TVA7', 500, null, 'AMB', 'SACH', 7.5],
  ['PAT-DAR-VER', 'Vermicelles Dari 500 g', 'شعرية داري 500 غ', 'DARI', 'EPS-FEC', 'RAMADAN', 'sachet', 'PCE', 'CART', 20, '500 g', 'TVA7', 500, null, 'AMB', 'SACH', 8],
  ['RIZ-ATI-1KG', 'Riz long grain Atina 1 kg', 'أرز طويل الحبة أتينا 1 كلغ', 'ATINA', 'EPS-FEC', 'PRIX_MINI', 'bag', 'PCE', 'CART', 10, '1 kg', 'TVA7', 1000, null, 'AMB', 'SACH', 17],
  ['LEN-ATI-1KG', 'Lentilles vertes Atina 1 kg', 'عدس أخضر أتينا 1 كلغ', 'ATINA', 'EPS-FEC', 'FAIT_MAISON', 'bag', 'PCE', 'CART', 10, '1 kg', 'TVA7', 1000, null, 'AMB', 'SACH', 18],
  ['CON-AIC-TOM', 'Concentré de tomates Aïcha 400 g', 'مركز الطماطم عائشة 400 غ', 'AICHA', 'EPS-CON', 'FAIT_MAISON', 'can', 'PCE', 'CART', 24, '400 g', 'TVA20', 400, null, 'AMB', 'CAN', 12.5],
  ['CON-BON-MAI', 'Maïs doux Bonduelle 300 g', 'ذرة حلوة بونديال 300 غ', 'BONDUELLE', 'EPS-CON', 'APERO', 'can', 'PCE', 'CART', 24, '300 g', 'TVA20', 300, null, 'AMB', 'CAN', 13],
  ['CON-BON-PPC', 'Petits pois carottes Bonduelle 400 g', 'جلبانة وجزر بونديال 400 غ', 'BONDUELLE', 'EPS-CON', 'FAIT_MAISON', 'can', 'PCE', 'CART', 24, '400 g', 'TVA20', 400, null, 'AMB', 'CAN', 14.5],
  ['CON-ATI-THO', 'Thon à l’huile d’olive Atina 160 g', 'تونة بزيت الزيتون أتينا 160 غ', 'ATINA', 'EPS-CON', 'APERO', 'can', 'PCE', 'CART', 24, '160 g', 'TVA20', 160, null, 'AMB', 'CAN', 16],
  ['OLV-ATI-VER', 'Olives vertes cassées Atina 500 g', 'زيتون أخضر مرحي أتينا 500 غ', 'ATINA', 'EPS-CON', 'APERO', 'jar', 'PCE', 'CART', 12, '500 g', 'TVA20', 500, null, 'AMB', 'POT', 14],
  ['EPI-ATI-CUM', 'Cumin moulu Atina 100 g', 'كمون مطحون أتينا 100 غ', 'ATINA', 'EPS-EPI', 'FAIT_MAISON', 'sachet', 'PCE', 'CART', 30, '100 g', 'TVA20', 100, null, 'AMB', 'SACH', 9],
  ['EPI-ATI-RAS', 'Ras el hanout Atina 100 g', 'رأس الحانوت أتينا 100 غ', 'ATINA', 'EPS-EPI', 'FAIT_MAISON', 'sachet', 'PCE', 'CART', 30, '100 g', 'TVA20', 100, null, 'AMB', 'SACH', 12],
  ['EPI-ATI-SEL', 'Sel fin iodé Atina 1 kg', 'ملح رقيق مُيود أتينا 1 كلغ', 'ATINA', 'EPS-EPI', 'PRIX_MINI', 'bag', 'PCE', 'CART', 20, '1 kg', 'TVA0', 1000, null, 'AMB', 'SACH', 3.5],
  ['EPI-ATI-PAP', 'Paprika doux Atina 100 g', 'فلفل أحمر حلو أتينا 100 غ', 'ATINA', 'EPS-EPI', 'FAIT_MAISON', 'sachet', 'PCE', 'CART', 30, '100 g', 'TVA20', 100, null, 'AMB', 'SACH', 8.5, 'draft'],
  ['BOU-KNO-POU', 'Bouillon de poule Knorr x24', 'مرق الدجاج كنور 24 مكعب', 'KNORR', 'EPS-SAU', 'FAIT_MAISON', 'box', 'PCE', 'CART', 24, 'x24', 'TVA20', 240, null, 'AMB', 'BOIT', 18],
  ['BOU-MAG-BOE', 'Bouillon Maggi goût bœuf x24', 'مرق ماجي بنكهة اللحم 24 مكعب', 'MAGGI', 'EPS-SAU', 'FAIT_MAISON', 'box', 'PCE', 'CART', 24, 'x24', 'TVA20', 240, null, 'AMB', 'BOIT', 17.5],
  ['SOU-KNO-HAR', 'Soupe harira Knorr 110 g', 'حريرة كنور 110 غ', 'KNORR', 'EPS-SAU', 'RAMADAN', 'sachet', 'PCE', 'CART', 24, '110 g', 'TVA20', 110, null, 'AMB', 'SACH', 9.5],
  ['SAU-LES-MAY', 'Mayonnaise Lesieur 400 g', 'مايونيز لوسيور 400 غ', 'LESIEUR', 'EPS-SAU', 'APERO', 'jar', 'PCE', 'CART', 12, '400 g', 'TVA20', 400, null, 'AMB', 'POT', 19],
  // Épicerie sucrée
  ['BIS-BIM-TON', 'Biscuits Tonik Bimo 138 g', 'بسكويت تونيك بيمو 138 غ', 'BIMO', 'EPU-BIS', 'ENFANTS', 'box', 'PCE', 'CART', 30, '138 g', 'TVA20', 138, null, 'AMB', 'BOIT', 4],
  ['BIS-BIM-CHO', 'Biscuits fourrés chocolat Bimo 150 g', 'بسكويت محشو بالشوكولاتة بيمو 150 غ', 'BIMO', 'EPU-BIS', 'ENFANTS', 'box', 'PCE', 'CART', 30, '150 g', 'TVA20', 150, null, 'AMB', 'BOIT', 6],
  ['BIS-MER-CHO', 'Gâteau Merendina chocolat x6', 'كعك ميرندينا بالشوكولاتة 6 قطع', 'MERENDINA', 'EPU-BIS', 'ENFANTS', 'box', 'PCE', 'CART', 20, 'x6', 'TVA20', 240, null, 'AMB', 'BOIT', 12],
  ['BIS-LUS-GAU', 'Gaufrettes vanille Lusine 200 g', 'ويفر بالفانيلا لوزين 200 غ', 'LUSINE', 'EPU-BIS', 'ENFANTS', 'sachet', 'PCE', 'CART', 24, '200 g', 'TVA20', 200, null, 'AMB', 'SACH', 7.5],
  ['BIS-BIM-SAB', 'Sablés au beurre Bimo 200 g', 'بسكويت بالزبدة بيمو 200 غ', 'BIMO', 'EPU-BIS', 'PETIT_DEJ', 'box', 'PCE', 'CART', 24, '200 g', 'TVA20', 200, null, 'AMB', 'BOIT', 7, 'inactive'],
  ['THE-SUL-250', 'Thé vert Sultan 250 g', 'شاي أخضر السلطان 250 غ', 'SULTAN', 'EPU-THE', 'PETIT_DEJ', 'box', 'PCE', 'CART', 40, '250 g', 'TVA20', 250, null, 'AMB', 'BOIT', 21],
  ['THE-SUL-500', 'Thé vert Sultan grain spécial 500 g', 'شاي أخضر السلطان حبة خاصة 500 غ', 'SULTAN', 'EPU-THE', 'PETIT_DEJ', 'box', 'PCE', 'CART', 20, '500 g', 'TVA20', 500, null, 'AMB', 'BOIT', 39],
  ['CAF-NES-200', 'Café soluble Nescafé Classic 200 g', 'قهوة سريعة الذوبان نسكافيه 200 غ', 'NESTLE', 'EPU-THE', 'PETIT_DEJ', 'jar', 'PCE', 'CART', 12, '200 g', 'TVA20', 200, null, 'AMB', 'POT', 69],
  ['INF-ATI-VER', 'Verveine séchée Atina 50 g', 'لويزة مجففة أتينا 50 غ', 'ATINA', 'EPU-THE', 'BIO', 'sachet', 'PCE', 'CART', 30, '50 g', 'TVA20', 50, null, 'AMB', 'SACH', 12],
  ['CFT-AIC-FRA', 'Confiture de fraises Aïcha 430 g', 'مربى الفراولة عائشة 430 غ', 'AICHA', 'EPU-CFT', 'PETIT_DEJ', 'jar', 'PCE', 'CART', 12, '430 g', 'TVA20', 430, null, 'AMB', 'POT', 17.5],
  ['CFT-AIC-ABR', 'Confiture d’abricots Aïcha 430 g', 'مربى المشمش عائشة 430 غ', 'AICHA', 'EPU-CFT', 'PETIT_DEJ', 'jar', 'PCE', 'CART', 12, '430 g', 'TVA20', 430, null, 'AMB', 'POT', 17.5],
  ['MIE-ATI-THY', 'Miel de thym Atina 500 g', 'عسل الزعتر أتينا 500 غ', 'ATINA', 'EPU-CFT', 'BIO', 'jar', 'PCE', 'CART', 12, '500 g', 'TVA20', 500, null, 'AMB', 'POT', 95],
  ['AML-ATI-250', 'Amlou aux amandes Atina 250 g', 'أملو باللوز أتينا 250 غ', 'ATINA', 'EPU-CFT', 'PETIT_DEJ', 'jar', 'PCE', 'CART', 12, '250 g', 'TVA20', 250, null, 'AMB', 'POT', 45],
  ['SUC-COS-PAI', 'Pain de sucre Cosumar 2 kg', 'قالب السكر كوزيمار 2 كلغ', 'COSUMAR', 'EPU-SUC', 'PRIX_MINI', 'box', 'PCE', 'CART', 10, '2 kg', 'TVA20', 2000, null, 'AMB', 'BOIT', 22],
  ['SUC-COS-GRA', 'Sucre granulé Cosumar 1 kg', 'سكر سنيدة كوزيمار 1 كلغ', 'COSUMAR', 'EPU-SUC', 'PRIX_MINI', 'bag', 'PCE', 'CART', 20, '1 kg', 'TVA20', 1000, null, 'AMB', 'SACH', 10.5],
  ['SUC-COS-MOR', 'Sucre en morceaux Cosumar 1 kg', 'سكر مقطع كوزيمار 1 كلغ', 'COSUMAR', 'EPU-SUC', 'PETIT_DEJ', 'box', 'PCE', 'CART', 20, '1 kg', 'TVA20', 1000, null, 'AMB', 'BOIT', 13],
  ['FAR-ATI-2KG', 'Farine de blé tendre Atina 2 kg', 'دقيق القمح الطري أتينا 2 كلغ', 'ATINA', 'EPU-SUC', 'FAIT_MAISON', 'bag', 'PCE', 'CART', 10, '2 kg', 'TVA7', 2000, null, 'AMB', 'SACH', 15],
  // Boissons
  ['EAU-SAL-150', 'Eau minérale Sidi Ali 1,5 L', 'ماء معدني سيدي علي 1.5 لتر', 'SIDI_ALI', 'BOI-EAU', 'PRIX_MINI', 'bottle', 'PCE', 'PACK', 6, '1,5 L', 'TVA20', 1500, 1500, 'AMB', 'BOUT', 6],
  ['EAU-SAL-050', 'Eau minérale Sidi Ali 50 cl', 'ماء معدني سيدي علي 50 سل', 'SIDI_ALI', 'BOI-EAU', 'ENFANTS', 'bottle', 'PCE', 'CART', 12, '50 cl', 'TVA20', 500, 500, 'AMB', 'BOUT', 3],
  ['EAU-SAL-PK6', 'Eau minérale Sidi Ali pack 6 x 1,5 L', 'ماء معدني سيدي علي 6 × 1.5 لتر', 'SIDI_ALI', 'BOI-EAU', 'PRIX_MINI', 'pack', 'PACK', 'PACK', 1, '6 x 1,5 L', 'TVA20', 9000, 9000, 'AMB', 'FARD6', 34],
  ['EAU-OUL-1L', 'Eau gazeuse Oulmès 1 L', 'ماء غازي والماس 1 لتر', 'OULMES', 'BOI-EAU', 'APERO', 'bottle', 'PCE', 'CART', 12, '1 L', 'TVA20', 1000, 1000, 'AMB', 'BOUT', 8.5],
  ['EAU-AIN-150', 'Eau minérale Aïn Saïss 1,5 L', 'ماء معدني عين سايس 1.5 لتر', 'AIN_SAISS', 'BOI-EAU', 'PRIX_MINI', 'bottle', 'PCE', 'PACK', 6, '1,5 L', 'TVA20', 1500, 1500, 'AMB', 'BOUT', 5.5],
  ['EAU-HAR-150', 'Eau minérale Sidi Harazem 1,5 L', 'ماء معدني سيدي حرازم 1.5 لتر', 'SIDI_HARAZEM', 'BOI-EAU', 'PRIX_MINI', 'bottle', 'PCE', 'PACK', 6, '1,5 L', 'TVA20', 1500, 1500, 'AMB', 'BOUT', 5],
  ['EAU-IFR-150', 'Eau de source Ifrane 1,5 L', 'ماء عين إفران 1.5 لتر', 'IFRANE', 'BOI-EAU', 'NOUVEAUTES', 'bottle', 'PCE', 'PACK', 6, '1,5 L', 'TVA20', 1500, 1500, 'AMB', 'BOUT', 5],
  ['SOD-COC-1L', 'Coca-Cola 1 L', 'كوكاكولا 1 لتر', 'COCA_COLA', 'BOI-SOD', 'APERO', 'bottle', 'PCE', 'CART', 12, '1 L', 'TVA20', 1000, 1000, 'AMB', 'BOUT', 10],
  ['SOD-COC-CAN', 'Coca-Cola canette 33 cl', 'كوكاكولا علبة 33 سل', 'COCA_COLA', 'BOI-SOD', 'APERO', 'can', 'PCE', 'CART', 24, '33 cl', 'TVA20', 330, 330, 'AMB', 'CAN', 6],
  ['SOD-COC-ZER', 'Coca-Cola Zéro 1 L', 'كوكاكولا زيرو 1 لتر', 'COCA_COLA', 'BOI-SOD', 'NOUVEAUTES', 'bottle', 'PCE', 'CART', 12, '1 L', 'TVA20', 1000, 1000, 'AMB', 'BOUT', 10],
  ['JUS-JAO-ORA', 'Jus d’orange Jaouda 1 L', 'عصير البرتقال جودة 1 لتر', 'JAOUDA', 'BOI-JUS', 'PETIT_DEJ', 'brick', 'PCE', 'CART', 12, '1 L', 'TVA20', 1000, 1000, 'FRAIS', 'BRIQ', 13],
  ['JUS-JAO-MUL', 'Nectar multifruits Jaouda 1 L', 'عصير متعدد الفواكه جودة 1 لتر', 'JAOUDA', 'BOI-JUS', 'ENFANTS', 'brick', 'PCE', 'CART', 12, '1 L', 'TVA20', 1000, 1000, 'FRAIS', 'BRIQ', 12.5],
  // Produits laitiers & œufs
  ['LAI-CEN-DEM', 'Lait demi-écrémé Centrale 1 L', 'حليب نصف مقشود سنطرال 1 لتر', 'CENTRALE', 'LAI-LAI', 'PETIT_DEJ', 'brick', 'PCE', 'CART', 12, '1 L', 'TVA0', 1030, 1000, 'FRAIS', 'BRIQ', 8.5],
  ['LAI-CEN-ENT', 'Lait entier Centrale 1 L', 'حليب كامل الدسم سنطرال 1 لتر', 'CENTRALE', 'LAI-LAI', 'PETIT_DEJ', 'brick', 'PCE', 'CART', 12, '1 L', 'TVA0', 1030, 1000, 'FRAIS', 'BRIQ', 8.5],
  ['LAI-JAO-PAS', 'Lait pasteurisé Jaouda 1 L', 'حليب مبستر جودة 1 لتر', 'JAOUDA', 'LAI-LAI', 'PETIT_DEJ', 'brick', 'PCE', 'CART', 12, '1 L', 'TVA0', 1030, 1000, 'FRAIS', 'BRIQ', 8],
  ['LBN-JAO-1L', 'Lben Jaouda 1 L', 'لبن جودة 1 لتر', 'JAOUDA', 'LAI-LAI', 'RAMADAN', 'brick', 'PCE', 'CART', 12, '1 L', 'TVA0', 1030, 1000, 'FRAIS', 'BRIQ', 8],
  ['RAI-CEN-JAM', 'Raïbi Jamila Centrale 110 g', 'رايبي جميلة سنطرال 110 غ', 'CENTRALE', 'LAI-YAO', 'ENFANTS', 'jar', 'PCE', 'CART', 24, '110 g', 'TVA7', 110, null, 'FRAIS', 'POT', 2.5],
  ['YAO-CEN-NAT', 'Yaourt nature Danone x4', 'ياغورت طبيعي دانون 4 قطع', 'CENTRALE', 'LAI-YAO', 'PETIT_DEJ', 'jar', 'PCE', 'CART', 12, 'x4', 'TVA7', 440, null, 'FRAIS', 'POT', 10],
  ['YAO-CEN-DUP', 'Danup à boire fraise 200 g', 'دانوب للشرب بالفراولة 200 غ', 'CENTRALE', 'LAI-YAO', 'ENFANTS', 'bottle', 'PCE', 'CART', 24, '200 g', 'TVA7', 200, null, 'FRAIS', 'BOUT', 3.5],
  ['YAO-JAO-FRU', 'Yaourt aux fruits Jaouda x4', 'ياغورت بالفواكه جودة 4 قطع', 'JAOUDA', 'LAI-YAO', 'ENFANTS', 'jar', 'PCE', 'CART', 12, 'x4', 'TVA7', 440, null, 'FRAIS', 'POT', 11],
  ['FRO-VQR-16', 'La Vache qui rit 16 portions', 'البقرة الضاحكة 16 قطعة', 'VACHE_QUI_RIT', 'LAI-FRO', 'ENFANTS', 'box', 'PCE', 'CART', 12, '16 p.', 'TVA20', 240, null, 'FRAIS', 'BOIT', 21],
  ['FRO-VQR-08', 'La Vache qui rit 8 portions', 'البقرة الضاحكة 8 قطع', 'VACHE_QUI_RIT', 'LAI-FRO', 'PETIT_DEJ', 'box', 'PCE', 'CART', 24, '8 p.', 'TVA20', 120, null, 'FRAIS', 'BOIT', 11.5],
  ['FRO-PRE-EDA', 'Edam Président tranches 200 g', 'جبن إيدام بريزيدون شرائح 200 غ', 'PRESIDENT', 'LAI-FRO', 'APERO', 'tray', 'PCE', 'CART', 12, '200 g', 'TVA20', 200, null, 'FRAIS', 'BARQ', 29],
  ['FRO-PRE-CAM', 'Camembert Président 250 g', 'جبن كامومبير بريزيدون 250 غ', 'PRESIDENT', 'LAI-FRO', 'APERO', 'box', 'PCE', 'CART', 12, '250 g', 'TVA20', 250, null, 'FRAIS', 'BOIT', 39],
  ['BEU-PRE-200', 'Beurre doux Président 200 g', 'زبدة بريزيدون 200 غ', 'PRESIDENT', 'LAI-BEU', 'PETIT_DEJ', 'box', 'PCE', 'CART', 20, '200 g', 'TVA20', 200, null, 'FRAIS', 'BOIT', 27],
  ['OEU-ATI-30', 'Œufs frais calibre moyen x30', 'بيض طري متوسط الحجم 30 بيضة', 'ATINA', 'LAI-BEU', 'PETIT_DEJ', 'carton', 'PCE', 'PCE', 1, 'x30', 'TVA0', 1800, null, 'FRAIS', 'BARQ', 42],
  ['OEU-ATI-12', 'Œufs frais x12', 'بيض طري 12 بيضة', 'ATINA', 'LAI-BEU', 'PETIT_DEJ', 'carton', 'PCE', 'CART', 10, 'x12', 'TVA0', 720, null, 'FRAIS', 'BARQ', 17.5],
  // Fruits & légumes (au kilo)
  ['LEG-TOM-1KG', 'Tomates rondes 1 kg', 'طماطم مستديرة 1 كلغ', 'ATINA', 'FRL-LEG', 'FAIT_MAISON', 'fruit', 'KG', 'KG', 1, '1 kg', 'TVA0', 1000, null, 'FRAIS', 'VRAC', 7],
  ['LEG-PDT-1KG', 'Pommes de terre 1 kg', 'بطاطس 1 كلغ', 'ATINA', 'FRL-LEG', 'PRIX_MINI', 'fruit', 'KG', 'KG', 1, '1 kg', 'TVA0', 1000, null, 'AMB', 'VRAC', 5.5],
  ['LEG-OIG-1KG', 'Oignons 1 kg', 'بصل 1 كلغ', 'ATINA', 'FRL-LEG', 'FAIT_MAISON', 'fruit', 'KG', 'KG', 1, '1 kg', 'TVA0', 1000, null, 'AMB', 'VRAC', 5],
  ['LEG-CAR-1KG', 'Carottes 1 kg', 'جزر 1 كلغ', 'ATINA', 'FRL-LEG', 'FAIT_MAISON', 'fruit', 'KG', 'KG', 1, '1 kg', 'TVA0', 1000, null, 'FRAIS', 'VRAC', 5],
  ['LEG-COU-1KG', 'Courgettes 1 kg', 'قرعة خضراء 1 كلغ', 'ATINA', 'FRL-LEG', 'BIO', 'fruit', 'KG', 'KG', 1, '1 kg', 'TVA0', 1000, null, 'FRAIS', 'VRAC', 7.5],
  ['LEG-POI-1KG', 'Poivrons verts 1 kg', 'فلفل أخضر 1 كلغ', 'ATINA', 'FRL-LEG', 'FAIT_MAISON', 'fruit', 'KG', 'KG', 1, '1 kg', 'TVA0', 1000, null, 'FRAIS', 'VRAC', 8],
  ['LEG-FRI-SUR', 'Frites surgelées Atina 1 kg', 'بطاطس مقلية مجمدة أتينا 1 كلغ', 'ATINA', 'FRL-LEG', 'ENFANTS', 'bag', 'PCE', 'CART', 10, '1 kg', 'TVA20', 1000, null, 'SURG', 'SACH', 22],
  ['FRU-ORA-1KG', 'Oranges à jus 1 kg', 'برتقال للعصير 1 كلغ', 'ATINA', 'FRL-FRU', 'PETIT_DEJ', 'fruit', 'KG', 'KG', 1, '1 kg', 'TVA0', 1000, null, 'AMB', 'VRAC', 6],
  ['FRU-BAN-1KG', 'Bananes 1 kg', 'موز 1 كلغ', 'ATINA', 'FRL-FRU', 'ENFANTS', 'fruit', 'KG', 'KG', 1, '1 kg', 'TVA0', 1000, null, 'AMB', 'VRAC', 14],
  ['FRU-POM-1KG', 'Pommes rouges 1 kg', 'تفاح أحمر 1 كلغ', 'ATINA', 'FRL-FRU', 'BIO', 'fruit', 'KG', 'KG', 1, '1 kg', 'TVA0', 1000, null, 'FRAIS', 'VRAC', 16],
  ['FRU-DAT-MED', 'Dattes Medjool 500 g', 'تمر المجهول 500 غ', 'ATINA', 'FRL-FRU', 'RAMADAN', 'box', 'PCE', 'CART', 12, '500 g', 'TVA0', 500, null, 'AMB', 'BOIT', 55],
  ['FRU-FRA-BIO', 'Fraises bio barquette 500 g', 'فراولة عضوية 500 غ', 'ATINA', 'FRL-FRU', 'BIO', 'tray', 'PCE', 'CART', 10, '500 g', 'TVA0', 500, null, 'FRAIS', 'BARQ', 18],
  ['HER-MEN-BOT', 'Menthe fraîche (botte)', 'نعناع طري (ربطة)', 'ATINA', 'FRL-HER', 'BIO', 'bunch', 'PCE', 'PCE', 1, 'botte', 'TVA0', 150, null, 'FRAIS', 'VRAC', 3],
  ['HER-COR-BOT', 'Coriandre fraîche (botte)', 'قزبر طري (ربطة)', 'ATINA', 'FRL-HER', 'FAIT_MAISON', 'bunch', 'PCE', 'PCE', 1, 'botte', 'TVA0', 120, null, 'FRAIS', 'VRAC', 2.5],
  ['HER-PER-BOT', 'Persil frais (botte)', 'معدنوس طري (ربطة)', 'ATINA', 'FRL-HER', 'FAIT_MAISON', 'bunch', 'PCE', 'PCE', 1, 'botte', 'TVA0', 120, null, 'FRAIS', 'VRAC', 2.5],
  // Boucherie & volaille
  ['VOL-POU-FER', 'Poulet fermier entier ~1,4 kg', 'دجاج بلدي كامل حوالي 1.4 كلغ', 'ATINA', 'BOU-VOL', 'FAIT_MAISON', 'tray', 'PCE', 'PCE', 1, '~1,4 kg', 'TVA0', 1400, null, 'FRAIS', 'BARQ', 75],
  ['VOL-BLA-500', 'Blanc de poulet 500 g', 'صدر الدجاج 500 غ', 'ATINA', 'BOU-VOL', 'FAIT_MAISON', 'tray', 'PCE', 'PCE', 1, '500 g', 'TVA0', 500, null, 'FRAIS', 'BARQ', 42],
  ['VOL-KOU-NUG', 'Nuggets de poulet surgelés Koutoubia 400 g', 'ناجتس الدجاج المجمد الكتبية 400 غ', 'KOUTOUBIA', 'BOU-VOL', 'ENFANTS', 'box', 'PCE', 'CART', 12, '400 g', 'TVA20', 400, null, 'SURG', 'BOIT', 32],
  ['VIA-BOE-HAC', 'Viande hachée de bœuf 500 g', 'لحم بقري مفروم 500 غ', 'ATINA', 'BOU-VIA', 'FAIT_MAISON', 'tray', 'PCE', 'PCE', 1, '500 g', 'TVA0', 500, null, 'FRAIS', 'BARQ', 55],
  ['VIA-AGN-COT', 'Côtelettes d’agneau 1 kg', 'ريش الغنمي 1 كلغ', 'ATINA', 'BOU-VIA', 'FAIT_MAISON', 'tray', 'KG', 'KG', 1, '1 kg', 'TVA0', 1000, null, 'FRAIS', 'BARQ', 120],
  ['CHA-KOU-CAC', 'Cachir de volaille Koutoubia 250 g', 'كاشير الدجاج الكتبية 250 غ', 'KOUTOUBIA', 'BOU-CHA', 'APERO', 'tray', 'PCE', 'CART', 12, '250 g', 'TVA20', 250, null, 'FRAIS', 'BARQ', 16],
  ['CHA-KOU-SAU', 'Saucisses de volaille Koutoubia 400 g', 'نقانق الدجاج الكتبية 400 غ', 'KOUTOUBIA', 'BOU-CHA', 'ENFANTS', 'tray', 'PCE', 'CART', 12, '400 g', 'TVA20', 400, null, 'FRAIS', 'BARQ', 24, 'discontinued'],
  // Boulangerie
  ['PAI-KHB-X2', 'Pain rond khobz x2', 'خبز دائري 2 قطع', 'ATINA', 'BLG-PAI', 'PRIX_MINI', 'loaf', 'PCE', 'PCE', 1, 'x2', 'TVA0', 400, null, 'AMB', 'SACH', 3],
  ['PAI-MIE-COM', 'Pain de mie complet Atina 500 g', 'خبز التوست الكامل أتينا 500 غ', 'ATINA', 'BLG-PAI', 'PETIT_DEJ', 'loaf', 'PCE', 'PCE', 1, '500 g', 'TVA0', 500, null, 'AMB', 'SACH', 14],
  ['VIE-CRO-X4', 'Croissants pur beurre x4', 'كرواسون بالزبدة 4 قطع', 'ATINA', 'BLG-VIE', 'PETIT_DEJ', 'loaf', 'PCE', 'PCE', 1, 'x4', 'TVA20', 240, null, 'AMB', 'SACH', 12],
  ['VIE-MSM-X5', 'Msemen feuilleté x5', 'مسمن 5 قطع', 'ATINA', 'BLG-VIE', 'FAIT_MAISON', 'loaf', 'PCE', 'PCE', 1, 'x5', 'TVA0', 400, null, 'AMB', 'SACH', 10],
  ['TRA-CHE-500', 'Chebakia au miel 500 g', 'شباكية بالعسل 500 غ', 'ATINA', 'BLG-TRA', 'RAMADAN', 'box', 'PCE', 'PCE', 1, '500 g', 'TVA20', 500, null, 'AMB', 'BOIT', 40],
  ['TRA-SEL-500', 'Sellou aux amandes 500 g', 'سلو باللوز 500 غ', 'ATINA', 'BLG-TRA', 'RAMADAN', 'box', 'PCE', 'PCE', 1, '500 g', 'TVA20', 500, null, 'AMB', 'BOIT', 60],
  ['TRA-BAG-X6', 'Baghrir x6', 'بغرير 6 قطع', 'ATINA', 'BLG-TRA', 'RAMADAN', 'loaf', 'PCE', 'PCE', 1, 'x6', 'TVA0', 360, null, 'AMB', 'SACH', 12, 'draft'],
  // Hygiène & beauté
  ['DOU-DOV-GEL', 'Gel douche Dove 250 ml', 'جل الاستحمام دوف 250 مل', 'DOVE', 'HYG-DOU', 'NOUVEAUTES', 'bottle', 'PCE', 'CART', 12, '250 ml', 'TVA20', 270, 250, 'AMB', 'BOUT', 32],
  ['SAV-DOV-X2', 'Savon crème Dove 2 x 100 g', 'صابون دوف كريمي 2 × 100 غ', 'DOVE', 'HYG-DOU', 'PRIX_MINI', 'box', 'PCE', 'CART', 24, '2 x 100 g', 'TVA20', 200, null, 'AMB', 'BOIT', 22],
  ['DEN-COL-TOT', 'Dentifrice Colgate Total 75 ml', 'معجون الأسنان كولجيت توتال 75 مل', 'COLGATE', 'HYG-DEN', 'PRIX_MINI', 'tube', 'PCE', 'CART', 24, '75 ml', 'TVA20', 100, 75, 'AMB', 'BOIT', 24],
  ['DEN-COL-BRO', 'Brosses à dents Colgate x2', 'فرشاة أسنان كولجيت 2 قطع', 'COLGATE', 'HYG-DEN', 'ENFANTS', 'box', 'PCE', 'CART', 24, 'x2', 'TVA20', 60, null, 'AMB', 'BOIT', 18],
  ['CAP-DOV-SHA', 'Shampooing Dove soin quotidien 400 ml', 'شامبو دوف العناية اليومية 400 مل', 'DOVE', 'HYG-CAP', 'NOUVEAUTES', 'bottle', 'PCE', 'CART', 12, '400 ml', 'TVA20', 430, 400, 'AMB', 'BOUT', 45],
  // Entretien
  ['LES-TID-3KG', 'Lessive poudre Tide 3 kg', 'مسحوق الغسيل تايد 3 كلغ', 'TIDE', 'ENT-LES', 'PRIX_MINI', 'bag', 'PCE', 'PCE', 1, '3 kg', 'TVA20', 3000, null, 'AMB', 'SACH', 69],
  ['LES-TID-1KG', 'Lessive poudre Tide 1 kg', 'مسحوق الغسيل تايد 1 كلغ', 'TIDE', 'ENT-LES', 'PRIX_MINI', 'bag', 'PCE', 'CART', 10, '1 kg', 'TVA20', 1000, null, 'AMB', 'SACH', 26],
  ['LES-ARI-2L', 'Lessive liquide Ariel 2 L', 'سائل الغسيل أريال 2 لتر', 'ARIEL', 'ENT-LES', 'NOUVEAUTES', 'jug', 'PCE', 'CART', 6, '2 L', 'TVA20', 2100, 2000, 'AMB', 'BOUT', 89],
  ['VAI-ATI-CIT', 'Liquide vaisselle citron Atina 1 L', 'سائل الأواني بالليمون أتينا 1 لتر', 'ATINA', 'ENT-VAI', 'PRIX_MINI', 'bottle', 'PCE', 'CART', 12, '1 L', 'TVA20', 1050, 1000, 'AMB', 'BOUT', 15],
  ['SUR-ATI-JAV', 'Eau de Javel Atina 1 L', 'ماء جافيل أتينا 1 لتر', 'ATINA', 'ENT-SUR', 'PRIX_MINI', 'jug', 'PCE', 'CART', 12, '1 L', 'TVA20', 1050, 1000, 'AMB', 'BOUT', 6],
  ['SUR-ATI-MUL', 'Nettoyant multi-surfaces Atina 1 L', 'منظف متعدد الأسطح أتينا 1 لتر', 'ATINA', 'ENT-SUR', 'PRIX_MINI', 'bottle', 'PCE', 'CART', 12, '1 L', 'TVA20', 1050, 1000, 'AMB', 'BOUT', 19],
  // Bébé
  ['COU-PAM-T3', 'Couches Pampers Baby-Dry taille 3 x52', 'حفاضات بامبرز مقاس 3 عدد 52', 'PAMPERS', 'BEB-COU', 'ENFANTS', 'box', 'PCE', 'PCE', 1, 'x52', 'TVA20', 1700, null, 'AMB', 'BOIT', 139],
  ['COU-PAM-T4', 'Couches Pampers Baby-Dry taille 4 x46', 'حفاضات بامبرز مقاس 4 عدد 46', 'PAMPERS', 'BEB-COU', 'ENFANTS', 'box', 'PCE', 'PCE', 1, 'x46', 'TVA20', 1750, null, 'AMB', 'BOIT', 139],
  ['LIN-PAM-SEN', 'Lingettes Pampers Sensitive x52', 'مناديل مبللة بامبرز سنسيتيف 52', 'PAMPERS', 'BEB-COU', 'ENFANTS', 'sachet', 'PCE', 'CART', 12, 'x52', 'TVA20', 400, null, 'AMB', 'SACH', 32],
  ['ALI-NES-CER', 'Céréales bébé Cérélac blé lait Nestlé 400 g', 'سيريلاك قمح بالحليب نستله 400 غ', 'NESTLE', 'BEB-ALI', 'ENFANTS', 'box', 'PCE', 'CART', 12, '400 g', 'TVA7', 400, null, 'AMB', 'BOIT', 49],
  ['ALI-NES-NID', 'Lait de croissance Nido 1+ Nestlé 400 g', 'حليب النمو نيدو 1+ نستله 400 غ', 'NESTLE', 'BEB-ALI', 'ENFANTS', 'can', 'PCE', 'CART', 12, '400 g', 'TVA7', 400, null, 'AMB', 'CAN', 69],
  ['SOI-ATI-LIN', 'Liniment oléo-calcaire bébé Atina 500 ml', 'ليniment للرضيع أتينا 500 مل', 'ATINA', 'BEB-SOI', 'NOUVEAUTES', 'bottle', 'PCE', 'CART', 12, '500 ml', 'TVA20', 520, 500, 'AMB', 'BOUT', 35, 'discontinued'],
  ['SOI-ATI-CRE', 'Crème change bébé Atina 100 ml', 'كريم الحفاض للرضيع أتينا 100 مل', 'ATINA', 'BEB-SOI', 'ENFANTS', 'tube', 'PCE', 'CART', 24, '100 ml', 'TVA20', 110, 100, 'AMB', 'BOIT', 29],

  // ── Ajout catalogue : boissons ──
  ['EAU-CIE-150', 'Eau minérale Ciel 1,5 L', 'ماء معدني سييل 1.5 لتر', 'CIEL', 'BOI-EAU', 'PRIX_MINI', 'bottle', 'PCE', 'PACK', 6, '1,5 L', 'TVA20', 1520, 1500, 'AMB', 'BOUT', 4.5],
  ['EAU-BAH-50', 'Eau minérale Bahia 50 cl', 'ماء معدني باهية 50 سل', 'BAHIA', 'BOI-EAU', 'PRIX_MINI', 'bottle', 'PCE', 'CART', 12, '50 cl', 'TVA20', 520, 500, 'AMB', 'BOUT', 3],
  ['EAU-AIN-050', 'Eau minérale Aïn Saïss 50 cl', 'ماء معدني عين سايس 50 سل', 'AIN_SAISS', 'BOI-EAU', 'PRIX_MINI', 'bottle', 'PCE', 'CART', 12, '50 cl', 'TVA20', 520, 500, 'AMB', 'BOUT', 3.5],
  ['SOD-POM-1L', 'Poms pomme pétillante 1 L', 'بومس تفاح غازي 1 لتر', 'POMS', 'BOI-SOD', 'APERO', 'bottle', 'PCE', 'CART', 12, '1 L', 'TVA20', 1030, 1000, 'AMB', 'BOUT', 9],
  ['SOD-HAW-1L', 'Hawaï tropical 1 L', 'هاواي استوائي 1 لتر', 'HAWAI', 'BOI-SOD', 'APERO', 'bottle', 'PCE', 'CART', 12, '1 L', 'TVA20', 1030, 1000, 'AMB', 'BOUT', 9],
  ['SOD-OUL-CIT', 'Oulmès citron 1 L', 'والماس ليمون 1 لتر', 'OULMES', 'BOI-SOD', 'APERO', 'bottle', 'PCE', 'CART', 12, '1 L', 'TVA20', 1030, 1000, 'AMB', 'BOUT', 10],
  ['JUS-MAR-ANA', 'Nectar ananas Marrakech 1 L', 'عصير أناناس مراكش 1 لتر', 'MARRAKECH', 'BOI-JUS', 'PETIT_DEJ', 'brick', 'PCE', 'CART', 12, '1 L', 'TVA20', 1040, 1000, 'AMB', 'BRIQ', 13],
  ['JUS-MAR-POM', 'Nectar pomme Marrakech 1 L', 'عصير تفاح مراكش 1 لتر', 'MARRAKECH', 'BOI-JUS', 'PETIT_DEJ', 'brick', 'PCE', 'CART', 12, '1 L', 'TVA20', 1040, 1000, 'AMB', 'BRIQ', 13],
  ['JUS-JAO-POM', 'Jus de pomme Jaouda 1 L', 'عصير التفاح جودة 1 لتر', 'JAOUDA', 'BOI-JUS', 'PETIT_DEJ', 'brick', 'PCE', 'CART', 12, '1 L', 'TVA20', 1040, 1000, 'FRAIS', 'BRIQ', 14],

  // ── Ajout catalogue : produits laitiers ──
  ['LAI-JAO-DEM', 'Lait demi-écrémé Jaouda 1 L', 'حليب نصف دسم جودة 1 لتر', 'JAOUDA', 'LAI-LAI', 'PETIT_DEJ', 'brick', 'PCE', 'CART', 12, '1 L', 'TVA7', 1030, 1000, 'AMB', 'BRIQ', 8],
  ['LBN-CEN-1L', 'Lben Centrale 1 L', 'لبن سنطرال 1 لتر', 'CENTRALE', 'LAI-LAI', 'FAIT_MAISON', 'bottle', 'PCE', 'CART', 12, '1 L', 'TVA7', 1030, 1000, 'FRAIS', 'BOUT', 9],
  ['RAI-JAO-FRA', 'Raïbi fraise Jaouda x4', 'رايبي بالفراولة جودة x4', 'JAOUDA', 'LAI-YAO', 'ENFANTS', 'tray', 'PCE', 'CART', 12, '4 x 110 g', 'TVA7', 440, null, 'FRAIS', 'BARQ', 12],
  ['YAO-CHE-NAT', 'Yaourt brassé nature Chergui x4', 'ياغورت طبيعي الشرقي x4', 'CHERGUI', 'LAI-YAO', 'PETIT_DEJ', 'tray', 'PCE', 'CART', 12, '4 x 110 g', 'TVA7', 440, null, 'FRAIS', 'BARQ', 14],
  ['FRO-CHE-CHV', 'Fromage de chèvre Chergui 150 g', 'جبن الماعز الشرقي 150 غ', 'CHERGUI', 'LAI-FRO', 'APERO', 'tray', 'PCE', 'CART', 12, '150 g', 'TVA20', 150, null, 'FRAIS', 'BARQ', 28],
  ['FRO-VQR-24', 'La Vache qui rit 24 portions', 'البقرة الضاحكة 24 حصة', 'VACHE_QUI_RIT', 'LAI-FRO', 'ENFANTS', 'box', 'PCE', 'CART', 12, '24 portions', 'TVA20', 400, null, 'FRAIS', 'BOIT', 39],
  ['BEU-ATI-500', 'Beurre doux Atina 500 g', 'زبدة أتينا 500 غ', 'ATINA', 'LAI-BEU', 'FAIT_MAISON', 'box', 'PCE', 'CART', 12, '500 g', 'TVA20', 500, null, 'FRAIS', 'BOIT', 46],

  // ── Ajout catalogue : épicerie salée ──
  ['HUI-CRI-1L', 'Huile de table Cristal 1 L', 'زيت المائدة كريستال 1 لتر', 'CRISTAL', 'EPS-HUI', 'PRIX_MINI', 'bottle', 'PCE', 'CART', 12, '1 L', 'TVA10', 920, 1000, 'AMB', 'BOUT', 20.5],
  ['HUI-ZIZ-2L', 'Huile de table Ziz 2 L', 'زيت المائدة زيز 2 لتر', 'ZIZ', 'EPS-HUI', 'PRIX_MINI', 'jug', 'PCE', 'CART', 6, '2 L', 'TVA10', 1840, 2000, 'AMB', 'BOUT', 39],
  ['HUI-ARG-25', 'Huile d’argan alimentaire Atina 25 cl', 'زيت الأركان الغذائي أتينا 25 سل', 'ATINA', 'EPS-HUI', 'FAIT_MAISON', 'bottle', 'PCE', 'CART', 12, '25 cl', 'TVA10', 230, 250, 'AMB', 'BOUT', 129],
  ['PAT-TRI-COQ', 'Coquillettes Tria 500 g', 'معكرونة صدفية تريا 500 غ', 'TRIA', 'EPS-FEC', 'PRIX_MINI', 'bag', 'PCE', 'CART', 12, '500 g', 'TVA7', 500, null, 'AMB', 'SACH', 7.5],
  ['PAT-TRI-PEN', 'Penne Tria 500 g', 'معكرونة بيني تريا 500 غ', 'TRIA', 'EPS-FEC', 'PRIX_MINI', 'bag', 'PCE', 'CART', 12, '500 g', 'TVA7', 500, null, 'AMB', 'SACH', 7.5],
  ['CSC-DAR-FIN2', 'Couscous fin Dari 2 kg', 'كسكس رقيق داري 2 كلغ', 'DARI', 'EPS-FEC', 'FAIT_MAISON', 'bag', 'PCE', 'CART', 6, '2 kg', 'TVA7', 2000, null, 'AMB', 'SACH', 31],
  ['RIZ-ATI-5KG', 'Riz long grain Atina 5 kg', 'أرز طويل الحبة أتينا 5 كلغ', 'ATINA', 'EPS-FEC', 'PRIX_MINI', 'bag', 'PCE', 'PCE', 1, '5 kg', 'TVA7', 5000, null, 'AMB', 'SACH', 79],
  ['POI-ATI-1KG', 'Pois chiches Atina 1 kg', 'حمص أتينا 1 كلغ', 'ATINA', 'EPS-FEC', 'FAIT_MAISON', 'bag', 'PCE', 'CART', 12, '1 kg', 'TVA7', 1000, null, 'AMB', 'SACH', 18],
  ['CON-AIC-DBL', 'Double concentré de tomates Aïcha 800 g', 'مركز الطماطم المضاعف عائشة 800 غ', 'AICHA', 'EPS-CON', 'FAIT_MAISON', 'can', 'PCE', 'CART', 12, '800 g', 'TVA20', 800, null, 'AMB', 'CAN', 24],
  ['CON-AIC-HAR', 'Harissa Aïcha 135 g', 'هريسة عائشة 135 غ', 'AICHA', 'EPS-CON', 'FAIT_MAISON', 'can', 'PCE', 'CART', 12, '135 g', 'TVA20', 135, null, 'AMB', 'CAN', 9.5],
  ['CON-ATI-SAR', 'Sardines à l’huile végétale Atina 125 g', 'سردين بالزيت النباتي أتينا 125 غ', 'ATINA', 'EPS-CON', 'PRIX_MINI', 'can', 'PCE', 'CART', 12, '125 g', 'TVA20', 125, null, 'AMB', 'CAN', 8.5],
  ['EPI-ATI-CAN', 'Cannelle moulue Atina 75 g', 'قرفة مطحونة أتينا 75 غ', 'ATINA', 'EPS-EPI', 'FAIT_MAISON', 'sachet', 'PCE', 'CART', 12, '75 g', 'TVA20', 75, null, 'AMB', 'SACH', 14],
  ['EPI-ATI-CUR', 'Curcuma moulu Atina 100 g', 'كركم مطحون أتينا 100 غ', 'ATINA', 'EPS-EPI', 'FAIT_MAISON', 'sachet', 'PCE', 'CART', 12, '100 g', 'TVA20', 100, null, 'AMB', 'SACH', 12],
  ['SAU-ATI-KET', 'Ketchup Atina 340 g', 'كاتشوب أتينا 340 غ', 'ATINA', 'EPS-SAU', 'ENFANTS', 'bottle', 'PCE', 'CART', 12, '340 g', 'TVA20', 340, null, 'AMB', 'BOUT', 16],
  ['SOU-KNO-VER', 'Soupe de légumes Knorr 70 g', 'شوربة الخضر كنور 70 غ', 'KNORR', 'EPS-SAU', 'PRIX_MINI', 'sachet', 'PCE', 'CART', 12, '70 g', 'TVA20', 70, null, 'AMB', 'SACH', 8],

  // ── Ajout catalogue : épicerie sucrée ──
  ['BIS-EXC-CRA', 'Biscuits Crak’s Excelo 40 g', 'بسكويت كراكس إكسيلو 40 غ', 'EXCELO', 'EPU-BIS', 'ENFANTS', 'sachet', 'PCE', 'CART', 12, '40 g', 'TVA20', 40, null, 'AMB', 'SACH', 3],
  ['BIS-BIM-GOL', 'Biscuits Golden Bimo 12 x 24 g', 'بسكويت غولدن بيمو 12 x 24 غ', 'BIMO', 'EPU-BIS', 'ENFANTS', 'box', 'PCE', 'CART', 12, '288 g', 'TVA20', 288, null, 'AMB', 'BOIT', 21],
  ['CFT-AIC-ORA', 'Confiture d’oranges Aïcha 430 g', 'مربى البرتقال عائشة 430 غ', 'AICHA', 'EPU-CFT', 'PETIT_DEJ', 'jar', 'PCE', 'CART', 12, '430 g', 'TVA20', 430, null, 'AMB', 'POT', 22],
  ['MIE-ATI-ORA', 'Miel d’oranger Atina 500 g', 'عسل زهر البرتقال أتينا 500 غ', 'ATINA', 'EPU-CFT', 'RAMADAN', 'jar', 'PCE', 'CART', 12, '500 g', 'TVA20', 500, null, 'AMB', 'POT', 119],
  ['SUC-COS-GLA', 'Sucre glace Cosumar 500 g', 'سكر ناعم كوزيمار 500 غ', 'COSUMAR', 'EPU-SUC', 'FAIT_MAISON', 'sachet', 'PCE', 'CART', 12, '500 g', 'TVA20', 500, null, 'AMB', 'SACH', 9],
  ['FAR-ATI-5KG', 'Farine de blé tendre Atina 5 kg', 'دقيق القمح اللين أتينا 5 كلغ', 'ATINA', 'EPU-SUC', 'PRIX_MINI', 'bag', 'PCE', 'PCE', 1, '5 kg', 'TVA7', 5000, null, 'AMB', 'SACH', 42],
  ['THE-SUL-MEN', 'Thé vert à la menthe Sultan 100 g', 'أتاي أخضر بالنعناع السلطان 100 غ', 'SULTAN', 'EPU-THE', 'RAMADAN', 'box', 'PCE', 'CART', 12, '100 g', 'TVA20', 100, null, 'AMB', 'BOIT', 19],
  ['CAF-NES-GOL', 'Café soluble Nescafé Gold 100 g', 'قهوة سريعة الذوبان نسكافيه غولد 100 غ', 'NESTLE', 'EPU-THE', 'PETIT_DEJ', 'jar', 'PCE', 'CART', 12, '100 g', 'TVA20', 100, null, 'AMB', 'POT', 69],

  // ── Ajout catalogue : boulangerie, frais, hygiène, entretien, bébé ──
  ['PAI-COM-500', 'Pain complet Atina 500 g', 'خبز كامل أتينا 500 غ', 'ATINA', 'BLG-PAI', 'BIO', 'loaf', 'PCE', 'PCE', 1, '500 g', 'TVA7', 500, null, 'AMB', 'SACH', 6],
  ['VIE-PAC-X4', 'Pains au chocolat x4', 'خبز بالشوكولاتة x4', 'ATINA', 'BLG-VIE', 'PETIT_DEJ', 'tray', 'PCE', 'PCE', 1, '4 pièces', 'TVA20', 260, null, 'AMB', 'BARQ', 16],
  ['LEG-CON-1KG', 'Concombres 1 kg', 'خيار 1 كلغ', 'ATINA', 'FRL-LEG', 'BIO', 'fruit', 'KG', 'KG', 1, '1 kg', 'TVA0', 1000, null, 'FRAIS', 'VRAC', 9],
  ['FRU-CIT-1KG', 'Citrons 1 kg', 'ليمون 1 كلغ', 'ATINA', 'FRL-FRU', 'FAIT_MAISON', 'fruit', 'KG', 'KG', 1, '1 kg', 'TVA0', 1000, null, 'FRAIS', 'VRAC', 12],
  ['VOL-KOU-ESC', 'Escalopes de poulet Koutoubia 500 g', 'شرائح دجاج الكتبية 500 غ', 'KOUTOUBIA', 'BOU-VOL', 'PRIX_MINI', 'tray', 'PCE', 'PCE', 1, '500 g', 'TVA20', 500, null, 'FRAIS', 'BARQ', 49],
  ['DOU-DOV-400', 'Gel douche Dove original 400 ml', 'جل الاستحمام دوف 400 مل', 'DOVE', 'HYG-DOU', 'PRIX_MINI', 'bottle', 'PCE', 'CART', 12, '400 ml', 'TVA20', 420, 400, 'AMB', 'BOUT', 45],
  ['PAP-FLU-X8', 'Papier toilette Fluffy x8', 'ورق المرحاض فلافي x8', 'FLUFFY', 'ENT-SUR', 'PRIX_MINI', 'pack', 'PCE', 'PCE', 1, '8 rouleaux', 'TVA20', 800, null, 'AMB', 'SACH', 34],
  ['LES-OMO-3KG', 'Lessive poudre Omo 3 kg', 'مسحوق الغسيل أومو 3 كلغ', 'OMO', 'ENT-LES', 'PRIX_MINI', 'bag', 'PCE', 'PCE', 1, '3 kg', 'TVA20', 3000, null, 'AMB', 'SACH', 69],
  ['VAI-ATI-POM', 'Liquide vaisselle pomme Atina 750 ml', 'سائل غسل الصحون بالتفاح أتينا 750 مل', 'ATINA', 'ENT-VAI', 'PRIX_MINI', 'bottle', 'PCE', 'CART', 12, '750 ml', 'TVA20', 780, 750, 'AMB', 'BOUT', 17],
  ['COU-PAM-T5', 'Couches Pampers Baby-Dry taille 5 x40', 'حفاضات بامبرز بيبي دراي مقاس 5 x40', 'PAMPERS', 'BEB-COU', 'ENFANTS', 'pack', 'PCE', 'PCE', 1, '40 couches', 'TVA20', 1500, null, 'AMB', 'SACH', 139],
].map((r) => ({
  code: r[0], name_fr: r[1], name_ar: r[2], brand: r[3], sub: r[4], cat: r[5], shape: r[6],
  unit_sale: r[7], unit_purchase: r[8], coeff: r[9], size: r[10], tax: r[11], weight_g: r[12], volume_ml: r[13],
  cons: r[14], packaging: r[15], price: r[16], status: r[17] || 'active',
}));

// Correction : nom AR du liniment (évite une translittération mixte).
SKUS.find((s) => s.code === 'SOI-ATI-LIN').name_ar = 'مرهم زيتي كلسي للرضيع أتينا 500 مل';

module.exports = { UNITS, TAXES, CONSERVATIONS, PACKAGINGS, FAMILIES, CATEGORIES, BRANDS, SKUS };
