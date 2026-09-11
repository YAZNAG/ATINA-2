/**
 * Étape « offres » : packs (promotions/pack.service), ventes flash (promotions.service),
 * codes promo (coupons.service), SKU échangeables contre des points (points_exchange),
 * jeux roulette / carte à gratter (gamification.service). Visuels générés.
 */
const path = require('path');
const I = require('../lib/images');
const { daysAgo, addDays } = require('../lib/util');
const { BACKEND } = require('./images');
const { customerList } = require('./clients');

const PACKS = [
  { key: 'PDJ', node: 'CASA-MAARIF', name_fr: 'Pack petit-déjeuner', name_ar: 'باك الفطور', color: '#e67e22', discount: 10, max: 40,
    desc_fr: 'Lait, pain de mie, confiture, thé et beurre : le petit-déjeuner complet livré en 20 minutes.', desc_ar: 'حليب وخبز ومربى وشاي وزبدة: فطور كامل يصلك في 20 دقيقة.',
    items: [['LAI-CEN-DEM', 2], ['PAI-MIE-COM', 1], ['CFT-AIC-FRA', 1], ['THE-SUL-250', 1], ['BEU-PRE-200', 1]] },
  { key: 'APERO', node: 'CASA-MAARIF', name_fr: 'Pack apéro', name_ar: 'باك المقبلات', color: '#c0392b', price: 58,
    desc_fr: 'Olives, thon, maïs, cachir et sodas pour recevoir sans stress.', desc_ar: 'زيتون وتونة وذرة وكاشير ومشروبات غازية لاستقبال الضيوف.',
    items: [['OLV-ATI-VER', 1], ['CON-ATI-THO', 1], ['CON-BON-MAI', 1], ['CHA-KOU-CAC', 1], ['SOD-COC-1L', 2]] },
  { key: 'FTOUR', node: 'CASA-AINSEBAA', name_fr: 'Pack ftour Ramadan', name_ar: 'باك فطور رمضان', color: '#7d3c98', discount: 12, max: 60,
    desc_fr: 'Dattes, chebakia, harira, lben et vermicelles : l’essentiel de la table du ftour.', desc_ar: 'تمر وشباكية وحريرة ولبن وشعرية: أساسيات مائدة الإفطار.',
    items: [['FRU-DAT-MED', 1], ['TRA-CHE-500', 1], ['SOU-KNO-HAR', 2], ['LBN-JAO-1L', 2], ['PAT-DAR-VER', 1]] },
  { key: 'MENAGE', node: 'CASA-AINSEBAA', name_fr: 'Pack grand ménage', name_ar: 'باك التنظيف الشامل', color: '#16a085', discount: 8,
    desc_fr: 'Lessive, vaisselle, javel et multi-surfaces pour toute la maison.', desc_ar: 'مسحوق الغسيل وسائل الأواني والجافيل ومنظف الأسطح.',
    items: [['LES-TID-3KG', 1], ['VAI-ATI-CIT', 1], ['SUR-ATI-JAV', 2], ['SUR-ATI-MUL', 1]] },
  { key: 'PDJ', node: 'RABAT-AGDAL', name_fr: 'Pack petit-déjeuner', name_ar: 'باك الفطور', color: '#e67e22', discount: 10, max: 30,
    desc_fr: 'Lait, pain de mie, confiture, thé et beurre : le petit-déjeuner complet.', desc_ar: 'حليب وخبز ومربى وشاي وزبدة: فطور كامل.',
    items: [['LAI-CEN-DEM', 2], ['PAI-MIE-COM', 1], ['CFT-AIC-FRA', 1], ['THE-SUL-250', 1], ['BEU-PRE-200', 1]] },
  { key: 'BEBE', node: 'RABAT-AGDAL', name_fr: 'Pack bébé', name_ar: 'باك الرضيع', color: '#d63384', discount: 10,
    desc_fr: 'Couches taille 3, lingettes et céréales bébé.', desc_ar: 'حفاضات مقاس 3 ومناديل مبللة وسيريلاك.',
    items: [['COU-PAM-T3', 1], ['LIN-PAM-SEN', 1], ['ALI-NES-CER', 1]] },
  { key: 'THE', node: 'MRK-GUELIZ', name_fr: 'Pack thé à la menthe', name_ar: 'باك أتاي بالنعناع', color: '#27ae60', discount: 10,
    desc_fr: 'Thé vert, pain de sucre et menthe fraîche pour un thé à la marocaine.', desc_ar: 'شاي أخضر وقالب سكر ونعناع طري لأتاي مغربي.',
    items: [['THE-SUL-250', 1], ['SUC-COS-PAI', 1], ['HER-MEN-BOT', 2]] },
  { key: 'TAJINE', node: 'MRK-GUELIZ', name_fr: 'Pack tajine du vendredi', name_ar: 'باك طاجين الجمعة', color: '#a04000', discount: 8, max: 25,
    desc_fr: 'Poulet fermier, légumes, épices et coriandre pour un tajine familial.', desc_ar: 'دجاج بلدي وخضر وتوابل وقزبر لطاجين عائلي.',
    items: [['VOL-POU-FER', 1], ['LEG-PDT-1KG', 1], ['LEG-OIG-1KG', 1], ['LEG-CAR-1KG', 1], ['EPI-ATI-CUM', 1], ['HER-COR-BOT', 1]] },
];

