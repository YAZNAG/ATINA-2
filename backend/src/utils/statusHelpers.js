const prisma = require('../config/database');

const getOrderStatusId = async (code) => {
  const s = await prisma.orderStatus.findFirst({ where: { code } });
  if (!s) throw { statusCode: 500, message: `Statut commande "${code}" introuvable — veuillez exécuter le seed` };
  return s.id;
};

const getPickingStatusId = async (code) => {
  const s = await prisma.pickingStatus.findFirst({ where: { code } });
  if (!s) throw { statusCode: 500, message: `Statut session picking "${code}" introuvable — veuillez exécuter le seed` };
  return s.id;
};

const getPickItemStatusId = async (code) => {
  const s = await prisma.pickItemStatus.findFirst({ where: { code } });
  if (!s) throw { statusCode: 500, message: `Statut item picking "${code}" introuvable — veuillez exécuter le seed` };
  return s.id;
};

const getOrderItemStatusId = async (code) => {
  const s = await prisma.orderItemStatus.findFirst({ where: { code } });
  if (!s) throw { statusCode: 500, message: `Statut item commande "${code}" introuvable — veuillez exécuter le seed` };
  return s.id;
};

module.exports = {
  getOrderStatusId,
  getPickingStatusId,
  getPickItemStatusId,
  getOrderItemStatusId,
};
