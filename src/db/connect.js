import mongoose from 'mongoose';

let database;

/**
 * Opens the shared Mongoose connection.
 *
 * The application talks to MongoDB through Mongoose models, but a few
 * maintenance scripts (such as the seed import) still need the native driver.
 * Connecting once with Mongoose and exposing its underlying Db keeps both
 * styles on a single connection pool.
 */
const connectToDb = async (options = {}) => {
    if (database) {
        return database;
    }

    const connectionString = options.connectionString || process.env.MONGODB_URI;
    const databaseName = options.databaseName || process.env.MONGODB_DB_NAME || 'kizuna-rail';

    if (!connectionString) {
        throw new Error('MONGODB_URI is required.');
    }

    await mongoose.connect(connectionString, { dbName: databaseName });
    database = mongoose.connection.db;

    return database;
};

/**
 * Returns the native Db handle of the open Mongoose connection.
 */
const getDb = () => {
    if (!database) {
        throw new Error('Database not initialized. Call connectToDb first.');
    }

    return database;
};

const closeDb = async () => {
    if (database) {
        await mongoose.disconnect();
        database = undefined;
    }
};

export { closeDb, connectToDb, getDb };
