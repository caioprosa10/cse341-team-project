/* Client-side hydration for the Kizuna Rail pages.
 * Every page keeps its layout in EJS; the dynamic parts are filled in here
 * from the JSON API so features such as filtering can grow without a reload.
 */

const showState = (element, visible) => {
    if (element) {
        element.hidden = !visible;
    }
};

const setError = (element, message) => {
    if (element) {
        element.hidden = false;
        element.textContent = message;
    }
};

/*
 * Fetches JSON. When the API refuses the request, the error carries the
 * status and the API's own message ({ "error": "..." }) so a page can show
 * the visitor what was wrong with a 400 instead of a generic failure.
 */
const fetchJson = async (url) => {
    const response = await fetch(url);

    if (!response.ok) {
        let message = `Request failed (${response.status})`;

        try {
            const body = await response.json();

            if (body && body.error) {
                message = body.error;
            }
        } catch {
            // The body was not JSON; keep the generic message.
        }

        const error = new Error(message);
        error.status = response.status;
        throw error;
    }

    return response.json();
};

/* ------------------------------------------------------------------ *
 * Trains page                                                         *
 * ------------------------------------------------------------------ */

const hookTrainsCatalog = async () => {
    const listEl = document.getElementById('trains-list');
    const templateEl = document.getElementById('train-card-template');
    const loadingEl = document.getElementById('trains-loading');
    const errorEl = document.getElementById('trains-error');

    if (!listEl || !templateEl) {
        return;
    }

    try {
        const payload = await fetchJson('/api/trains');
        const trains = Array.isArray(payload) ? payload : payload.trains || [];
        const fragment = document.createDocumentFragment();

        trains.forEach((train) => {
            const card = templateEl.content.cloneNode(true);
            const imageEl = card.querySelector('[data-field="image"]');

            imageEl.src = train.imageUrl;
            imageEl.alt = train.imageAlt || `${train.name} train`;

            card.querySelector('[data-field="name"]').textContent = train.name;
            card.querySelector('[data-field="operator"]').textContent = train.operator;
            card.querySelector('[data-field="type"]').textContent = train.type;
            card.querySelector('[data-field="speed"]').textContent = `${train.maxSpeedKmh} km/h`;
            card.querySelector('[data-field="seats"]').textContent = `${train.capacity} seats`;
            card.querySelector('[data-field="power"]').textContent = train.powerSource;
            card.querySelector('[data-field="description"]').textContent = train.description;
            card.querySelector('[data-field="best-for"]').textContent = train.bestFor;

            fragment.appendChild(card);
        });

        listEl.replaceChildren(fragment);
        showState(loadingEl, false);
    } catch (error) {
        showState(loadingEl, false);
        setError(errorEl, 'Unable to load trains right now. Please try again in a moment.');
    }
};

/* ------------------------------------------------------------------ *
 * Trip list page                                                      *
 * ------------------------------------------------------------------ */

const capitalise = (value) => {
    if (!value) {
        return '';
    }

    return value.charAt(0).toUpperCase() + value.slice(1);
};

const buildTripCard = (trip, templateEl) => {
    const card = templateEl.content.cloneNode(true);
    const cardEl = card.querySelector('.route-card');

    if (trip.region) {
        cardEl.classList.add(trip.region);
    }

    card.querySelector('[data-field="name"]').textContent = trip.name;
    card.querySelector('[data-field="region"]').textContent = trip.region;
    card.querySelector('[data-field="start-station"]').textContent = trip.startStation;
    card.querySelector('[data-field="end-station"]').textContent = trip.endStation;
    card.querySelector('[data-field="duration"]').textContent = trip.duration;
    card.querySelector('[data-field="distance"]').textContent = `${trip.distance}km`;
    card.querySelector('[data-field="description"]').textContent = trip.description;

    const seasonEl = card.querySelector('[data-field="season"]');
    seasonEl.textContent = `Best in ${trip.bestSeason}`;
    seasonEl.classList.add(`season-${trip.bestSeason}`);

    const highlightsEl = card.querySelector('[data-field="highlights"]');
    (trip.highlights || []).forEach((highlight) => {
        const tag = document.createElement('span');
        tag.className = 'highlight-tag';
        tag.textContent = highlight;
        highlightsEl.appendChild(tag);
    });

    card.querySelector('[data-field="details-link"]').href = `/trips/${trip.id}`;

    return card;
};

