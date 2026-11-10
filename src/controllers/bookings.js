// src/controllers/bookings.js
import {
    createBooking,
    getAllBookings as findAllBookings,
    getBookingById
} from '../models/bookings.js';
import { getAllTicketClasses } from '../models/ticket-classes.js';
import { generateConfirmationCode } from '../includes/helpers.js';
import { getScheduleById } from '../models/schedules.js';
import { getTripById } from '../models/trips.js';

/* ------------------------------------------------------------------ *
 * API controllers: these send JSON.                                   *
 * ------------------------------------------------------------------ */

const getAllBookings = async (req, res) => {
    try {
        const bookings = await findAllBookings();

        return res.status(200).json(bookings);
    } catch (error) {
        console.error('Error fetching bookings:', error);

        return res.status(500).json({ error: 'Failed to fetch bookings' });
    }
};

/* ------------------------------------------------------------------ *
 * EJS controllers: these render pages.                                *
 * ------------------------------------------------------------------ */

/**
 * Renders the booking form for one departure, with a price for every ticket
 * class. The price depends on the trip distance, so the trip is loaded too.
 */
const bookingPage = async (req, res, next) => {
    try {
        const { scheduleId } = req.params;
        const schedule = await getScheduleById(scheduleId);

        if (!schedule) {
            const notFound = new Error('Schedule Not Found');
            notFound.status = 404;

            return next(notFound);
        }

        const trip = await getTripById(schedule.tripId);

        if (!trip) {
            const notFound = new Error('Trip Not Found');
            notFound.status = 404;

            return next(notFound);
        }

        const ticketClasses = await getAllTicketClasses();
        const ticketOptions = ticketClasses.map((ticketClass) => ({
            class: ticketClass.class,
            name: ticketClass.name,
            price: trip.distance * ticketClass.pricePerKm,
            amenities: ticketClass.amenities,
            description: ticketClass.description,
            availableDays: ticketClass.availableDays || []
        }));

        return res.render('trips/book', { title: 'Book Trip', schedule, ticketOptions });
    } catch (error) {
        return next(error);
    }
};

/**
 * Stores the submitted booking and sends the traveller to the confirmation.
 */
const processBookingRequest = async (req, res, next) => {
    try {
        const { tripId, scheduleId, ticketClass, selectedDay, passengers } = req.body;
        const passengerList = Array.isArray(passengers) ? passengers : Object.values(passengers || {});

        if (!tripId || !scheduleId || !ticketClass || !selectedDay || passengerList.length === 0) {
            const badRequest = new Error('The booking form was incomplete.');
            badRequest.status = 400;

            return next(badRequest);
        }

        const booking = await createBooking({
            id: generateConfirmationCode(),
            tripId,
            scheduleId: Number(scheduleId),
            ticketClass,
            selectedDay,
            passengers: passengerList,
            createdAt: new Date()
        });

        return res.redirect(`/trips/confirmation/${booking.id}`);
    } catch (error) {
        return next(error);
    }
};

/**
 * Renders the confirmation for one booking.
 */
const confirmationPage = async (req, res, next) => {
    try {
        const { confirmationId } = req.params;
        const booking = await getBookingById(confirmationId);

        if (!booking) {
            const notFound = new Error('Booking Not Found');
            notFound.status = 404;

            return next(notFound);
        }

        return res.render('trips/confirm', { title: 'Trip Confirmation', confirmation: booking });
    } catch (error) {
        return next(error);
    }
};

/**
 * Renders the admin shell. The table rows come from /api/bookings.
 */
const bookingsAdminPage = (req, res) => {
    return res.render('bookings', { title: 'Bookings Admin' });
};

export {
    bookingPage,
    bookingsAdminPage,
    confirmationPage,
    getAllBookings,
    processBookingRequest
};