const FLASH = [
  { key: 'JUS', node: 'CASA-MAARIF', sku: 'JUS-JAO-ORA', name_fr: 'Vente flash : jus d’orange Jaouda', name_ar: 'عرض سريع: عصير البرتقال جودة', pct: 20, stock: 30, max: 2, start: -2, end: 5, color: '#f39c12' },
  { key: 'PDJ-RBA', node: 'RABAT-AGDAL', pack: 'PDJ', name_fr: 'Vente flash : pack petit-déjeuner', name_ar: 'عرض سريع: باك الفطور', pct: 15, stock: 15, max: 2, start: -1, end: 3, color: '#e67e22' },
  { key: 'THE-MRK', node: 'MRK-GUELIZ', sku: 'THE-SUL-500', name_fr: 'Vente flash : thé Sultan 500 g', name_ar: 'عرض سريع: شاي السلطان 500 غ', pct: 18, stock: 20, max: 2, start: 3, end: 10, color: '#b71c1c' },
  { key: 'EAU-AIN', node: 'CASA-AINSEBAA', sku: 'EAU-SAL-PK6', name_fr: 'Vente flash : pack eau Sidi Ali', name_ar: 'عرض سريع: حزمة ماء سيدي علي', pct: 15, stock: 25, max: 2, start: -20, end: 1, endedDaysAgo: 12, color: '#0277bd' },
];

const EXCHANGE = [['EAU-SAL-150', 60, 2], ['SOD-COC-CAN', 60, 2], ['BIS-BIM-TON', 40, 3], ['RAI-CEN-JAM', 30, 4], ['YAO-CEN-DUP', 40, 2], ['PAI-KHB-X2', 30, 2], ['HER-MEN-BOT', 30, 2], ['LAI-CEN-DEM', 80, 2], ['BIS-LUS-GAU', 70, 1], ['SAV-DOV-X2', 200, 1]];
const EXCHANGE_NODES = ['CASA-MAARIF', 'RABAT-AGDAL'];

function packImageSvg(p, skusByCode, nPieces) {
  const shapes = p.items.slice(0, 3).map(([c]) => skusByCode[c]?.shape || 'box');
  return I.bannerSvg({ title: p.name_fr, subtitle: `${nPieces} produits · ${p.discount ? `-${p.discount} %` : 'prix malin'}`, color: p.color, shapes, width: 800, height: 800, badge: 'PACK' });
}

