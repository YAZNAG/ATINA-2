const jwt     = require('jsonwebtoken');
const prisma  = require('../config/database');
const { JWT_SECRET } = require('../config/jwt');

// ── requirePickerAuth ─────────────────────────────────────────────────────────
// Vérifie que le token JWT appartient à un picker actif.
// Attache req.picker avec { id, name, node_id, phone_number }.
const requirePickerAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer '))
      return res.status(401).json({ success: false, message: 'Token manquant' });

    const token = header.slice(7);
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: 'Token invalide ou expiré' });
    }

    if (payload.profile_type !== 'picker')
      return res.status(403).json({ success: false, message: 'Accès réservé aux pickers' });

    const picker = await prisma.picker.findFirst({
      where: { id: payload.id, is_active: true, is_deleted: false },
      select: { id: true, name: true, node_id: true, phone_number: true, phone_country: true },
    });
    if (!picker)
      return res.status(401).json({ success: false, message: 'Picker introuvable ou inactif' });

    req.picker = picker;
    next();
  } catch (err) {
    next(err);
  }
};

// ── requirePickerOwnSession ───────────────────────────────────────────────────
// À utiliser après requirePickerAuth.
// Vérifie que la session :sessionId appartient au picker connecté.
const requirePickerOwnSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const session = await prisma.pickingSession.findUnique({
      where: { id: sessionId },
      select: { id: true, picker_id: true, node_id: true },
    });
    if (!session)
      return res.status(404).json({ success: false, message: 'Session picking introuvable' });
    if (session.picker_id !== req.picker.id)
      return res.status(403).json({ success: false, message: 'Cette session ne vous appartient pas' });

    req.session = session;
    next();
  } catch (err) {
    next(err);
  }
};

// ── requirePickerOwnItem ──────────────────────────────────────────────────────
// Vérifie que l'item :itemId appartient à une session du picker connecté.
const requirePickerOwnItem = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const item = await prisma.pickingSessionItem.findUnique({
      where: { id: itemId },
      include: { session: { select: { id: true, picker_id: true, status: { select: { code: true } } } } },
    });
    if (!item)
      return res.status(404).json({ success: false, message: 'Article picking introuvable' });
    if (item.session.picker_id !== req.picker.id)
      return res.status(403).json({ success: false, message: 'Cet article ne fait pas partie de vos sessions' });

    req.pickItem = item;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { requirePickerAuth, requirePickerOwnSession, requirePickerOwnItem };
