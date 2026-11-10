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

const fetchJson = async (url) => {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
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

const fillFilter = (selectEl, values) => {
    if (!selectEl) {
        return;
    }

    values.forEach((value) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = capitalise(value);
        selectEl.appendChild(option);
    });
};

const hookTripsCatalog = async () => {
    const listEl = document.getElementById('trips-list');
    const templateEl = document.getElementById('trip-card-template');
    const loadingEl = document.getElementById('trips-loading');
    const errorEl = document.getElementById('trips-error');
    const emptyEl = document.getElementById('trips-empty');
    const regionSelect = document.getElementById('region-filter');
    const seasonSelect = document.getElementById('season-filter');

    if (!listEl || !templateEl) {
        return;
    }

    let allTrips = [];

    const render = () => {
        const region = regionSelect ? regionSelect.value : 'all';
        const season = seasonSelect ? seasonSelect.value : 'all';
        const visible = allTrips.filter((trip) => {
            const regionMatches = region === 'all' || trip.region === region;
            const seasonMatches = season === 'all' || trip.bestSeason === season;

            return regionMatches && seasonMatches;
        });

        const fragment = document.createDocumentFragment();
        visible.forEach((trip) => {
            fragment.appendChild(buildTripCard(trip, templateEl));
        });

        listEl.replaceChildren(fragment);
        showState(emptyEl, visible.length === 0);
    };

    try {
        allTrips = await fetchJson('/api/trips');

        const regions = [...new Set(allTrips.map((trip) => trip.region))].sort();
        const seasons = [...new Set(allTrips.map((trip) => trip.bestSeason))].sort();

        fillFilter(regionSelect, regions);
        fillFilter(seasonSelect, seasons);

        if (regionSelect) {
            regionSelect.addEventListener('change', render);
        }
        if (seasonSelect) {
            seasonSelect.addEventListener('change', render);
        }

        render();
        showState(loadingEl, false);
    } catch (error) {
        showState(loadingEl, false);
        setError(errorEl, 'Unable to load trips right now. Please try again in a moment.');
    }
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

document.addEventListener('DOMContentLoaded', () => {
    hookTrainsCatalog();
    hookTripsCatalog();
    hookTripSchedules();
    hookStationDetails();
    hookTicketAvailability();
    hookBookingsAdmin();
});
