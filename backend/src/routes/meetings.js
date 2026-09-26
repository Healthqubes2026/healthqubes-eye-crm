const router = require('express').Router();
const ctrl   = require('../controllers/meetingsController');
const { authenticate, isSalesCoordinator, isAgent } = require('../middleware/auth');
const { upload, uploadPhotos } = require('../middleware/upload');

router.use(authenticate);

router.get('/followups',    isAgent, ctrl.getFollowUps);
router.get('/doctors',      isAgent, ctrl.listDoctors);
router.post('/doctors',     isSalesCoordinator, ctrl.addDoctor);
router.put('/doctors/:id',  isSalesCoordinator, ctrl.updateDoctor);
router.post('/add',         isSalesCoordinator, uploadPhotos, upload.array('photos', 5), ctrl.addMeeting);
router.get('/list',         isAgent, ctrl.listMeetings);
router.get('/:id',          isAgent, ctrl.getMeeting);
router.put('/:id/checkout', isSalesCoordinator, ctrl.checkoutMeeting);

module.exports = router;
