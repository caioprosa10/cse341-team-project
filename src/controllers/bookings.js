// src/controllers/bookings.js
import {
    createBooking,
    deleteBooking,
    getAllBookings as findAllBookings,
    getBookingById,
    getBookingsForEmail,
    updateBooking
} from '../models/bookings.js';
import { getAllTicketClasses } from '../models/ticket-classes.js';
import { generateConfirmationCode } from '../includes/helpers.js';
import { getScheduleById } from '../models/schedules.js';
import { getTripById } from '../models/trips.js';

/* ------------------------------------------------------------------ *
 * API controllers: these send JSON.                                   *
 * ------------------------------------------------------------------ */

/*
 * A booking has no owner field: the people on it are passengers. A customer
 * owns a booking when their email is one of the passenger emails, which is
 * also how the list is filtered.
 */
const ownsBooking = (req, bookingDocument) => {
    if (req.user.role === 'admin') {
        return true;
    }

    const email = String(req.user.email || '').toLowerCase();

    return (bookingDocument.passengers || []).some((passenger) => {
        return String(passenger.email || '').toLowerCase() === email;
    });
};

const getAllBookings = async (req, res) => {
    try {
        const bookings = req.user.role === 'admin'
            ? await findAllBookings()
            : await getBookingsForEmail(req.user.email);

        return res.status(200).json(bookings);
    } catch (error) {
        console.error('Error fetching bookings:', error);

        return res.status(500).json({ error: 'Failed to fetch bookings' });
    }
};

const putBooking = async (req, res, next) => {
    try {
        const existing = await getBookingById(req.params.id);

        if (!existing) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        if (!ownsBooking(req, existing)) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const updated = await updateBooking(req.params.id, req.body);

        if (updated === null) {
            return res.status(400).json({ message: 'Send a ticketClass or a selectedDay to update.' });
        }

        return res.status(200).json(updated);
    } catch (error) {
        return next(error);
    }
};

const removeBooking = async (req, res, next) => {
    try {
        const existing = await getBookingById(req.params.id);

        if (!existing) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        if (!ownsBooking(req, existing)) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        await deleteBooking(req.params.id);

        return res.status(204).send();
    } catch (error) {
        return next(error);
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

// Welcome by display name; the booking list is fetched from /api/bookings,
// which already answers with only what this user may see.
const userDashboardPage = (req, res) => {
    return res.render('dashboard', { title: 'Your Dashboard' });
};

export {
    bookingPage,
    bookingsAdminPage,
    putBooking,
    removeBooking,
    userDashboardPage,
    confirmationPage,
    getAllBookings,
    processBookingRequest
};
