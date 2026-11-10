// src/models/ticket-classes.js
import ticketClass from './schemas/ticket-classes.js';

const getAllTicketClasses = async () => {
    return ticketClass.find({}).sort({ pricePerKm: 1 }).lean();
};

/**
 * Returns only the ticket classes that can be booked on the given weekday.
 * @param {string} day A lowercase weekday name, such as 'monday'.
 */
const getTicketClassesForDay = async (day) => {
    return ticketClass.find({ availableDays: day }).sort({ pricePerKm: 1 }).lean();
};

export { getAllTicketClasses, getTicketClassesForDay };
