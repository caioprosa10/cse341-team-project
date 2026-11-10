# Kizuna Rail - Week 03 Specification

Refactor of the Kizuna Rail codebase to use Mongoose, to follow a clear
model / view / controller split, and to hydrate the dynamic parts of the pages
from JSON endpoints instead of EJS loops.

- Repository: https://github.com/caioprosa10/cse341-team-project
- Documentation: `/api-docs` (Swagger UI)

## Conventions that apply to every feature

### Layers
- `src/models/schemas/*.js` declares the Mongoose schema and nothing else.
- `src/models/*.js` holds the queries. A model function returns plain objects
  (`.lean()`) and never touches `req` or `res`.
- `src/controllers/*.js` holds two kinds of function: API controllers that send
  JSON, and EJS controllers that render a page. Controllers never import a
  schema directly; they go through the model.
- `src/routes/api-routes.js` declares the JSON endpoints and their Swagger
  comments. `src/routes/ejs-routes.js` declares the page routes.

### Database connection
`src/db/connect.js` opens one Mongoose connection with `mongoose.connect()` and
exposes the underlying native `Db` through `getDb()`, so the seed importer and
the existing test setup keep working on the same connection pool.

### Collections
Mongoose pluralises a model name to get a collection name, which would give
`ticketclasses` for `TicketClass` and miss the seeded `ticketClasses`
collection. Every schema therefore names its collection explicitly.

### Responses
- Success with a body: `200`, or `201` when something was created.
- A missing document: `404` with `{ "error": "<Thing> not found" }`.
- Invalid query input: `400` with `{ "error": "<what is wrong>" }`.
- Unexpected failure: `500` with a fixed message. The real error is logged on
  the server with `console.error`; the client never receives driver details.
- New endpoints answer with a bare JSON array. `GET /api/trains` keeps its older
  `{ "trains": [...] }` shape, because the trains page and `tests/trains.test.js`
  already depend on it.

---

## Feature Set 1: Trips

### Description
Expose trips through the API and turn the trip list page into a shell that the
browser fills in. The page keeps its markup in EJS; the cards come from
`/api/trips`. The region and season filters are built from the same response and
filter in the browser, so no page reload is needed.

### Data model - `trips`
| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string | yes | Custom id such as `alpine-panorama`. Unique. |
| `name` | string | yes | |
| `description` | string | no | |
| `region` | string | yes | `central`, `kansai`, ... |
| `startStation` | string | yes | References `stations.id`. |
| `endStation` | string | yes | References `stations.id`. |
| `duration` | string | yes | Human readable, such as `4.5 hours`. |
| `distance` | number | yes | Kilometres, minimum 0. |
| `highlights` | string[] | no | Defaults to `[]`. |
| `bestSeason` | string | yes | |
| `operatingMonths` | number[] | no | Month numbers 1-12. |
| `imageUrl` | string | no | |

### Model functions - `src/models/trips.js`
- `getAllTrips()` - every trip, sorted by name.
- `getTripById(id)` - one trip by its custom id, or `null`.

### API
| Method | Path | Success | Failures |
| --- | --- | --- | --- |
| GET | `/api/trips` | `200` array of trips | `500` |
| GET | `/api/trips/{id}` | `200` trip object | `404`, `500` |

### Pages
- `GET /trips` renders `trips/list` with only a title. The controller does not
  query the database.
- `GET /trips/{tripId}` renders `trips/details` with the trip and the month
  names. A missing trip is forwarded to the 404 handler.

### Test plan
- [ ] `GET /api/trips` returns 200 and six trips.
- [ ] `GET /api/trips/alpine-panorama` returns 200 and that trip.
- [ ] `GET /api/trips/not-a-trip` returns 404 with a JSON error.
- [ ] `/trips` shows every trip card after the page loads.
- [ ] The region filter narrows the cards without reloading the page.
- [ ] The season filter narrows the cards without reloading the page.
- [ ] Both filters together show the empty-state message when nothing matches.
- [ ] The page source contains no EJS loop over trips.
- [ ] `npm run lint` passes.

