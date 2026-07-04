const { Router } = require('express');
const ctrl         = require('./customer_reviews.controller');
const customerAuth = require('../../middlewares/customer_auth.middleware');

const router = Router();

router.get('/articles/:article_id', ctrl.listByArticle.bind(ctrl));

router.use(customerAuth);
router.get('/articles/:article_id/me', ctrl.getMyReview.bind(ctrl));
router.post('/articles/:article_id',   ctrl.create.bind(ctrl));
router.put('/:id',                     ctrl.update.bind(ctrl));
router.delete('/:id',                  ctrl.destroy.bind(ctrl));

module.exports = router;