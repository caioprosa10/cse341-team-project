// src/models/schemas/ticket-classes.js
import mongoose from 'mongoose';
import { WEEK_DAYS } from '../../includes/week-days.js';

const ticketClassSchema = new mongoose.Schema(
    {
        class: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },
        name: {
            type: String,
            required: true,
            trim: true
        },
        pricePerKm: {
            type: Number,
            required: true,
            min: 0
        },
        amenities: {
            type: [String],
            default: []
        },
        description: {
            type: String,
            required: false,
            trim: true
        },
        // Days of the week on which this class can be booked. Seeded data that
        // predates this field is treated as available every day.
        availableDays: {
            type: [String],
            enum: WEEK_DAYS,
            default: WEEK_DAYS
        }
    },
    {
        // The seeded collection uses camelCase, so the default pluralisation
        // ('ticketclasses') would point at an empty collection.
        collection: 'ticketClasses',
        timestamps: true
    }
);

const ticketClass = mongoose.model('TicketClass', ticketClassSchema);

export default ticketClass;
