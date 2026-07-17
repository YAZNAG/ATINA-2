const { Router } = require('express');
const ctrl = require('./customer_reviews.controller');
const customerAuth = require('../../middlewares/customer_auth.middleware');
const optionalCustomerAuth = require('../../middlewares/optional_customer_auth.middleware');

const router = Router();

// Lecture publique
router.get('/articles/:article_id', optionalCustomerAuth, ctrl.listByArticle.bind(ctrl));

// Actions authentifiees
router.use(customerAuth);
router.get('/articles/:article_id/me', ctrl.getMyReview.bind(ctrl));
router.post('/articles/:article_id',   ctrl.create.bind(ctrl));
router.put('/:id',                     ctrl.update.bind(ctrl));
router.delete('/:id',                  ctrl.destroy.bind(ctrl));
router.post('/:id/helpful',            ctrl.toggleHelpful.bind(ctrl));

module.exports = router;