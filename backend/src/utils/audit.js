const prisma = require('../config/database');

/**
 * Journal d'audit transverse (table audit_logs, APPEND-ONLY : un trigger PG
 * interdit UPDATE et DELETE).
 *
 * L'écriture ne fait jamais échouer l'action métier : une erreur d'audit est
 * seulement loguée.
 *
 * @param {import('express').Request|null} req  requête Express (utilise req.user.id, l'IP, le user-agent)
 * @param {object} entry
 * @param {string} entry.action       ex. 'CREATE', 'UPDATE', 'DELETE', 'BLOCK_USER', 'CANCEL_ORDER'
 * @param {string} entry.resource     table ou entité concernée, ex. 'customers', 'promotions'
 * @param {string|number} [entry.resource_id]
 * @param {object} [entry.old_values] état avant
 * @param {object} [entry.new_values] état après (ou motif, paramètres de l'action)
 * @param {object} [tx]               client Prisma de transaction (par défaut le client global)
 */
async function audit(req, { action, resource, resource_id = null, old_values = null, new_values = null }, tx = prisma) {
  try {
    const clean = (v) => (v == null ? undefined : JSON.parse(JSON.stringify(v)));
    const forwarded = req?.headers?.['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' && forwarded.split(',')[0].trim()) || req?.ip || null;
    await tx.auditLog.create({
      data: {
        user_id: req?.user?.id ?? null,
        action: String(action).slice(0, 50),
        resource: String(resource).slice(0, 100),
        resource_id: resource_id != null ? String(resource_id).slice(0, 100) : null,
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
