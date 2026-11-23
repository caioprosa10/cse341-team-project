import { describe, expect, test } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { getDb } from '../src/db/connect.js';

// The starter data holds six trips. Sorted by name they are:
const NAMES_IN_ORDER = [
  'Alpine Panorama Express',
  'Coastal Breeze Line',
  'Kurobe Gorge Explorer',
  'Sagano Romantic Train',
  'Sakura Valley Limited',
  'Winter Wetlands Steam Train'
];

describe('GET /api/trips pagination', () => {
  test('returns the first page of ten with metadata by default', async () => {
    const response = await request(app).get('/api/trips');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.body.trips.map((trip) => trip.name)).toEqual(NAMES_IN_ORDER);
    expect(response.body.meta).toMatchObject({
      page: 1,
      limit: 10,
      totalItems: 6,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false
    });
  });

  test('steps through the trips with page and limit', async () => {
    const first = await request(app).get('/api/trips?page=1&limit=4');
    const second = await request(app).get('/api/trips?page=2&limit=4');

    expect(first.status).toBe(200);
    expect(first.body.trips.map((trip) => trip.name)).toEqual(NAMES_IN_ORDER.slice(0, 4));
    expect(first.body.meta).toMatchObject({
      page: 1,
      limit: 4,
      totalItems: 6,
      totalPages: 2,
      hasPreviousPage: false,
      hasNextPage: true
    });

    expect(second.status).toBe(200);
    expect(second.body.trips.map((trip) => trip.name)).toEqual(NAMES_IN_ORDER.slice(4));
    expect(second.body.meta).toMatchObject({
      page: 2,
      hasPreviousPage: true,
      hasNextPage: false
    });
  });

  test('a page past the end is empty but still reports the totals', async () => {
    const response = await request(app).get('/api/trips?page=99');

    expect(response.status).toBe(200);
    expect(response.body.trips).toEqual([]);
    expect(response.body.meta).toMatchObject({ page: 99, totalItems: 6, totalPages: 1 });
  });

  test('pages through more than ten trips ten at a time', async () => {
    const extraTrips = Array.from({ length: 9 }, (_, index) => ({
      id: `test-trip-${index}`,
      name: `Test Trip ${index}`,
      region: 'test',
      startStation: 'tokyo',
      endStation: 'nagoya',
      duration: '1 hour',
      distance: 10,
      bestSeason: 'summer'
    }));
    await getDb().collection('trips').insertMany(extraTrips);

    const first = await request(app).get('/api/trips');
    const second = await request(app).get('/api/trips?page=2');

    expect(first.body.trips).toHaveLength(10);
    expect(second.body.trips).toHaveLength(5);
    expect(second.body.meta).toMatchObject({ totalItems: 15, totalPages: 2, hasNextPage: false });

    const ids = [...first.body.trips, ...second.body.trips].map((trip) => trip.id);
    expect(new Set(ids).size).toBe(15);
  });

  test.each([
    ['page=0', 'page'],
    ['page=-1', 'page'],
    ['page=1.5', 'page'],
    ['page=abc', 'page'],
    ['page=1&page=2', 'page'],
    ['limit=0', 'limit'],
    ['limit=51', 'limit'],
    ['limit=ten', 'limit']
  ])('rejects ?%s with a 400', async (query, field) => {
    const response = await request(app).get(`/api/trips?${query}`);

    expect(response.status).toBe(400);
    expect(response.body.error).toContain(field);
  });
});

