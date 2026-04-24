const express = require('express');
const controller = require('../controllers/jobController');
const { protect, allowRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/dashboard', controller.getDashboard);
router.get('/jobs', controller.getJobs);

router.post('/jobs', protect, allowRoles('employer', 'admin'), controller.postJob);
router.patch('/jobs/:id/status', protect, allowRoles('employer', 'admin'), controller.updateJobStatus);

router.post('/jobs/:id/apply', protect, allowRoles('candidate', 'admin'), controller.applyToJob);
router.get('/applications/me', protect, allowRoles('candidate', 'admin'), controller.getMyApplications);
router.get('/applications/employer', protect, allowRoles('employer', 'admin'), controller.getEmployerApplications);
router.patch('/applications/:id/status', protect, allowRoles('employer', 'admin'), controller.updateApplicationStatus);

module.exports = router;
