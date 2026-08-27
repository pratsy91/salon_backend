const express = require('express');

const authenticate = require('../middleware/authenticate');
const tenantScope = require('../middleware/tenantScope');
const requireRole = require('../middleware/requireRole');
const requireActiveSubscription = require('../middleware/requireActiveSubscription');
const { ROLES } = require('../config/constants');

const authController = require('../controllers/authController');
const planController = require('../controllers/planController');
const salonController = require('../controllers/salonController');
const subscriptionController = require('../controllers/subscriptionController');
const clientController = require('../controllers/clientController');
const staffController = require('../controllers/staffController');
const serviceController = require('../controllers/serviceController');
const appointmentController = require('../controllers/appointmentController');
const attendanceController = require('../controllers/attendanceController');
const dashboardController = require('../controllers/dashboardController');

const router = express.Router();

const SALON_USERS = [ROLES.SALON_OWNER, ROLES.RECEPTIONIST];

router.get('/health', (req, res) => res.json({ status: 'ok' }));

/* ---------------------------------- auth --------------------------------- */
router.post('/auth/login', authController.login);
router.get('/auth/me', authenticate, authController.me);

// Everything below requires a verified token and a token-derived tenant scope.
router.use(authenticate, tenantScope);

/* ------------------------------ super admin ------------------------------ */
router.post('/plans', requireRole(ROLES.SUPER_ADMIN), planController.createPlan);
router.patch('/plans/:planId', requireRole(ROLES.SUPER_ADMIN), planController.updatePlan);
// Salon users may read the catalogue to see what their plan offers, but only
// the Super Admin can change it.
router.get('/plans', requireRole(ROLES.SUPER_ADMIN, ...SALON_USERS), planController.listPlans);

router.get('/salons', requireRole(ROLES.SUPER_ADMIN), salonController.listSalons);
router.post('/salons', requireRole(ROLES.SUPER_ADMIN), salonController.createSalon);
router.get('/salons/:id', requireRole(ROLES.SUPER_ADMIN), salonController.getSalon);
router.post('/salons/:id/subscription', requireRole(ROLES.SUPER_ADMIN), subscriptionController.assignPlan);
router.get('/salons/:id/subscriptions', requireRole(ROLES.SUPER_ADMIN), subscriptionController.listHistory);
router.get('/subscriptions/history', requireRole(ROLES.SUPER_ADMIN), subscriptionController.listHistory);

/* -------------------------------- owner ---------------------------------- */
// Readable on an expired plan by design; it is the renewal-status screen.
router.get('/me/subscription', requireRole(ROLES.SALON_OWNER), subscriptionController.mySubscription);

/* --------------------------- owner + receptionist ------------------------- */
router.get('/dashboard', requireRole(...SALON_USERS), dashboardController.summary);

router.get('/clients', requireRole(...SALON_USERS), requireActiveSubscription, clientController.listClients);
router.post('/clients', requireRole(...SALON_USERS), requireActiveSubscription, clientController.createClient);

router.get('/services', requireRole(...SALON_USERS), requireActiveSubscription, serviceController.listServices);

router.get('/staff', requireRole(...SALON_USERS), requireActiveSubscription, staffController.listStaff);
router.post('/staff', requireRole(ROLES.SALON_OWNER), requireActiveSubscription, staffController.createStaff);

router.get('/appointments', requireRole(...SALON_USERS), requireActiveSubscription, appointmentController.listAppointments);
router.post('/appointments', requireRole(...SALON_USERS), requireActiveSubscription, appointmentController.createAppointment);
router.patch('/appointments/:id/status', requireRole(...SALON_USERS), requireActiveSubscription, appointmentController.updateStatus);
router.get('/appointments/today/summary', requireRole(...SALON_USERS), requireActiveSubscription, appointmentController.todaySummary);

/* ------------------------------- attendance ------------------------------- */
router.post('/attendance/check-in', requireRole(...SALON_USERS), requireActiveSubscription, attendanceController.checkIn);
router.get('/attendance/me', requireRole(...SALON_USERS), attendanceController.myStatus);
router.get('/attendance', requireRole(ROLES.SALON_OWNER), requireActiveSubscription, attendanceController.listAttendance);

module.exports = router;
