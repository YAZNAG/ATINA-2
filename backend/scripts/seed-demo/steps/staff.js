/**
 * Étape « staff » : 3 préparateurs et 2 à 3 livreurs par node (mot de passe Test@2026).
 */
const { passwordHash, slug } = require('../lib/util');

const STAFF = {
  'CASA-MAARIF': {
    pickers: ['Ayoub Ziani', 'Kawtar Saidi', 'Ilyas Bouzid'],
    drivers: [['Badr El Mansouri', 'Moto', '48213-A-6'], ['Soufiane Haddad', 'Scooter électrique', '51377-A-6'], ['Nabil Kettani', 'Voiture utilitaire', '20941-B-6']],
  },
  'CASA-AINSEBAA': {
    pickers: ['Hajar Moussaoui', 'Anas Belhaj', 'Siham Naciri'],
    drivers: [['Tarik Lamrani', 'Voiture utilitaire', '73120-D-6'], ['Reda Chakir', 'Moto', '66458-A-6']],
  },
  'RABAT-AGDAL': {
    pickers: ['Meryem Filali', 'Othmane Tahiri', 'Zineb Rahmouni'],
    drivers: [['Yassir Benali', 'Moto', '12870-A-1'], ['Karim Zerouali', 'Scooter électrique', '30554-B-1'], ['Hicham Hajji', 'Voiture utilitaire', '47719-D-1']],
  },
  'MRK-GUELIZ': {
    pickers: ['Asmae Ouazzani', 'Mehdi Sqalli', 'Wiam El Fassi'],
    drivers: [['Adil Mansouri', 'Moto', '85236-A-42'], ['Omar Alaoui', 'Triporteur', '90417-B-42']],
  },
};

async function run(ctx) {
  const { prisma } = ctx;
  const nodes = await ctx.nodes();
  const hash = await passwordHash();
  const [pickerRole, driverRole] = await Promise.all([
    prisma.role.findFirst({ where: { code: 'picker' } }),
    prisma.role.findFirst({ where: { code: 'driver' } }),
  ]);
  let p = 200; let d = 300;
  for (const node of nodes) {
    const cfg = STAFF[node.code];
    for (const name of cfg.pickers) {
      p += 1;
      const phone = `600000${p}`;
      await ctx.ensure('picker', { phone_number: phone, is_deleted: false }, {
        node_id: node.id, phone_country: '+212', phone_number: phone, name, password_hash: hash,
        email: `${slug(name)}@example.com`, role_id: pickerRole?.id ?? null, is_active: true,
      }, { table: 'pickers' });
    }
    for (const [name, vehicle, plate] of cfg.drivers) {
      d += 1;
      const phone = `600000${d}`;
      await ctx.ensure('driver', { phone_number: phone, is_deleted: false }, {
        node_id: node.id, phone_country: '+212', phone_number: phone, name, password_hash: hash,
        vehicle_type: vehicle, vehicle_plate: plate, role_id: driverRole?.id ?? null, is_active: true,
      }, { table: 'drivers' });
    }
  }
}

module.exports = { name: 'staff', label: 'Préparateurs et livreurs', run, STAFF };
