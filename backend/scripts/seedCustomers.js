const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const p = new PrismaClient();

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genCode() {
  const b = crypto.randomBytes(12);
  let c = '';
  for (let i = 0; i < 10; i++) c += CHARS[b[i] % CHARS.length];
  return c;
}

const CUSTOMERS = [
  { name: 'Yassine Benali',      phone: '0612345678', lang: 'fr', city: 'Rabat',        wallet: 150.00, points: 320,  active: true,  verified: true  },
  { name: 'Fatima Zahra Idrissi',phone: '0623456789', lang: 'ar', city: 'Casablanca',   wallet: 0.00,   points: 0,    active: true,  verified: false },
  { name: 'Mehdi Alaoui',        phone: '0634567890', lang: 'fr', city: 'Marrakech',    wallet: 75.50,  points: 150,  active: true,  verified: true  },
  { name: 'Sanae Moussaoui',     phone: '0645678901', lang: 'fr', city: 'Fès',          wallet: 200.00, points: 500,  active: true,  verified: true  },
  { name: 'Omar Benkhalil',      phone: '0656789012', lang: 'ar', city: 'Agadir',       wallet: 0.00,   points: 80,   active: false, verified: true  },
  { name: 'Hajar Tazi',          phone: '0667890123', lang: 'fr', city: 'Rabat',        wallet: 50.00,  points: 100,  active: true,  verified: true  },
  { name: 'Karim Mansouri',      phone: '0678901234', lang: 'fr', city: 'Casablanca',   wallet: 0.00,   points: 0,    active: true,  verified: false },
  { name: 'Nadia Berraho',       phone: '0689012345', lang: 'ar', city: 'Tétouan',      wallet: 300.00, points: 750,  active: true,  verified: true  },
  { name: 'Rachid Lamrani',      phone: '0690123456', lang: 'fr', city: 'Oujda',        wallet: 25.00,  points: 60,   active: true,  verified: true  },
  { name: 'Meryem Chraibi',      phone: '0601234567', lang: 'fr', city: 'Rabat',        wallet: 0.00,   points: 200,  active: true,  verified: true  },
  { name: 'Anas Saidi',          phone: '0611111111', lang: 'ar', city: 'Casablanca',   wallet: 80.00,  points: 180,  active: true,  verified: true  },
  { name: 'Khadija El Fassi',    phone: '0622222222', lang: 'ar', city: 'Fès',          wallet: 0.00,   points: 0,    active: true,  verified: false },
  { name: 'Hamza Benchekroun',   phone: '0633333333', lang: 'fr', city: 'Casablanca',   wallet: 500.00, points: 1200, active: true,  verified: true  },
  { name: 'Loubna Amrani',       phone: '0644444444', lang: 'fr', city: 'Rabat',        wallet: 0.00,   points: 40,   active: false, verified: true  },
  { name: 'Youssef El Habti',    phone: '0655555555', lang: 'ar', city: 'Marrakech',    wallet: 120.00, points: 280,  active: true,  verified: true  },
];

const ADDRESSES = {
  'Rabat': [
    { label: 'Maison',  street_number: '14', street_name: 'Rue Ibn Battouta',   quartier: 'Agdal',    city: 'Rabat',      postal_code: '10090', delivery_notes: '3ème étage, sonner 2 fois' },
    { label: 'Bureau',  street_number: '3',  street_name: 'Avenue Hassan II',    quartier: 'Centre',   city: 'Rabat',      postal_code: '10000', delivery_notes: null },
  ],
  'Casablanca': [
    { label: 'Maison',  street_number: '21', street_name: 'Rue Zerktouni',       quartier: 'Maarif',   city: 'Casablanca', postal_code: '20100', delivery_notes: 'Portail vert' },
    { label: 'Bureau',  street_number: '7',  street_name: 'Boulevard Anfa',      quartier: 'Anfa',     city: 'Casablanca', postal_code: '20000', delivery_notes: null },
  ],
  'Marrakech': [
    { label: 'Maison',  street_number: '5',  street_name: 'Avenue Mohammed VI',  quartier: 'Gueliz',   city: 'Marrakech',  postal_code: '40000', delivery_notes: null },
  ],
  'Fès': [
    { label: 'Maison',  street_number: '11', street_name: 'Rue Karaouiyine',     quartier: 'Médina',   city: 'Fès',        postal_code: '30000', delivery_notes: 'Pas de numéro visible, demander Ait Omar' },
  ],
  'Agadir': [
    { label: 'Maison',  street_number: '2',  street_name: 'Avenue du Prince Héritier', quartier: null, city: 'Agadir',     postal_code: '80000', delivery_notes: null },
  ],
};

