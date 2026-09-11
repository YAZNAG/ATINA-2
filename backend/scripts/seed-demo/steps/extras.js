/**
 * Étape « extras » : FAQ, avis produits, favoris, réclamations et conversations support
 * (modules de relation client, sans impact stock / points).
 */
const { rng, seedOf, addMinutes } = require('../lib/util');

const FAQ = [
  ['Commandes & livraison', 'truck', [
    ['En combien de temps suis-je livré ?', 'La plupart des commandes sont livrées en 20 à 40 minutes après confirmation, ou sur le créneau que vous avez choisi.'],
    ['Quels sont les frais de livraison ?', 'Les frais dépendent de votre dark store (10 à 20 MAD). La livraison est offerte à partir de 300 MAD d’achats.'],
    ['Puis-je retirer ma commande en magasin ?', 'Oui : choisissez « Retrait en magasin » à la validation, vous serez notifié dès que la commande est prête.'],
  ]],
  ['Paiement', 'credit-card', [
    ['Quels moyens de paiement acceptez-vous ?', 'Le paiement à la livraison (espèces) est disponible partout. Le paiement par carte arrive prochainement.'],
    ['Le livreur a-t-il la monnaie ?', 'Nos livreurs disposent d’un fonds de caisse, mais préparez si possible l’appoint.'],
  ]],
  ['Fidélité & jeux', 'gift', [
    ['Comment gagner des points ?', '1 point pour 10 MAD dépensés, 50 points à votre première commande livrée, et des bonus sur certaines catégories.'],
    ['Comment utiliser mes points ?', 'Échangez vos points contre des produits sélectionnés dans l’onglet « Échanger mes points ».'],
    ['Comment fonctionne le parrainage ?', 'Partagez votre code : votre filleul reçoit un bon de 20 MAD et vous gagnez 100 points à sa première commande livrée.'],
  ]],
];

const REVIEWS = [
  [5, 'Produit frais et bien emballé, livraison rapide.'], [4, 'Bon rapport qualité-prix, je recommande.'],
  [5, 'Toujours disponible, parfait pour le quotidien.'], [3, 'Correct, mais l’emballage était un peu abîmé.'],
  [4, 'Livré en 25 minutes, très pratique.'], [2, 'Date de péremption un peu courte à la livraison.'],
  [5, 'Excellent, comme au souk !'], [4, 'Conforme à la description.'],
];

