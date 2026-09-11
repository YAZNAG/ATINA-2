/**
 * Contexte partagé entre les étapes : client Prisma, mode dry-run, compteurs,
 * helpers d'upsert idempotents et chargeurs de référentiels.
 */
const { fakeReq } = require('./util');

const ADMIN_EMAIL = 'admin@darkstore.local';

function createCtx(prisma, { dry = false } = {}) {
  const ctx = {
    prisma,
    dry,
    created: {},   // table → lignes créées par CE lancement
    planned: {},   // dry-run : table → lignes qui seraient créées
    notes: [],     // avertissements / éléments non générés
    step: null,
  };

  ctx.count = (table, n = 1) => {
    const bucket = ctx.dry ? ctx.planned : ctx.created;
    bucket[table] = (bucket[table] || 0) + n;
  };

  ctx.log = (msg) => console.log(`  [${ctx.step}] ${msg}`);
  ctx.warn = (msg) => {
    console.warn(`  [${ctx.step}] ⚠ ${msg}`);
    ctx.notes.push(`[${ctx.step}] ${msg}`);
  };

  /**
   * Idempotent : cherche `where` ; crée `data` si absent (ou compte en dry-run) ;
   * met à jour avec `update` si fourni et présent.
   */
  ctx.ensure = async (model, where, data, { update = null, table = model } = {}) => {
    const found = await prisma[model].findFirst({ where });
    if (found) {
      if (update && !ctx.dry) return prisma[model].update({ where: { id: found.id }, data: update });
      return found;
    }
    ctx.count(table);
    if (ctx.dry) return null;
    return prisma[model].create({ data });
  };

  ctx.admin = async () => {
    if (ctx._admin) return ctx._admin;
    const u = await prisma.user.findFirst({ where: { email: ADMIN_EMAIL } });
    if (u) ctx._admin = u;
    return u;
  };

  ctx.req = async () => {
    const a = await ctx.admin();
    if (!a) throw new Error(`Compte ${ADMIN_EMAIL} introuvable : lancez d'abord l'étape « acces »`);
    return fakeReq(a.id);
  };

  // ── Chargeurs ────────────────────────────────────────────────────────────
  ctx.byCode = async (model, where = {}) => {
    const rows = await prisma[model].findMany({ where });
    return Object.fromEntries(rows.map((r) => [r.code, r]));
  };
  ctx.nodes = async () => {
    const { NODES } = require('../data/people.data');
    const rows = await prisma.node.findMany({ where: { code: { in: NODES.map((n) => n.code) }, is_deleted: false } });
    const map = Object.fromEntries(rows.map((r) => [r.code, r]));
    return NODES.filter((n) => map[n.code]).map((n) => ({ ...n, row: map[n.code], id: map[n.code].id }));
  };
  ctx.skus = async () => {
    const { SKUS } = require('../data/catalog.data');
    const rows = await prisma.sku.findMany({ where: { sku_code: { in: SKUS.map((s) => s.code) } } });
    const map = Object.fromEntries(rows.map((r) => [r.sku_code, r]));
    return SKUS.filter((s) => map[s.code]).map((s) => ({ ...s, row: map[s.code], id: map[s.code].id }));
  };

  return ctx;
}

module.exports = { createCtx, ADMIN_EMAIL };
