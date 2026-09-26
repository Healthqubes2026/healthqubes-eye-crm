const router = require('express').Router();
const ctrl   = require('../controllers/reportsController');
const { authenticate, isManagement } = require('../middleware/auth');

router.use(authenticate);
router.get('/', isManagement, ctrl.getDashboard);

module.exports = router;
