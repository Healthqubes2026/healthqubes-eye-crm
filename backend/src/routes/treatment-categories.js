const router = require('express').Router();
const ctrl   = require('../controllers/treatmentCategoriesController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.post('/add',     ctrl.addTreatmentCategory);
router.get('/list',     ctrl.listTreatmentCategories);
router.put('/:id',      ctrl.updateTreatmentCategory);

module.exports = router;