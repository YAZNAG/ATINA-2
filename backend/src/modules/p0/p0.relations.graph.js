/**
 * Graphe documenté des FK « métier » entre tables P0 (noms SQL @@map).
 * Les tables hors registre (nodes, skus, cities, users, delivery_slots…) sont notées toSql null.
 */
const EDGES = [
  { fromSql: 'orders', toSql: 'customers', field: 'customer_id', label: 'Client' },
  { fromSql: 'orders', toSql: 'order_statuses', field: 'status_id', label: 'Statut commande' },
  { fromSql: 'orders', toSql: 'delivery_types', field: 'delivery_type_id', label: 'Type livraison' },
  { fromSql: 'orders', toSql: 'addresses', field: 'address_id', label: 'Adresse' },
  { fromSql: 'orders', toSql: 'tours', field: 'tour_id', label: 'Tournée' },
  { fromSql: 'orders', toSql: 'promotions', field: 'promotion_id', label: 'Promo' },
  { fromSql: 'orders', toSql: null, field: 'node_id', label: 'Node (dark store)' },
  { fromSql: 'orders', toSql: null, field: 'confirmed_slot_id', label: 'Créneau confirmé' },

  { fromSql: 'order_items', toSql: 'orders', field: 'order_id', label: 'Commande' },
  { fromSql: 'order_items', toSql: 'order_item_statuses', field: 'status_id', label: 'Statut ligne' },
  { fromSql: 'order_items', toSql: 'packs', field: 'pack_id', label: 'Pack' },
  { fromSql: 'order_items', toSql: 'flash_sales', field: 'flash_sale_id', label: 'Vente flash' },
  { fromSql: 'order_items', toSql: 'order_items', field: 'parent_item_id', label: 'Ligne parent (pack)' },
  { fromSql: 'order_items', toSql: null, field: 'sku_id', label: 'SKU catalogue' },
  { fromSql: 'order_items', toSql: null, field: 'node_id', label: 'Node' },

  { fromSql: 'payments', toSql: 'orders', field: 'order_id', label: 'Commande' },
  { fromSql: 'payments', toSql: 'payment_statuses', field: 'status_id', label: 'Statut paiement' },
  { fromSql: 'payments', toSql: 'payment_methods', field: 'payment_method_id', label: 'Moyen de paiement' },

  { fromSql: 'addresses', toSql: 'customers', field: 'customer_id', label: 'Client' },
  { fromSql: 'addresses', toSql: null, field: 'city_id', label: 'Ville (géo)' },

  { fromSql: 'stock_levels', toSql: null, field: 'node_id', label: 'Node' },
  { fromSql: 'stock_levels', toSql: null, field: 'sku_id', label: 'SKU' },

  { fromSql: 'selling_rules', toSql: null, field: 'node_id', label: 'Node' },
  { fromSql: 'selling_rules', toSql: null, field: 'sku_id', label: 'SKU' },
  { fromSql: 'reorder_rules', toSql: null, field: 'node_id', label: 'Node' },
  { fromSql: 'reorder_rules', toSql: null, field: 'sku_id', label: 'SKU' },

  { fromSql: 'app_configs', toSql: 'config_value_types', field: 'value_type_id', label: 'Type valeur' },
  { fromSql: 'app_configs', toSql: null, field: 'node_id', label: 'Node' },
  { fromSql: 'app_configs', toSql: null, field: 'updated_by', label: 'Utilisateur back-office' },

  { fromSql: 'locations', toSql: null, field: 'node_id', label: 'Node' },
  { fromSql: 'sku_node_locations', toSql: 'locations', field: 'location_id', label: 'Emplacement' },
  { fromSql: 'sku_node_locations', toSql: null, field: 'sku_id', label: 'SKU' },
  { fromSql: 'sku_node_locations', toSql: null, field: 'node_id', label: 'Node' },

  { fromSql: 'stock_moves', toSql: 'move_types', field: 'move_type_id', label: 'Type mouvement' },
  { fromSql: 'stock_moves', toSql: null, field: 'node_id', label: 'Node' },
  { fromSql: 'stock_moves', toSql: null, field: 'sku_id', label: 'SKU' },

  { fromSql: 'pack_items', toSql: 'packs', field: 'pack_id', label: 'Pack' },
  { fromSql: 'pack_items', toSql: null, field: 'sku_id', label: 'SKU' },

  { fromSql: 'flash_sales', toSql: null, field: 'sku_id', label: 'SKU' },
  { fromSql: 'flash_sales', toSql: null, field: 'node_id', label: 'Node' },

  { fromSql: 'promotions', toSql: 'promo_types', field: 'promo_type_id', label: 'Type promo' },

  { fromSql: 'points_rules', toSql: 'points_rule_types', field: 'rule_type_id', label: 'Type règle' },
  { fromSql: 'points_rules', toSql: null, field: 'node_id', label: 'Node' },

  { fromSql: 'referrals', toSql: 'customers', field: 'referrer_customer_id', label: 'Parrain' },
  { fromSql: 'referrals', toSql: 'customers', field: 'referee_customer_id', label: 'Filleul' },
  { fromSql: 'referrals', toSql: 'referral_statuses', field: 'status_id', label: 'Statut' },
  { fromSql: 'referrals', toSql: 'reward_types', field: 'reward_type_id', label: 'Type récompense' },

  { fromSql: 'gamification_games', toSql: 'game_types', field: 'game_type_id', label: 'Type jeu' },
  { fromSql: 'gamification_games', toSql: 'game_play_periods', field: 'play_period_id', label: 'Période' },
  { fromSql: 'gamification_games', toSql: 'unlock_conditions', field: 'unlock_condition_id', label: 'Condition' },
  { fromSql: 'gamification_games', toSql: null, field: 'created_by', label: 'Créateur (user BO)' },

  { fromSql: 'gamification_prizes', toSql: 'gamification_games', field: 'game_id', label: 'Jeu' },
  { fromSql: 'gamification_prizes', toSql: 'prize_types', field: 'prize_type_id', label: 'Type lot' },

  { fromSql: 'gamification_plays', toSql: 'gamification_games', field: 'game_id', label: 'Jeu' },
  { fromSql: 'gamification_plays', toSql: 'customers', field: 'customer_id', label: 'Client' },
  { fromSql: 'gamification_plays', toSql: 'gamification_prizes', field: 'prize_id', label: 'Lot' },
  { fromSql: 'gamification_plays', toSql: 'orders', field: 'order_id', label: 'Commande' },

  { fromSql: 'tours', toSql: 'tour_statuses', field: 'status_id', label: 'Statut tournée' },
  { fromSql: 'tours', toSql: null, field: 'node_id', label: 'Node' },

  { fromSql: 'tour_stops', toSql: 'tours', field: 'tour_id', label: 'Tournée' },
  { fromSql: 'tour_stops', toSql: 'orders', field: 'order_id', label: 'Commande' },
  { fromSql: 'tour_stops', toSql: 'stop_statuses', field: 'status_id', label: 'Statut arrêt' },

  { fromSql: 'customers', toSql: 'customers', field: 'referred_by_id', label: 'Parrain (client)' },
];

function edgesForTable(sql) {
  const s = (sql || '').toLowerCase();
  return EDGES.filter((e) => e.fromSql === s || e.toSql === s);
}

module.exports = { EDGES, edgesForTable };
