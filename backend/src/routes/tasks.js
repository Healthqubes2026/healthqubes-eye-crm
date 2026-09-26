const router = require('express').Router();
const ctrl   = require('../controllers/tasksController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.post('/add',           ctrl.addTask);
router.get('/list',           ctrl.listTasks);
router.get('/overdue',        ctrl.getOverdueTasks);
router.put('/:id/status',     ctrl.updateTaskStatus);

module.exports = router;