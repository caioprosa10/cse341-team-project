// src/models/schedules.js
import schedule from './schemas/schedules.js';
import { getTripById } from './trips.js';

/**
 * Returns the schedules for a trip, optionally limited to a single month.
 *
 * Schedule documents store the days of the week a departure runs, but they do
 * not store months. The month a trip runs at all lives on the trip itself, in
 * `operatingMonths`. So filtering by month means asking the trip whether it
 * operates that month: if it does not, the trip has no departures to show.
 *
 * @param {string} tripId The custom trip id, such as 'alpine-panorama'.
 * @param {number} [month] Month number from 1 (January) to 12 (December).
 * @returns {Promise<Array>} The matching schedules, sorted by departure time.
 */
const getSchedulesByTripId = async (tripId, month) => {
    if (month !== undefined && month !== null && month !== '') {
        const monthNumber = Number(month);
        const parentTrip = await getTripById(tripId);

        if (!parentTrip) {
            return [];
        }

        const operatingMonths = parentTrip.operatingMonths || [];

        if (!operatingMonths.includes(monthNumber)) {
            return [];
        }
    }

    return schedule.find({ tripId }).sort({ departureTime: 1 }).lean();
};

/**
 * Returns a single schedule by its numeric id. The booking page needs one
 * departure, not the whole list for a trip.
 */
const getScheduleById = async (id) => {
    return schedule.findOne({ id: Number(id) }).lean();
};

export { getScheduleById, getSchedulesByTripId };
