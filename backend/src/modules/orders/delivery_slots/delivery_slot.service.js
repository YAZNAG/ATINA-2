const prisma = require('../../../config/database');
const repo = require('./delivery_slot.repository');
const { audit } = require('../../../utils/audit');
const { enrichSlotsCapacity } = require('../../orders_mgmt/order_lifecycle');

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const toDate = (d) => new Date(`${d}T00:00:00.000Z`);
const normTime = (t) => {
  const m = String(t ?? '').trim().match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
};
const cleanName = (v) => (v == null ? null : String(v).trim().slice(0, 100) || null);

function validateRange(start, end) {
  if (!TIME_RE.test(start)) throw { statusCode: 400, message: `Heure de début invalide (${start || 'vide'}) — format HH:MM` };
  if (!TIME_RE.test(end))   throw { statusCode: 400, message: `Heure de fin invalide (${end || 'vide'}) — format HH:MM` };
  if (start >= end) throw { statusCode: 400, message: `La fin du créneau (${end}) doit être après le début (${start})` };
}

function validateCapacity(v) {
  const n = Number(v);
  if (v === undefined || v === null || v === '' || !Number.isInteger(n) || n < 0) {
    throw { statusCode: 400, message: 'Capacité max (nombre de commandes) invalide : entier ≥ 0 requis' };
  }
  return n;
}

