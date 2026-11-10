// src/controllers/ticket-classes.js
import {
    getAllTicketClasses as findAllTicketClasses,
    getTicketClassesForDay as findTicketClassesForDay
} from '../models/ticket-classes.js';
import { WEEK_DAYS } from '../includes/week-days.js';

const getAllTicketClasses = async (req, res) => {
    try {
        const ticketClasses = await findAllTicketClasses();

        return res.status(200).json(ticketClasses);
    } catch (error) {
        console.error('Error fetching ticket classes:', error);

        return res.status(500).json({ error: 'Failed to fetch ticket classes' });
    }
};

const getTicketClassesForDay = async (req, res) => {
    try {
        const day = String(req.query.day || '').trim().toLowerCase();

        if (!WEEK_DAYS.includes(day)) {
            return res.status(400).json({
                error: `The day must be one of: ${WEEK_DAYS.join(', ')}`
            });
        }

        const ticketClasses = await findTicketClassesForDay(day);

        return res.status(200).json(ticketClasses);
    } catch (error) {
        console.error('Error fetching ticket classes for day:', error);

        return res.status(500).json({ error: 'Failed to fetch ticket classes' });
    }
};

/**
 * `/api/ticket-classes` serves the whole list, and the same path with a
 * `?day=` query serves only the classes sold on that day.
 */
const listTicketClasses = async (req, res) => {
    if (req.query.day === undefined) {
        return getAllTicketClasses(req, res);
    }

    return getTicketClassesForDay(req, res);
};

export { getAllTicketClasses, getTicketClassesForDay, listTicketClasses };
