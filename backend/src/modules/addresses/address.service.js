const repo = require('./address.repository');
const prisma = require('../../config/database');

const customerExists = (id) =>
  prisma.customer.findFirst({ where: { id, is_deleted: false }, select: { id: true } });

class AddressService {
  async listByCustomer(customer_id) {
    if (!await customerExists(customer_id)) throw { statusCode: 404, message: 'Client introuvable' };
    return repo.findAllByCustomer(customer_id);
  }

  async create(customer_id, body) {
    if (!await customerExists(customer_id)) throw { statusCode: 404, message: 'Client introuvable' };

    const street_name = String(body.street_name || '').trim();
    if (!street_name) throw { statusCode: 400, message: 'Nom de rue requis' };

    const city = String(body.city || 'Rabat').trim();

    // If first address or explicitly requested, set as default
    const existing = await repo.findAllByCustomer(customer_id);
    const make_default = existing.length === 0 || body.is_default === true || body.is_default === 'true';

    if (make_default) {
      await prisma.address.updateMany({
        where: { customer_id, is_default: true },
        data:  { is_default: false },
      });
    }

    return repo.create({
      customer_id,
      label:          body.label        ? String(body.label).trim()         : null,
      street_number:  body.street_number ? String(body.street_number).trim() : null,
      street_name,
      quartier:       body.quartier     ? String(body.quartier).trim()      : null,
      city,
      postal_code:    body.postal_code  ? String(body.postal_code).trim()   : null,
      lat:            body.lat != null  ? body.lat                          : null,
      lng:            body.lng != null  ? body.lng                          : null,
      delivery_notes: body.delivery_notes ? String(body.delivery_notes).trim() : null,
      is_default:     make_default,
    });
  }

  async update(id, body) {
    const addr = await repo.findById(id);
    if (!addr || addr.is_deleted) throw { statusCode: 404, message: 'Adresse introuvable' };

    const data = {};
    if (body.label !== undefined)          data.label          = body.label ? String(body.label).trim() : null;
    if (body.street_number !== undefined)  data.street_number  = body.street_number ? String(body.street_number).trim() : null;
    if (body.street_name !== undefined) {
      const s = String(body.street_name || '').trim();
      if (!s) throw { statusCode: 400, message: 'Nom de rue requis' };
      data.street_name = s;
    }
    if (body.quartier !== undefined)       data.quartier       = body.quartier ? String(body.quartier).trim() : null;
    if (body.city !== undefined)           data.city           = String(body.city || 'Rabat').trim();
    if (body.postal_code !== undefined)    data.postal_code    = body.postal_code ? String(body.postal_code).trim() : null;
    if (body.lat !== undefined)            data.lat            = body.lat;
    if (body.lng !== undefined)            data.lng            = body.lng;
    if (body.delivery_notes !== undefined) data.delivery_notes = body.delivery_notes ? String(body.delivery_notes).trim() : null;

    return repo.update(id, data);
  }

  async setDefault(id) {
    const addr = await repo.findById(id);
    if (!addr || addr.is_deleted) throw { statusCode: 404, message: 'Adresse introuvable' };
    return repo.setDefault(id, addr.customer_id);
  }

  async softDelete(id) {
    const addr = await repo.findById(id);
    if (!addr) throw { statusCode: 404, message: 'Adresse introuvable' };
    if (addr.is_deleted) throw { statusCode: 400, message: 'Adresse déjà supprimée' };
    return repo.softDelete(id);
  }
}

module.exports = new AddressService();
