/**
 * Routes CLIENT (app mobile) — section « Jeux ». À monter AVANT les montages génériques :
 *   router.use('/customer/games', require('../modules/customer_games/customer_games.routes'));
 */
const { Router } = require('express');
const ctrl = require('./customer_games.controller');
const customerAuth = require('../../middlewares/customer_auth.middleware');

const router = Router();
router.use(customerAuth);

router.get('/',          ctrl.index.bind(ctrl));
router.get('/prizes',    ctrl.prizes.bind(ctrl));
router.post('/:id/play', ctrl.play.bind(ctrl));

module.exports = router;
