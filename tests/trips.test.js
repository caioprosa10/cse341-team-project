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
