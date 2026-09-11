/**
 * Offres > Gamification — back-office (monté sur /gamification).
 * Permissions : games.view (lecture) / games.manage (écriture).
 * Le moteur de jeu côté client (gamification.engine.js) n'est pas exposé ici.
 */
const { Router } = require('express');
const auth = require('../../middlewares/auth.middleware');
const perm = require('../../middlewares/permission.middleware');
const ctrl = require('./gamification.controller');

const router = Router();
router.use(auth);

const view = perm.permAny(['games.view', 'games.manage']);
const manage = perm('games.manage');

// Référentiels (types, périodes, conditions, types de lots, types de promo coupon, nodes)
router.get('/lookups', view, ctrl.lookups.bind(ctrl));
router.get('/nodes/:nodeId/packs', view, ctrl.nodePacks.bind(ctrl));
router.get('/nodes/:nodeId/skus', view, ctrl.nodeSkus.bind(ctrl));

// Participations — LECTURE SEULE (US-082)
router.get('/plays', view, ctrl.plays.bind(ctrl));
router.get('/plays/export', view, ctrl.exportPlays.bind(ctrl));
router.get('/plays/:id', view, ctrl.showPlay.bind(ctrl));

// Jeux (US-079 / US-080)
router.get('/games', view, ctrl.index.bind(ctrl));
router.post('/games', manage, ctrl.store.bind(ctrl));
router.get('/games/:id', view, ctrl.show.bind(ctrl));
router.put('/games/:id', manage, ctrl.update.bind(ctrl));
router.post('/games/:id/activate', manage, ctrl.activate.bind(ctrl));
router.post('/games/:id/deactivate', manage, ctrl.deactivate.bind(ctrl));
router.get('/games/:id/delete-check', view, ctrl.deleteCheck.bind(ctrl));
router.delete('/games/:id', manage, ctrl.destroy.bind(ctrl));
router.get('/games/:id/plays', view, ctrl.gamePlays.bind(ctrl));

// Lots d'un jeu (US-081)
router.post('/games/:id/prizes', manage, ctrl.addPrize.bind(ctrl));
router.put('/games/:id/prizes/:prizeId', manage, ctrl.updatePrize.bind(ctrl));
router.delete('/games/:id/prizes/:prizeId', manage, ctrl.deletePrize.bind(ctrl));

module.exports = router;
