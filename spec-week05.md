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

---

## Pull Request 2: Filter by region and season, and search by keyword

### Description
Move the region and season filters from the browser to the API, add a keyword
search over the trip names and descriptions, and keep the results paged. Before
this, the dropdowns could only narrow the page already on screen; now every
filter runs against the whole collection and the paging counts the matches.

### API: `GET /api/trips`

New query parameters, all optional and combinable with each other and with
`page` and `limit`. A trip must match every filter that is given.

| Query parameter | Type | Rule | MongoDB filter |
| --- | --- | --- | --- |
| `region` | string | One of the regions in the trips collection. Trimmed and lowercased first. | `{ region }` |
| `season` | string | One of the best seasons in the trips collection. Trimmed and lowercased first. | `{ bestSeason: season }` |
| `q` | string | At most 100 characters after trimming. | `{ $or: [{ name: /q/i }, { description: /q/i }] }` |

- A blank value (`?q=` or `?q=%20`) counts as missing.
- The keyword is escaped before it becomes a regular expression, so `(` or `.*`
  is searched for literally and cannot break or widen the query.
- A region or season that does not exist is a `400` whose message lists the
  valid values, rather than an empty page that looks like "no trips".
- A repeated parameter (`?region=a&region=b`) is a `400`.

#### 200 response
`meta` gains `filters`, the values that were actually applied (after trimming
and lowercasing), with `null` for a filter that was not used:

```json
{
  "trips": [
    { "id": "alpine-panorama", "name": "Alpine Panorama Express", "...": "..." },
    { "id": "gorge-explorer", "name": "Kurobe Gorge Explorer", "...": "..." }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "totalItems": 2,
    "totalPages": 1,
    "hasPreviousPage": false,
    "hasNextPage": false,
    "filters": { "region": "central", "season": "autumn", "q": null }
  }
}
```

#### 400 response

```json
{ "error": "region must be one of: central, hokkaido, kansai, northern" }
```

### API: `GET /api/trips/filters` (new)
Answers `200` with the distinct regions and best seasons, sorted:

```json
{
  "regions": ["central", "hokkaido", "kansai", "northern"],
  "seasons": ["autumn", "spring", "summer", "winter"]
}
```

The page fills its dropdowns from here, because a single page of trips no
longer contains every region and season. It is registered before
`/api/trips/:id` so that `filters` is not read as a trip id.

### Code
| File | Change |
| --- | --- |
| `src/includes/trip-filters.js` | New. `parseTripFilters(query, allowed)` returns `{ filters, mongoFilter }`; `escapeRegex(text)`. |
| `src/models/trips.js` | `getTripsPage` takes a `filter`; new `getTripFilterOptions()` using `distinct`. |
| `src/controllers/trips.js` | `listTrips` applies the filters and adds `meta.filters`; new `listTripFilters`. |
| `src/routes/api-routes.js` | New route `/api/trips/filters`; Swagger for the new parameters, `TripFilters` component and the new route. |
| `swagger.json` | Regenerated. |
| `src/views/trips/list.ejs` | The filters become a search form: both dropdowns, a keyword box, Search and Clear. |
| `public/js/main.js` | Filters go to the API through the address bar; no more filtering in the browser. |
| `public/css/utilities/hydration.css` | Filter form styles. |
| `tests/trips.test.js` | Filter, search and validation tests. |

### Page behaviour
- The dropdowns apply as soon as they change. The keyword applies on Enter or
  Search, so the API is not called on every keystroke.
- Every filter change goes back to page 1 and keeps the page size.
- Clear resets both dropdowns and the keyword.
- The filters are in the address (`/trips?region=central&q=gorge`), so a link
  opens with the same filters selected, and back / forward restore them.
- The summary uses `meta.filters`, for example
  "Showing 1-2 of 2 trips (region Central, best in autumn)".
- When nothing matches, the empty message shows and the pagination hides.

### Test plan
- [ ] `GET /api/trips` has `meta.filters = { region: null, season: null, q: null }`.
- [ ] `?region=kansai` returns Sagano Romantic Train and Sakura Valley Limited.
- [ ] `?season=autumn` returns three trips.
- [ ] `?region=central&season=autumn` returns Alpine Panorama Express and Kurobe Gorge Explorer.
- [ ] `?region=Kansai&season=SPRING` returns Sakura Valley Limited and reports the lowercase values.
- [ ] `?q=gorge` and `?q=GORGE` both return Kurobe Gorge Explorer (name) and Sagano Romantic Train (description).
- [ ] `?q=cranes` returns Winter Wetlands Steam Train.
- [ ] `?q=.*` and `?q=(` return 200 and no trips.
- [ ] `?q=%20%20` returns all six trips with `filters.q: null`.
- [ ] `?season=autumn&limit=2&page=2` returns one trip with `totalItems: 3, totalPages: 2`.
- [ ] `?region=hokkaido&season=summer` returns 200, no trips and `totalPages: 0`.
- [ ] `region=mars`, `season=monsoon`, `region=central&region=kansai` and a 101 character `q` each return 400 with a message.
- [ ] `GET /api/trips/filters` returns the four regions and four seasons.
- [ ] On `/trips`, each dropdown narrows the list across all pages and resets to page 1.
- [ ] Typing "gorge" and pressing Enter shows two trips and puts `q=gorge` in the address.
- [ ] A keyword with no match shows the empty message and hides the pagination.
- [ ] Clear shows every trip again.
- [ ] Opening `/trips?region=central&season=autumn` selects both dropdowns.
- [ ] Back after a search restores the previous results and the keyword box.
- [ ] `/trips?region=mars` shows the API's error message.
- [ ] Swagger UI shows `region`, `season`, `q`, the `meta.filters` example and `/api/trips/filters`.
- [ ] `npm test` and `npm run lint` pass.
