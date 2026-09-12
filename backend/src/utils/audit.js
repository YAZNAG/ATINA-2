const prisma = require('../config/database');

/**
 * Journal d'audit transverse (table audit_logs, APPEND-ONLY : un trigger PG
 * interdit UPDATE et DELETE).
 *
 * Depuis le classeur du 12-09-2026, l'action et l'entité sont des références
 * (audit_actions / audit_resources) qui portent les libellés FR et AR affichés
 * dans le journal. Les appelants continuent de passer des codes : la résolution
 * est faite ici, avec un cache mémoire.
 *
 * L'écriture ne fait jamais échouer l'action métier : une erreur d'audit est
 * seulement loguée.
 *
 * @param {import('express').Request|null} req  requête Express (utilise req.user.id, l'IP, le user-agent)
 * @param {object} entry
 * @param {string} entry.action       code d'action, ex. 'CREATE', 'CANCEL_ORDER'
 * @param {string} entry.resource     code d'entité, ex. 'customers', 'promotions'
 * @param {string|number} [entry.resource_id] identifiant de l'enregistrement (alias de target_id)
 * @param {string|number} [entry.target_id]   identifiant de l'enregistrement
 * @param {object} [entry.old_values] état avant
 * @param {object} [entry.new_values] état après (ou motif, paramètres de l'action)
 * @param {object} [tx]               client Prisma de transaction (par défaut le client global)
 */

const actionCache = new Map();
const resourceCache = new Map();

/** Résout un code en id, en créant la ligne de référentiel si elle manque. */
async function refId(cache, delegate, code, label) {
  const key = String(code).slice(0, 50);
  if (cache.has(key)) return cache.get(key);
  let row = await delegate.findUnique({ where: { code: key }, select: { id: true } });
  if (!row) {
    // Un nouveau code apparaît avec un écran : on l'enregistre plutôt que de
    // perdre l'événement. Les libellés propres arrivent par migration.
    row = await delegate.create({
      data: { code: key, name_fr: label || key, name_ar: label || key },
      select: { id: true },
    });
  }
  cache.set(key, row.id);
  return row.id;
}

async function audit(
  req,
  { action, resource, resource_id = null, target_id = null, old_values = null, new_values = null },
  tx = prisma,
) {
  try {
    const clean = (v) => (v == null ? undefined : JSON.parse(JSON.stringify(v)));
    const forwarded = req?.headers?.['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' && forwarded.split(',')[0].trim()) || req?.ip || null;
    // Les référentiels vivent hors transaction : une transaction annulée ne doit
    // pas retirer un code de référentiel déjà utilisé ailleurs.
    const [action_id, resourceRefId] = await Promise.all([
      refId(actionCache, prisma.auditAction, action),
      refId(resourceCache, prisma.auditResource, resource),
    ]);
    const target = target_id ?? resource_id;
    await tx.auditLog.create({
      data: {
        user_id: req?.user?.id ?? null,
        action_id,
        resource_id: resourceRefId,
        target_id: target != null ? String(target).slice(0, 100) : null,
        old_values: clean(old_values),
        new_values: clean(new_values),
        ip: ip ? String(ip).slice(0, 64) : null,
        user_agent: req?.headers?.['user-agent'] ?? null,
      },
    });
  } catch (err) {
    console.error('[audit] écriture impossible :', err.message);
  }
}

module.exports = { audit };