/*
 * Replaces the options of a filter dropdown, keeping its first "all" option
 * and the value the visitor had picked if it is still on offer.
 */
const fillFilter = (selectEl, values) => {
    if (!selectEl) {
        return;
    }

    const selected = selectEl.value;
    const allOption = selectEl.options[0];

    selectEl.replaceChildren(allOption);

    values.forEach((value) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = capitalise(value);
        selectEl.appendChild(option);
    });

    selectEl.value = values.includes(selected) ? selected : allOption.value;
};

/*
 * The trip list asks /api/trips for one page of matching trips at a time.
 * The page, the page size and the filters live in the address bar
 * (/trips?region=central&q=gorge&page=2), so a refresh, a bookmark or the back
 * button shows the same results. The browser passes them to the API as they
 * are, and the API decides whether they are valid.
 */
const TRIP_QUERY_KEYS = ['page', 'limit', 'region', 'season', 'q'];

// Describes the filters the API reports in meta.filters, for the summary.
const describeTripFilters = (filters) => {
    if (!filters) {
        return '';
    }

    const parts = [];

    if (filters.region) {
        parts.push(`region ${capitalise(filters.region)}`);
    }
    if (filters.season) {
        parts.push(`best in ${filters.season}`);
    }
    if (filters.q) {
        parts.push(`matching "${filters.q}"`);
    }

    return parts.length > 0 ? ` (${parts.join(', ')})` : '';
};

