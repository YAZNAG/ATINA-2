const { Router } = require('express');
const ctrl       = require('./reviews.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

const router = Router();
router.use(authMiddleware);

router.get('/',       ctrl.index.bind(ctrl));
router.delete('/:id', ctrl.destroy.bind(ctrl));

module.exports = router;