/**
 * Étape « clients » : 36 clients FICTIFS (compte app client : rôle customer, mot de passe
 * Test@2026, OTP de test 0000), 1 à 3 adresses proches de leur node, parrainages
 * (service loyalty.createReferralOnRegistration).
 */
const { FIRST_M, FIRST_F, LAST, STREETS, QUARTIER_CITY, NODES } = require('../data/people.data');
const { passwordHash, rng, slug, daysAgo } = require('../lib/util');

const PER_NODE = { 'CASA-MAARIF': 10, 'CASA-AINSEBAA': 8, 'RABAT-AGDAL': 10, 'MRK-GUELIZ': 8 };
/** Parrainages : [index filleul, index parrain] dans la liste générée. */
const REFERRALS = [[3, 0], [5, 0], [12, 10], [22, 20], [24, 21], [30, 28]];

/** Liste déterministe des clients (même résultat à chaque lancement). */
function customerList() {
  const r = rng(424242);
  const used = new Set();
  const out = [];
  let i = 0;
  for (const node of NODES) {
    for (let k = 0; k < PER_NODE[node.code]; k += 1) {
      const female = i % 2 === 1;
      let first; let last; let key;
      do {
        first = r.pick(female ? FIRST_F : FIRST_M);
        last = r.pick(LAST);
        key = `${first} ${last}`;
      } while (used.has(key));
      used.add(key);
      const streets = STREETS[node.code];
      const nAddr = 1 + (i % 3 === 0 ? 2 : i % 3 === 1 ? 1 : 0);
      const addresses = [];
      for (let a = 0; a < nAddr; a += 1) {
        const [quartier, street] = streets[(i + a * 2) % streets.length];
        addresses.push({
          label: ['Domicile', 'Travail', 'Chez mes parents'][a], quartier, street_name: street, street_number: String(r.int(2, 180)),
          city_code: QUARTIER_CITY[quartier] || node.city,
          lat: Number((node.lat + (r() - 0.5) * 0.035).toFixed(6)), lng: Number((node.lng + (r() - 0.5) * 0.035).toFixed(6)),
          notes: r.pick(['Sonner à l’interphone', '2e étage, porte gauche', 'Appeler en arrivant', 'Laisser au gardien', null, 'Immeuble en face de la pharmacie']),
        });
      }
      out.push({
        idx: i, node: node.code, name: key, first, last, female,
        phone: `600000${String(101 + i)}`,
        email: `${slug(first)}.${slug(last)}@example.com`,
        lang: r() < 0.3 ? 'ar' : 'fr',
        referral_code: `${slug(first).replace(/\./g, '').toUpperCase().slice(0, 6)}${String(101 + i)}`,
        since: 35 + r.int(0, 70),
        addresses,
      });
      i += 1;
    }
  }
  return out;
}

async function run(ctx) {
  const { prisma } = ctx;
  const list = customerList();
  const hash = await passwordHash();
  const role = await prisma.role.findFirst({ where: { code: 'customer' } });
  const cities = await ctx.byCode('city');
  const loyalty = require('../../../src/modules/loyalty/loyalty.service');
  const ids = [];

  for (const c of list) {
    let customer = await prisma.customer.findFirst({ where: { phone_country: '+212', phone_number: c.phone, is_deleted: false } });
    if (!customer) {
      ctx.count('customers');
      if (ctx.dry) { ctx.count('addresses', c.addresses.length); ids.push(null); continue; }
      const since = daysAgo(c.since, 18, 0);
      let user = await prisma.user.findFirst({ where: { email: c.email } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            full_name: c.name, email: c.email, password_hash: hash, status: 'active', is_active: true,
            phone: `+212${c.phone}`, phone_country: '+212', phone_number: c.phone, phone_verified_at: since, created_at: since,
          },
        });
        ctx.count('users');
      }
      if (role) {
        await prisma.userRole.upsert({ where: { user_id_role_id: { user_id: user.id, role_id: role.id } }, update: {}, create: { user_id: user.id, role_id: role.id } });
      }
      const home = c.addresses[0];
      const city = cities[home.city_code];
      customer = await prisma.customer.create({
        data: {
          user_id: user.id, phone_country: '+212', phone_number: c.phone, phone_verified_at: since, name: c.name,
          preferred_lang: c.lang, referral_code: c.referral_code, city_id: city?.id ?? null, city: city?.name_fr ?? null,
          lat: home.lat, lng: home.lng, is_active: true, created_at: since,
        },
      });
    }
    ids.push(customer.id);
    if (ctx.dry) continue;
    for (const [a, addr] of c.addresses.entries()) {
      const city = cities[addr.city_code];
      await ctx.ensure('address', { customer_id: customer.id, label: addr.label, is_deleted: false }, {
        customer_id: customer.id, label: addr.label, street_number: addr.street_number, street_name: addr.street_name,
        quartier: addr.quartier, city: city?.name_fr ?? 'Casablanca', city_id: city?.id ?? null, postal_code: city?.postal_code ?? null,
        lat: addr.lat, lng: addr.lng, delivery_notes: addr.notes, is_default: a === 0,
        phone: `+212${c.phone}`, recipient_name: a === 2 ? `Famille ${c.last}` : c.name,
      }, { table: 'addresses' });
    }
  }

  // Parrainages (avant toute commande du filleul : validés à sa 1re livraison)
  for (const [refereeIdx, referrerIdx] of REFERRALS) {
    const refereeId = ids[refereeIdx];
    const referrer = list[referrerIdx];
    if (ctx.dry || !refereeId) { ctx.count('referrals'); continue; }
    const already = await prisma.referral.findFirst({ where: { referee_id: refereeId } });
    if (already) continue;
    const referrerRow = await prisma.customer.findFirst({ where: { phone_country: '+212', phone_number: referrer.phone, is_deleted: false } });
    if (!referrerRow) continue;
    await loyalty.createReferralOnRegistration(refereeId, referrerRow.referral_code);
    if (await prisma.referral.findFirst({ where: { referee_id: refereeId } })) ctx.count('referrals');
    else ctx.warn(`Parrainage non créé pour ${list[refereeIdx].name} (configuration de parrainage active ?)`);
  }
}

module.exports = { name: 'clients', label: 'Clients, adresses, parrainages', run, customerList, REFERRALS };
