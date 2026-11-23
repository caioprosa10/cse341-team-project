// src/models/trips.js
import trip from './schemas/trips.js';

const getTripById = async (id) => {
    return trip.findOne({ id }).lean();
};

const getAllTrips = async () => {
    return trip.find({}).sort({ name: 1 }).lean();
};

/**
 * One page of trips, sorted by name, and the number of trips in total.
 *
 * The _id is a tie breaker: two trips with the same name would otherwise come
 * back in any order, and a trip could show up on two pages or on none.
 *
 * The count runs first so that a page past the end never sends Mongo a huge
 * skip value; it simply answers with no trips.
 */
const getTripsPage = async ({ skip, limit }) => {
    const totalItems = await trip.countDocuments({});

    if (skip >= totalItems) {
        return { trips: [], totalItems };
    }

    const trips = await trip
        .find({})
        .sort({ name: 1, _id: 1 })
        .skip(skip)
        .limit(limit)
        .lean();

    return { trips, totalItems };
};

const UPDATABLE = [
    'name',
    'description',
    'region',
    'startStation',
    'endStation',
    'duration',
    'distance',
    'bestSeason'
];

const updateTrip = async (id, changes) => {
    const allowed = {};

    for (const field of UPDATABLE) {
        if (changes[field] !== undefined && changes[field] !== '') {
            allowed[field] = changes[field];
        }
    }

    if (Object.keys(allowed).length === 0) {
        return null;
    }

    return trip.findOneAndUpdate({ id }, allowed, { new: true, runValidators: true }).lean();
};

const deleteTrip = async (id) => {
    const removed = await trip.findOneAndDelete({ id }).lean();

    return Boolean(removed);
};

export { deleteTrip, getAllTrips, getTripById, getTripsPage, updateTrip };
