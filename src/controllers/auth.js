// src/controllers/auth.js
import { createUser, findUserByEmail, verifyPassword } from '../models/users.js';

// The role is never read from the submitted form: public registration is
// always a customer, so posting role=admin cannot create an administrator.
const PUBLIC_ROLE = 'customer';

const DUPLICATE_KEY = 11000;

// Only allow a relative path, so ?next= cannot send the user to another site.
const safeNext = (value) => {
    if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
        return '';
    }

    return value;
};

const homeFor = (sessionUser) => {
    return sessionUser.role === 'admin' ? '/admin' : '/dashboard';
};

const toSessionUser = (userDocument) => {
    return {
        id: String(userDocument._id),
        name: userDocument.name,
        email: userDocument.email,
        role: userDocument.role && userDocument.role.name ? userDocument.role.name : PUBLIC_ROLE
    };
};

/* ------------------------------------------------------------------ *
 * Pages                                                              *
 * ------------------------------------------------------------------ */

const registerPage = (req, res) => {
    if (req.user) {
        return res.redirect(homeFor(req.user));
    }

    return res.render('auth/register', {
        title: 'Create an Account',
        next: safeNext(req.query.next),
        values: { name: '', email: '' },
        error: null
    });
};

const loginPage = (req, res) => {
    if (req.user) {
        return res.redirect(homeFor(req.user));
    }

    return res.render('auth/login', {
        title: 'Sign In',
        next: safeNext(req.query.next),
        values: { email: '' },
        error: null
    });
};

const adminDashboardPage = (req, res) => {
    return res.render('admin/dashboard', { title: 'Admin Dashboard' });
};

/* ------------------------------------------------------------------ *
 * Actions                                                            *
 * ------------------------------------------------------------------ */

const register = async (req, res, next) => {
    const { name, email, password, confirmPassword } = req.body;
    const wanted = safeNext(req.body.next);
    const values = { name: name || '', email: email || '' };

    const fail = (message) => {
        return res.status(400).render('auth/register', {
            title: 'Create an Account',
            next: wanted,
            values,
            error: message
        });
    };

    if (!name || !email || !password) {
        return fail('Please fill in your name, email and password.');
    }

    if (password.length < 8) {
        return fail('Your password must be at least 8 characters long.');
    }

    if (password !== confirmPassword) {
        return fail('The two passwords do not match.');
    }

    try {
        const created = await createUser({ name, email, password, roleName: PUBLIC_ROLE });

        req.session.user = toSessionUser(created);

        return res.redirect(wanted || homeFor(req.session.user));
    } catch (error) {
        if (error && error.code === DUPLICATE_KEY) {
            return fail('An account with that email already exists. Try signing in instead.');
        }

        return next(error);
    }
};

const login = async (req, res, next) => {
    const { email, password } = req.body;
    const wanted = safeNext(req.body.next);

    // The same message for an unknown email and a wrong password, so the form
    // cannot be used to find out which addresses have accounts.
    const fail = () => {
        return res.status(401).render('auth/login', {
            title: 'Sign In',
            next: wanted,
            values: { email: email || '' },
            error: 'That email and password do not match an account.'
        });
    };

    if (!email || !password) {
        return fail();
    }

    try {
        const found = await findUserByEmail(email);

        if (!found) {
            return fail();
        }

        const matches = await verifyPassword(password, found.passwordHash);

        if (!matches) {
            return fail();
        }

        req.session.user = toSessionUser(found);

        return res.redirect(wanted || homeFor(req.session.user));
    } catch (error) {
        return next(error);
    }
};

const logout = (req, res, next) => {
    if (!req.session) {
        return res.redirect('/');
    }

    return req.session.destroy((error) => {
        if (error) {
            return next(error);
        }

        res.clearCookie('connect.sid');

        return res.redirect('/');
    });
};

export {
    adminDashboardPage,
    login,
    loginPage,
    logout,
    register,
    registerPage
};
