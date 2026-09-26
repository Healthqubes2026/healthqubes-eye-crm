const router = require('express').Router();
const ctrl   = require('../controllers/salesController');
const { authenticate, isManagement, isCaseManager } = require('../middleware/auth');

router.use(authenticate);

router.get('/summary', isManagement, ctrl.getSummary);
router.post('/add',    isCaseManager, ctrl.addSale);
router.get('/list',    isManagement, ctrl.listSales);

module.exports = router;
