// src/models/trips.js
import trip from './schemas/trips.js';

const getTripById = async (id) => {
    return trip.findOne({ id }).lean();
};

const getAllTrips = async () => {
    return trip.find({}).sort({ name: 1 }).lean();
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

export { deleteTrip, getAllTrips, getTripById, updateTrip };
