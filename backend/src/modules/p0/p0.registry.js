/**
 * Registre des tables P0 (alignées Prisma) — utilisé par GET /api/p0/registry pour affichage back-office.
 * `model` = nom exact du modèle Prisma (pour prisma[delegate].count()).
 * `sql` = nom physique PostgreSQL (@@map).
 */
const P0_TABLE_GROUPS = [
  {
    id: 'lookups_stock',
    titleFr: 'Lookups — stock & mouvements',
    tables: [
      { model: 'StockOperation', sql: 'stock_operations', labelFr: 'Sens stock (IN / OUT / NEUTRAL)' },
      { model: 'MoveType', sql: 'move_types', labelFr: 'Types de mouvement' },
    ],
  },
  {
    id: 'lookups_orders',
    titleFr: 'Lookups — commandes & paiements',
    tables: [
      { model: 'OrderStatus', sql: 'order_statuses', labelFr: 'Statuts commande' },
      { model: 'OrderItemStatus', sql: 'order_item_statuses', labelFr: 'Statuts ligne commande' },
      { model: 'OrderSlotStatus', sql: 'order_slot_statuses', labelFr: 'Statuts créneau' },
      { model: 'PaymentStatus', sql: 'payment_statuses', labelFr: 'Statuts paiement' },
      { model: 'PaymentMethod', sql: 'payment_methods', labelFr: 'Moyens de paiement' },
      { model: 'DeliveryType', sql: 'delivery_types', labelFr: 'Types livraison (domicile / retrait)' },
      { model: 'SlotAssignmentSource', sql: 'slot_assignment_sources', labelFr: 'Source assignation créneau' },
    ],
  },
  {
    id: 'lookups_logistics',
    titleFr: 'Lookups — tournées & picking',
    tables: [
      { model: 'TourStatus', sql: 'tour_statuses', labelFr: 'Statuts tournée' },
      { model: 'StopStatus', sql: 'stop_statuses', labelFr: 'Statuts arrêt' },
      { model: 'PickingStatus', sql: 'picking_statuses', labelFr: 'Statuts picking' },
      { model: 'PickItemStatus', sql: 'pick_item_statuses', labelFr: 'Statuts ligne picking' },
    ],
  },
  {
    id: 'lookups_marketing',
    titleFr: 'Lookups — marketing & fidélité',
    tables: [
      { model: 'ReferralStatus', sql: 'referral_statuses', labelFr: 'Statuts parrainage' },
      { model: 'WalletTxnType', sql: 'wallet_txn_types', labelFr: 'Types transaction wallet' },
      { model: 'PrizeType', sql: 'prize_types', labelFr: 'Types de lot jeu' },
      { model: 'GameType', sql: 'game_types', labelFr: 'Types de jeu' },
      { model: 'GamePlayPeriod', sql: 'game_play_periods', labelFr: 'Périodes de jeu' },
      { model: 'UnlockCondition', sql: 'unlock_conditions', labelFr: 'Conditions déblocage jeu' },
      { model: 'PromoType', sql: 'promo_types', labelFr: 'Types promo' },
      { model: 'PointsRuleType', sql: 'points_rule_types', labelFr: 'Types règles points' },
      { model: 'RewardType', sql: 'reward_types', labelFr: 'Types récompense parrainage' },
    ],
  },
  {
    id: 'lookups_misc',
    titleFr: 'Lookups — divers',
    tables: [
      { model: 'NotificationChannel', sql: 'notification_channels', labelFr: 'Canaux notification' },
      { model: 'NotificationDeliveryStatus', sql: 'notification_statuses', labelFr: 'Statuts envoi notification' },
      { model: 'QualityCheckType', sql: 'quality_check_types', labelFr: 'Types contrôle qualité' },
      { model: 'ConfigValueType', sql: 'config_value_types', labelFr: 'Types valeur config' },
      { model: 'CostingMethod', sql: 'costing_methods', labelFr: 'Méthodes valorisation stock' },
    ],
  },
  {
    id: 'core_commerce',
    titleFr: 'Cœur métier — clients, commandes, stock',
    tables: [
      {
        model: 'Customer',
        sql: 'customers',
        labelFr: 'Clients (app) — inscription, wallet, points, parrainage',
        listPath: '/customers',
        listPermission: 'customers.view',
        listPermissionAny: ['dashboard.view'],
        genericCrud: false,
      },
      { model: 'Address', sql: 'addresses', labelFr: 'Adresses livraison' },
      { model: 'StockLevel', sql: 'stock_levels', labelFr: 'Stock agrégé node × SKU' },
      { model: 'SellingRule', sql: 'selling_rules', labelFr: 'Règles de vente (backorder…)' },
      { model: 'ReorderRule', sql: 'reorder_rules', labelFr: 'Règles réapprovisionnement' },
      { model: 'Supplier', sql: 'suppliers', labelFr: 'Fournisseurs' },
      { model: 'Order', sql: 'orders', labelFr: 'Commandes' },
      { model: 'OrderItem', sql: 'order_items', labelFr: 'Lignes commande' },
      { model: 'Payment', sql: 'payments', labelFr: 'Paiements' },
      { model: 'AppConfig', sql: 'app_configs', labelFr: 'Paramètres plateforme' },
    ],
  },
  {
    id: 'warehouse',
    titleFr: 'Entrepôt — emplacements & mouvements',
    tables: [
      { model: 'WarehouseLocation', sql: 'locations', labelFr: 'Emplacements (allée / étagère)' },
      { model: 'SkuNodeLocation', sql: 'sku_node_locations', labelFr: 'SKU × node × emplacement' },
      { model: 'StockMove', sql: 'stock_moves', labelFr: 'Mouvements de stock' },
    ],
  },
  {
    id: 'offers',
    titleFr: 'Offres — packs, flash, promos, jeux, parrainage',
    tables: [
      { model: 'Pack', sql: 'packs', labelFr: 'Packs / bundles' },
      { model: 'PackItem', sql: 'pack_items', labelFr: 'Composition pack' },
      { model: 'FlashSale', sql: 'flash_sales', labelFr: 'Ventes flash' },
      { model: 'Promotion', sql: 'promotions', labelFr: 'Codes promo' },
      { model: 'PointsRule', sql: 'points_rules', labelFr: 'Règles points fidélité' },
      { model: 'ReferralConfig', sql: 'referral_config', labelFr: 'Config parrainage' },
      { model: 'Referral', sql: 'referrals', labelFr: 'Parrainages' },
      { model: 'GamificationGame', sql: 'gamification_games', labelFr: 'Jeux gamification' },
      { model: 'GamificationPrize', sql: 'gamification_prizes', labelFr: 'Lots jeu' },
      { model: 'GamificationPlay', sql: 'gamification_plays', labelFr: 'Parties jouées' },
    ],
  },
  {
    id: 'tours',
    titleFr: 'Tournées livraison',
    tables: [
      { model: 'Tour', sql: 'tours', labelFr: 'Tournées' },
      { model: 'TourStop', sql: 'tour_stops', labelFr: 'Arrêts tournée' },
    ],
  },
];

function findTableEntryBySql(rawSql) {
  const trimmed = (rawSql || '').trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  for (const g of P0_TABLE_GROUPS) {
    for (const t of g.tables) {
      if (t.sql === trimmed || t.sql === lower) return { group: g, table: t };
    }
  }
  return null;
}

module.exports = { P0_TABLE_GROUPS, findTableEntryBySql };
