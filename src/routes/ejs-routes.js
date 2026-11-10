// src/routes/ejs-routes.js
import { aboutPage, homePage, testErrorPage } from './index.js';
import {
    bookingPage,
    bookingsAdminPage,
    confirmationPage,
    processBookingRequest
} from '../controllers/bookings.js';
import { listTripsPage, tripDetailsPage } from '../controllers/trips.js';
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

// Bookings admin page
router.get('/bookings-admin', bookingsAdminPage);

// Test 500 error page
router.get('/500', testErrorPage);

export default router;
