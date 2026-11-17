// src/middleware/auth.js

/*
 * loadSessionUser is not a guard. It copies the signed-in user from the
 * session onto req.user, for the guards below, and onto res.locals.user, so
 * every EJS template can ask who is signed in without each controller
 * passing the user through. Register it after the session middleware and
 * before the routes.
 */
const loadSessionUser = (req, res, next) => {
    req.user = req.session && req.session.user ? req.session.user : null;
    res.locals.user = req.user;

    return next();
};

const isLoggedIn = (req) => {
    return Boolean(req.user);
};

const hasRole = (req, role) => {
    return Boolean(req.user) && req.user.role === role;
};

// Where to send the visitor back to once they have signed in.
const loginRedirect = (req) => {
    return `/login?next=${encodeURIComponent(req.originalUrl)}`;
};

const requireApiLogin = (req, res, next) => {
    if (!isLoggedIn(req)) {
        return res.status(401).json({ message: 'Authentication required' });
    }

    return next();
};

const requirePageLogin = (req, res, next) => {
    if (!isLoggedIn(req)) {
        return res.redirect(loginRedirect(req));
    }

    return next();
};

const requireApiRole = (role) => (req, res, next) => {
    if (!isLoggedIn(req)) {
        return res.status(401).json({ message: 'Authentication required' });
    }

    if (!hasRole(req, role)) {
        return res.status(403).json({ message: 'Forbidden' });
    }

    return next();
};

const requirePageRole = (role) => (req, res, next) => {
    if (!isLoggedIn(req)) {
        return res.redirect(loginRedirect(req));
    }

    if (!hasRole(req, role)) {
        return res.status(403).render('errors/403', { title: 'Forbidden' });
    }

    return next();
};

export {
    loadSessionUser,
    requireApiLogin,
    requireApiRole,
    requirePageLogin,
    requirePageRole
};
