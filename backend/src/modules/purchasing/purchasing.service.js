/**
 * Module Achats & Fournisseurs — point d'entrée des services + référentiels (lookups)
 * utilisés par les formulaires du back-office (statuts BC, nodes, fournisseurs actifs, SKU).
 */
const prisma = require('../../config/database');
const suppliers = require('./suppliers.service');
const prices = require('./supplier_prices.service');
const orders = require('./purchase_orders.service');

async function lookups() {
  const [statuses, nodes, activeSuppliers] = await Promise.all([
    prisma.poStatus.findMany({ orderBy: { sort_order: 'asc' } }),
    prisma.node.findMany({
      where: { is_deleted: false, is_active: true },
      select: { id: true, code: true, name_fr: true, name_ar: true },
      orderBy: { name_fr: 'asc' },
    }),
    prisma.supplier.findMany({
      where: { is_deleted: false, is_active: true },
      select: { id: true, code: true, name_fr: true, name_ar: true, lead_time_days: true, payment_terms: true },
      orderBy: { name_fr: 'asc' },
    }),
  ]);
  return { statuses, nodes, suppliers: activeSuppliers };
}

/** Recherche SKU minimale (repli si l'utilisateur n'a pas skus.view pour /catalog/skus). */
async function searchSkus(query = {}) {
  const search = String(query.search || '').trim();
  const limit = Math.min(50, Math.max(1, parseInt(query.limit ?? '15', 10) || 15));
  const where = { is_deleted: false, deleted_at: null, is_active: true };
  if (search) {
    where.OR = ['sku_code', 'name_fr', 'name_ar', 'ean13'].map((f) => ({ [f]: { contains: search, mode: 'insensitive' } }));
  }
  const rows = await prisma.sku.findMany({
    where,
    select: { id: true, sku_code: true, name_fr: true, name_ar: true, ean13: true, unit_purchase: true, unit_sale: true, coeff: true },
    orderBy: { name_fr: 'asc' },
    take: limit,
  });
  return rows.map((r) => ({ ...r, coeff: Number(r.coeff ?? 1) }));
}

module.exports = { suppliers, prices, orders, lookups, searchSkus };
