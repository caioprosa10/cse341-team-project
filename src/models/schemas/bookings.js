// src/models/schemas/bookings.js
import mongoose from 'mongoose';

const passengerSchema = new mongoose.Schema(
    {
        firstName: {
            type: String,
            required: true,
            trim: true
        },
        lastName: {
            type: String,
            required: true,
            trim: true
        },
        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true
        },
        phone: {
            type: String,
            required: true,
            trim: true
        }
    },
    { _id: false }
);

const bookingSchema = new mongoose.Schema(
    {
        id: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },
        tripId: {
            type: String,
            required: true,
            trim: true
        },
        scheduleId: {
            type: Number,
            required: true
        },
        ticketClass: {
            type: String,
            required: true,
            trim: true
        },
        selectedDay: {
            type: String,
            required: true,
            trim: true
        },
        passengers: {
            type: [passengerSchema],
            required: true,
            validate: {
                validator: (passengers) => {
                    return Array.isArray(passengers) && passengers.length > 0 && passengers.length <= 8;
                },
                message: 'A booking needs between 1 and 8 passengers.'
            }
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        collection: 'bookings',
        // createdAt is written by the application, so only updatedAt is managed.
        timestamps: { createdAt: false, updatedAt: true }
    }
);

const booking = mongoose.model('Booking', bookingSchema);

export default booking;
