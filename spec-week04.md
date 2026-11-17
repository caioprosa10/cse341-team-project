# Week 04 Spec: Authentication and Authorization

Kizuna Rail has no concept of a user. Every page and every endpoint is open,
and the admin pages added in Week 03 are reachable by anyone who knows the
URL. This spec covers all five Week 04 feature sets: session based
authentication, the pages that depend on it, and the three protected admin
pages with their update and delete endpoints.

## 1. Data model

### roles

One document per role. The role name is the only field, and it is unique.

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `name` | String | `customer` or `admin`, unique, required |

The seed script inserts both roles. `initialize.js` replaces the starter
collections on every import, so `roles` is seeded the same way.

### users

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `name` | String | display name, required |
| `email` | String | required, unique, lowercase, trimmed |
| `passwordHash` | String | bcrypt hash, required. Never returned by the API |
| `role` | ObjectId | reference to `roles`, required |
| `createdAt` / `updatedAt` | Date | from `timestamps: true` |

The plain password is never stored and never logged. `passwordHash` is
excluded from every API response by a projection in the model layer, not by
deleting the field in the controller, so a new endpoint cannot leak it by
forgetting to strip it.

**The seed does not touch `users`.** `npm run db:import` replaces the starter
collections and clears bookings, but accounts created by registering must
survive a re-import, otherwise every team member loses their login whenever
anyone re-seeds.

### Session

After a successful login the session holds only what the access checks need:

```js
req.session.user = { id, name, email, role }   // role is the NAME, not the id
```

The role name is copied into the session at login so that each guarded request
is a string comparison instead of a database round trip. The trade-off is
recorded under "Decisions".

## 2. Middleware

`src/middleware/auth.js` exports five functions.

| Function | Not signed in | Signed in, wrong role |
|---|---|---|
| `loadSessionUser` | sets `req.user = null` and continues | n/a |
| `requireApiLogin` | `401` JSON | n/a |
| `requirePageLogin` | redirect to `/login?next=<path>` | n/a |
| `requireApiRole(role)` | `401` JSON | `403` JSON |
| `requirePageRole(role)` | redirect to `/login?next=<path>` | `403` page |

`loadSessionUser` is not a guard. It copies the session user onto `req.user`
and `res.locals.user` so every EJS template can ask whether someone is signed
in without each controller passing the user through. It is registered after
the session middleware and before the routes.

Ownership is a separate check from role. A `customer` may read and change
their own user document and the bookings where their email appears as a
passenger; an `admin` may change anything. Ownership is enforced in the
controller, because it depends on the document being acted upon, not only on
the session.

## 3. Pages

| Route | Guard | Behaviour |
|---|---|---|
| `GET /register` | none | registration form. Already signed in → redirect to the dashboard |
| `POST /register` | none | creates a `customer`, signs the user in, redirects to `/dashboard` |
| `GET /login` | none | login form. Already signed in → redirect to the dashboard |
| `POST /login` | none | on success redirects admins to `/admin`, everyone else to `/dashboard` (or to `next` when present) |
| `POST /logout` | none | destroys the session, redirects to `/` |
| `GET /admin` | `requirePageRole('admin')` | Admin Dashboard, with links to the three admin pages |
| `GET /dashboard` | `requirePageLogin` | user dashboard: welcome by display name, their bookings, links to the booking and user admin pages |
| `GET /admin/users` | `requirePageLogin` | admin sees every user, a customer sees only their own record |
| `GET /bookings-admin` | `requirePageLogin` | admin sees every booking, a customer sees only bookings where their email is a passenger |
| `GET /admin/trips` | `requirePageRole('admin')` | trip admin page |

Registration always assigns `customer` on the server. The role is never read
from the submitted form, so posting `role=admin` to `/register` cannot create
an administrator.

## 4. API

Every list below is hydrated by `public/js/main.js`, so each page gets its
data from these endpoints rather than from EJS loops.

