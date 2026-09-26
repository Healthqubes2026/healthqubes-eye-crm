const router = require('express').Router();
const ctrl   = require('../controllers/quotationsController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.post('/add',           ctrl.addQuotation);
router.get('/list',           ctrl.listQuotations);
router.put('/:id/send',       ctrl.sendQuotation);
router.put('/:id/status',     ctrl.updateQuotationStatus);

module.exports = router;