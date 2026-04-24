const express = require('express');
const controller = require('../controllers/restaurantController');
const { protect, allowRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/dashboard', controller.getDashboard);
router.get('/menu', controller.getMenu);
router.get('/tables', controller.getTables);

router.post('/menu', protect, allowRoles('manager', 'admin'), controller.createMenuItem);
router.patch('/menu/:id/inventory', protect, allowRoles('manager', 'admin'), controller.updateInventory);
router.post('/tables', protect, allowRoles('manager', 'admin'), controller.createTable);

router.post('/reservations', protect, controller.createReservation);
router.get('/reservations/me', protect, controller.getMyReservations);
router.delete('/reservations/:id', protect, controller.cancelReservation);

router.post('/orders', protect, controller.placeOrder);
router.get('/orders', protect, allowRoles('manager', 'admin'), controller.getOrders);
router.patch('/orders/:id/status', protect, allowRoles('manager', 'admin'), controller.updateOrderStatus);

router.get('/reports', protect, allowRoles('manager', 'admin'), controller.getReports);

module.exports = router;