const hookTripsCatalog = () => {
    const listEl = document.getElementById('trips-list');
    const templateEl = document.getElementById('trip-card-template');
    const loadingEl = document.getElementById('trips-loading');
    const errorEl = document.getElementById('trips-error');
    const emptyEl = document.getElementById('trips-empty');
    const summaryEl = document.getElementById('trips-summary');
    const paginationEl = document.getElementById('trips-pagination');
    const prevButton = document.getElementById('trips-prev');
    const nextButton = document.getElementById('trips-next');
    const pageStatusEl = document.getElementById('trips-page-status');
    const filtersForm = document.getElementById('filters');
    const regionSelect = document.getElementById('region-filter');
    const seasonSelect = document.getElementById('season-filter');
    const searchInput = document.getElementById('trip-search');
    const clearButton = document.getElementById('trip-filters-clear');

    if (!listEl || !templateEl) {
        return;
    }

    let pageTrips = [];
    let meta = null;

    const renderCards = () => {
        const fragment = document.createDocumentFragment();

        pageTrips.forEach((trip) => {
            fragment.appendChild(buildTripCard(trip, templateEl));
        });

        listEl.replaceChildren(fragment);
        showState(emptyEl, meta !== null && meta.totalItems === 0);
    };

    const renderPagination = () => {
        if (!meta || meta.totalItems === 0) {
            showState(paginationEl, false);
            summaryEl.textContent = '';

            return;
        }

        const first = (meta.page - 1) * meta.limit + 1;
        const last = first + pageTrips.length - 1;

        summaryEl.textContent = `Showing ${first}-${last} of ${meta.totalItems} trips`
            + describeTripFilters(meta.filters);
        pageStatusEl.textContent = `Page ${meta.page} of ${meta.totalPages}`;
        prevButton.disabled = !meta.hasPreviousPage;
        nextButton.disabled = !meta.hasNextPage;
        showState(paginationEl, true);
    };

    // Puts the values from the address bar back into the form controls.
    const syncControlsFromAddress = () => {
        const params = new URLSearchParams(window.location.search);
        const pickOption = (selectEl, value) => {
            if (!selectEl) {
                return;
            }

            const wanted = (value || '').toLowerCase();
            const exists = [...selectEl.options].some((option) => option.value === wanted);
            selectEl.value = exists ? wanted : 'all';
        };

        pickOption(regionSelect, params.get('region'));
        pickOption(seasonSelect, params.get('season'));

        if (searchInput) {
            searchInput.value = params.get('q') || '';
        }
    };

    // Copies the query values from the address bar into the API request.
    const buildApiUrl = () => {
        const pageParams = new URLSearchParams(window.location.search);
        const apiParams = new URLSearchParams();

        TRIP_QUERY_KEYS.forEach((key) => {
            if (pageParams.has(key)) {
                apiParams.set(key, pageParams.get(key));
            }
        });

        const query = apiParams.toString();

        return query ? `/api/trips?${query}` : '/api/trips';
    };

    const writeAddress = (params, replace) => {
        const query = params.toString();
        const url = query ? `${window.location.pathname}?${query}` : window.location.pathname;

        if (replace) {
            window.history.replaceState(null, '', url);
        } else {
            window.history.pushState(null, '', url);
        }
    };

    const setPageInAddress = (page, replace) => {
        const params = new URLSearchParams(window.location.search);
        params.set('page', String(page));
        writeAddress(params, replace);
    };

    const load = async () => {
        showState(loadingEl, true);
        showState(errorEl, false);
        showState(emptyEl, false);
        prevButton.disabled = true;
        nextButton.disabled = true;

        try {
            const payload = await fetchJson(buildApiUrl());

            // A bookmarked page that no longer exists: go to the last real one.
            if (payload.trips.length === 0 && payload.meta.page > payload.meta.totalPages
                && payload.meta.totalPages > 0) {
                setPageInAddress(payload.meta.totalPages, true);

                return load();
            }

            pageTrips = payload.trips;
            meta = payload.meta;
            renderCards();
            renderPagination();
        } catch (error) {
            pageTrips = [];
            meta = null;
            listEl.replaceChildren();
            renderPagination();
            setError(
                errorEl,
                error.status === 400
                    ? `Unable to show these trips: ${error.message}.`
                    : 'Unable to load trips right now. Please try again in a moment.'
            );
        }

        showState(loadingEl, false);

        return undefined;
    };

    const goToPage = async (page) => {
        setPageInAddress(page, false);
        await load();
        listEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    /*
     * Applies the form to the address and reloads. Any change to the filters
     * starts again at page 1, because page 3 of the old results may not
     * exist in the new ones. The page size is kept.
     */
    const applyFilters = () => {
        const params = new URLSearchParams(window.location.search);
        const values = {
            region: regionSelect && regionSelect.value !== 'all' ? regionSelect.value : '',
            season: seasonSelect && seasonSelect.value !== 'all' ? seasonSelect.value : '',
            q: searchInput ? searchInput.value.trim() : ''
        };

        Object.entries(values).forEach(([key, value]) => {
            if (value) {
                params.set(key, value);
            } else {
                params.delete(key);
            }
        });
        params.delete('page');

        writeAddress(params, false);
        load();
    };

    prevButton.addEventListener('click', () => goToPage(meta.page - 1));
    nextButton.addEventListener('click', () => goToPage(meta.page + 1));

    // The dropdowns apply at once; the keyword waits for Enter or Search so
    // the API is not called on every keystroke.
    if (regionSelect) {
        regionSelect.addEventListener('change', applyFilters);
    }
    if (seasonSelect) {
        seasonSelect.addEventListener('change', applyFilters);
    }
    if (filtersForm) {
        filtersForm.addEventListener('submit', (event) => {
            event.preventDefault();
            applyFilters();
        });
    }
    if (clearButton) {
        clearButton.addEventListener('click', () => {
            if (regionSelect) {
                regionSelect.value = 'all';
            }
            if (seasonSelect) {
                seasonSelect.value = 'all';
            }
            if (searchInput) {
                searchInput.value = '';
            }
            applyFilters();
        });
    }

    // Back and forward buttons change the address without reloading.
    window.addEventListener('popstate', () => {
        syncControlsFromAddress();
        load();
    });

    // The dropdown options come from the API; the list loads at the same time.
    const loadFilterOptions = async () => {
        try {
            const options = await fetchJson('/api/trips/filters');

            fillFilter(regionSelect, options.regions);
            fillFilter(seasonSelect, options.seasons);
        } catch (error) {
            // The list still works from the address bar without the dropdowns.
            console.error('Unable to load the trip filters:', error);
        }

        syncControlsFromAddress();
    };

    syncControlsFromAddress();
    loadFilterOptions();
    load();
};

/* ------------------------------------------------------------------ *
 * Trip details page: schedules by month                               *
 * ------------------------------------------------------------------ */

const hookTripSchedules = () => {
    const sectionEl = document.getElementById('schedules-section');
    const listEl = document.getElementById('schedules-list');
    const templateEl = document.getElementById('schedule-card-template');
    const loadingEl = document.getElementById('schedules-loading');
    const errorEl = document.getElementById('schedules-error');
    const emptyEl = document.getElementById('schedules-empty');
    const monthSelect = document.getElementById('month-filter');

    if (!sectionEl || !listEl || !templateEl) {
        return;
    }

    const tripId = sectionEl.dataset.tripId;

    const load = async () => {
        const month = monthSelect ? monthSelect.value : '';
        const url = month
            ? `/api/trips/${encodeURIComponent(tripId)}/schedules?month=${encodeURIComponent(month)}`
            : `/api/trips/${encodeURIComponent(tripId)}/schedules`;

        showState(loadingEl, true);
        showState(errorEl, false);
        showState(emptyEl, false);

        try {
            const schedules = await fetchJson(url);
            const fragment = document.createDocumentFragment();

            schedules.forEach((schedule) => {
                const card = templateEl.content.cloneNode(true);

                card.querySelector('[data-field="departure"]').textContent = schedule.departureTime;
                card.querySelector('[data-field="arrival"]').textContent = schedule.arrivalTime;

                const daysEl = card.querySelector('[data-field="days"]');
                (schedule.daysOfWeek || []).forEach((day) => {
                    const badge = document.createElement('span');
                    badge.className = 'day-badge';
                    badge.textContent = day.substring(0, 3);
                    daysEl.appendChild(badge);
                });

                card.querySelector('[data-field="book-link"]').href = `/trips/booking/${schedule.id}`;
                fragment.appendChild(card);
            });

            listEl.replaceChildren(fragment);
            showState(loadingEl, false);
            showState(emptyEl, schedules.length === 0);
        } catch (error) {
            listEl.replaceChildren();
            showState(loadingEl, false);
            setError(errorEl, 'Unable to load the schedules right now. Please try again in a moment.');
        }
    };

    if (monthSelect) {
        monthSelect.addEventListener('change', load);
    }

    load();
};

/* ------------------------------------------------------------------ *
 * Trip details page: station information                              *
 * ------------------------------------------------------------------ */

const renderStation = (container, station) => {
    container.replaceChildren();

    const heading = document.createElement('h3');
    heading.textContent = station.name;
    container.appendChild(heading);

    const location = document.createElement('p');
    location.textContent = `${station.prefecture} prefecture, ${station.region} region`;
    container.appendChild(location);

    if (station.description) {
        const description = document.createElement('p');
        description.textContent = station.description;
        container.appendChild(description);
    }

    if (station.facilities && station.facilities.length > 0) {
        const list = document.createElement('ul');
        list.className = 'station-facilities';

        station.facilities.forEach((facility) => {
            const item = document.createElement('li');
            item.textContent = facility.replace(/_/g, ' ');
            list.appendChild(item);
        });

        container.appendChild(list);
    }
};

const hookStationDetails = () => {
    const buttons = document.querySelectorAll('.station-info-btn');

    if (buttons.length === 0) {
        return;
    }

    buttons.forEach((button) => {
        button.addEventListener('click', async () => {
            const stationId = button.dataset.stationId;
            const panel = document.getElementById(`station-details-${stationId}`);

            if (!panel) {
                return;
            }

            const isOpen = button.getAttribute('aria-expanded') === 'true';

            if (isOpen) {
                panel.hidden = true;
                button.setAttribute('aria-expanded', 'false');

                return;
            }

            panel.hidden = false;
            button.setAttribute('aria-expanded', 'true');

            if (panel.dataset.loaded === 'true') {
                return;
            }

            panel.textContent = 'Loading station information...';

            try {
                const station = await fetchJson(`/api/stations/${encodeURIComponent(stationId)}`);
                renderStation(panel, station);
                panel.dataset.loaded = 'true';
            } catch (error) {
                panel.textContent = 'Unable to load this station right now.';
            }
        });
    });
};

/* ------------------------------------------------------------------ *
 * Booking page: ticket classes available on the selected day          *
 * ------------------------------------------------------------------ */

const applyTicketAvailability = (availableClasses) => {
    const radios = document.querySelectorAll('input[name="ticketClass"]');
    let checkedIsAvailable = false;
    let firstAvailable = null;

    radios.forEach((radio) => {
        const label = radio.closest('.ticket-card');
        const isAvailable = availableClasses.includes(radio.value);

        radio.disabled = !isAvailable;

        if (label) {
            label.classList.toggle('ticket-unavailable', !isAvailable);
        }

        if (isAvailable) {
            if (!firstAvailable) {
                firstAvailable = radio;
            }
            if (radio.checked) {
                checkedIsAvailable = true;
            }
        } else if (radio.checked) {
            radio.checked = false;
            radio.removeAttribute('checked');
        }
    });

    if (!checkedIsAvailable && firstAvailable) {
        firstAvailable.checked = true;
        firstAvailable.setAttribute('checked', true);
        firstAvailable.dispatchEvent(new Event('change', { bubbles: true }));
    }
};

const hookTicketAvailability = () => {
    const dayLabels = document.querySelectorAll('.days-display label');
    const ticketRadios = document.querySelectorAll('input[name="ticketClass"]');

    if (dayLabels.length === 0 || ticketRadios.length === 0) {
        return;
    }

    const loadForDay = async (day) => {
        if (!day) {
            return;
        }

        try {
            const ticketClasses = await fetchJson(`/api/ticket-classes?day=${encodeURIComponent(day)}`);
            applyTicketAvailability(ticketClasses.map((ticketClass) => ticketClass.class));
        } catch (error) {
            // Leave every option enabled rather than blocking the booking.
            applyTicketAvailability([...ticketRadios].map((radio) => radio.value));
        }
    };

    dayLabels.forEach((label) => {
        label.addEventListener('click', () => {
            const input = label.querySelector('input');

            if (input) {
                loadForDay(input.value);
            }
        });
    });

    const selectedDay = document.querySelector('input[name="selectedDay"]:checked');

    if (selectedDay) {
        loadForDay(selectedDay.value);
    }
};

/* ------------------------------------------------------------------ *
 * Bookings admin page                                                 *
 * ------------------------------------------------------------------ */

const hookBookingsAdmin = async () => {
    const listEl = document.getElementById('bookings-list');
    const templateEl = document.getElementById('booking-card-template');
    const loadingEl = document.getElementById('bookings-loading');
    const errorEl = document.getElementById('bookings-error');
    const emptyEl = document.getElementById('bookings-empty');

    if (!listEl || !templateEl) {
        return;
    }

    try {
        const bookings = await fetchJson('/api/bookings');
        const fragment = document.createDocumentFragment();

        bookings.forEach((booking) => {
            const card = templateEl.content.cloneNode(true);
            const passengers = booking.passengers || [];

            card.querySelector('[data-field="reference"]').textContent = booking.id;
            card.querySelector('[data-field="created"]').textContent = new Date(
                booking.createdAt
            ).toLocaleString();
            card.querySelector('[data-field="trip"]').textContent = booking.tripId;
            card.querySelector('[data-field="schedule"]').textContent = booking.scheduleId;
            card.querySelector('[data-field="ticket-class"]').textContent = booking.ticketClass;
            card.querySelector('[data-field="day"]').textContent = booking.selectedDay;
            card.querySelector('[data-field="passenger-count"]').textContent = passengers.length;

            const passengersEl = card.querySelector('[data-field="passengers"]');
            passengers.forEach((passenger) => {
                const item = document.createElement('li');
                item.textContent = `${passenger.firstName} ${passenger.lastName} - ${passenger.email}`;
                passengersEl.appendChild(item);
            });

            fragment.appendChild(card);
        });

        listEl.replaceChildren(fragment);
        showState(loadingEl, false);
        showState(emptyEl, bookings.length === 0);
    } catch (error) {
        showState(loadingEl, false);
        setError(errorEl, 'Unable to load bookings right now. Please try again in a moment.');
    }
};

/* ------------------------------------------------------------------ *
 * User admin page                                                    *
 * ------------------------------------------------------------------ */

const sendJson = async (url, method, payload) => {
    const options = { method, headers: { 'Content-Type': 'application/json' } };

    if (payload) {
        options.body = JSON.stringify(payload);
    }

    const response = await fetch(url, options);

    if (response.status === 204) {
        return null;
    }

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || `Request failed (${response.status})`);
    }

    return data;
};