async function run(ctx) {
  const { prisma } = ctx;
  const { toPublicUrl } = require('../../../src/utils/fileStorage');
  const packSvc = require('../../../src/modules/promotions/pack.service');
  const promoSvc = require('../../../src/modules/promotions/promotions.service');
  const couponSvc = require('../../../src/modules/coupons/coupons.service');
  const exSvc = require('../../../src/modules/points_exchange/points_exchange.service');
  const gameSvc = require('../../../src/modules/gamification/gamification.service');
  const req = ctx.dry ? null : await ctx.req();
  const nodes = Object.fromEntries((await ctx.nodes()).map((n) => [n.code, n]));
  const skus = await ctx.skus();
  const skuByCode = Object.fromEntries(skus.map((s) => [s.code, s]));

  // ── Packs ────────────────────────────────────────────────────────────────
  const packIds = {};
  for (const p of PACKS) {
    const node = nodes[p.node];
    if (!node) continue;
    let pack = await prisma.pack.findFirst({ where: { node_id: node.id, name_fr: p.name_fr, is_deleted: false } });
    if (!pack) {
      ctx.count('packs');
      if (ctx.dry) continue;
      const rel = `/uploads/packs/demo-pack-${node.short.toLowerCase()}-${p.key.toLowerCase()}.webp`;
      await I.writeWebp(packImageSvg(p, skuByCode, p.items.reduce((s, [, q]) => s + q, 0)), path.join(BACKEND, rel));
      try {
        const created = await packSvc.create({
          node_id: node.id, name_fr: p.name_fr, name_ar: p.name_ar, description_fr: p.desc_fr, description_ar: p.desc_ar,
          ...(p.discount ? { discount_type: 'percentage', discount_value: p.discount } : { total_price: p.price }),
          valid_from: daysAgo(30, 0, 0).toISOString(), valid_to: addDays(new Date(), 90).toISOString(),
          max_pack_qty: p.max ?? null, estimated_restock_days: 2, is_backorderable: false, is_active: true,
          image_url: toPublicUrl(rel),
          items: p.items.map(([code, qty]) => ({ sku_id: skuByCode[code].id, qty })),
        }, req);
        pack = await prisma.pack.findUnique({ where: { id: created.id } });
      } catch (e) { ctx.warn(`Pack « ${p.name_fr} » (${p.node}) : ${e.message}`); continue; }
    }
    packIds[`${p.node}:${p.key}`] = pack.id;
  }

  // ── Ventes flash ─────────────────────────────────────────────────────────
  for (const f of FLASH) {
    const node = nodes[f.node];
    if (!node) continue;
    const exists = await prisma.flashSale.findFirst({ where: { node_id: node.id, name_fr: f.name_fr, is_deleted: false } });
    if (exists) continue;
    ctx.count('flash_sales');
    if (ctx.dry) continue;
    const rel = `/uploads/flash_sales/demo-flash-${f.key.toLowerCase()}.webp`;
    const target = f.sku ? skuByCode[f.sku] : null;
    await I.writeWebp(I.bannerSvg({ title: f.name_fr.replace('Vente flash : ', ''), subtitle: `Jusqu’à -${f.pct} % · quantités limitées`, color: f.color, shapes: target ? [target.shape, target.shape] : ['box', 'jar', 'brick'], width: 1200, height: 500, badge: `VENTE FLASH -${f.pct} %` }), path.join(BACKEND, rel));
    const packId = f.pack ? packIds[`${f.node}:${f.pack}`] : null;
    if (f.pack && !packId) { ctx.warn(`Vente flash ${f.key} : pack absent`); continue; }
    const startsAt = f.start < 0 ? daysAgo(-f.start, 8, 0) : addDays(daysAgo(0, 8, 0), f.start);
    try {
      const created = await promoSvc.CreatePromotion({
        node_id: node.id, ...(target ? { sku_id: target.id } : { pack_id: packId }),
        name_fr: f.name_fr, name_ar: f.name_ar, image_url: toPublicUrl(rel),
        discount_type: 'percentage', discount_value: f.pct, stock_flash: f.stock, max_qty_per_user: f.max,
        starts_at: startsAt.toISOString(), ends_at: addDays(daysAgo(0, 23, 0), f.end).toISOString(), is_active: true,
      }, req);
      if (created.warnings?.length) ctx.log(`flash ${f.key} : ${created.warnings.join(' ')}`);
    } catch (e) { ctx.warn(`Vente flash ${f.key} : ${e.message}`); }
  }

  // ── Codes promo ──────────────────────────────────────────────────────────
  const clients = customerList();
  const vip = clients[1];
  const vipRow = ctx.dry ? null : await prisma.customer.findFirst({ where: { phone_number: vip.phone, is_deleted: false } });
  const iso = (d) => d.toISOString();
  const COUPONS = [
    { code: 'BIENVENUE10', type: 'PERCENTAGE', value: 10, max_discount: 30, min_order_amount: 100, uses_per_user_max: 1, valid_from: iso(daysAgo(40)), valid_to: iso(addDays(new Date(), 60)) },
    { code: 'ATINA20', type: 'FIXED', value: 20, min_order_amount: 150, uses_per_user_max: 2, valid_from: iso(daysAgo(40)), valid_to: iso(addDays(new Date(), 45)) },
    { code: 'LIVRAISON0', type: 'FREE_SHIPPING', value: 0, min_order_amount: 80, uses_per_user_max: 3, valid_from: iso(daysAgo(40)), valid_to: iso(addDays(new Date(), 30)) },
    { code: 'RABAT15', type: 'PERCENTAGE', value: 15, max_discount: 40, min_order_amount: 120, uses_per_user_max: 1, node: 'RABAT-AGDAL', valid_from: iso(daysAgo(30)), valid_to: iso(addDays(new Date(), 30)) },
    { code: `VIP-${vip.referral_code}`.slice(0, 50), type: 'PERCENTAGE', value: 15, min_order_amount: 0, uses_max: 3, uses_per_user_max: 3, customer_id: vipRow?.id, valid_from: iso(daysAgo(35)), valid_to: iso(addDays(new Date(), 60)) },
    { code: 'FLASH50', type: 'FIXED', value: 50, min_order_amount: 250, uses_max: 2, uses_per_user_max: 1, valid_from: iso(daysAgo(30)), valid_to: iso(addDays(new Date(), 20)) },
    { code: 'ETE2026', type: 'PERCENTAGE', value: 20, max_discount: 50, min_order_amount: 200, uses_per_user_max: 1, valid_from: iso(daysAgo(100)), valid_to: iso(daysAgo(40)) },
    { code: 'RAMADAN2027', type: 'PERCENTAGE', value: 12, max_discount: 60, min_order_amount: 150, uses_per_user_max: 2, valid_from: iso(addDays(new Date(), 150)), valid_to: iso(addDays(new Date(), 185)) },
  ];
  for (const c of COUPONS) {
    if (await prisma.promotion.findFirst({ where: { code: { equals: c.code, mode: 'insensitive' } } })) continue;
    ctx.count('promotions');
    if (ctx.dry) continue;
    const { node, ...body } = c;
    try {
      await couponSvc.create({ ...body, ...(node ? { node_id: nodes[node]?.id } : {}), is_combined: false, is_active: true }, req);
    } catch (e) { ctx.warn(`Code promo ${c.code} : ${e.message}`); }
  }

  // ── Échange de points (10 SKU sur 2 nodes) ───────────────────────────────
  for (const code of EXCHANGE_NODES) {
    const node = nodes[code];
    if (!node) continue;
    for (const [skuCode, cost, max] of EXCHANGE) {
      const s = skuByCode[skuCode];
      if (!s) continue;
      if (await prisma.pointsExchangeSku.findFirst({ where: { node_id: node.id, sku_id: s.id, is_deleted: false } })) continue;
      ctx.count('points_exchange_skus');
      if (ctx.dry) continue;
      try { await exSvc.create({ node_id: node.id, sku_id: s.id, points_cost: cost, max_qty_per_order: max, is_active: true }, req); } catch (e) { ctx.warn(`Échange ${skuCode} (${code}) : ${e.message}`); }
    }
  }

  // ── Jeux ─────────────────────────────────────────────────────────────────
  const GAMES = [
    {
      node: 'CASA-MAARIF', name_fr: 'Roue de la chance Maârif', name_ar: 'عجلة الحظ المعاريف', game_type: 'roulette',
      unlock_condition: 'order_delivered', play_period: 'monthly', max_plays_per_user: 3, unlock_min_amount: 100,
      prizes: [
        { prize_type: 'points', name_fr: '50 points fidélité', name_ar: '50 نقطة ولاء', value: 50, probability_weight: 30, sort_order: 1 },
        { prize_type: 'coupon', name_fr: 'Coupon -10 %', name_ar: 'قسيمة تخفيض 10%', value: 10, coupon_promo_type: 'PERCENTAGE', coupon_code_prefix: 'ROUE', coupon_min_order_amount: 100, coupon_validity_days: 15, probability_weight: 20, sort_order: 2 },
        { prize_type: 'free_sku', name_fr: 'Coca-Cola canette offerte', name_ar: 'علبة كوكاكولا مجانية', sku: 'SOD-COC-CAN', probability_weight: 15, stock_limit: 50, sort_order: 3 },
        { prize_type: 'free_pack', name_fr: 'Pack petit-déjeuner offert', name_ar: 'باك الفطور مجانًا', pack: 'CASA-MAARIF:PDJ', probability_weight: 5, stock_limit: 5, sort_order: 4 },
        { prize_type: 'no_prize', name_fr: 'Perdu, retentez votre chance', name_ar: 'حظ أوفر في المرة القادمة', probability_weight: 30, sort_order: 5 },
      ],
    },
    {
      node: 'RABAT-AGDAL', name_fr: 'Carte à gratter Agdal', name_ar: 'بطاقة الخدش أكدال', game_type: 'scratch_card',
      unlock_condition: 'first_order', play_period: 'lifetime', max_plays_per_user: 1,
      prizes: [
        { prize_type: 'points', name_fr: '100 points de bienvenue', name_ar: '100 نقطة ترحيبية', value: 100, probability_weight: 25, sort_order: 1 },
        { prize_type: 'coupon', name_fr: 'Bon de 15 MAD', name_ar: 'قسيمة 15 درهم', value: 15, coupon_promo_type: 'FIXED', coupon_code_prefix: 'GRAT', coupon_min_order_amount: 80, coupon_validity_days: 30, probability_weight: 25, sort_order: 2 },
        { prize_type: 'free_sku', name_fr: 'Biscuits Tonik offerts', name_ar: 'بسكويت تونيك مجانًا', sku: 'BIS-BIM-TON', probability_weight: 20, stock_limit: 40, sort_order: 3 },
        { prize_type: 'free_pack', name_fr: 'Pack petit-déjeuner offert', name_ar: 'باك الفطور مجانًا', pack: 'RABAT-AGDAL:PDJ', probability_weight: 5, stock_limit: 3, sort_order: 4 },
        { prize_type: 'no_prize', name_fr: 'Pas gagnant cette fois', name_ar: 'لم تربح هذه المرة', probability_weight: 25, sort_order: 5 },
      ],
    },
  ];
  for (const g of GAMES) {
    const node = nodes[g.node];
    if (!node) continue;
    let game = await prisma.gamificationGame.findFirst({ where: { node_id: node.id, name_fr: g.name_fr, is_deleted: false } });
    if (!game) {
      ctx.count('gamification_games');
      ctx.count('gamification_prizes', g.prizes.length);
      if (ctx.dry) continue;
      try {
        const { prizes, node: _n, ...rest } = g;
        const res = await gameSvc.createGame(req, {
          ...rest, node_id: node.id, starts_at: daysAgo(35, 0, 0).toISOString(), ends_at: addDays(new Date(), 60).toISOString(),
          prizes: prizes.map(({ sku, pack, ...p }) => ({ ...p, ...(sku ? { sku_id: skuByCode[sku].id } : {}), ...(pack ? { pack_id: packIds[pack] } : {}) })),
        });
        game = res.game;
      } catch (e) { ctx.warn(`Jeu « ${g.name_fr} » : ${e.message}`); continue; }
    }
    if (!ctx.dry && !game.is_active) {
      try { await gameSvc.activateGame(req, game.id); } catch (e) { ctx.warn(`Activation « ${g.name_fr} » : ${e.message}`); }
    }
  }
}

module.exports = { name: 'offres', label: 'Packs, ventes flash, codes promo, échange de points, jeux', run, FLASH, PACKS, EXCHANGE };