async function run(ctx) {
  const { prisma } = ctx;
  const r = rng(seedOf('extras'));

  // FAQ
  for (const [ci, [name, icon, items]] of FAQ.entries()) {
    const cat = await ctx.ensure('faqCategory', { name_fr: name, is_deleted: false }, { name_fr: name, icon, sort_order: ci + 1, is_active: true }, { table: 'faq_categories' });
    if (!cat) { ctx.count('faq_items', items.length); continue; }
    for (const [ii, [q, a]] of items.entries()) {
      await ctx.ensure('faqItem', { category_id: cat.id, question_fr: q, is_deleted: false }, { category_id: cat.id, question_fr: q, answer_fr: a, sort_order: ii + 1, is_active: true }, { table: 'faq_items' });
    }
  }
  if (ctx.dry) return;

  // Avis, favoris, réclamations, support : à partir des commandes livrées de démonstration
  const delivered = await prisma.order.findMany({
    where: { notes: { startsWith: '[DEMO:' }, status: { code: 'delivered' } },
    include: { items: { where: { sku_id: { not: null }, parent_item_id: null } }, customer: { select: { id: true, phone_number: true } } },
    orderBy: { created_at: 'asc' },
  });
  let reviews = 0;
  for (const [i, o] of delivered.entries()) {
    const line = o.items[i % Math.max(1, o.items.length)];
    if (!line) continue;
    const exists = await prisma.articleReview.findUnique({ where: { sku_id_customer_id: { sku_id: line.sku_id, customer_id: o.customer_id } } });
    if (!exists && i % 3 !== 2) {
      const [rating, comment] = REVIEWS[i % REVIEWS.length];
      await prisma.articleReview.create({ data: { customer_id: o.customer_id, sku_id: line.sku_id, rating, comment, created_at: addMinutes(o.created_at, 60 * 26) } });
      reviews += 1;
    }
    const w = o.items[(i + 1) % Math.max(1, o.items.length)];
    if (w && i % 2 === 0) {
      const had = await prisma.wishlist.findUnique({ where: { customer_id_sku_id: { customer_id: o.customer_id, sku_id: w.sku_id } } });
      if (!had) { await prisma.wishlist.create({ data: { customer_id: o.customer_id, sku_id: w.sku_id } }); ctx.count('wishlists'); }
    }
  }
  ctx.count('article_reviews', reviews);

  const CLAIMS = [
    ['MISSING_PRODUCT', 'OPEN', 'NORMAL', 'Il manquait une bouteille d’eau dans ma commande.'],
    ['DAMAGED_PRODUCT', 'IN_PROGRESS', 'URGENT', 'Les œufs sont arrivés cassés.', 'Remboursement de l’article en cours.'],
    ['WRONG_PRODUCT', 'RESOLVED', 'NORMAL', 'J’ai reçu du lait entier au lieu de demi-écrémé.', 'Produit échangé lors de la commande suivante.'],
    ['DELIVERY_ISSUE', 'CLOSED', 'NORMAL', 'Livraison arrivée avec 40 minutes de retard.', 'Geste commercial de 150 points accordé.'],
  ];
  for (const [i, [type, status, priority, description, note]] of CLAIMS.entries()) {
    const o = delivered[(i * 5 + 2) % Math.max(1, delivered.length)];
    if (!o) break;
    if (await prisma.claim.findFirst({ where: { order_id: o.id, type } })) continue;
    await prisma.claim.create({
      data: {
        customer_id: o.customer_id, order_id: o.id, type, status, priority, description, admin_note: note || null,
        contact_phone: `+212${o.customer.phone_number}`, created_at: addMinutes(o.created_at, 180),
        resolved_at: ['RESOLVED', 'CLOSED'].includes(status) ? addMinutes(o.created_at, 60 * 30) : null,
      },
    });
    ctx.count('claims');
  }

  const CONVS = [
    ['ORDER', 'OPEN', 'Où en est ma commande ?', ['Bonjour, ma commande n’est pas encore arrivée.', 'Bonjour, votre livreur est en route, arrivée prévue dans 10 minutes.']],
    ['LOYALTY', 'RESOLVED', 'Points non crédités', ['Mes points de la dernière commande n’apparaissent pas.', 'Les points sont crédités à la livraison : c’est désormais visible dans votre historique.']],
    ['PRODUCT', 'PENDING', 'Disponibilité des couches taille 4', ['Quand les couches Pampers taille 4 seront-elles de retour ?', null]],
  ];
  for (const [i, [category, status, subject, msgs]] of CONVS.entries()) {
    const o = delivered[(i * 7 + 1) % Math.max(1, delivered.length)];
    if (!o) break;
    if (await prisma.supportConversation.findFirst({ where: { customer_id: o.customer_id, subject } })) continue;
    const t0 = addMinutes(o.created_at, 30 + r.int(0, 60));
    const conv = await prisma.supportConversation.create({ data: { customer_id: o.customer_id, order_id: category === 'ORDER' ? o.id : null, subject, category, status, last_message_at: t0, created_at: t0 } });
    ctx.count('support_conversations');
    const admin = await ctx.admin();
    for (const [j, content] of msgs.entries()) {
      if (!content) continue;
      await prisma.supportMessage.create({ data: { conversation_id: conv.id, sender_type: j === 0 ? 'CUSTOMER' : 'AGENT', sender_id: j === 0 ? o.customer_id : String(admin?.id ?? ''), content, created_at: addMinutes(t0, j * 4) } });
      ctx.count('support_messages');
    }
  }
}

module.exports = { name: 'extras', label: 'FAQ, avis, favoris, réclamations, support', run };
