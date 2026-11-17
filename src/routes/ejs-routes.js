// src/routes/ejs-routes.js
import { aboutPage, homePage, testErrorPage } from './index.js';
import {
    adminDashboardPage,
    login,
    loginPage,
    logout,
    register,
    registerPage
} from '../controllers/auth.js';
import {
    bookingPage,
    bookingsAdminPage,
    confirmationPage,
    processBookingRequest,
    userDashboardPage
} from '../controllers/bookings.js';
import { listTripsPage, tripDetailsPage, tripsAdminPage } from '../controllers/trips.js';
import { requirePageLogin, requirePageRole } from '../middleware/auth.js';
import { usersAdminPage } from '../controllers/users.js';
import { Router } from 'express';
import { trainsPage } from '../controllers/trains-page.js';

const router = Router();

// Home page
router.get('/', homePage);

// About page
router.get('/about', aboutPage);

// Trains page
router.get('/trains', trainsPage);

// Trip list page
router.get('/trips', listTripsPage);

// Booking form for one departure
router.get('/trips/booking/:scheduleId', bookingPage);

// Booking submission
router.post('/trips/book', processBookingRequest);

// Booking confirmation page
router.get('/trips/confirmation/:confirmationId', confirmationPage);

// Trip details page. Registered after the more specific /trips paths.
router.get('/trips/:tripId', tripDetailsPage);

// Bookings admin page. An admin sees every booking; a customer sees only the
// bookings carrying their email, which the API decides.
router.get('/bookings-admin', requirePageLogin, bookingsAdminPage);

/* ------------------------------------------------------------------ *
 * Authentication                                                     *
 * ------------------------------------------------------------------ */

// Registration form and submission
router.get('/register', registerPage);
router.post('/register', register);

// Sign-in form and submission
router.get('/login', loginPage);
router.post('/login', login);

// Sign out. POST, so that a link preload or a crawler cannot end a session.
router.post('/logout', logout);

// Admin dashboard. Signed out visitors are sent to the login page; signed in
// visitors without the admin role get the 403 page.
router.get('/admin', requirePageRole('admin'), adminDashboardPage);

// Standard user dashboard
router.get('/dashboard', requirePageLogin, userDashboardPage);

// User admin: an admin sees everyone, a customer sees only their own record.
router.get('/admin/users', requirePageLogin, usersAdminPage);

// Trip admin: admin role only.
router.get('/admin/trips', requirePageRole('admin'), tripsAdminPage);

// Test 500 error page
router.get('/500', testErrorPage);

export default router;
