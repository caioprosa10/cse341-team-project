// src/models/schemas/roles.js
import mongoose from 'mongoose';

const roleSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            enum: ['customer', 'admin']
        }
    },
    {
        collection: 'roles',
        timestamps: true
    }
);

const role = mongoose.model('Role', roleSchema);

export default role;
