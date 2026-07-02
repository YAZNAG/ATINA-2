const { Router }   = require('express');
const ctrl         = require('./customer_substitution.controller');
const customerAuth = require('../../middlewares/customer_auth.middleware');

const router = Router();
router.use(customerAuth);

// GET   /customer/substitutions/pending   substitutions en attente (toutes commandes)
router.get('/pending', ctrl.getPending.bind(ctrl));

// PATCH /customer/substitutions/:sessionItemId/respond  accepter ou refuser
router.patch('/:sessionItemId/respond', ctrl.respond.bind(ctrl));

module.exports = router;