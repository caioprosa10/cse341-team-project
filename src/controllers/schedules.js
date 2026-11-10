// src/controllers/schedules.js
import { getSchedulesByTripId } from '../models/schedules.js';

const getSchedulesForTrip = async (req, res) => {
    try {
        const { id } = req.params;
        const schedules = await getSchedulesByTripId(id);

        return res.status(200).json(schedules);
    } catch (error) {
        console.error('Error fetching schedules:', error);

        return res.status(500).json({ error: 'Failed to fetch schedules' });
    }
};

const getSchedulesForTripAndMonth = async (req, res) => {
    try {
        const { id } = req.params;
        const { month } = req.query;
        const monthNumber = Number(month);

        if (!Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
            return res.status(400).json({ error: 'The month must be a whole number from 1 to 12' });
        }

        const schedules = await getSchedulesByTripId(id, monthNumber);

        return res.status(200).json(schedules);
    } catch (error) {
        console.error('Error fetching schedules for month:', error);

        return res.status(500).json({ error: 'Failed to fetch schedules' });
    }
};

export { getSchedulesForTrip, getSchedulesForTripAndMonth };
