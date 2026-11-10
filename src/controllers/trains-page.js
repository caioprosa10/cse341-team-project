// src/controllers/trains-page.js
// Controllers that serve the trains page. The trains model and API controllers
// shipped with the project as the worked example, so they are left untouched;
// what lives here is the page itself and the list endpoint that page consumes.
import { getAllTrains as findAllTrains } from '../models/trains.js';

const trainsPage = (req, res) => {
    return res.render('trains', { title: 'Trains' });
};

/**
 * Returns the trains wrapped in an object: { trains: [...] }.
 *
 * The newer endpoints answer with a bare array, but this one predates them and
 * both the trains page and tests/trains.test.js read `payload.trains`. Changing
 * the shape here would break a feature nobody asked us to touch, so the old
 * contract stays.
 */
const getTrainsForPage = async (req, res) => {
    try {
        const trains = await findAllTrains();

        return res.status(200).json({ trains });
    } catch (error) {
        console.error('Error fetching trains:', error);

        return res.status(500).json({ error: 'Failed to fetch trains' });
    }
};

export { getTrainsForPage, trainsPage };
