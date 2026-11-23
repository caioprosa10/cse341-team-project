# Week 05 Spec: Pagination and Searching

Feature Set 1: Trip List. The `/trips` page is filled in by `public/js/main.js`
from `GET /api/trips`. Until now the endpoint answered with every trip in one
bare array, and the page filtered that array in the browser. This spec splits
the work into two pull requests:

1. **Pagination.** `/api/trips` answers one page at a time with metadata, and
   the page steps through the trips ten at a time.
2. **Searching and filtering.** `/api/trips` filters by region and season and
   searches the trip names and descriptions on the server, still paged.

- Repository: https://github.com/caioprosa10/cse341-team-project
- Documentation: `/api-docs` (Swagger UI)

## Conventions

- Query parameters are read and checked in `src/includes/`, which has no
  Express or Mongoose imports, so the rules can be reused by the other list
  endpoints and tested on their own.
- Bad query input answers `400` with `{ "error": "<what is wrong>" }`, the same
  shape the Week 03 endpoints use. Anything else that fails answers `500` with a
  fixed message and the real error goes to `console.error`.
- A paged response is an object, never a bare array:
  `{ "trips": [ ... ], "meta": { ... } }`. The items keep the collection's name,
  as `/api/trains` already does with `{ "trains": [ ... ] }`.

---

## Pull Request 1: Paginated trip list

### Description
Return the trips one page at a time so a client never has to download the whole
catalogue, and add Previous / Next controls to `/trips` that step through the
results ten at a time.

### API: `GET /api/trips`

| Query parameter | Type | Default | Rule |
| --- | --- | --- | --- |
| `page` | integer | `1` | Whole number, 1 or more |
| `limit` | integer | `10` | Whole number from 1 to 50 |

An empty value (`?page=`) counts as missing and uses the default. Anything else
that is not a plain whole number in range is a `400`: `0`, `-1`, `1.5`, `abc`,
`1e3`, a repeated parameter (`?page=1&page=2`) and `limit` above 50.

Trips are sorted by `name`, then by `_id`, so the order is stable and no trip
can appear on two pages.

#### 200 response

```json
{
  "trips": [
    { "id": "alpine-panorama", "name": "Alpine Panorama Express", "...": "..." }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "totalItems": 6,
    "totalPages": 1,
    "hasPreviousPage": false,
    "hasNextPage": false
  }
}
```

- `totalPages` is `Math.ceil(totalItems / limit)`, so it is `0` when nothing
  matches.
- A page past the last one is not an error. It answers `200` with an empty
  `trips` array and the real totals, so the client can tell where the results
  end.

#### 400 response

```json
{ "error": "limit must be a whole number from 1 to 50" }
```

### Code
| File | Change |
| --- | --- |
| `src/includes/pagination.js` | New. `parsePagination(query)`, `buildPaginationMeta(...)` and `QueryError`. |
| `src/models/trips.js` | New `getTripsPage({ skip, limit })` returning `{ trips, totalItems }`. |
| `src/controllers/trips.js` | `getAllTrips` becomes `listTrips` and answers with `{ trips, meta }`. |
| `src/routes/api-routes.js` | Swagger: `page` and `limit` parameters, response schema, `PageMeta` and `Error` components. |
| `swagger.json` | Regenerated. This also brings in the Week 04 routes that were missing. |
| `src/views/trips/list.ejs` | Result summary and the pagination `<nav>`. |
| `public/js/main.js` | The trip list loads one page at a time; the trips admin page reads `payload.trips`. |
| `public/css/utilities/hydration.css` | Pagination styles. |
| `tests/trips.test.js` | New endpoint tests. |

### Page behaviour
- `/trips` reads `page` and `limit` from its own address and passes them to the
  API, so `/trips?page=2` opens on page 2 and a refresh stays there.
- Previous / Next update the address with `history.pushState`, so the browser
  back button returns to the previous page of trips without a reload.
- The controls show "Page X of Y", and "Showing A-B of N trips" sits above the
  list. Previous is disabled on page 1, Next on the last page.
- A page number past the end (an old bookmark) is replaced with the last page.
- A `400` from the API is shown to the visitor with the API's message.
- The region and season dropdowns still filter in the browser, so in this pull
  request they narrow the page on screen only. Pull Request 2 moves them to
  the API.

### Shared endpoint
`/api/trips` also feeds the trips admin page (Feature Set 5). Its response
changes from an array to `{ trips, meta }`, so the admin page now reads
`payload.trips` and asks for `?limit=50`, the largest page, until that page gets
pagination of its own.

### Test plan
- [ ] `GET /api/trips` returns 200, six trips sorted by name, and
      `meta = { page: 1, limit: 10, totalItems: 6, totalPages: 1, hasPreviousPage: false, hasNextPage: false }`.
- [ ] `GET /api/trips?page=2&limit=4` returns the last two trips with `hasPreviousPage: true` and `hasNextPage: false`.
- [ ] With 15 trips in the database, page 1 holds 10 and page 2 holds 5, with no trip on both.
- [ ] `GET /api/trips?page=99` returns 200, `trips: []` and the real totals.
- [ ] `page=0`, `page=-1`, `page=1.5`, `page=abc`, `page=1&page=2`, `limit=0`, `limit=51` and `limit=ten` each return 400 with a JSON error that names the parameter.
- [ ] `/trips` shows "Page 1 of 1" and both buttons disabled with the starter data.
- [ ] `/trips?limit=2` shows three pages; Next and Previous step through them and update the address.
- [ ] The browser back button returns to the previous page of trips.
- [ ] `/trips?limit=2&page=99` moves to page 3.
- [ ] `/trips?page=abc` shows the API's error message and no pagination controls.
- [ ] `/admin/trips` still lists every trip.
- [ ] Swagger UI shows the new parameters and the response example.
- [ ] `npm test` and `npm run lint` pass.
