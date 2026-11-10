// src/includes/week-days.js
/**
 * The weekday names used by schedules, bookings and ticket class availability.
 * Kept outside the Mongoose schemas so controllers can validate input without
 * importing a database model.
 */
const WEEK_DAYS = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday'
];

export { WEEK_DAYS };
