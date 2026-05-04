const prisma = require('../../config/database');
const response = require('../../utils/response');
const { findTableEntryBySql } = require('./p0.registry');

function prismaDelegate(modelName) {
  return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}

function getDelegate(modelName) {
  const key = prismaDelegate(modelName);
  const d = prisma[key];
  if (!d || typeof d.findMany !== 'function') return null;
  return d;
}

/** Sérialise Decimal / Date / BigInt pour JSON. */
function toPlain(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toPlain);
  if (typeof value === 'object') {
    if (typeof value.toFixed === 'function' && typeof value.toString === 'function') {
      return value.toString();
    }
    const out = {};
    for (const k of Object.keys(value)) {
      out[k] = toPlain(value[k]);
    }
    return out;
  }
  return value;
}

function resolveTable(req, res) {
  const raw = (req.params.sql || '').trim();
  if (!raw || !/^[a-zA-Z0-9_]+$/.test(raw)) {
    response.error(res, 'Identifiant de table SQL invalide', 400);
    return null;
  }
  const found = findTableEntryBySql(raw);
  if (!found) {
    response.error(res, 'Table P0 inconnue ou hors registre', 404);
    return null;
  }
  if (found.table.genericCrud === false) {
    response.error(res, 'CRUD générique désactivé pour cette table (écran dédié).', 403);
    return null;
  }
  const delegate = getDelegate(found.table.model);
  if (!delegate) {
    response.error(res, 'Modèle Prisma introuvable (exécutez prisma generate).', 503);
    return null;
  }
  return { found, delegate, sql: found.table.sql };
}

function sanitizeCreateBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {};
  }
  const data = { ...body };
  delete data.id;
  return data;
}

function sanitizeUpdateBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {};
  }
  const data = { ...body };
  delete data.id;
  return data;
}

function prismaErrMessage(err) {
  if (err.code === 'P2002') return 'Violation contrainte unique (doublon).';
  if (err.code === 'P2003') return 'Référence invalide (clé étrangère).';
  if (err.code === 'P2025') return 'Enregistrement introuvable.';
  return err.message || 'Erreur Prisma';
}

exports.list = async (req, res, next) => {
  try {
    const resolved = resolveTable(req, res);
    if (!resolved) return;

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      resolved.delegate.findMany({
        skip,
        take: limit,
        orderBy: { id: 'desc' },
      }),
      resolved.delegate.count(),
    ]);

    return response.success(res, {
      sql: resolved.sql,
      model: resolved.found.table.model,
      items: items.map(toPlain),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    });
  } catch (err) {
    if (err.code === 'P2021') {
      return response.error(res, 'Table absente en base (npx prisma db push ou script SQL).', 503);
    }
    next(err);
  }
};

exports.getOne = async (req, res, next) => {
  try {
    const resolved = resolveTable(req, res);
    if (!resolved) return;

    const id = req.params.id;
    if (!id) return response.error(res, 'Identifiant requis', 400);

    const row = await resolved.delegate.findUnique({ where: { id } });
    if (!row) return response.error(res, 'Ligne introuvable', 404);
    return response.success(res, { sql: resolved.sql, item: toPlain(row) });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const resolved = resolveTable(req, res);
    if (!resolved) return;

    const data = sanitizeCreateBody(req.body);
    const created = await resolved.delegate.create({ data });
    return response.success(res, { sql: resolved.sql, item: toPlain(created) }, 'Créé', 201);
  } catch (err) {
    if (err.code && err.code.startsWith('P')) {
      return response.error(res, prismaErrMessage(err), 400);
    }
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const resolved = resolveTable(req, res);
    if (!resolved) return;

    const id = req.params.id;
    if (!id) return response.error(res, 'Identifiant requis', 400);

    const data = sanitizeUpdateBody(req.body);
    const updated = await resolved.delegate.update({
      where: { id },
      data,
    });
    return response.success(res, { sql: resolved.sql, item: toPlain(updated) });
  } catch (err) {
    if (err.code === 'P2025') return response.error(res, 'Ligne introuvable', 404);
    if (err.code && err.code.startsWith('P')) {
      return response.error(res, prismaErrMessage(err), 400);
    }
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const resolved = resolveTable(req, res);
    if (!resolved) return;

    const id = req.params.id;
    if (!id) return response.error(res, 'Identifiant requis', 400);

    await resolved.delegate.delete({ where: { id } });
    return response.success(res, { deleted: true, id });
  } catch (err) {
    if (err.code === 'P2025') return response.error(res, 'Ligne introuvable', 404);
    if (err.code === 'P2003') {
      return response.error(res, 'Suppression impossible : d’autres lignes référencent cet enregistrement.', 409);
    }
    next(err);
  }
};
