const express = require('express');
const router = express.Router();
const {
  getAllEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  registerForEvent,
  cancelRegistration,
  getMyRegistrations,
  getEventAttendees,
} = require('../controllers/eventController');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/', getAllEvents);
router.get('/my-registrations', protect, getMyRegistrations);

router.post('/:id/register', protect, registerForEvent);
router.delete('/:id/register', protect, cancelRegistration);

router.post('/', protect, adminOnly, createEvent);
router.put('/:id', protect, adminOnly, updateEvent);
router.delete('/:id', protect, adminOnly, deleteEvent);
router.get('/:id/attendees', protect, adminOnly, getEventAttendees);

router.get('/:id', getEventById);

module.exports = router;
