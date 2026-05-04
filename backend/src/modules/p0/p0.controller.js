const prisma = require('../../config/database');
const response = require('../../utils/response');
const { P0_TABLE_GROUPS, findTableEntryBySql } = require('./p0.registry');
const { EDGES, edgesForTable } = require('./p0.relations.graph');

function prismaDelegate(modelName) {
  return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}

async function safeCount(modelName) {
  const key = prismaDelegate(modelName);
  const delegate = prisma[key];
  if (!delegate || typeof delegate.count !== 'function') return { count: null, error: 'delegate_missing' };
  try {
    const count = await delegate.count();
    return { count, error: null };
  } catch (e) {
    return { count: null, error: e.message || 'count_failed' };
  }
}

function buildTablePayload(t, count, error) {
  return {
    model: t.model,
    sql: t.sql,
    labelFr: t.labelFr,
    listPath: t.listPath || null,
    listPermission: t.listPermission || null,
    listPermissionAny: t.listPermissionAny || null,
    genericCrud: t.genericCrud !== false,
    rowCount: count,
    countError: error,
  };
}

exports.registry = async (req, res, next) => {
  try {
    const groups = [];
    for (const g of P0_TABLE_GROUPS) {
      const tables = [];
      for (const t of g.tables) {
        const { count, error } = await safeCount(t.model);
        tables.push(buildTablePayload(t, count, error));
      }
      groups.push({ id: g.id, titleFr: g.titleFr, tables });
    }
    return response.success(res, {
      groups,
      generatedAt: new Date().toISOString(),
      note:
        'Tables créées dans Prisma (P0). Les compteurs utilisent prisma.<model>.count(). Si la table n’existe pas encore en base, exécutez npx prisma db push.',
    });
  } catch (err) {
    next(err);
  }
};

/** Fiche d’une table P0 (nom SQL @@map) — pour page dédiée back-office. */
exports.tableBySql = async (req, res, next) => {
  try {
    const raw = (req.params.sql || '').trim();
    if (!raw || !/^[a-zA-Z0-9_]+$/.test(raw)) {
      return response.error(res, 'Identifiant de table SQL invalide', 400);
    }
    const entry = findTableEntryBySql(raw);
    if (!entry) {
      return response.error(res, 'Table P0 inconnue ou hors registre', 404);
    }
    const { count, error } = await safeCount(entry.table.model);
    return response.success(res, {
      group: { id: entry.group.id, titleFr: entry.group.titleFr },
      table: buildTablePayload(entry.table, count, error),
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
};

/** Graphe des relations (FK documentées) entre tables P0. */
exports.relations = async (req, res, next) => {
  try {
    return response.success(res, { edges: EDGES, note: 'Arêtes orientées : fromSql → toSql via field.' });
  } catch (err) {
    next(err);
  }
};

exports.relationsForTable = async (req, res, next) => {
  try {
    const raw = (req.params.sql || '').trim();
    if (!raw || !/^[a-zA-Z0-9_]+$/.test(raw)) {
      return response.error(res, 'Identifiant SQL invalide', 400);
    }
    if (!findTableEntryBySql(raw)) {
      return response.error(res, 'Table hors registre P0', 404);
    }
    return response.success(res, { sql: raw.toLowerCase(), edges: edgesForTable(raw) });
  } catch (err) {
    next(err);
  }
};