describe('GET /api/trips filtering and searching', () => {
  const namesOf = (response) => response.body.trips.map((trip) => trip.name);

  test('reports the filters in meta, null when not used', async () => {
    const response = await request(app).get('/api/trips');

    expect(response.body.meta.filters).toEqual({ region: null, season: null, q: null });
  });

  test('filters by region', async () => {
    const response = await request(app).get('/api/trips?region=kansai');

    expect(response.status).toBe(200);
    expect(namesOf(response)).toEqual(['Sagano Romantic Train', 'Sakura Valley Limited']);
    expect(response.body.meta).toMatchObject({
      totalItems: 2,
      totalPages: 1,
      filters: { region: 'kansai', season: null, q: null }
    });
  });

  test('filters by season', async () => {
    const response = await request(app).get('/api/trips?season=autumn');

    expect(namesOf(response)).toEqual([
      'Alpine Panorama Express',
      'Kurobe Gorge Explorer',
      'Sagano Romantic Train'
    ]);
  });

  test('combines region and season', async () => {
    const response = await request(app).get('/api/trips?region=central&season=autumn');

    expect(namesOf(response)).toEqual(['Alpine Panorama Express', 'Kurobe Gorge Explorer']);
    expect(response.body.meta.filters).toEqual({ region: 'central', season: 'autumn', q: null });
  });

  test('accepts the region and season in any case', async () => {
    const response = await request(app).get('/api/trips?region=Kansai&season=SPRING');

    expect(namesOf(response)).toEqual(['Sakura Valley Limited']);
    expect(response.body.meta.filters).toMatchObject({ region: 'kansai', season: 'spring' });
  });

  test('searches the names and the descriptions without regard to case', async () => {
    const lower = await request(app).get('/api/trips?q=gorge');
    const upper = await request(app).get('/api/trips?q=GORGE');

    // Kurobe matches on its name, Sagano only on its description.
    expect(namesOf(lower)).toEqual(['Kurobe Gorge Explorer', 'Sagano Romantic Train']);
    expect(namesOf(upper)).toEqual(namesOf(lower));
    expect(lower.body.meta.filters.q).toBe('gorge');
  });

  test('finds a word that only appears in a description', async () => {
    const response = await request(app).get('/api/trips?q=cranes');

    expect(namesOf(response)).toEqual(['Winter Wetlands Steam Train']);
  });

  test('searches for special characters literally', async () => {
    const everything = await request(app).get('/api/trips?q=.*');
    const bracket = await request(app).get('/api/trips?q=(');

    expect(everything.status).toBe(200);
    expect(everything.body.trips).toEqual([]);
    expect(bracket.status).toBe(200);
    expect(bracket.body.trips).toEqual([]);
  });

  test('treats a blank keyword as no keyword', async () => {
    const response = await request(app).get('/api/trips?q=%20%20');

    expect(response.body.meta.totalItems).toBe(6);
    expect(response.body.meta.filters.q).toBeNull();
  });

  test('pages through filtered results', async () => {
    const response = await request(app).get('/api/trips?season=autumn&limit=2&page=2');

    expect(namesOf(response)).toEqual(['Sagano Romantic Train']);
    expect(response.body.meta).toMatchObject({
      page: 2,
      limit: 2,
      totalItems: 3,
      totalPages: 2,
      hasPreviousPage: true,
      hasNextPage: false,
      filters: { season: 'autumn' }
    });
  });

  test('returns an empty page with the totals when nothing matches', async () => {
    const response = await request(app).get('/api/trips?region=hokkaido&season=summer');

    expect(response.status).toBe(200);
    expect(response.body.trips).toEqual([]);
    expect(response.body.meta).toMatchObject({ totalItems: 0, totalPages: 0, hasNextPage: false });
  });

  test.each([
    ['region=mars', 'region must be one of'],
    ['season=monsoon', 'season must be one of'],
    ['region=central&region=kansai', 'region must be a single value'],
    [`q=${'x'.repeat(101)}`, 'q must be 100 characters or fewer']
  ])('rejects ?%s with a 400', async (query, message) => {
    const response = await request(app).get(`/api/trips?${query}`);

    expect(response.status).toBe(400);
    expect(response.body.error).toContain(message);
  });
});

describe('GET /api/trips/filters', () => {
  test('lists the regions and seasons in the starter data', async () => {
    const response = await request(app).get('/api/trips/filters');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      regions: ['central', 'hokkaido', 'kansai', 'northern'],
      seasons: ['autumn', 'spring', 'summer', 'winter']
    });
  });

  test('is not mistaken for a trip id', async () => {
    const response = await request(app).get('/api/trips/filters');

    expect(response.body).not.toHaveProperty('error');
  });
});
