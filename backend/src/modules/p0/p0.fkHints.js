/**
 * Résolution des FK (tables P0 + tables hors registre notées refSql null).
 */
const { findTableEntryByModel } = require('./p0.registry');

const MODEL_FK_HINTS = {
  Order: {
    status_id: { refModel: 'OrderStatus', refSql: 'order_statuses' },
    customer_id: { refModel: 'Customer', refSql: 'customers' },
    address_id: { refModel: 'Address', refSql: 'addresses' },
    node_id: { refModel: 'Node', refSql: null },
    tour_id: { refModel: 'Tour', refSql: 'tours' },
    promotion_id: { refModel: 'Promotion', refSql: 'promotions' },
    delivery_type_id: { refModel: 'DeliveryType', refSql: 'delivery_types' },
    confirmed_slot_id: { refModel: 'DeliverySlot', refSql: null },
  },
  OrderItem: {
    order_id: { refModel: 'Order', refSql: 'orders' },
    sku_id: { refModel: 'Sku', refSql: null },
    pack_id: { refModel: 'Pack', refSql: 'packs' },
    parent_item_id: { refModel: 'OrderItem', refSql: 'order_items' },
    flash_sale_id: { refModel: 'FlashSale', refSql: 'flash_sales' },
    status_id: { refModel: 'OrderItemStatus', refSql: 'order_item_statuses' },
    node_id: { refModel: 'Node', refSql: null },
  },
  Payment: {
    order_id: { refModel: 'Order', refSql: 'orders' },
    status_id: { refModel: 'PaymentStatus', refSql: 'payment_statuses' },
    payment_method_id: { refModel: 'PaymentMethod', refSql: 'payment_methods' },
  },
  Address: {
    customer_id: { refModel: 'Customer', refSql: 'customers' },
    city_id: { refModel: 'City', refSql: null },
  },
  StockLevel: {
    node_id: { refModel: 'Node', refSql: null },
    sku_id: { refModel: 'Sku', refSql: null },
  },
  SellingRule: {
    node_id: { refModel: 'Node', refSql: null },
    sku_id: { refModel: 'Sku', refSql: null },
  },
  ReorderRule: {
    node_id: { refModel: 'Node', refSql: null },
    sku_id: { refModel: 'Sku', refSql: null },
  },
  AppConfig: {
    node_id: { refModel: 'Node', refSql: null },
    value_type_id: { refModel: 'ConfigValueType', refSql: 'config_value_types' },
    updated_by: { refModel: 'User', refSql: null },
  },
  WarehouseLocation: {
    node_id: { refModel: 'Node', refSql: null },
  },
  SkuNodeLocation: {
    sku_id: { refModel: 'Sku', refSql: null },
    node_id: { refModel: 'Node', refSql: null },
    location_id: { refModel: 'WarehouseLocation', refSql: 'locations' },
  },
  StockMove: {
    node_id: { refModel: 'Node', refSql: null },
    sku_id: { refModel: 'Sku', refSql: null },
    move_type_id: { refModel: 'MoveType', refSql: 'move_types' },
  },
  PackItem: {
    pack_id: { refModel: 'Pack', refSql: 'packs' },
    sku_id: { refModel: 'Sku', refSql: null },
  },
  FlashSale: {
    sku_id: { refModel: 'Sku', refSql: null },
    node_id: { refModel: 'Node', refSql: null },
  },
  Promotion: {
    promo_type_id: { refModel: 'PromoType', refSql: 'promo_types' },
  },
  PointsRule: {
    node_id: { refModel: 'Node', refSql: null },
    rule_type_id: { refModel: 'PointsRuleType', refSql: 'points_rule_types' },
  },
  Referral: {
    referrer_customer_id: { refModel: 'Customer', refSql: 'customers' },
    referee_customer_id: { refModel: 'Customer', refSql: 'customers' },
    status_id: { refModel: 'ReferralStatus', refSql: 'referral_statuses' },
    reward_type_id: { refModel: 'RewardType', refSql: 'reward_types' },
  },
  GamificationGame: {
    game_type_id: { refModel: 'GameType', refSql: 'game_types' },
    play_period_id: { refModel: 'GamePlayPeriod', refSql: 'game_play_periods' },
    unlock_condition_id: { refModel: 'UnlockCondition', refSql: 'unlock_conditions' },
    created_by: { refModel: 'User', refSql: null },
  },
  GamificationPrize: {
    game_id: { refModel: 'GamificationGame', refSql: 'gamification_games' },
    prize_type_id: { refModel: 'PrizeType', refSql: 'prize_types' },
  },
  GamificationPlay: {
    game_id: { refModel: 'GamificationGame', refSql: 'gamification_games' },
    customer_id: { refModel: 'Customer', refSql: 'customers' },
    prize_id: { refModel: 'GamificationPrize', refSql: 'gamification_prizes' },
    order_id: { refModel: 'Order', refSql: 'orders' },
  },
  Tour: {
    node_id: { refModel: 'Node', refSql: null },
    status_id: { refModel: 'TourStatus', refSql: 'tour_statuses' },
  },
  TourStop: {
    tour_id: { refModel: 'Tour', refSql: 'tours' },
    order_id: { refModel: 'Order', refSql: 'orders' },
    status_id: { refModel: 'StopStatus', refSql: 'stop_statuses' },
  },
};

function snakeToPascal(snake) {
  return snake
    .split('_')
    .filter(Boolean)
    .map((s) => s[0].toUpperCase() + s.slice(1).toLowerCase())
    .join('');
}

function mergeRefSql(hint) {
  if (!hint) return null;
  if (hint.refSql) return hint;
  const reg = findTableEntryByModel(hint.refModel);
  if (reg) return { ...hint, refSql: reg.table.sql };
  return hint;
}

/**
 * @returns {{ refModel: string, refSql: string|null }|null}
 */
function resolveFk(prismaModel, field) {
  const direct = MODEL_FK_HINTS[prismaModel]?.[field];
  if (direct) return mergeRefSql({ ...direct });

  if (!field.endsWith('_id')) return null;
  const base = field.slice(0, -3);
  if (!base) return null;
  const refModel = snakeToPascal(base);
  const reg = findTableEntryByModel(refModel);
  if (reg) return { refModel, refSql: reg.table.sql };
  return { refModel, refSql: null };
}

module.exports = { MODEL_FK_HINTS, resolveFk, snakeToPascal };
