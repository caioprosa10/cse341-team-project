// src/includes/trip-filters.js
// Reads and checks the region, season and q (keyword) query parameters of
// /api/trips, and turns them into a MongoDB filter. Like pagination.js it has
// no Express or Mongoose imports.
import { QueryError } from './pagination.js';

const MAX_SEARCH_LENGTH = 100;

/**
 * Escapes the characters that mean something in a regular expression, so a
 * keyword such as "(" or ".*" is searched for literally instead of breaking
 * the query or matching everything.
 */
const escapeRegex = (text) => {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * One optional text value. Missing or blank gives null; a repeated
 * parameter (?region=a&region=b) arrives as an array and is refused.
 */
const readOptionalText = (value, name) => {
    if (value === undefined) {
        return null;
    }

    if (typeof value !== 'string') {
        throw new QueryError(`${name} must be a single value`);
    }

    const trimmed = value.trim();

    return trimmed === '' ? null : trimmed;
};

/**
 * Reads the filters from req.query.
 *
 * @param {object} query - req.query
 * @param {{ regions: string[], seasons: string[] }} allowed - the regions and
 *   seasons that exist in the trips collection
 * @returns {{ filters: { region: string|null, season: string|null, q: string|null }, mongoFilter: object }}
 *   filters goes back to the client in meta; mongoFilter goes to the model.
 * @throws {QueryError} when a value is not valid
 */
const parseTripFilters = (query = {}, allowed = { regions: [], seasons: [] }) => {
    const regionText = readOptionalText(query.region, 'region');
    const seasonText = readOptionalText(query.season, 'season');
    const q = readOptionalText(query.q, 'q');

    // The stored regions and seasons are lowercase, so Kansai finds kansai.
    const region = regionText === null ? null : regionText.toLowerCase();
    const season = seasonText === null ? null : seasonText.toLowerCase();

    if (region !== null && !allowed.regions.includes(region)) {
        throw new QueryError(`region must be one of: ${allowed.regions.join(', ')}`);
    }

    if (season !== null && !allowed.seasons.includes(season)) {
        throw new QueryError(`season must be one of: ${allowed.seasons.join(', ')}`);
    }

    if (q !== null && q.length > MAX_SEARCH_LENGTH) {
        throw new QueryError(`q must be ${MAX_SEARCH_LENGTH} characters or fewer`);
    }

    const mongoFilter = {};

    if (region !== null) {
        mongoFilter.region = region;
    }

    if (season !== null) {
        mongoFilter.bestSeason = season;
    }

    if (q !== null) {
        // Case-insensitive "contains" on the name or the description.
        const pattern = new RegExp(escapeRegex(q), 'i');
        mongoFilter.$or = [{ name: pattern }, { description: pattern }];
    }

    return { filters: { region, season, q }, mongoFilter };
};

export { MAX_SEARCH_LENGTH, escapeRegex, parseTripFilters };