class DeliverySlotService {
  /** Liste enrichie : nb de réservations, places restantes, préférences client (lecture seule). */
  async getAll(params) {
    const { data, total } = await repo.findAll(params);
    const enriched = await enrichSlotsCapacity(data);
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 100;
    if (params.all === 'true') return { data: enriched };
    return { data: enriched, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async getById(id) {
    const item = await repo.findById(id);
    if (!item) throw { statusCode: 404, message: 'Créneau introuvable' };
    const [enriched] = await enrichSlotsCapacity([item]);
    const [preferences, orders] = await Promise.all([repo.findPreferences(id), repo.findConfirmedOrders(id)]);
    return { ...enriched, preferences_list: preferences, confirmed_orders: orders };
  }

  async create(data, req = null) {
    const { node_id, specific_date, max_orders, is_active } = data;
    if (!node_id) throw { statusCode: 400, message: 'Nœud requis' };
    if (!DATE_RE.test(String(specific_date || ''))) throw { statusCode: 400, message: 'Date requise (AAAA-MM-JJ)' };
    const slot_start = normTime(data.slot_start);
    const slot_end = normTime(data.slot_end);
    validateRange(slot_start, slot_end);
    const cap = validateCapacity(max_orders);
    const node = await prisma.node.findFirst({ where: { id: node_id, is_deleted: false } });
    if (!node) throw { statusCode: 404, message: 'Nœud introuvable' };

    const date = toDate(specific_date);
    if (await repo.findDuplicate(node_id, date, slot_start, slot_end)) {
      throw { statusCode: 409, message: `Un créneau ${slot_start}–${slot_end} existe déjà le ${specific_date} pour ce nœud` };
    }
    const slot = await repo.create({
      node_id, specific_date: date, slot_start, slot_end, max_orders: cap,
      name_fr: cleanName(data.name_fr), name_ar: cleanName(data.name_ar),
      is_active: is_active !== false && is_active !== 'false',
    });
    await audit(req, { action: 'CREATE', resource: 'delivery_slots', resource_id: slot.id, new_values: slot });
    return slot;
  }

  /**
   * Ouverture en masse (WF #24) : dates × plages. Les doublons existants sont
   * ignorés (UNIQUE node × date × début × fin) et signalés dans la réponse.
   * body = { node_id, dates: [...], ranges: [{ slot_start, slot_end, max_orders, name_fr?, name_ar? }] }
   */
  async bulkCreate({ node_id, dates = [], ranges = [] } = {}, req = null) {
    if (!node_id) throw { statusCode: 400, message: 'Nœud requis' };
    const node = await prisma.node.findFirst({ where: { id: node_id, is_deleted: false } });
    if (!node) throw { statusCode: 404, message: 'Nœud introuvable' };
    const uniqDates = [...new Set((dates || []).map(String))];
    if (!uniqDates.length) throw { statusCode: 400, message: 'Sélectionnez au moins une date' };
    if (uniqDates.some((d) => !DATE_RE.test(d))) throw { statusCode: 400, message: 'Date invalide (AAAA-MM-JJ)' };
    if (!Array.isArray(ranges) || !ranges.length) throw { statusCode: 400, message: 'Définissez au moins une plage horaire' };
    if (uniqDates.length * ranges.length > 500) throw { statusCode: 400, message: 'Trop de créneaux en une fois (500 max)' };

    const cleanRanges = ranges.map((r, i) => {
      const s = normTime(r.slot_start);
      const e = normTime(r.slot_end);
      try { validateRange(s, e); } catch (err) { throw { statusCode: 400, message: `Plage ${i + 1} : ${err.message}` }; }
      return { slot_start: s, slot_end: e, max_orders: validateCapacity(r.max_orders), name_fr: cleanName(r.name_fr), name_ar: cleanName(r.name_ar) };
    });
    const keys = cleanRanges.map((r) => `${r.slot_start}-${r.slot_end}`);
    if (new Set(keys).size !== keys.length) throw { statusCode: 400, message: 'Deux plages identiques ont été saisies' };

    const created = [];
    const skipped = [];
    await prisma.$transaction(async (tx) => {
      for (const d of uniqDates) {
        for (const r of cleanRanges) {
          const date = toDate(d);
          if (await repo.findDuplicate(node_id, date, r.slot_start, r.slot_end, null, tx)) {
            skipped.push({ date: d, slot_start: r.slot_start, slot_end: r.slot_end });
            continue;
          }
          created.push(await repo.create({ node_id, specific_date: date, ...r, is_active: true }, tx));
        }
      }
      if (created.length) {
        await audit(req, {
          action: 'CREATE', resource: 'delivery_slots', resource_id: node_id,
          new_values: { node_id, dates: uniqDates, ranges: cleanRanges, created: created.length, skipped: skipped.length },
        }, tx);
      }
    });
    return { created: created.length, skipped, slots: created };
  }

  async update(id, data, req = null) {
    const slot = await repo.findById(id);
    if (!slot) throw { statusCode: 404, message: 'Créneau introuvable' };
    const p = {};
    if (data.specific_date !== undefined) {
      if (!DATE_RE.test(String(data.specific_date))) throw { statusCode: 400, message: 'Date invalide (AAAA-MM-JJ)' };
      p.specific_date = toDate(data.specific_date);
    }
    if (data.slot_start !== undefined) p.slot_start = normTime(data.slot_start);
    if (data.slot_end !== undefined)   p.slot_end   = normTime(data.slot_end);
    if (p.slot_start !== undefined || p.slot_end !== undefined) validateRange(p.slot_start ?? slot.slot_start, p.slot_end ?? slot.slot_end);
    if (data.max_orders !== undefined) p.max_orders = validateCapacity(data.max_orders);
    if (data.is_active !== undefined)  p.is_active  = data.is_active === true || data.is_active === 'true';
    if (data.name_fr !== undefined)    p.name_fr = cleanName(data.name_fr);
    if (data.name_ar !== undefined)    p.name_ar = cleanName(data.name_ar);

    if (p.specific_date || p.slot_start || p.slot_end) {
      const dup = await repo.findDuplicate(slot.node_id, p.specific_date ?? slot.specific_date, p.slot_start ?? slot.slot_start, p.slot_end ?? slot.slot_end, id);
      if (dup) throw { statusCode: 409, message: 'Un créneau identique (même date et même plage) existe déjà pour ce nœud' };
    }
    const updated = await repo.update(id, p);
    const old = {};
    for (const k of Object.keys(p)) old[k] = slot[k];
    const onlyToggle = p.is_active !== undefined && Object.keys(p).length === 1;
    await audit(req, {
      action: onlyToggle ? (p.is_active ? 'ACTIVATE' : 'DEACTIVATE') : 'UPDATE',
      resource: 'delivery_slots', resource_id: id, old_values: old, new_values: p,
    });
    const [enriched] = await enrichSlotsCapacity([updated]);
    return enriched;
  }

  /**
   * « Supprimer » un créneau = le RETIRER : is_active = false (classeur : « retrait =
   * is_active=false »). Jamais de suppression physique : les commandes et préférences
   * qui le référencent restent intactes ; le créneau n'est simplement plus proposé.
   */
  async delete(id, req = null) {
    const slot = await repo.findById(id);
    if (!slot) throw { statusCode: 404, message: 'Créneau introuvable' };
    const used = await repo.countUsage(id);
    if (!slot.is_active) {
      return { slot, already_inactive: true, usage: used, message: 'Ce créneau est déjà désactivé.' };
    }
    const updated = await repo.update(id, { is_active: false });
    await audit(req, {
      action: 'DEACTIVATE', resource: 'delivery_slots', resource_id: id,
      old_values: { is_active: true }, new_values: { is_active: false, retrait: true, usage: used },
    });
    const [enriched] = await enrichSlotsCapacity([updated]);
    return {
      slot: enriched,
      already_inactive: false,
      usage: used,
      message: used > 0
        ? `Créneau désactivé : il n'est plus proposé. ${used} commande(s)/préférence(s) qui y sont liées sont conservées.`
        : "Créneau désactivé : il n'est plus proposé (aucune suppression physique).",
    };
  }
}

module.exports = new DeliverySlotService();
