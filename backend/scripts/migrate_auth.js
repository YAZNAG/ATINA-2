const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // ── Users ──────────────────────────────────────────────────────────────────
  await p.$executeRawUnsafe("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_country VARCHAR(5) DEFAULT '+212'");
  await p.$executeRawUnsafe("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(15)");
  await p.$executeRawUnsafe("ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_code VARCHAR(10)");
  await p.$executeRawUnsafe("ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMPTZ");
  await p.$executeRawUnsafe("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ");
  await p.$executeRawUnsafe("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ");
  await p.$executeRawUnsafe("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE");
  await p.$executeRawUnsafe("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE");
  await p.$executeRawUnsafe("ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ");
  console.log('✓ users: new columns added');

  // ── Roles ──────────────────────────────────────────────────────────────────
  await p.$executeRawUnsafe("ALTER TABLE roles ADD COLUMN IF NOT EXISTS name_fr VARCHAR(100)");
  await p.$executeRawUnsafe("ALTER TABLE roles ADD COLUMN IF NOT EXISTS name_ar VARCHAR(100)");
  await p.$executeRawUnsafe("ALTER TABLE roles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE");
  await p.$executeRawUnsafe("ALTER TABLE roles ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE");
  console.log('✓ roles: new columns added');

  // ── Permissions ────────────────────────────────────────────────────────────
  await p.$executeRawUnsafe("ALTER TABLE permissions ADD COLUMN IF NOT EXISTS name_fr VARCHAR(150)");
  await p.$executeRawUnsafe("ALTER TABLE permissions ADD COLUMN IF NOT EXISTS name_ar VARCHAR(150)");
  await p.$executeRawUnsafe("ALTER TABLE permissions ADD COLUMN IF NOT EXISTS action VARCHAR(50)");
  console.log('✓ permissions: new columns added');

  // ── Profile tables ─────────────────────────────────────────────────────────
  await p.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS backoffice_admins (
      id         SERIAL PRIMARY KEY,
      user_id    INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      node_id    UUID REFERENCES nodes(id),
      created_by INT REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await p.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS pickers (
      id         SERIAL PRIMARY KEY,
      user_id    INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      node_id    UUID REFERENCES nodes(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await p.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS drivers (
      id            SERIAL PRIMARY KEY,
      user_id       INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      node_id       UUID REFERENCES nodes(id),
      vehicle_type  VARCHAR(50),
      vehicle_plate VARCHAR(20),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  console.log('✓ profile tables: backoffice_admins, pickers, drivers created');
}

main().catch(console.error).finally(() => p.$disconnect());