const showRowMessage = (row, text, isError) => {
    const target = row.querySelector('[data-field="message"]');

    if (!target) {
        return;
    }

    target.hidden = false;
    target.textContent = text;
    target.classList.toggle('is-error', Boolean(isError));
};

const hookUsersAdmin = async () => {
    const listEl = document.getElementById('users-list');
    const templateEl = document.getElementById('user-row-template');
    const errorEl = document.getElementById('users-error');
    const emptyEl = document.getElementById('users-empty');
    const scopeEl = document.getElementById('users-scope');

    if (!listEl || !templateEl) {
        return;
    }

    const buildRow = (person) => {
        const fragment = templateEl.content.cloneNode(true);
        const row = fragment.querySelector('[data-field="row"]');
        const nameInput = fragment.querySelector('[data-field="name"]');
        const emailInput = fragment.querySelector('[data-field="email"]');

        nameInput.value = person.name;
        emailInput.value = person.email;
        fragment.querySelector('[data-field="role"]').textContent =
            person.role && person.role.name ? person.role.name : 'customer';

        row.addEventListener('submit', async (event) => {
            event.preventDefault();

            try {
                const updated = await sendJson(`/api/users/${person._id}`, 'PUT', {
                    name: nameInput.value,
                    email: emailInput.value
                });

                nameInput.value = updated.name;
                emailInput.value = updated.email;
                showRowMessage(row, 'Saved.', false);
            } catch (error) {
                showRowMessage(row, error.message, true);
            }
        });

        fragment.querySelector('[data-field="delete"]').addEventListener('click', async () => {
            try {
                await sendJson(`/api/users/${person._id}`, 'DELETE');
                row.remove();
                showState(emptyEl, listEl.children.length === 0);
            } catch (error) {
                showRowMessage(row, error.message, true);
            }
        });

        return fragment;
    };

    try {
        const people = await fetchJson('/api/users');
        const fragment = document.createDocumentFragment();

        people.forEach((person) => {
            fragment.appendChild(buildRow(person));
        });

        listEl.replaceChildren(fragment);
        showState(emptyEl, people.length === 0);

        if (scopeEl) {
            scopeEl.textContent = people.length === 1
                ? 'Your account.'
                : `Every user in the system (${people.length}).`;
        }
    } catch (error) {
        if (scopeEl) {
            scopeEl.textContent = '';
        }

        setError(errorEl, 'Unable to load the users right now.');
    }
};

