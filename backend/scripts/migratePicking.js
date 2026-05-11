/**
 * migratePicking.js — Crée les tables picking selon le schéma officiel
 * Run: node scripts/migratePicking.js
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  console.log('🔧 Migration picking...\n');

  // 1. Drop old pickers table (old structure: id SERIAL, user_id INT)
  await p.$executeRawUnsafe('DROP TABLE IF EXISTS pickers CASCADE');
  console.log('✓ Ancienne table pickers supprimée');

  // 2. Create new pickers table per spec
  await p.$executeRawUnsafe(`
    CREATE TABLE pickers (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      node_id       UUID NOT NULL REFERENCES nodes(id),
      phone_country VARCHAR(5)   NOT NULL DEFAULT '+212',
      phone_number  VARCHAR(15)  NOT NULL,
      name          VARCHAR(150) NOT NULL,
      password_hash TEXT         NOT NULL,
      is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
      is_deleted    BOOLEAN      NOT NULL DEFAULT FALSE,
      deleted_at    TIMESTAMPTZ,
      created_by    INT REFERENCES users(id),
      created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);
  // Partial unique index on phone
  await p.$executeRawUnsafe(`
    CREATE UNIQUE INDEX pickers_phone_unique
    ON pickers (phone_country, phone_number)
    WHERE is_deleted = FALSE
  `);
  console.log('✓ Nouvelle table pickers créée (UUID, phone auth)');

  // 3. Seed picking_statuses with lowercase codes (spec requirement)
  const pickingCodes = [
    { code: 'open',        name_fr: 'Ouverte',       name_ar: 'مفتوحة'     },
    { code: 'in_progress', name_fr: 'En cours',      name_ar: 'جارٍ'       },
    { code: 'completed',   name_fr: 'Terminée',      name_ar: 'مكتملة'     },
    { code: 'cancelled',   name_fr: 'Annulée',       name_ar: 'ملغاة'      },
  ];
  for (const s of pickingCodes) {
    await p.$executeRawUnsafe(
      `INSERT INTO picking_statuses (id, code, name_fr, name_ar)
       VALUES (gen_random_uuid(), $1, $2, $3)
       ON CONFLICT (code) DO UPDATE SET name_fr = EXCLUDED.name_fr`,
      s.code, s.name_fr, s.name_ar
    );
  }
  console.log('✓ picking_statuses: 4 statuts (open, in_progress, completed, cancelled)');

  // 4. Seed pick_item_statuses with spec codes
  const itemCodes = [
    { code: 'pending',      name_fr: 'En attente',    name_ar: 'في الانتظار' },
    { code: 'picked',       name_fr: 'Préparé',       name_ar: 'تم التحضير'  },
    { code: 'substituted',  name_fr: 'Substitué',     name_ar: 'مستبدل'      },
    { code: 'out_of_stock', name_fr: 'Rupture stock', name_ar: 'نفاد المخزون'},
  ];
  for (const s of itemCodes) {
    await p.$executeRawUnsafe(
      `INSERT INTO pick_item_statuses (id, code, name_fr, name_ar)
       VALUES (gen_random_uuid(), $1, $2, $3)
       ON CONFLICT (code) DO UPDATE SET name_fr = EXCLUDED.name_fr`,
      s.code, s.name_fr, s.name_ar
    );
  }
  console.log('✓ pick_item_statuses: 4 statuts (pending, picked, substituted, out_of_stock)');

  // 5. Create picking_sessions
  await p.$executeRawUnsafe('DROP TABLE IF EXISTS picking_session_items CASCADE');
  await p.$executeRawUnsafe('DROP TABLE IF EXISTS picking_sessions CASCADE');

  await p.$executeRawUnsafe(`
    CREATE TABLE picking_sessions (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id     UUID        NOT NULL REFERENCES orders(id),
      node_id      UUID        NOT NULL REFERENCES nodes(id),
      picker_id    UUID        REFERENCES pickers(id),
      status_id    UUID        NOT NULL REFERENCES picking_statuses(id),
      started_at   TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      error_count  SMALLINT    NOT NULL DEFAULT 0,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  console.log('✓ picking_sessions créée');

  // 6. Create picking_session_items
  await p.$executeRawUnsafe(`
    CREATE TABLE picking_session_items (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id    UUID           NOT NULL REFERENCES picking_sessions(id) ON DELETE CASCADE,
      order_item_id UUID           NOT NULL REFERENCES order_items(id),
      location_id   UUID           REFERENCES warehouse_locations(id),
      status_id     UUID           NOT NULL REFERENCES pick_item_statuses(id),
      qty_expected  DECIMAL(10,3)  NOT NULL,
      qty_picked    DECIMAL(10,3)  NOT NULL DEFAULT 0,
      scanned_ean   VARCHAR(13),
      picked_at     TIMESTAMPTZ
    )
  `);
  console.log('✓ picking_session_items créée');

  console.log('\n✅ Migration picking terminée!');
}

main().catch(console.error).finally(() => p.$disconnect());
