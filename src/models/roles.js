// src/models/roles.js
import role from './schemas/roles.js';

const getAllRoles = async () => {
    return role.find({}).sort({ name: 1 }).lean();
};

const getRoleByName = async (name) => {
    return role.findOne({ name }).lean();
};

export { getAllRoles, getRoleByName };
