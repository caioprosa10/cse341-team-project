// src/models/schemas/schedules.js
import mongoose from 'mongoose';

const scheduleSchema = new mongoose.Schema(
    {
        id: {
            type: Number,
            required: true,
            unique: true
        },
        tripId: {
            type: String,
            required: true,
            trim: true,
            index: true
        },
        departureTime: {
            type: String,
            required: true,
            trim: true
        },
        arrivalTime: {
            type: String,
            required: true,
            trim: true
        },
        daysOfWeek: {
            type: [String],
            default: []
        },
        status: {
            type: Boolean,
            default: true
        }
    },
    {
        collection: 'schedules',
        timestamps: true
    }
);

const schedule = mongoose.model('Schedule', scheduleSchema);

export default schedule;
