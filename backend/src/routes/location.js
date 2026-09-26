const router = require('express').Router();
const ctrl   = require('../controllers/locationController');
const { authenticate, isManagement } = require('../middleware/auth');

router.use(authenticate);

router.post('/update',          ctrl.updateLocation);
router.get('/live',             isManagement, ctrl.getLiveLocations);
router.get('/route/:employeeId', isManagement, ctrl.getEmployeeRoute);
router.get('/summary',          isManagement, ctrl.getDailySummary);

module.exports = router;
