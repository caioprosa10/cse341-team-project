// src/routes/api-routes.js
import {
    getAllBookings,
    putBooking,
    removeBooking
} from '../controllers/bookings.js';
import { getUser, listUsers, putUser, removeUser } from '../controllers/users.js';
import {
    requireApiLogin,
    requireApiRole
} from '../middleware/auth.js';
import { getAllStations, getStationById } from '../controllers/stations.js';
import { getTrainById } from '../controllers/trains.js';
import { getTrainsForPage } from '../controllers/trains-page.js';
import { getAllTrips, getTripById, putTrip, removeTrip } from '../controllers/trips.js';
import { getSchedulesForTrip, getSchedulesForTripAndMonth } from '../controllers/schedules.js';
import { listTicketClasses } from '../controllers/ticket-classes.js';
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
router.get('/api/bookings', requireApiLogin, getAllBookings);

/**
 * @openapi
 * /api/ticket-classes:
 *   get:
 *     summary: Get the ticket classes
 *     description: >
 *       Returns every ticket class. When the optional day is given, only the
 *       classes sold on that weekday are returned.
 *     tags:
 *       - Ticket Classes
 *     parameters:
 *       - in: query
 *         name: day
 *         required: false
 *         description: A lowercase weekday name, such as monday
 *         schema:
 *           type: string
 *           enum: [monday, tuesday, wednesday, thursday, friday, saturday, sunday]
 *     responses:
 *       200:
 *         description: The matching ticket classes
 *       400:
 *         description: The day is not a valid weekday name
 *       500:
 *         description: Failed to fetch ticket classes
 */
router.get('/api/ticket-classes', listTicketClasses);

/**
 * @openapi
 * /api/stations:
 *   get:
 *     summary: Get all stations
 *     tags:
 *       - Stations
 *     responses:
 *       200:
 *         description: A list of stations
 *       500:
 *         description: Failed to fetch stations
 */
router.get('/api/stations', getAllStations);

/**
 * @openapi
 * /api/stations/{id}:
 *   get:
 *     summary: Get one station by id
 *     tags:
 *       - Stations
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The custom station id, such as nagoya
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The matching station
 *       404:
 *         description: Station not found
 *       500:
 *         description: Failed to fetch station
 */
router.get('/api/stations/:id', getStationById);

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

/**
 * @openapi
 * /api/bookings/{id}:
 *   put:
 *     summary: Update a booking
 *     description: >
 *       Any signed in user may update a booking where their email is one of
 *       the passengers. An admin may update any booking.
 *     tags:
 *       - Bookings
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The booking reference
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ticketClass:
 *                 type: string
 *               selectedDay:
 *                 type: string
 *     responses:
 *       200:
 *         description: The updated booking
 *       400:
 *         description: Nothing to update
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Not your booking
 *       404:
 *         description: Booking not found
 *   delete:
 *     summary: Delete a booking
 *     tags:
 *       - Bookings
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Deleted
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Not your booking
 *       404:
 *         description: Booking not found
 */
router.put('/api/bookings/:id', requireApiLogin, putBooking);
router.delete('/api/bookings/:id', requireApiLogin, removeBooking);

/**
 * @openapi
 * /api/users:
 *   get:
 *     summary: Get users
 *     description: >
 *       An admin receives every user. Any other signed in user receives a list
 *       holding only their own record. The password hash is never included.
 *     tags:
 *       - Users
 *     responses:
 *       200:
 *         description: A list of users
 *       401:
 *         description: Authentication required
 */
router.get('/api/users', requireApiLogin, listUsers);

/**
 * @openapi
 * /api/users/{id}:
 *   get:
 *     summary: Get one user
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The user
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Not your account
 *       404:
 *         description: User not found
 *   put:
 *     summary: Update a user
 *     description: >
 *       Only the display name and the email can be changed. The role is never
 *       read from the body, so a customer cannot promote themselves.
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: The updated user
 *       400:
 *         description: Nothing to update
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Not your account
 *       404:
 *         description: User not found
 *       409:
 *         description: That email is already in use
 *   delete:
 *     summary: Delete a user
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Deleted
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Not your account
 *       404:
 *         description: User not found
 */
router.get('/api/users/:id', requireApiLogin, getUser);
router.put('/api/users/:id', requireApiLogin, putUser);
router.delete('/api/users/:id', requireApiLogin, removeUser);

/**
 * @openapi
 * /api/trips/{id}:
 *   put:
 *     summary: Update a trip
 *     description: Admin role only. Reading the trips stays public.
 *     tags:
 *       - Trips
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The custom trip id, such as alpine-panorama
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               region:
 *                 type: string
 *               startStation:
 *                 type: string
 *               endStation:
 *                 type: string
 *               duration:
 *                 type: string
 *               distance:
 *                 type: number
 *     responses:
 *       200:
 *         description: The updated trip
 *       400:
 *         description: Nothing to update
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin role required
 *       404:
 *         description: Trip not found
 *   delete:
 *     summary: Delete a trip
 *     description: Admin role only.
 *     tags:
 *       - Trips
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Deleted
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin role required
 *       404:
 *         description: Trip not found
 */
router.put('/api/trips/:id', requireApiRole('admin'), putTrip);
router.delete('/api/trips/:id', requireApiRole('admin'), removeTrip);

export default router;