---

## Feature Set 2: Schedules

### Description
Serve the schedules of a trip from the API and let the trip details page reload
that section when the visitor picks a month.

### Data model - `schedules`
| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | number | yes | Unique. |
| `tripId` | string | yes | References `trips.id`. Indexed. |
| `departureTime` | string | yes | `HH:MM`. |
| `arrivalTime` | string | yes | `HH:MM`. |
| `daysOfWeek` | string[] | no | Lowercase weekday names. |
| `status` | boolean | no | Defaults to `true`. |

### The month decision
Schedule documents store weekdays, not months. The only month information in the
data is `trips.operatingMonths`. So filtering schedules by month means asking the
trip whether it runs that month: if it does not, the trip has no departures that
month and the endpoint returns an empty array. This keeps the rule in one place
and needs no change to the seeded data.

### Model functions - `src/models/schedules.js`
- `getSchedulesByTripId(tripId, month?)` - schedules for a trip, sorted by
  departure time. With a month, returns `[]` when the trip does not operate then.
- `getScheduleById(id)` - one schedule, used by the booking page.

### API
| Method | Path | Success | Failures |
| --- | --- | --- | --- |
| GET | `/api/trips/{id}/schedules` | `200` array | `500` |
| GET | `/api/trips/{id}/schedules?month={month}` | `200` array | `400`, `500` |

`month` must be a whole number from 1 to 12; anything else is a `400`.

### Pages
`GET /trips/{tripId}` no longer loads schedules. The details page renders a month
selector from `operatingMonths` and fetches the schedules on load and on change.

### Test plan
- [ ] `GET /api/trips/alpine-panorama/schedules` returns 200 and two schedules.
- [ ] `?month=7` returns the schedules, because the trip operates in July.
- [ ] `?month=1` returns an empty array, because it does not operate in January.
- [ ] `?month=0`, `?month=13` and `?month=abc` each return 400.
- [ ] The details page lists schedules without a reload when a month is picked.
- [ ] Picking a month the trip does not run shows the empty-state message.
- [ ] The details EJS controller no longer queries schedules.
- [ ] `npm run lint` passes.

---

## Feature Set 3: Bookings

### Description
Rename the `confirmations` collection to `bookings`, move the booking flow into
a controller backed by a Mongoose model, and add an admin page that lists every
booking from the API.

### Data model - `bookings`
| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string | yes | Confirmation code such as `JR8KD92L`. Unique. |
| `tripId` | string | yes | References `trips.id`. |
| `scheduleId` | number | yes | References `schedules.id`. |
| `ticketClass` | string | yes | References `ticketClasses.class`. |
| `selectedDay` | string | yes | Lowercase weekday name. |
| `passengers` | object[] | yes | 1 to 8 passengers. |
| `createdAt` | date | yes | Set by the application. |

Each passenger has `firstName`, `lastName`, `email` and `phone`, all required.
Passengers are stored as subdocuments without their own `_id`.

### Model functions - `src/models/bookings.js`
- `createBooking(data)` - writes only the documented fields, so an unexpected
  form field never reaches the database.
- `getAllBookings()` - every booking, newest first.
- `getBookingById(id)` - one booking by its confirmation code.

### API
| Method | Path | Success | Failures |
| --- | --- | --- | --- |
| GET | `/api/bookings` | `200` array, newest first | `500` |

### Pages
- `GET /trips/booking/{scheduleId}` renders the form. A missing schedule or trip
  is forwarded to the 404 handler.
- `POST /trips/book` stores the booking and redirects to the confirmation. An
  incomplete form is forwarded as a 400.
- `GET /trips/confirmation/{id}` renders the stored booking.
- `GET /bookings-admin` renders a shell that the browser fills from
  `/api/bookings`.

### Test plan
- [ ] The seed importer creates an empty `bookings` collection and no
      `confirmations` collection.
