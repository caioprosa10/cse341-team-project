// src/controllers/trips.js
import { QueryError, buildPaginationMeta, parsePagination } from '../includes/pagination.js';
import {
    deleteTrip,
    getTripById as findTripById,
    getTripFilterOptions,
    getTripsPage,
    updateTrip
} from '../models/trips.js';
import { parseTripFilters } from '../includes/trip-filters.js';

const MONTH_NAMES = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
];

/* ------------------------------------------------------------------ *
 * API controllers: these send JSON.                                   *
 * ------------------------------------------------------------------ */

/**
 * GET /api/trips?page=&limit=&region=&season=&q=
 * Answers with one page of the matching trips and the metadata for that page,
 * including the filters that were applied:
 * { trips: [...], meta: { page, limit, totalItems, totalPages, ..., filters } }
 */
const listTrips = async (req, res) => {
    try {
        const { page, limit, skip } = parsePagination(req.query);
        const allowed = await getTripFilterOptions();
        const { filters, mongoFilter } = parseTripFilters(req.query, allowed);
        const { trips, totalItems } = await getTripsPage({ filter: mongoFilter, skip, limit });

        return res.status(200).json({
            trips,
            meta: {
                ...buildPaginationMeta({ page, limit, totalItems }),
                filters
            }
        });
    } catch (error) {
        if (error instanceof QueryError) {
            return res.status(400).json({ error: error.message });
        }

        console.error('Error fetching trips:', error);

        return res.status(500).json({ error: 'Failed to fetch trips' });
    }
};

/**
 * GET /api/trips/filters
 * The regions and seasons the trip list can be filtered by.
 */
const listTripFilters = async (req, res) => {
    try {
        const options = await getTripFilterOptions();

        return res.status(200).json(options);
    } catch (error) {
        console.error('Error fetching trip filters:', error);

        return res.status(500).json({ error: 'Failed to fetch trip filters' });
    }
};

const getTripById = async (req, res) => {
    try {
        const { id } = req.params;
        const trip = await findTripById(id);

        if (!trip) {
            return res.status(404).json({ error: 'Trip not found' });
        }

        return res.status(200).json(trip);
    } catch (error) {
        console.error('Error fetching trip:', error);

        return res.status(500).json({ error: 'Failed to fetch trip' });
    }
};

/* ------------------------------------------------------------------ *
 * EJS controllers: these render pages.                                *
 * ------------------------------------------------------------------ */

/**
 * Renders the trip list shell. The cards and the filter options are fetched
 * from /api/trips by the browser, so this controller does not query the
 * database at all.
 */
const listTripsPage = (req, res) => {
    return res.render('trips/list', { title: 'Scenic Train Trips' });
};

/**
 * Renders one trip. The schedules section is hydrated from
 * /api/trips/:id/schedules, so the schedules are not loaded here.
 */
const tripDetailsPage = async (req, res, next) => {
    try {
        const { tripId } = req.params;
        const details = await findTripById(tripId);

        if (!details) {
            const notFound = new Error('Trip Not Found');
            notFound.status = 404;

            return next(notFound);
        }

        return res.render('trips/details', {
            title: 'Trip Details',
            details,
            monthNames: MONTH_NAMES
        });
    } catch (error) {
        return next(error);
    }
};

const putTrip = async (req, res, next) => {
    try {
        const existing = await findTripById(req.params.id);

        if (!existing) {
            return res.status(404).json({ message: 'Trip not found' });
        }

        const updated = await updateTrip(req.params.id, req.body);

        if (updated === null) {
            return res.status(400).json({ message: 'Send at least one field to update.' });
        }

        return res.status(200).json(updated);
    } catch (error) {
        return next(error);
    }
};

const removeTrip = async (req, res, next) => {
    try {
        const wasDeleted = await deleteTrip(req.params.id);

        if (!wasDeleted) {
            return res.status(404).json({ message: 'Trip not found' });
        }

        return res.status(204).send();
    } catch (error) {
        return next(error);
    }
};

// Filled by public/js/main.js from the public /api/trips endpoint.
const tripsAdminPage = (req, res) => {
    return res.render('admin/trips', { title: 'Trip Admin' });
};

export {
    getTripById,
    listTripFilters,
    listTrips,
    listTripsPage,
    putTrip,
    removeTrip,
    tripDetailsPage,
    tripsAdminPage
};
