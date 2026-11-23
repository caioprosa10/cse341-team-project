// src/includes/pagination.js
// Reads and checks the page and limit query parameters, and builds the
// metadata that goes back with every paged response. Nothing here touches
// Express or the database, so any list endpoint can reuse it.

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

/**
 * An error caused by bad query input. Controllers answer it with a 400,
 * while any other error is still a 500.
 */
class QueryError extends Error {
    constructor(message) {
        super(message);
        this.name = 'QueryError';
        this.status = 400;
    }
}

// Digits only: rejects "1.5", "-2", "1e3", " 3" and "abc".
const WHOLE_NUMBER = /^\d+$/;

/**
 * Turns one query value into a whole number between min and max.
 * A missing or empty value gives the fallback.
 */
const readWholeNumber = (value, name, { min, max, fallback, rule }) => {
    if (value === undefined || value === '') {
        return fallback;
    }

    // ?page=1&page=2 arrives as an array, which is not a single page number.
    if (typeof value !== 'string' || !WHOLE_NUMBER.test(value)) {
        throw new QueryError(`${name} must be ${rule}`);
    }

    const number = Number(value);

    if (!Number.isSafeInteger(number) || number < min || number > max) {
        throw new QueryError(`${name} must be ${rule}`);
    }

    return number;
};

/**
 * Reads page and limit from req.query.
 * @param {object} query - req.query
 * @returns {{ page: number, limit: number, skip: number }}
 * @throws {QueryError} when page or limit is not valid
 */
const parsePagination = (query = {}) => {
    const page = readWholeNumber(query.page, 'page', {
        min: 1,
        max: Number.MAX_SAFE_INTEGER,
        fallback: 1,
        rule: 'a whole number of 1 or more'
    });

    const limit = readWholeNumber(query.limit, 'limit', {
        min: 1,
        max: MAX_PAGE_SIZE,
        fallback: DEFAULT_PAGE_SIZE,
        rule: `a whole number from 1 to ${MAX_PAGE_SIZE}`
    });

    return { page, limit, skip: (page - 1) * limit };
};

/**
 * Builds the metadata that tells the client where it is in the results.
 * @param {{ page: number, limit: number, totalItems: number }} values
 */
const buildPaginationMeta = ({ page, limit, totalItems }) => {
    const totalPages = Math.ceil(totalItems / limit);

    return {
        page,
        limit,
        totalItems,
        totalPages,
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages
    };
};

export {
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    QueryError,
    buildPaginationMeta,
    parsePagination
};
