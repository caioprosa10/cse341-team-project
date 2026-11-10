// src/models/trips.js
import trip from './schemas/trips.js';

const getTripById = async (id) => {
    return trip.findOne({ id }).lean();
};

const getAllTrips = async () => {
    return trip.find({}).sort({ name: 1 }).lean();
};

export { getAllTrips, getTripById };
