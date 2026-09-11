const prisma = require('../../config/database');

/** Rôles opérationnels par défaut (codes du référentiel `roles`). */
const DEFAULT_ROLES = {
  picker: { name: 'Picker', name_fr: 'Préparateur (picker)', name_ar: 'محضر الطلبيات', description: 'Préparateur de commandes (application picker)' },
  driver: { name: 'Driver', name_fr: 'Livreur (driver)', name_ar: 'سائق التوصيل', description: 'Livreur (application driver)' },
};

/**
 * Retourne l'id du rôle `picker` / `driver`, en le créant (rôle système) s'il n'existe pas encore.
 * Utilisé à la création d'un picker / driver pour renseigner `role_id` par défaut.
 */
async function defaultRoleId(code, db = prisma) {
  const existing = await db.role.findUnique({ where: { code }, select: { id: true } });
  if (existing) return existing.id;
  const def = DEFAULT_ROLES[code];
  if (!def) return null;
  const created = await db.role.upsert({
    where: { code },
    update: {},
    create: { code, ...def, is_system: true, is_active: true, status: 'active' },
    select: { id: true },
  });
  return created.id;
}

const ROLE_SELECT = { select: { id: true, code: true, name: true, name_fr: true, name_ar: true } };

module.exports = { defaultRoleId, ROLE_SELECT };
