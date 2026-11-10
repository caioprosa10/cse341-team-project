// src/routes/api-routes.js
import { getAllBookings } from '../controllers/bookings.js';
import { getTrainById } from '../controllers/trains.js';
import { getTrainsForPage } from '../controllers/trains-page.js';
import { getAllTrips, getTripById } from '../controllers/trips.js';
import { getSchedulesForTrip, getSchedulesForTripAndMonth } from '../controllers/schedules.js';
import { Router } from 'express';

const router = Router();

/**
 * @openapi
 * /api/trips:
 *   get:
 *     summary: Get all trips
 *     tags:
 *       - Trips
 *     responses:
 *       200:
 *         description: A list of trips
 *       500:
 *         description: Failed to fetch trips
 */
router.get('/api/trips', getAllTrips);

/**
 * @openapi
 * /api/trips/{id}:
 *   get:
 *     summary: Get one trip by id
 *     tags:
 *       - Trips
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The custom trip id, such as alpine-panorama
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The matching trip
 *       404:
 *         description: Trip not found
 *       500:
 *         description: Failed to fetch trip
 */
router.get('/api/trips/:id', getTripById);

/**
 * @openapi
 * /api/trips/{id}/schedules:
 *   get:
 *     summary: Get the schedules for a trip
 *     description: >
 *       Returns every schedule for the trip. When the optional month is given,
 *       the schedules are returned only if the trip operates in that month,
 *       because schedules store weekdays while the operating months live on the
 *       trip itself. A trip that does not run that month returns an empty list.
 *     tags:
 *       - Schedules
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The custom trip id, such as alpine-panorama
 *         schema:
 *           type: string
 *       - in: query
 *         name: month
 *         required: false
 *         description: Month number from 1 (January) to 12 (December)
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *     responses:
 *       200:
 *         description: The schedules for the trip
 *       400:
 *         description: The month is not a whole number from 1 to 12
 *       500:
 *         description: Failed to fetch schedules
 */
router.get('/api/trips/:id/schedules', async (req, res) => {
    if (req.query.month === undefined) {
        return getSchedulesForTrip(req, res);
    }

    return getSchedulesForTripAndMonth(req, res);
});

/**
 * @openapi
 * /api/bookings:
 *   get:
 *     summary: Get all bookings
 *     tags:
 *       - Bookings
 *     responses:
 *       200:
 *         description: A list of bookings, newest first
 *       500:
 *         description: Failed to fetch bookings
 */
router.get('/api/bookings', getAllBookings);

/**
 * @openapi
 * /api/trains:
 *   get:
 *     summary: Get all trains
 *     tags:
 *       - Trains
 *     description: >
 *       Answers with the trains wrapped in an object, as { "trains": [ ... ] }.
 *       This endpoint predates the newer ones, which return bare arrays, and the
 *       trains page reads payload.trains.
 *     responses:
 *       200:
 *         description: An object with a trains array
 *       500:
 *         description: Failed to fetch trains
 */
router.get('/api/trains', getTrainsForPage);

/**
 * @openapi
 * /api/trains/{id}:
 *   get:
 *     summary: Get one train by id
 *     tags:
 *       - Trains
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The custom train id
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The matching train
 *       404:
 *         description: Train not found
 *       500:
 *         description: Failed to fetch train
 */
router.get('/api/trains/:id', getTrainById);

export default router;
