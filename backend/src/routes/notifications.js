const router = require('express').Router();
const ctrl   = require('../controllers/notificationsController');
const { authenticate, isAdmin } = require('../middleware/auth');

router.use(authenticate);

router.get('/my',          ctrl.getMyNotifications);
router.put('/read-all',    ctrl.markAllRead);
router.put('/:id/read',    ctrl.markRead);
router.post('/send',       isAdmin, ctrl.send);

module.exports = router;