- [ ] Completing the booking form stores a document and redirects.
- [ ] The confirmation page shows the stored booking.
- [ ] `GET /api/bookings` returns 200 and includes the new booking first.
- [ ] `/bookings-admin` lists the bookings after the page loads.
- [ ] `/bookings-admin` shows the empty-state message on a fresh database.
- [ ] No code refers to a `confirmations` collection.
- [ ] `npm run lint` passes.

---

## Feature Set 4: Ticket Classes

### Description
Serve the ticket classes from the API and gray out the ones that are not sold on
the day the visitor picked on the booking form.

### Data model - `ticketClasses`
| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `class` | string | yes | `standard`, `premium`, `first`. Unique. |
| `name` | string | yes | |
| `pricePerKm` | number | yes | Yen per kilometre. |
| `amenities` | string[] | no | |
| `description` | string | no | |
| `availableDays` | string[] | no | Weekdays this class is sold. |

`availableDays` is new. The seeded data had no notion of availability, so there
was nothing to filter on; the field was added to the schema and to the seed:
standard every day, premium every day except Monday, first class Friday to
Sunday. Documents without the field default to every day.

### Model functions - `src/models/ticket-classes.js`
- `getAllTicketClasses()` - every class, cheapest first.
- `getTicketClassesForDay(day)` - only the classes sold on that weekday.

### API
| Method | Path | Success | Failures |
| --- | --- | --- | --- |
| GET | `/api/ticket-classes` | `200` array | `500` |
| GET | `/api/ticket-classes?day={day}` | `200` array | `400`, `500` |

`day` must be a lowercase weekday name; anything else is a `400`.

### Pages
The booking page fetches `/api/ticket-classes?day=` whenever a day is selected,
disables the radio of every class that is not returned and grays its card out. If
the selected class becomes unavailable, the first available class is selected so
the form can still be submitted.

### Test plan
- [ ] `GET /api/ticket-classes` returns 200 and three classes.
- [ ] `?day=monday` omits premium and first class.
- [ ] `?day=saturday` returns all three.
- [ ] `?day=funday` returns 400.
- [ ] Picking Monday on the booking form grays out and disables premium and first.
- [ ] Picking Saturday re-enables them.
- [ ] Selecting an unavailable class is impossible, and the summary stays correct.
- [ ] `npm run lint` passes.

---

## Feature Set 5: Stations

### Description
Serve stations from the API and let the trip details page expand the start and
end station to show the full station record.

### Data model - `stations`
| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string | yes | Custom id such as `nagoya`. Unique. |
| `name` | string | yes | |
| `prefecture` | string | yes | |
| `region` | string | yes | |
| `facilities` | string[] | no | |
| `description` | string | no | |

### Model functions - `src/models/stations.js`
- `getAllStations()` - every station, sorted by name.
- `getStationById(id)` - one station by its custom id.

### API
| Method | Path | Success | Failures |
| --- | --- | --- | --- |
| GET | `/api/stations` | `200` array | `500` |
| GET | `/api/stations/{id}` | `200` station object | `404`, `500` |

### Pages
Each station on the trip details page gets a "Station info" button. The first
click fetches the station and renders it into a panel below the name; later
clicks toggle the panel without fetching again.

### Test plan
- [ ] `GET /api/stations` returns 200 and twelve stations.
- [ ] `GET /api/stations/nagoya` returns 200 and that station.
- [ ] `GET /api/stations/not-a-station` returns 404.
- [ ] The details page shows the station panel on the first click.
- [ ] Clicking again hides it, and a third click shows it without a new request.
- [ ] `npm run lint` passes.

---

## Out of scope this week
- Writing to the API. Every new endpoint is read-only; bookings are still created
  by the HTML form.
- Pagination and server-side search. The trip filters run in the browser over the
  full list, which is why the list page now loads from an endpoint.
- Authentication on `/bookings-admin`. The page is open, as the rest of the site
  is this week.
