const { Router } = require('express');
const ctrl       = require('./claims.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

const router = Router();
router.use(authMiddleware);

router.get('/',       ctrl.index.bind(ctrl));
router.get('/:id',    ctrl.show.bind(ctrl));
router.put('/:id',    ctrl.update.bind(ctrl));

module.exports = router;