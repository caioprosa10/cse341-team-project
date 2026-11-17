// src/models/users.js
import bcrypt from 'bcrypt';
import { getRoleByName } from './roles.js';
import user from './schemas/users.js';

const SALT_ROUNDS = 12;

/*
 * Every query that can reach an API response uses this projection, so a new
 * endpoint cannot leak the hash by forgetting to strip the field.
 * findUserByEmail is the one exception: the login controller needs the hash
 * to compare the password, and it never sends that document to the client.
 */
const WITHOUT_HASH = '-passwordHash';

const createUser = async ({ name, email, password, roleName = 'customer' }) => {
    const assignedRole = await getRoleByName(roleName);

    if (!assignedRole) {
        throw new Error(`The role "${roleName}" is not in the database.`);
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const created = await user.create({
        name,
        email,
        passwordHash,
        role: assignedRole._id
    });

    return user.findById(created._id).select(WITHOUT_HASH).populate('role').lean();
};

const findUserByEmail = async (email) => {
    const normalised = String(email || '').toLowerCase().trim();

    return user.findOne({ email: normalised }).populate('role').lean();
};

const verifyPassword = async (password, passwordHash) => {
    if (!password || !passwordHash) {
        return false;
    }

    return bcrypt.compare(password, passwordHash);
};

const getAllUsers = async () => {
    return user.find({}).select(WITHOUT_HASH).populate('role').sort({ name: 1 }).lean();
};

const getUserById = async (id) => {
    return user.findById(id).select(WITHOUT_HASH).populate('role').lean();
};

/*
 * Only the display name and the email can be changed here. The role is not
 * accepted, so a customer cannot promote themselves by adding a field to the
 * request body.
 */
const updateUser = async (id, { name, email }) => {
    const changes = {};

    if (typeof name === 'string' && name.trim()) {
        changes.name = name.trim();
    }

    if (typeof email === 'string' && email.trim()) {
        changes.email = email.toLowerCase().trim();
    }

    if (Object.keys(changes).length === 0) {
        return null;
    }

    return user
        .findByIdAndUpdate(id, changes, { new: true, runValidators: true })
        .select(WITHOUT_HASH)
        .populate('role')
        .lean();
};

const deleteUser = async (id) => {
    const removed = await user.findByIdAndDelete(id).select(WITHOUT_HASH).lean();

    return Boolean(removed);
};

export {
    createUser,
    deleteUser,
    findUserByEmail,
    getAllUsers,
    getUserById,
    updateUser,
    verifyPassword
};