/* ------------------------------------------------------------------ *
 * Trip admin page                                                    *
 * ------------------------------------------------------------------ */

const fillStationOptions = (selectEl, stations, selected) => {
    stations.forEach((station) => {
        const option = document.createElement('option');

        option.value = station.id;
        option.textContent = station.name;
        option.selected = station.id === selected;
        selectEl.appendChild(option);
    });
};

const hookTripsAdmin = async () => {
    const listEl = document.getElementById('trips-admin-list');
    const templateEl = document.getElementById('trip-row-template');
    const errorEl = document.getElementById('trips-admin-error');
    const emptyEl = document.getElementById('trips-admin-empty');

    if (!listEl || !templateEl) {
        return;
    }

    const buildRow = (tripItem, stations) => {
        const fragment = templateEl.content.cloneNode(true);
        const row = fragment.querySelector('[data-field="row"]');
        const fields = {
            name: fragment.querySelector('[data-field="name"]'),
            region: fragment.querySelector('[data-field="region"]'),
            duration: fragment.querySelector('[data-field="duration"]'),
            distance: fragment.querySelector('[data-field="distance"]')
        };
        const startSelect = fragment.querySelector('[data-field="start-station"]');
        const endSelect = fragment.querySelector('[data-field="end-station"]');

        fields.name.value = tripItem.name;
        fields.region.value = tripItem.region;
        fields.duration.value = tripItem.duration;
        fields.distance.value = tripItem.distance;
        fillStationOptions(startSelect, stations, tripItem.startStation);
        fillStationOptions(endSelect, stations, tripItem.endStation);

        row.addEventListener('submit', async (event) => {
            event.preventDefault();

            try {
                await sendJson(`/api/trips/${tripItem.id}`, 'PUT', {
                    name: fields.name.value,
                    region: fields.region.value,
                    startStation: startSelect.value,
                    endStation: endSelect.value,
                    duration: fields.duration.value,
                    distance: Number(fields.distance.value)
                });

                showRowMessage(row, 'Saved.', false);
            } catch (error) {
                showRowMessage(row, error.message, true);
            }
        });

        fragment.querySelector('[data-field="delete"]').addEventListener('click', async () => {
            try {
                await sendJson(`/api/trips/${tripItem.id}`, 'DELETE');
                row.remove();
                showState(emptyEl, listEl.children.length === 0);
            } catch (error) {
                showRowMessage(row, error.message, true);
            }
        });

        return fragment;
    };

    try {
        // /api/trips is paged now. This page still edits the whole catalogue
        // in one list, so it asks for the largest page the API allows.
        const [tripsPage, stations] = await Promise.all([
            fetchJson('/api/trips?limit=50'),
            fetchJson('/api/stations')
        ]);
        const trips = tripsPage.trips;
        const fragment = document.createDocumentFragment();

        trips.forEach((tripItem) => {
            fragment.appendChild(buildRow(tripItem, stations));
        });

        listEl.replaceChildren(fragment);
        showState(emptyEl, trips.length === 0);
    } catch (error) {
        setError(errorEl, 'Unable to load the trips right now.');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    hookTrainsCatalog();
    hookTripsCatalog();
    hookTripSchedules();
    hookStationDetails();
    hookTicketAvailability();
    hookBookingsAdmin();
    hookUsersAdmin();
    hookTripsAdmin();
});
