const { Router } = require('express');
const multer = require('multer');
const ctrl         = require('./customer_claims.controller');
const customerAuth = require('../../middlewares/customer_auth.middleware');

const router = Router();
router.use(customerAuth);

const upload = multer({ dest: '../uploads/claims/' });

router.get('/types',        ctrl.types.bind(ctrl));
router.get('/',              ctrl.list.bind(ctrl));
router.get('/:id',           ctrl.show.bind(ctrl));
router.post('/',             ctrl.store.bind(ctrl));
router.post('/:id/photo',    upload.single('photo'), ctrl.photo.bind(ctrl));
router.delete('/:id',        ctrl.cancel.bind(ctrl));

module.exports = router;