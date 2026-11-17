// src/controllers/users.js
import { deleteUser, getAllUsers, getUserById, updateUser } from '../models/users.js';

const DUPLICATE_KEY = 11000;

/*
 * Ownership is checked here rather than in a guard. A guard runs before the
 * document is loaded, so it can answer "is this an admin" but not "is this
 * their record". Any user may change their own account; an admin may change
 * anyone's.
 */
const mayActOn = (req, userId) => {
    return req.user.role === 'admin' || req.user.id === String(userId);
};

/* ------------------------------------------------------------------ *
 * API controllers                                                    *
 * ------------------------------------------------------------------ */

const listUsers = async (req, res, next) => {
    try {
        if (req.user.role === 'admin') {
            return res.status(200).json(await getAllUsers());
        }

        // A customer sees only themselves, returned as a list so the page can
        // render the same way for both roles.
        const own = await getUserById(req.user.id);

        return res.status(200).json(own ? [own] : []);
    } catch (error) {
        return next(error);
    }
};

const getUser = async (req, res, next) => {
    try {
        if (!mayActOn(req, req.params.id)) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const found = await getUserById(req.params.id);

        if (!found) {
            return res.status(404).json({ message: 'User not found' });
        }

        return res.status(200).json(found);
    } catch (error) {
        return next(error);
    }
};

const putUser = async (req, res, next) => {
    try {
        if (!mayActOn(req, req.params.id)) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const updated = await updateUser(req.params.id, req.body);

        if (updated === null) {
            return res.status(400).json({ message: 'Send a name or an email to update.' });
        }

        // Keep the session in step when a user renames their own account.
        if (req.user.id === String(req.params.id)) {
            req.session.user = { ...req.session.user, name: updated.name, email: updated.email };
        }

        return res.status(200).json(updated);
    } catch (error) {
        if (error && error.code === DUPLICATE_KEY) {
            return res.status(409).json({ message: 'That email is already in use.' });
        }

        if (error && error.name === 'CastError') {
            return res.status(404).json({ message: 'User not found' });
        }

        return next(error);
    }
};

const removeUser = async (req, res, next) => {
    try {
        if (!mayActOn(req, req.params.id)) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const wasDeleted = await deleteUser(req.params.id);

        if (!wasDeleted) {
            return res.status(404).json({ message: 'User not found' });
        }

        return res.status(204).send();
    } catch (error) {
        if (error && error.name === 'CastError') {
            return res.status(404).json({ message: 'User not found' });
        }

        return next(error);
    }
};

/* ------------------------------------------------------------------ *
 * EJS controllers                                                    *
 * ------------------------------------------------------------------ */

// The table is filled by public/js/main.js from /api/users, so this
// controller does not query the database.
const usersAdminPage = (req, res) => {
    return res.render('admin/users', { title: 'User Admin' });
};

export { getUser, listUsers, putUser, removeUser, usersAdminPage };
