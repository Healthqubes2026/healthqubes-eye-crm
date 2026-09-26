const router = require('express').Router();
const ctrl   = require('../controllers/hospitalsController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.post('/add',     ctrl.addHospital);
router.get('/list',     ctrl.listHospitals);
router.put('/:id',      ctrl.updateHospital);

module.exports = router;