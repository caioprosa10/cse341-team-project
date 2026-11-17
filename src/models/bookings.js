// src/models/bookings.js
import booking from './schemas/bookings.js';

/**
 * Stores a new booking. Only the fields declared on the schema are persisted,
 * so unexpected form fields never reach the database.
 */
const createBooking = async (bookingData) => {
    const created = await booking.create({
        id: bookingData.id,
        tripId: bookingData.tripId,
        scheduleId: bookingData.scheduleId,
        ticketClass: bookingData.ticketClass,
        selectedDay: bookingData.selectedDay,
        passengers: bookingData.passengers,
        createdAt: bookingData.createdAt || new Date()
    });

    return created.toObject();
};

const getAllBookings = async () => {
    return booking.find({}).sort({ createdAt: -1 }).lean();
};

const getBookingById = async (id) => {
    return booking.findOne({ id }).lean();
};

/*
 * A booking has no owner field. The people on it are passengers, so a
 * customer owns a booking when their email is one of the passenger emails.
 */
const getBookingsForEmail = async (email) => {
    const normalised = String(email || '').toLowerCase().trim();

    return booking.find({ 'passengers.email': normalised }).sort({ createdAt: -1 }).lean();
};

const updateBooking = async (id, { ticketClass, selectedDay }) => {
    const changes = {};

    if (typeof ticketClass === 'string' && ticketClass.trim()) {
        changes.ticketClass = ticketClass.trim();
    }

    if (typeof selectedDay === 'string' && selectedDay.trim()) {
        changes.selectedDay = selectedDay.trim();
    }

    if (Object.keys(changes).length === 0) {
        return null;
    }

    return booking.findOneAndUpdate({ id }, changes, { new: true, runValidators: true }).lean();
};

const deleteBooking = async (id) => {
    const removed = await booking.findOneAndDelete({ id }).lean();

    return Boolean(removed);
};

export {
    createBooking,
    deleteBooking,
    getAllBookings,
    getBookingById,
    getBookingsForEmail,
    updateBooking
};
