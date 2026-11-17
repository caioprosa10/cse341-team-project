import express from 'express';
import session from 'express-session';
import { loadSessionUser } from './src/middleware/auth.js';
import { randomBytes } from 'node:crypto';
import Path from 'path';
import { fileURLToPath } from 'url';
import pkg from './package.json' with { type: 'json' };
import globalMiddleware from './src/middleware/global.js';
import swaggerDocument from './swagger.json' with { type: 'json' };
import swaggerUi from 'swagger-ui-express';
import routes from './src/routes/router.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = Path.dirname(__filename);

const app = express();

// Add version info to res.locals for access in templates.
app.use((req, res, next) => {
    res.locals.appVersion = pkg.version;
    next();
});

// Configure static files and EJS templates.
app.use(express.static(Path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', Path.join(__dirname, 'src/views'));

// Parse JSON and URL-encoded request bodies.
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/*
 * Session management. This has to be registered before anything that reads
 * req.session, so it comes before the routes and before loadSessionUser.
 * saveUninitialized is false so that a visitor who never signs in does not
 * get a stored session, and rolling measures the one hour from the user's
 * last request instead of from the moment they signed in.
 */
const sessionSecret = process.env.SESSION_SECRET || randomBytes(32).toString('hex');

if (!process.env.SESSION_SECRET) {
    console.warn('SESSION_SECRET is not set. Using a temporary secret, so sessions will not survive a restart.');
}

app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 1000
    }
}));

// Copies the session user onto req.user and res.locals.user for the guards
// and for the templates. Not a guard itself.
app.use(loadSessionUser);

// Interactive API documentation.
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use(globalMiddleware);
app.use('/', routes);

// Catch requests that did not match a route.
app.use((req, res, next) => {
    const err = new Error('Page Not Found');
    err.status = 404;
    next(err);
});

// Render the appropriate error page.
app.use((err, req, res, next) => {
    const status = err.status || 500;
    const template = status === 404 ? '404' : '500';
    const context = {
        title: status === 404 ? 'Page Not Found' : 'Server Error',
        error: err.message,
        stack: err.stack
    };

    return res.status(status).render(`errors/${template}`, context);
});

export default app;
