/**
 * seed-warehouse-params.js
 * Seeds ALL lookup / parameter tables required by the warehouse, nodes,
 * emplacements and the full P0 platform:
 *   NodeType, Zone, Level, PackagingType,
 *   StockOperation, MoveType,
 *   OrderStatus, OrderItemStatus, OrderSlotStatus,
 *   PaymentStatus, PaymentMethod,
 *   TourStatus, StopStatus, PickingStatus, PickItemStatus,
 *   ReferralStatus, WalletTxnType,
 *   PrizeType, GameType, GamePlayPeriod, UnlockCondition,
 *   PromoType, PointsRuleType, RewardType,
 *   NotificationChannel, NotificationDeliveryStatus,
 *   QualityCheckType, ConfigValueType,
 *   CostingMethod, DeliveryType, SlotAssignmentSource
 *
 * Run AFTER seed-moroccan-data.js (needs units already seeded).
 * Run: node scripts/seed-warehouse-params.js
 * Safe to run multiple times (upsert everywhere).
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ── Helpers ───────────────────────────────────────────────────────────────────

const up = (model, where, data) =>
  prisma[model].upsert({ where, update: {}, create: data });

// UUID-keyed models (code is the unique field, not the PK)
const upCode  = (model, data) => up(model, { code: data.code }, data);
// String-PK models (StockOperation uses code as @id)
const upCodeId = (data) => prisma.stockOperation.upsert({ where: { code: data.code }, update: {}, create: data });

// ── 1. NodeType ───────────────────────────────────────────────────────────────

const NODE_TYPES = [
  { code: 'DARK_STORE',       name_fr: 'Dark Store',           name_ar: 'متجر مظلم',          description: 'Entrepôt de préparation commandes e-commerce',          icon: '🏪', color_badge: '#dc2626', is_active: true },
  { code: 'HUB_LIVRAISON',    name_fr: 'Hub de Livraison',     name_ar: 'مركز التوزيع',        description: 'Centre de dispatch et de livraison last-mile',           icon: '🚚', color_badge: '#f59e0b', is_active: true },
  { code: 'ENTREPOT_CENTRAL', name_fr: 'Entrepôt Central',     name_ar: 'المستودع المركزي',    description: 'Entrepôt principal de stockage en vrac',                icon: '🏭', color_badge: '#6366f1', is_active: true },
  { code: 'PICKUP_POINT',     name_fr: 'Point de Retrait',     name_ar: 'نقطة الاستلام',       description: 'Emplacement Click & Collect pour le client final',       icon: '📦', color_badge: '#10b981', is_active: true },
  { code: 'POINT_VENTE',      name_fr: 'Point de Vente',       name_ar: 'نقطة البيع',          description: 'Magasin de vente directe au client',                    icon: '🛒', color_badge: '#3b82f6', is_active: true },
  { code: 'FOURNISSEUR',      name_fr: 'Fournisseur',          name_ar: 'المورد',              description: 'Nœud externe représentant un fournisseur',             icon: '🏢', color_badge: '#8b5cf6', is_active: true },
];

// ── 2. Zone ───────────────────────────────────────────────────────────────────

const ZONES = [
  { code: 'ZONE_SEC',     name_fr: 'Zone Sèche',           name_ar: 'المنطقة الجافة',         description_fr: 'Produits à température ambiante — épicerie, conserves', is_active: true },
  { code: 'ZONE_FRAIS',   name_fr: 'Zone Frais',           name_ar: 'المنطقة الطازجة',        description_fr: 'Produits réfrigérés : laitiers, charcuterie',          is_active: true },
  { code: 'ZONE_SURGELE', name_fr: 'Zone Surgelé',         name_ar: 'منطقة التجميد',          description_fr: 'Produits congelés — température < −18 °C',             is_active: true },
  { code: 'ZONE_HYGIENE', name_fr: 'Zone Hygiène & Beauté',name_ar: 'منطقة النظافة والجمال', description_fr: 'Hygiène corporelle, cosmétiques, produits dentaires',   is_active: true },
  { code: 'ZONE_ENTRETIEN',name_fr:'Zone Entretien Maison', name_ar: 'منطقة العناية بالمنزل',description_fr: 'Détergents, produits ménagers, entretien',             is_active: true },
  { code: 'ZONE_BOISSONS', name_fr: 'Zone Boissons',       name_ar: 'منطقة المشروبات',        description_fr: 'Eaux, jus, boissons gazeuses et chaudes',             is_active: true },
  { code: 'ZONE_PROMO',   name_fr: 'Zone Promotion',       name_ar: 'منطقة العروض',           description_fr: 'Articles en promotion ou en tête de gondole',          is_active: true },
  { code: 'ZONE_VRAC',    name_fr: 'Zone Vrac',            name_ar: 'منطقة السائب',           description_fr: 'Produits vendus au poids ou en grande quantité',      is_active: true },
  { code: 'ZONE_NONALIM', name_fr: 'Zone Non Alimentaire', name_ar: 'المنطقة غير الغذائية',  description_fr: 'Produits non alimentaires divers',                    is_active: true },
  { code: 'ZONE_RETOUR',  name_fr: 'Zone Retours',         name_ar: 'منطقة المرتجعات',        description_fr: 'Zone de traitement des retours et articles défectueux', is_active: true },
];

// ── 3. Level ──────────────────────────────────────────────────────────────────

const LEVELS = [
  { code: 'SOL',  name_fr: 'Sol / Palette',    name_ar: 'الأرض / منصة',    sort_order: 0, is_active: true },
  { code: 'L1',   name_fr: 'Niveau 1 — Bas',   name_ar: 'المستوى 1 — أسفل', sort_order: 1, is_active: true },
  { code: 'L2',   name_fr: 'Niveau 2',          name_ar: 'المستوى 2',        sort_order: 2, is_active: true },
  { code: 'L3',   name_fr: 'Niveau 3',          name_ar: 'المستوى 3',        sort_order: 3, is_active: true },
  { code: 'L4',   name_fr: 'Niveau 4 — Haut',  name_ar: 'المستوى 4 — أعلى', sort_order: 4, is_active: true },
  { code: 'DESSUS', name_fr: 'Dessus / Mezzanine', name_ar: 'الميزانين',    sort_order: 5, is_active: true },
];

// ── 4. StockOperation (code = PK) ─────────────────────────────────────────────

const STOCK_OPERATIONS = [
  { code: 'IN',  name_fr: 'Entrée de stock' },
  { code: 'OUT', name_fr: 'Sortie de stock' },
  { code: 'ADJ', name_fr: 'Ajustement de stock' },
  { code: 'TRF', name_fr: 'Transfert de stock' },
];

// ── 5. MoveType ───────────────────────────────────────────────────────────────

const MOVE_TYPES = [
  { code: 'RECEP_FOURN',    name_fr: 'Réception fournisseur',   name_ar: 'استلام من المورد',      operation: 'IN'  },
  { code: 'RETOUR_CLIENT',  name_fr: 'Retour client',           name_ar: 'إرجاع من العميل',        operation: 'IN'  },
  { code: 'TRANSFERT_IN',   name_fr: 'Transfert entrant',       name_ar: 'نقل وارد',              operation: 'IN'  },
  { code: 'VENTE',          name_fr: 'Vente',                   name_ar: 'بيع',                   operation: 'OUT' },
  { code: 'PERTE',          name_fr: 'Perte / Casse',           name_ar: 'خسارة / كسر',           operation: 'OUT' },
  { code: 'PEREMPTION',     name_fr: 'Péremption',              name_ar: 'انتهاء الصلاحية',        operation: 'OUT' },
  { code: 'TRANSFERT_OUT',  name_fr: 'Transfert sortant',       name_ar: 'نقل صادر',              operation: 'OUT' },
  { code: 'ADJ_POSITIF',    name_fr: 'Ajustement positif',      name_ar: 'تسوية موجبة',           operation: 'ADJ' },
  { code: 'ADJ_NEGATIF',    name_fr: 'Ajustement négatif',      name_ar: 'تسوية سالبة',           operation: 'ADJ' },
  { code: 'INVENTAIRE',     name_fr: 'Inventaire',              name_ar: 'جرد',                   operation: 'ADJ' },
];

// ── 6. OrderStatus ────────────────────────────────────────────────────────────

const ORDER_STATUSES = [
  { code: 'PENDING',           name_fr: 'En attente',          name_ar: 'في الانتظار',            is_terminal: false, sort_order: 1 },
  { code: 'CONFIRMED',         name_fr: 'Confirmée',           name_ar: 'مؤكدة',                  is_terminal: false, sort_order: 2 },
  { code: 'PICKING',           name_fr: 'En préparation',      name_ar: 'قيد التحضير',            is_terminal: false, sort_order: 3 },
  { code: 'READY',             name_fr: 'Prête',               name_ar: 'جاهزة',                  is_terminal: false, sort_order: 4 },
  { code: 'OUT_FOR_DELIVERY',  name_fr: 'En livraison',        name_ar: 'في التوصيل',             is_terminal: false, sort_order: 5 },
  { code: 'DELIVERED',         name_fr: 'Livrée',              name_ar: 'تم التسليم',             is_terminal: true,  sort_order: 6 },
  { code: 'CANCELLED',         name_fr: 'Annulée',             name_ar: 'ملغاة',                  is_terminal: true,  sort_order: 7 },
  { code: 'FAILED',            name_fr: 'Échec de livraison',  name_ar: 'فشل التوصيل',            is_terminal: true,  sort_order: 8 },
  { code: 'RETURNED',          name_fr: 'Retournée',           name_ar: 'مُرجعة',                 is_terminal: true,  sort_order: 9 },
  { code: 'PARTIALLY_DELIVERED', name_fr: 'Partiellement livrée', name_ar: 'تسليم جزئي',         is_terminal: false, sort_order: 10 },
];

// ── 7. OrderItemStatus ────────────────────────────────────────────────────────

const ORDER_ITEM_STATUSES = [
  { code: 'PENDING',      name_fr: 'En attente',    name_ar: 'في الانتظار' },
  { code: 'CONFIRMED',    name_fr: 'Confirmé',      name_ar: 'مؤكد' },
  { code: 'PICKED',       name_fr: 'Préparé',       name_ar: 'تم التحضير' },
  { code: 'DELIVERED',    name_fr: 'Livré',          name_ar: 'تم التسليم' },
  { code: 'CANCELLED',    name_fr: 'Annulé',        name_ar: 'ملغى' },
  { code: 'BACKORDER',    name_fr: 'En rupture',    name_ar: 'نفدت الكمية' },
  { code: 'SUBSTITUTED',  name_fr: 'Substitué',     name_ar: 'تم الاستبدال' },
  { code: 'RETURNED',     name_fr: 'Retourné',      name_ar: 'مُرجع' },
];

// ── 8. OrderSlotStatus ────────────────────────────────────────────────────────

const ORDER_SLOT_STATUSES = [
  { code: 'AVAILABLE', name_fr: 'Disponible', name_ar: 'متاح' },
  { code: 'FULL',      name_fr: 'Complet',    name_ar: 'ممتلئ' },
  { code: 'BLOCKED',   name_fr: 'Bloqué',    name_ar: 'محظور' },
  { code: 'EXPIRED',   name_fr: 'Expiré',    name_ar: 'منتهي' },
];

// ── 9. PaymentStatus ──────────────────────────────────────────────────────────

const PAYMENT_STATUSES = [
  { code: 'PENDING',   name_fr: 'En attente',    name_ar: 'في الانتظار' },
  { code: 'PAID',      name_fr: 'Payé',           name_ar: 'مدفوع' },
  { code: 'FAILED',    name_fr: 'Échoué',         name_ar: 'فاشل' },
  { code: 'REFUNDED',  name_fr: 'Remboursé',      name_ar: 'مسترد' },
  { code: 'PARTIAL',   name_fr: 'Partiel',        name_ar: 'جزئي' },
  { code: 'CANCELLED', name_fr: 'Annulé',         name_ar: 'ملغى' },
];

// ── 10. PaymentMethod ─────────────────────────────────────────────────────────

const PAYMENT_METHODS = [
  { code: 'CASH',       name_fr: 'Espèces (COD)',        name_ar: 'الدفع نقداً عند الاستلام', is_active: true  },
  { code: 'CARD',       name_fr: 'Carte bancaire',       name_ar: 'بطاقة بنكية',               is_active: true  },
  { code: 'WALLET',     name_fr: 'Portefeuille',         name_ar: 'المحفظة الرقمية',           is_active: true  },
  { code: 'CMI',        name_fr: 'CMI / Paiement en ligne', name_ar: 'الدفع الإلكتروني CMI',  is_active: true  },
  { code: 'VIREMENT',   name_fr: 'Virement bancaire',    name_ar: 'تحويل بنكي',                is_active: false },
  { code: 'POINTS',     name_fr: 'Points fidélité',      name_ar: 'نقاط الولاء',               is_active: true  },
];

// ── 11. TourStatus ────────────────────────────────────────────────────────────

const TOUR_STATUSES = [
  { code: 'DRAFT',       name_fr: 'Brouillon',    name_ar: 'مسودة' },
  { code: 'PLANNED',     name_fr: 'Planifiée',    name_ar: 'مخططة' },
  { code: 'ASSIGNED',    name_fr: 'Assignée',     name_ar: 'مُسندة' },
  { code: 'IN_PROGRESS', name_fr: 'En cours',     name_ar: 'جارية' },
  { code: 'COMPLETED',   name_fr: 'Terminée',     name_ar: 'مكتملة' },
  { code: 'CANCELLED',   name_fr: 'Annulée',      name_ar: 'ملغاة' },
];

// ── 12. StopStatus ────────────────────────────────────────────────────────────

const STOP_STATUSES = [
  { code: 'PENDING',     name_fr: 'En attente',   name_ar: 'في الانتظار' },
  { code: 'IN_PROGRESS', name_fr: 'En cours',     name_ar: 'جارٍ' },
  { code: 'DELIVERED',   name_fr: 'Livré',        name_ar: 'تم التسليم' },
  { code: 'FAILED',      name_fr: 'Échec',        name_ar: 'فاشل' },
  { code: 'SKIPPED',     name_fr: 'Ignoré',       name_ar: 'متجاوز' },
  { code: 'RETURNED',    name_fr: 'Retourné',     name_ar: 'مُرجع' },
];

// ── 13. PickingStatus ─────────────────────────────────────────────────────────

const PICKING_STATUSES = [
  { code: 'PENDING',     name_fr: 'En attente',   name_ar: 'في الانتظار' },
  { code: 'IN_PROGRESS', name_fr: 'En cours',     name_ar: 'جارٍ' },
  { code: 'COMPLETED',   name_fr: 'Terminé',      name_ar: 'مكتمل' },
  { code: 'CANCELLED',   name_fr: 'Annulé',       name_ar: 'ملغى' },
];

// ── 14. PickItemStatus ────────────────────────────────────────────────────────

const PICK_ITEM_STATUSES = [
  { code: 'PENDING',     name_fr: 'En attente',   name_ar: 'في الانتظار' },
  { code: 'PICKED',      name_fr: 'Préparé',      name_ar: 'تم التحضير' },
  { code: 'MISSING',     name_fr: 'Manquant',     name_ar: 'مفقود' },
  { code: 'SUBSTITUTED', name_fr: 'Substitué',    name_ar: 'تم الاستبدال' },
  { code: 'CANCELLED',   name_fr: 'Annulé',       name_ar: 'ملغى' },
];

// ── 15. ReferralStatus ────────────────────────────────────────────────────────

const REFERRAL_STATUSES = [
  { code: 'PENDING',   name_fr: 'En attente',   name_ar: 'في الانتظار' },
  { code: 'VALIDATED', name_fr: 'Validé',        name_ar: 'مُعتمد' },
  { code: 'REJECTED',  name_fr: 'Rejeté',        name_ar: 'مرفوض' },
  { code: 'EXPIRED',   name_fr: 'Expiré',        name_ar: 'منتهي' },
];

// ── 16. WalletTxnType ─────────────────────────────────────────────────────────

const WALLET_TXN_TYPES = [
  { code: 'CREDIT_ORDER',    name_fr: 'Crédit remboursement commande', name_ar: 'رصيد استرداد الطلب',  direction: 'IN'  },
  { code: 'CREDIT_REFERRAL', name_fr: 'Crédit parrainage',            name_ar: 'رصيد الإحالة',          direction: 'IN'  },
  { code: 'CREDIT_REFUND',   name_fr: 'Remboursement',                name_ar: 'استرداد',               direction: 'IN'  },
  { code: 'CREDIT_PROMO',    name_fr: 'Crédit promotionnel',          name_ar: 'رصيد ترويجي',           direction: 'IN'  },
  { code: 'CREDIT_ADMIN',    name_fr: 'Ajustement crédit admin',      name_ar: 'تعديل رصيد إداري',      direction: 'IN'  },
  { code: 'DEBIT_PURCHASE',  name_fr: 'Paiement commande',            name_ar: 'دفع الطلب',             direction: 'OUT' },
  { code: 'DEBIT_EXPIRY',    name_fr: 'Expiration du solde',          name_ar: 'انتهاء الرصيد',         direction: 'OUT' },
  { code: 'DEBIT_ADMIN',     name_fr: 'Débit admin',                  name_ar: 'خصم إداري',             direction: 'OUT' },
];

// ── 17. PrizeType ─────────────────────────────────────────────────────────────

const PRIZE_TYPES = [
  { code: 'DISCOUNT',      name_fr: 'Réduction',           name_ar: 'تخفيض' },
  { code: 'FREE_PRODUCT',  name_fr: 'Produit offert',      name_ar: 'منتج مجاني' },
  { code: 'WALLET_CREDIT', name_fr: 'Crédit portefeuille', name_ar: 'رصيد المحفظة' },
  { code: 'POINTS',        name_fr: 'Points fidélité',     name_ar: 'نقاط الولاء' },
  { code: 'FREE_SHIPPING', name_fr: 'Livraison gratuite',  name_ar: 'شحن مجاني' },
  { code: 'NO_PRIZE',      name_fr: 'Pas de lot',          name_ar: 'لا توجد جائزة' },
];

// ── 18. GameType ──────────────────────────────────────────────────────────────

const GAME_TYPES = [
  { code: 'WHEEL',       name_fr: 'Roue de la fortune', name_ar: 'عجلة الحظ' },
  { code: 'SCRATCH',     name_fr: 'Ticket à gratter',   name_ar: 'بطاقة الحظ' },
  { code: 'QUIZ',        name_fr: 'Quiz',               name_ar: 'مسابقة' },
  { code: 'LUCKY_DRAW',  name_fr: 'Tirage au sort',     name_ar: 'سحب عشوائي' },
];

// ── 19. GamePlayPeriod ────────────────────────────────────────────────────────

const GAME_PLAY_PERIODS = [
  { code: 'DAILY',     name_fr: 'Quotidien',       name_ar: 'يومي' },
  { code: 'WEEKLY',    name_fr: 'Hebdomadaire',    name_ar: 'أسبوعي' },
  { code: 'MONTHLY',   name_fr: 'Mensuel',         name_ar: 'شهري' },
  { code: 'PER_ORDER', name_fr: 'Par commande',    name_ar: 'لكل طلب' },
  { code: 'UNLIMITED', name_fr: 'Sans restriction', name_ar: 'غير محدود' },
];

// ── 20. UnlockCondition ───────────────────────────────────────────────────────

const UNLOCK_CONDITIONS = [
  { code: 'NONE',        name_fr: 'Aucune condition',          name_ar: 'لا يوجد شرط' },
  { code: 'MIN_ORDER',   name_fr: 'Montant minimum commande',  name_ar: 'حد أدنى للطلب' },
  { code: 'FIRST_ORDER', name_fr: 'Première commande',         name_ar: 'أول طلب' },
  { code: 'LOYALTY',     name_fr: 'Fidélité client',           name_ar: 'ولاء العميل' },
  { code: 'REFERRAL',    name_fr: 'Parrainage',                name_ar: 'إحالة' },
];

// ── 21. PromoType ─────────────────────────────────────────────────────────────

const PROMO_TYPES = [
  { code: 'PERCENTAGE',    name_fr: 'Pourcentage de réduction', name_ar: 'نسبة خصم' },
  { code: 'FIXED',         name_fr: 'Montant fixe',             name_ar: 'مبلغ ثابت' },
  { code: 'FREE_SHIPPING', name_fr: 'Livraison gratuite',       name_ar: 'شحن مجاني' },
  { code: 'BUY_X_GET_Y',  name_fr: 'Achetez X, obtenez Y',    name_ar: 'اشترِ X واحصل على Y' },
  { code: 'BUNDLE',        name_fr: 'Pack groupé',              name_ar: 'حزمة مجمعة' },
];

// ── 22. PointsRuleType ────────────────────────────────────────────────────────

const POINTS_RULE_TYPES = [
  { code: 'PURCHASE',     name_fr: 'Achat',              name_ar: 'شراء' },
  { code: 'REFERRAL',     name_fr: 'Parrainage',         name_ar: 'إحالة' },
  { code: 'FIRST_ORDER',  name_fr: 'Première commande',  name_ar: 'أول طلب' },
  { code: 'BIRTHDAY',     name_fr: 'Anniversaire',       name_ar: 'عيد ميلاد' },
  { code: 'REVIEW',       name_fr: 'Avis client',        name_ar: 'تقييم العميل' },
  { code: 'BONUS',        name_fr: 'Bonus ponctuel',     name_ar: 'مكافأة خاصة' },
];

// ── 23. RewardType ────────────────────────────────────────────────────────────

const REWARD_TYPES = [
  { code: 'POINTS',       name_fr: 'Points fidélité',     name_ar: 'نقاط الولاء' },
  { code: 'WALLET',       name_fr: 'Crédit portefeuille', name_ar: 'رصيد المحفظة' },
  { code: 'DISCOUNT',     name_fr: 'Réduction',           name_ar: 'خصم' },
  { code: 'FREE_PRODUCT', name_fr: 'Produit offert',      name_ar: 'منتج مجاني' },
];

// ── 24. NotificationChannel ───────────────────────────────────────────────────

const NOTIFICATION_CHANNELS = [
  { code: 'PUSH',   name_fr: 'Notification push',  name_ar: 'إشعار فوري' },
  { code: 'SMS',    name_fr: 'SMS',                name_ar: 'رسالة قصيرة' },
  { code: 'EMAIL',  name_fr: 'Email',              name_ar: 'البريد الإلكتروني' },
  { code: 'IN_APP', name_fr: 'In-app',             name_ar: 'داخل التطبيق' },
  { code: 'WHATSAPP', name_fr: 'WhatsApp',         name_ar: 'واتساب' },
];

// ── 25. NotificationDeliveryStatus ───────────────────────────────────────────

const NOTIFICATION_STATUSES = [
  { code: 'PENDING',   name_fr: 'En attente', name_ar: 'في الانتظار' },
  { code: 'SENT',      name_fr: 'Envoyé',     name_ar: 'مُرسل' },
  { code: 'DELIVERED', name_fr: 'Livré',       name_ar: 'تم الاستلام' },
  { code: 'FAILED',    name_fr: 'Échoué',     name_ar: 'فاشل' },
  { code: 'READ',      name_fr: 'Lu',          name_ar: 'مقروء' },
];

// ── 26. QualityCheckType ──────────────────────────────────────────────────────

const QUALITY_CHECK_TYPES = [
  { code: 'RECEPTION',   name_fr: 'Contrôle réception',    name_ar: 'فحص الاستلام' },
  { code: 'EXPIRY',      name_fr: 'Contrôle péremption',   name_ar: 'فحص انتهاء الصلاحية' },
  { code: 'PICKING',     name_fr: 'Contrôle préparation',  name_ar: 'فحص التحضير' },
  { code: 'RETURN',      name_fr: 'Contrôle retour',       name_ar: 'فحص المرتجعات' },
  { code: 'INVENTORY',   name_fr: 'Contrôle inventaire',   name_ar: 'فحص الجرد' },
  { code: 'TEMPERATURE', name_fr: 'Contrôle température',  name_ar: 'فحص درجة الحرارة' },
];

// ── 27. ConfigValueType ───────────────────────────────────────────────────────

const CONFIG_VALUE_TYPES = [
  { code: 'STRING',  name_fr: 'Texte libre',      name_ar: 'نص حر' },
  { code: 'INTEGER', name_fr: 'Entier',           name_ar: 'عدد صحيح' },
  { code: 'DECIMAL', name_fr: 'Décimal',          name_ar: 'عدد عشري' },
  { code: 'BOOLEAN', name_fr: 'Booléen',          name_ar: 'قيمة منطقية' },
  { code: 'JSON',    name_fr: 'JSON',             name_ar: 'بيانات JSON' },
  { code: 'DATE',    name_fr: 'Date',             name_ar: 'تاريخ' },
  { code: 'URL',     name_fr: 'URL',              name_ar: 'رابط' },
];

// ── 28. CostingMethod ─────────────────────────────────────────────────────────

const COSTING_METHODS = [
  { code: 'FIFO',     name_fr: 'FIFO — Premier entré, premier sorti', name_ar: 'الوارد أولاً يصدر أولاً' },
  { code: 'LIFO',     name_fr: 'LIFO — Dernier entré, premier sorti', name_ar: 'الوارد أخيراً يصدر أولاً' },
  { code: 'AVERAGE',  name_fr: 'Coût moyen pondéré (CMP)',            name_ar: 'متوسط التكلفة المرجح' },
  { code: 'STANDARD', name_fr: 'Coût standard',                       name_ar: 'التكلفة المعيارية' },
];

// ── 29. DeliveryType ──────────────────────────────────────────────────────────

const DELIVERY_TYPES = [
  { code: 'HOME_DELIVERY', name_fr: 'Livraison à domicile',  name_ar: 'توصيل للمنزل' },
  { code: 'PICKUP',        name_fr: 'Click & Collect',       name_ar: 'اسحب واستلم' },
  { code: 'EXPRESS',       name_fr: 'Livraison express',     name_ar: 'توصيل سريع' },
  { code: 'SCHEDULED',     name_fr: 'Livraison programmée',  name_ar: 'توصيل مجدوَل' },
  { code: 'IN_STORE',      name_fr: 'Retrait en magasin',    name_ar: 'استلام من المتجر' },
];

// ── 30. SlotAssignmentSource ──────────────────────────────────────────────────

const SLOT_ASSIGNMENT_SOURCES = [
  { code: 'CUSTOMER', name_fr: 'Client',         name_ar: 'العميل' },
  { code: 'ADMIN',    name_fr: 'Administrateur', name_ar: 'المسؤول' },
  { code: 'SYSTEM',   name_fr: 'Système',        name_ar: 'النظام' },
];

// ── 31. PackagingType ─────────────────────────────────────────────────────────
// Defined after Units are loaded — references unit.id

const PACKAGING_DEFS = [
  { code: 'UNITE',    name_fr: 'Unité / Pièce',    name_ar: 'وحدة / قطعة',   qty: 1,     unit_code: 'PCE' },
  { code: 'LOT_3',    name_fr: 'Lot de 3',          name_ar: 'مجموعة 3',      qty: 3,     unit_code: 'PCE' },
  { code: 'PACK_6',   name_fr: 'Pack de 6',         name_ar: 'حزمة 6',         qty: 6,     unit_code: 'PCE' },
  { code: 'CARTON_12',name_fr: 'Carton de 12',      name_ar: 'كرتون 12',       qty: 12,    unit_code: 'PCE' },
  { code: 'CARTON_24',name_fr: 'Carton de 24',      name_ar: 'كرتون 24',       qty: 24,    unit_code: 'PCE' },
  { code: 'PALETTE',  name_fr: 'Palette (kg)',       name_ar: 'منصة (كغ)',      qty: 1000,  unit_code: 'KG'  },
  { code: 'SAC_5KG',  name_fr: 'Sac 5 kg',          name_ar: 'كيس 5 كغ',       qty: 5,     unit_code: 'KG'  },
  { code: 'SAC_25KG', name_fr: 'Sac 25 kg',         name_ar: 'كيس 25 كغ',      qty: 25,    unit_code: 'KG'  },
  { code: 'CAISSE_L', name_fr: 'Caisse (litres)',    name_ar: 'صندوق (لتر)',    qty: 6,     unit_code: 'LIT' },
  { code: 'FARDEAU',  name_fr: 'Fardeau (bouteilles)', name_ar: 'رزمة زجاجات', qty: 12,    unit_code: 'PCE' },
];

// ── Nodes (dark stores marocains) ─────────────────────────────────────────────
// Created only if NodeType + City exist; safe to skip if city not found

const NODE_DEFS = [
  {
    code: 'DS-CBA-01',  name_fr: 'Dark Store Casablanca Centre',    name_ar: 'متجر الدار البيضاء المركز',
    node_type_code: 'DARK_STORE',
    region_code: 'CAS', city_code: 'CBA-V',
    address_line1: 'Bd Mohammed V', quartier: 'Centre-ville',
    postal_code: '20000', lat: 33.5898, lng: -7.6031,
    timezone: 'Africa/Casablanca', delivery_radius_km: 5, max_daily_orders: 300,
  },
  {
    code: 'DS-CBA-02',  name_fr: 'Dark Store Casablanca Ain Sebaâ', name_ar: 'متجر عين السبع الدار البيضاء',
    node_type_code: 'DARK_STORE',
    region_code: 'CAS', city_code: 'AIN-V',
    address_line1: 'Route de Meknès', quartier: 'Aïn Sebaâ',
    postal_code: '20250', lat: 33.6200, lng: -7.5350,
    timezone: 'Africa/Casablanca', delivery_radius_km: 4, max_daily_orders: 250,
  },
  {
    code: 'DS-RBA-01',  name_fr: 'Dark Store Rabat Agdal',          name_ar: 'متجر أكدال الرباط',
    node_type_code: 'DARK_STORE',
    region_code: 'RSK', city_code: 'RBA-V',
    address_line1: 'Av. Fal Ould Oumeïr', quartier: 'Agdal',
    postal_code: '10000', lat: 33.9716, lng: -6.8498,
    timezone: 'Africa/Casablanca', delivery_radius_km: 5, max_daily_orders: 200,
  },
  {
    code: 'DS-SAL-01',  name_fr: 'Dark Store Salé Tabriquet',       name_ar: 'متجر التبريقة سلا',
    node_type_code: 'DARK_STORE',
    region_code: 'RSK', city_code: 'SAL-V',
    address_line1: 'Av. Ibn Khaldoun', quartier: 'Tabriquet',
    postal_code: '11000', lat: 34.0390, lng: -6.7980,
    timezone: 'Africa/Casablanca', delivery_radius_km: 4, max_daily_orders: 150,
  },
  {
    code: 'DS-MAR-01',  name_fr: 'Dark Store Marrakech Guéliz',     name_ar: 'متجر كيليز مراكش',
    node_type_code: 'DARK_STORE',
    region_code: 'MRS', city_code: 'MAR-V',
    address_line1: 'Rue Mohammed El Beqal', quartier: 'Guéliz',
    postal_code: '40000', lat: 31.6295, lng: -7.9811,
    timezone: 'Africa/Casablanca', delivery_radius_km: 5, max_daily_orders: 200,
  },
  {
    code: 'DS-AGA-01',  name_fr: 'Dark Store Agadir Centre',        name_ar: 'متجر أكادير المركز',
    node_type_code: 'DARK_STORE',
    region_code: 'SOM', city_code: 'AGA-V',
    address_line1: 'Av. Hassan II', quartier: 'Centre',
    postal_code: '80000', lat: 30.4278, lng: -9.5981,
    timezone: 'Africa/Casablanca', delivery_radius_km: 5, max_daily_orders: 150,
  },
  {
    code: 'DS-FES-01',  name_fr: 'Dark Store Fès Jdid',             name_ar: 'متجر فاس الجديد',
    node_type_code: 'DARK_STORE',
    region_code: 'FME', city_code: 'FES-V',
    address_line1: 'Bd Mohammed V', quartier: 'Fès Jdid',
    postal_code: '30000', lat: 34.0333, lng: -5.0000,
    timezone: 'Africa/Casablanca', delivery_radius_km: 4, max_daily_orders: 120,
  },
  {
    code: 'HUB-CBA-01', name_fr: 'Hub Casablanca Logistique',       name_ar: 'مركز توزيع الدار البيضاء',
    node_type_code: 'HUB_LIVRAISON',
    region_code: 'CAS', city_code: 'CBA-V',
    address_line1: 'Zone Industrielle Aïn Sebaâ',
    postal_code: '20600', lat: 33.6100, lng: -7.5200,
    timezone: 'Africa/Casablanca', delivery_radius_km: 30, max_daily_orders: 1000,
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n⚙️  Seed Warehouse & Platform Parameters — démarrage…\n');

  let counts = {};

  // ── NodeTypes ──
  process.stdout.write('🏪 NodeTypes… ');
  for (const d of NODE_TYPES) await upCode('nodeType', d);
  console.log(`✓ ${NODE_TYPES.length}`);
  counts.nodeTypes = NODE_TYPES.length;

  // ── Zones ──
  process.stdout.write('📍 Zones entrepôt… ');
  for (const d of ZONES) await upCode('zone', d);
  console.log(`✓ ${ZONES.length}`);
  counts.zones = ZONES.length;

  // ── Levels ──
  process.stdout.write('📏 Niveaux (levels)… ');
  for (const d of LEVELS) await upCode('level', d);
  console.log(`✓ ${LEVELS.length}`);
  counts.levels = LEVELS.length;

  // ── StockOperation ──
  process.stdout.write('📦 StockOperations… ');
  for (const d of STOCK_OPERATIONS) await upCodeId(d);
  console.log(`✓ ${STOCK_OPERATIONS.length}`);

  // ── MoveType ──
  process.stdout.write('🔄 MoveTypes… ');
  for (const d of MOVE_TYPES) await upCode('moveType', d);
  console.log(`✓ ${MOVE_TYPES.length}`);

  // ── OrderStatus ──
  process.stdout.write('🛒 OrderStatuses… ');
  for (const d of ORDER_STATUSES) await upCode('orderStatus', d);
  console.log(`✓ ${ORDER_STATUSES.length}`);

  // ── OrderItemStatus ──
  process.stdout.write('📋 OrderItemStatuses… ');
  for (const d of ORDER_ITEM_STATUSES) await upCode('orderItemStatus', d);
  console.log(`✓ ${ORDER_ITEM_STATUSES.length}`);

  // ── OrderSlotStatus ──
  process.stdout.write('🕐 OrderSlotStatuses… ');
  for (const d of ORDER_SLOT_STATUSES) await upCode('orderSlotStatus', d);
  console.log(`✓ ${ORDER_SLOT_STATUSES.length}`);

  // ── PaymentStatus ──
  process.stdout.write('💳 PaymentStatuses… ');
  for (const d of PAYMENT_STATUSES) await upCode('paymentStatus', d);
  console.log(`✓ ${PAYMENT_STATUSES.length}`);

  // ── PaymentMethod ──
  process.stdout.write('💰 PaymentMethods… ');
  for (const d of PAYMENT_METHODS) await upCode('paymentMethod', d);
  console.log(`✓ ${PAYMENT_METHODS.length}`);

  // ── TourStatus ──
  process.stdout.write('🚚 TourStatuses… ');
  for (const d of TOUR_STATUSES) await upCode('tourStatus', d);
  console.log(`✓ ${TOUR_STATUSES.length}`);

  // ── StopStatus ──
  process.stdout.write('📍 StopStatuses… ');
  for (const d of STOP_STATUSES) await upCode('stopStatus', d);
  console.log(`✓ ${STOP_STATUSES.length}`);

  // ── PickingStatus ──
  process.stdout.write('🧺 PickingStatuses… ');
  for (const d of PICKING_STATUSES) await upCode('pickingStatus', d);
  console.log(`✓ ${PICKING_STATUSES.length}`);

  // ── PickItemStatus ──
  process.stdout.write('📝 PickItemStatuses… ');
  for (const d of PICK_ITEM_STATUSES) await upCode('pickItemStatus', d);
  console.log(`✓ ${PICK_ITEM_STATUSES.length}`);

  // ── ReferralStatus ──
  process.stdout.write('👥 ReferralStatuses… ');
  for (const d of REFERRAL_STATUSES) await upCode('referralStatus', d);
  console.log(`✓ ${REFERRAL_STATUSES.length}`);

  // ── WalletTxnType ──
  process.stdout.write('👛 WalletTxnTypes… ');
  for (const d of WALLET_TXN_TYPES) await upCode('walletTxnType', d);
  console.log(`✓ ${WALLET_TXN_TYPES.length}`);

  // ── PrizeType ──
  process.stdout.write('🎁 PrizeTypes… ');
  for (const d of PRIZE_TYPES) await upCode('prizeType', d);
  console.log(`✓ ${PRIZE_TYPES.length}`);

  // ── GameType ──
  process.stdout.write('🎮 GameTypes… ');
  for (const d of GAME_TYPES) await upCode('gameType', d);
  console.log(`✓ ${GAME_TYPES.length}`);

  // ── GamePlayPeriod ──
  process.stdout.write('⏱️  GamePlayPeriods… ');
  for (const d of GAME_PLAY_PERIODS) await upCode('gamePlayPeriod', d);
  console.log(`✓ ${GAME_PLAY_PERIODS.length}`);

  // ── UnlockCondition ──
  process.stdout.write('🔓 UnlockConditions… ');
  for (const d of UNLOCK_CONDITIONS) await upCode('unlockCondition', d);
  console.log(`✓ ${UNLOCK_CONDITIONS.length}`);

  // ── PromoType ──
  process.stdout.write('🏷️  PromoTypes… ');
  for (const d of PROMO_TYPES) await upCode('promoType', d);
  console.log(`✓ ${PROMO_TYPES.length}`);

  // ── PointsRuleType ──
  process.stdout.write('⭐ PointsRuleTypes… ');
  for (const d of POINTS_RULE_TYPES) await upCode('pointsRuleType', d);
  console.log(`✓ ${POINTS_RULE_TYPES.length}`);

  // ── RewardType ──
  process.stdout.write('🎖️  RewardTypes… ');
  for (const d of REWARD_TYPES) await upCode('rewardType', d);
  console.log(`✓ ${REWARD_TYPES.length}`);

  // ── NotificationChannel ──
  process.stdout.write('🔔 NotificationChannels… ');
  for (const d of NOTIFICATION_CHANNELS) await upCode('notificationChannel', d);
  console.log(`✓ ${NOTIFICATION_CHANNELS.length}`);

  // ── NotificationDeliveryStatus ──
  process.stdout.write('📨 NotificationStatuses… ');
  for (const d of NOTIFICATION_STATUSES) await upCode('notificationDeliveryStatus', d);
  console.log(`✓ ${NOTIFICATION_STATUSES.length}`);

  // ── QualityCheckType ──
  process.stdout.write('✅ QualityCheckTypes… ');
  for (const d of QUALITY_CHECK_TYPES) await upCode('qualityCheckType', d);
  console.log(`✓ ${QUALITY_CHECK_TYPES.length}`);

  // ── ConfigValueType ──
  process.stdout.write('⚙️  ConfigValueTypes… ');
  for (const d of CONFIG_VALUE_TYPES) await upCode('configValueType', d);
  console.log(`✓ ${CONFIG_VALUE_TYPES.length}`);

  // ── CostingMethod ──
  process.stdout.write('📊 CostingMethods… ');
  for (const d of COSTING_METHODS) await upCode('costingMethod', d);
  console.log(`✓ ${COSTING_METHODS.length}`);

  // ── DeliveryType ──
  process.stdout.write('🚴 DeliveryTypes… ');
  for (const d of DELIVERY_TYPES) await upCode('deliveryType', d);
  console.log(`✓ ${DELIVERY_TYPES.length}`);

  // ── SlotAssignmentSource ──
  process.stdout.write('📅 SlotAssignmentSources… ');
  for (const d of SLOT_ASSIGNMENT_SOURCES) await upCode('slotAssignmentSource', d);
  console.log(`✓ ${SLOT_ASSIGNMENT_SOURCES.length}`);

  // ── PackagingType (needs Unit IDs) ──
  process.stdout.write('📦 PackagingTypes… ');
  const unitRows = await prisma.unit.findMany({ select: { id: true, code: true } });
  const unitMap = Object.fromEntries(unitRows.map((u) => [u.code, u.id]));
  for (const d of PACKAGING_DEFS) {
    const unit_id = unitMap[d.unit_code] ?? null;
    await prisma.packagingType.upsert({
      where: { code: d.code },
      update: {},
      create: { code: d.code, name_fr: d.name_fr, name_ar: d.name_ar, quantity: d.qty, unit_id },
    });
  }
  console.log(`✓ ${PACKAGING_DEFS.length}`);

  // ── Nodes (dark stores marocains) ──
  process.stdout.write('\n🏪 Nodes (dark stores)… ');
  const nodeTypeRows = await prisma.nodeType.findMany({ select: { id: true, code: true } });
  const ntMap = Object.fromEntries(nodeTypeRows.map((t) => [t.code, t.id]));
  const regionRows  = await prisma.region.findMany({ select: { id: true, code: true } });
  const regMap = Object.fromEntries(regionRows.map((r) => [r.code, r.id]));
  const cityRows    = await prisma.city.findMany({ select: { id: true, code: true } });
  const cityMap = Object.fromEntries(cityRows.map((c) => [c.code, c.id]));

  let nodeCreated = 0; let nodeSkipped = 0;
  for (const d of NODE_DEFS) {
    const node_type_id = ntMap[d.node_type_code];
    const region_id    = regMap[d.region_code];
    const city_id      = cityMap[d.city_code];
    if (!node_type_id || !region_id || !city_id) {
      console.warn(`\n   ⚠️  Skipping node ${d.code} — référence manquante`);
      nodeSkipped++; continue;
    }
    await prisma.node.upsert({
      where: { code: d.code },
      update: {},
      create: {
        code: d.code, name_fr: d.name_fr, name_ar: d.name_ar,
        node_type_id, region_id, city_id,
        address_line1: d.address_line1 ?? null,
        quartier: d.quartier ?? null,
        postal_code: d.postal_code ?? null,
        lat: d.lat ?? null, lng: d.lng ?? null,
        timezone: d.timezone ?? 'Africa/Casablanca',
        delivery_radius_km: d.delivery_radius_km ?? null,
        max_daily_orders: d.max_daily_orders ?? null,
        is_active: true, is_deleted: false,
      },
    });
    nodeCreated++;
  }
  console.log(`✓ ${nodeCreated} créés, ${nodeSkipped} ignorés`);

  // ── Summary ──
  console.log('\n✅  Seed terminé!\n');
  console.log('   NodeTypes:               ', NODE_TYPES.length);
  console.log('   Zones entrepôt:          ', ZONES.length);
  console.log('   Niveaux (levels):        ', LEVELS.length);
  console.log('   StockOperations:         ', STOCK_OPERATIONS.length);
  console.log('   MoveTypes:               ', MOVE_TYPES.length);
  console.log('   OrderStatuses:           ', ORDER_STATUSES.length);
  console.log('   OrderItemStatuses:       ', ORDER_ITEM_STATUSES.length);
  console.log('   OrderSlotStatuses:       ', ORDER_SLOT_STATUSES.length);
  console.log('   PaymentStatuses:         ', PAYMENT_STATUSES.length);
  console.log('   PaymentMethods:          ', PAYMENT_METHODS.length);
  console.log('   TourStatuses:            ', TOUR_STATUSES.length);
  console.log('   StopStatuses:            ', STOP_STATUSES.length);
  console.log('   PickingStatuses:         ', PICKING_STATUSES.length);
  console.log('   PickItemStatuses:        ', PICK_ITEM_STATUSES.length);
  console.log('   ReferralStatuses:        ', REFERRAL_STATUSES.length);
  console.log('   WalletTxnTypes:          ', WALLET_TXN_TYPES.length);
  console.log('   PrizeTypes:              ', PRIZE_TYPES.length);
  console.log('   GameTypes:               ', GAME_TYPES.length);
  console.log('   GamePlayPeriods:         ', GAME_PLAY_PERIODS.length);
  console.log('   UnlockConditions:        ', UNLOCK_CONDITIONS.length);
  console.log('   PromoTypes:              ', PROMO_TYPES.length);
  console.log('   PointsRuleTypes:         ', POINTS_RULE_TYPES.length);
  console.log('   RewardTypes:             ', REWARD_TYPES.length);
  console.log('   NotificationChannels:    ', NOTIFICATION_CHANNELS.length);
  console.log('   NotificationStatuses:    ', NOTIFICATION_STATUSES.length);
  console.log('   QualityCheckTypes:       ', QUALITY_CHECK_TYPES.length);
  console.log('   ConfigValueTypes:        ', CONFIG_VALUE_TYPES.length);
  console.log('   CostingMethods:          ', COSTING_METHODS.length);
  console.log('   DeliveryTypes:           ', DELIVERY_TYPES.length);
  console.log('   SlotAssignmentSources:   ', SLOT_ASSIGNMENT_SOURCES.length);
  console.log('   PackagingTypes:          ', PACKAGING_DEFS.length);
  console.log('   Nodes créés:             ', nodeCreated);
  console.log('');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
