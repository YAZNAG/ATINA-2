const prisma = require('../../../config/database');

const SELECT = { id: true, node_id: true, phone_country: true, phone_number: true, name: true, vehicle_type: true, vehicle_plate: true, is_active: true, is_deleted: true, deleted_at: true, created_by: true, created_at: true, updated_at: true, node: { select: { id: true, code: true, name_fr: true } } };

const buildWhere = ({ node_id, is_active, vehicle_type, search } = {}) => {
  const w = { is_deleted: false };
  if (node_id)      w.node_id      = node_id;
  if (vehicle_type) w.vehicle_type = vehicle_type;
  if (is_active !== undefined && is_active !== '') w.is_active = is_active === 'true' || is_active === true;
  if (search?.trim()) w.OR = [{ name: { contains: search, mode: 'insensitive' } }, { phone_number: { contains: search } }, { vehicle_plate: { contains: search, mode: 'insensitive' } }];
  return w;
};

const findAll = async ({ page = 1, limit = 25, ...filters } = {}) => {
  const where = buildWhere(filters);
  const [data, total] = await Promise.all([
    prisma.driver.findMany({ where, select: SELECT, orderBy: { created_at: 'desc' }, skip: (page-1)*limit, take: limit }),
    prisma.driver.count({ where }),
  ]);
  return { data, total };
};

const findById    = (id) => prisma.driver.findUnique({ where: { id }, select: { ...SELECT, password_hash: true } });
const findByPhone = (phone_country, phone_number) =>
  prisma.driver.findFirst({ where: { phone_country, phone_number, is_deleted: false }, select: { ...SELECT, password_hash: true } });

const create     = (data) => prisma.driver.create({ data, select: SELECT });
const update     = (id, data) => prisma.driver.update({ where: { id }, data, select: SELECT });
const softDelete = (id) => prisma.driver.update({ where: { id }, data: { is_deleted: true, is_active: false, deleted_at: new Date() }, select: SELECT });

// Stats placeholder — tours not yet linked to drivers, returns empty stats ready for future
const findStats  = async (id) => ({
  total_tours:      0,
  completed_tours:  0,
  total_deliveries: 0,
  cod_collected:    '0.00',
  avg_tour_duration_min: 0,
  note: 'Les tournées seront liées au module Livraison',
});

// Vehicle type distribution across all drivers
const countByVehicleType = async () => {
  const rows = await prisma.driver.groupBy({
    by: ['vehicle_type'],
    where: { is_deleted: false, is_active: true },
    _count: { id: true },
  });
  return rows.map(r => ({ vehicle_type: r.vehicle_type ?? 'Non défini', count: r._count.id }));
};

module.exports = { findAll, findById, findByPhone, create, update, softDelete, findStats, countByVehicleType };
