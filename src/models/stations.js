// src/models/stations.js
import station from './schemas/stations.js';

const getAllStations = async () => {
    return station.find({}).sort({ name: 1 }).lean();
};

const getStationById = async (id) => {
    return station.findOne({ id }).lean();
};

export { getAllStations, getStationById };
