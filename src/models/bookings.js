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

export { createBooking, getAllBookings, getBookingById };