| Method | Path | Guard | Success | Errors |
|---|---|---|---|---|
| `GET` | `/api/users` | `requireApiLogin` | `200` every user for an admin, an array with only the caller for a customer | `401` |
| `GET` | `/api/users/:id` | `requireApiLogin` + ownership | `200` | `401`, `403`, `404` |
| `PUT` | `/api/users/:id` | `requireApiLogin` + ownership | `200` updated user | `400`, `401`, `403`, `404`, `409` duplicate email |
| `DELETE` | `/api/users/:id` | `requireApiLogin` + ownership | `204` | `401`, `403`, `404` |
| `GET` | `/api/bookings` | `requireApiLogin` | `200` all for an admin, own for a customer | `401` |
| `PUT` | `/api/bookings/:id` | `requireApiLogin` + ownership | `200` | `400`, `401`, `403`, `404` |
| `DELETE` | `/api/bookings/:id` | `requireApiLogin` + ownership | `204` | `401`, `403`, `404` |
| `PUT` | `/api/trips/:id` | `requireApiRole('admin')` | `200` | `400`, `401`, `403`, `404` |
| `DELETE` | `/api/trips/:id` | `requireApiRole('admin')` | `204` | `401`, `403`, `404` |

`GET /api/trips`, `/api/stations`, `/api/schedules` and `/api/ticket-classes`
stay public. They feed the public catalogue pages, and closing them would
break the trip list for signed-out visitors.

`GET /api/bookings` changes meaning rather than access: it was public and
returned everything. It now requires a login and filters by the caller.

## 5. What each kind of visitor sees

**Signed out.** The header shows Register and Login. The public catalogue
works as before. Asking for `/dashboard`, `/admin`, `/admin/users`,
`/admin/trips` or `/bookings-admin` redirects to `/login` with `next` set, so
signing in lands on the page that was asked for. Calling a protected endpoint
from the console returns `401` JSON.

**Signed in as `customer`.** The header shows Dashboard and Logout. The
dashboard greets them by display name and lists the bookings carrying their
email. `/admin/users` shows only their own record, which they may edit or
delete. `/bookings-admin` shows only their own bookings. `/admin` and
`/admin/trips` render the 403 page. `PUT /api/users/<someone else>` returns
`403`.

**Signed in as `admin`.** Login lands on `/admin`. Every list is unfiltered,
and every update and delete is allowed.

## 6. Decisions

**The role name is copied into the session, not looked up per request.** The
alternative was storing only the user id and calling `populate('role')` inside
every guard, which costs a database round trip on every protected request. The
cost of caching is that a role changed in the database does not take effect
until the user signs in again. Roles here are assigned at registration and
changed by hand, so a stale role is a rare and recoverable problem, while the
extra query would be paid on every request forever.

**`passwordHash` is excluded in the model layer.** Every user query uses the
same projection, so an endpoint added later cannot leak the hash by forgetting
to delete the field.

**Ownership lives in the controller, not in the middleware.** A guard runs
before the document is loaded, so it can only answer "is this a customer",
not "is this *their* booking". Putting ownership in the middleware would mean
loading the document twice.

**The default session store is kept.** `express-session` stores sessions in
memory, which loses every login when the process restarts. For local
development and this assignment that is acceptable; a deployed instance would
need a shared store such as `connect-mongo`.

## 7. Test plan

Run with a seeded database and at least one `customer` and one `admin`.

### Registration and login
1. `POST /register` with a new email creates the account, signs the user in and
   lands on `/dashboard`.
2. Registering the same email again returns a friendly message, not a raw
   MongoDB duplicate-key error.
3. `POST /register` with `role=admin` in the body still creates a `customer`.
4. Login with a wrong password is refused and does not reveal whether the email
   exists.
5. Login as an admin lands on `/admin`; login as a customer lands on
   `/dashboard`.
6. Logout destroys the session: the header returns to Register and Login, and
   `/dashboard` redirects to `/login`.

### Page guards
7. Signed out, each of `/dashboard`, `/admin`, `/admin/users`, `/admin/trips`
   and `/bookings-admin` redirects to `/login`.
8. Signed in as a customer, `/admin` and `/admin/trips` render the 403 page.
9. Signing in from a redirect lands on the originally requested page.

### API guards
10. Signed out, `GET /api/users`, `GET /api/bookings`, `PUT /api/trips/:id` and
    `DELETE /api/trips/:id` each return `401` JSON.
11. Signed in as a customer, `PUT` and `DELETE /api/trips/:id` return `403`.
12. Signed in as a customer, `GET /api/users` returns only that user.
13. Signed in as a customer, `PUT /api/users/<another id>` returns `403`.
14. Signed in as an admin, `GET /api/users` returns every user.

### Update and delete
15. Editing a user on `/admin/users` updates the row without a page reload.
16. Deleting a user removes the row without a page reload.
17. Editing and deleting a booking on `/bookings-admin` behaves the same way.
18. Editing and deleting a trip on `/admin/trips` behaves the same way.
19. `PUT /api/users/:id` with an email already in use returns `409`.
20. No API response anywhere contains `passwordHash`.