const DEFAULT_ADDRESSES = {
  'Tétouan': [{ label: 'Maison', street_number: '8',  street_name: 'Rue Moulay Rachid', quartier: 'Centre', city: 'Tétouan',    postal_code: '93000', delivery_notes: null }],
  'Oujda':   [{ label: 'Maison', street_number: '17', street_name: 'Boulevard Zerktouni', quartier: null,  city: 'Oujda',      postal_code: '60000', delivery_notes: null }],
};

async function main() {
  console.log('🌱 Seeding customers...\n');

  const usedCodes = new Set();
  const created = [];

  for (const cust of CUSTOMERS) {
    // Check if customer already exists by phone
    const existing = await p.customer.findFirst({ where: { phone_number: cust.phone.replace(/^0/, ''), is_deleted: false } });
    if (existing) { console.log(`  ⏭  ${cust.name} already exists`); created.push(existing); continue; }

    let code;
    do { code = genCode(); } while (usedCodes.has(code));
    usedCodes.add(code);

    const row = await p.customer.create({
      data: {
        phone_country:    '+212',
        phone_number:     cust.phone.replace(/^0/, ''),
        name:             cust.name,
        preferred_lang:   cust.lang,
        referral_code:    code,
        wallet_balance:   cust.wallet,
        points_balance:   cust.points,
        points_lifetime:  cust.points,
        city:             cust.city,
        is_active:        cust.active,
        is_deleted:       false,
        phone_verified_at: cust.verified ? new Date(Date.now() - Math.random() * 30 * 86400000) : null,
      },
    });

    console.log(`  ✓ ${cust.name} (${code})`);
    created.push(row);
  }

  console.log(`\n✅ ${created.length} clients traités\n`);

  // Seed addresses
  console.log('🏠 Seeding addresses...\n');
  let addrCount = 0;

  for (const cust of created) {
    const existingAddrs = await p.address.count({ where: { customer_id: cust.id } });
    if (existingAddrs > 0) { console.log(`  ⏭  Addresses already exist for ${cust.name}`); continue; }

    const allAddrs = ADDRESSES[cust.city] ?? DEFAULT_ADDRESSES[cust.city] ?? [
      { label: 'Maison', street_number: '1', street_name: 'Rue Principale', quartier: null, city: cust.city ?? 'Rabat', postal_code: null, delivery_notes: null },
    ];

    for (let i = 0; i < allAddrs.length; i++) {
      await p.address.create({
        data: {
          customer_id:    cust.id,
          label:          allAddrs[i].label,
          street_number:  allAddrs[i].street_number,
          street_name:    allAddrs[i].street_name,
          quartier:       allAddrs[i].quartier,
          city:           allAddrs[i].city,
          postal_code:    allAddrs[i].postal_code,
          delivery_notes: allAddrs[i].delivery_notes,
          is_default:     i === 0,
        },
      });
      addrCount++;
    }
    console.log(`  ✓ ${cust.name}: ${allAddrs.length} adresse(s)`);
  }

  console.log(`\n✅ ${addrCount} adresses créées`);
  console.log('\n🎉 Seed customers terminé!\n');
}

main().catch(console.error).finally(() => p.$disconnect());
