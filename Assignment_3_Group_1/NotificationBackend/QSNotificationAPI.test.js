// API tests for the Notification module (Richard).

const request = require('supertest');
const app = require('./QSNotificationServer');
const db = require('./QSNotificationDB');

// Fresh/empty store before every test
beforeEach(() => {
  db._resetForTests();
});

describe('Notification API', () => {
  test('GET /api/notifications/:userId returns an empty list for a new user', async () => {
    const res = await request(app).get('/api/notifications/1');
    expect(res.status).toBe(200);
    expect(res.body.notifications).toEqual([]);
  });

  test('POST /queue-joined creates a queue notification (201)', async () => {
    const res = await request(app)
      .post('/api/notifications/queue-joined')
      .send({ userId: 1, serviceName: 'Advising Things' });

    expect(res.status).toBe(201);
    expect(res.body.notification.type).toBe('queue');
    expect(res.body.notification.message).toBe('You joined the Advising Things queue.');
  });

  test('POST /queue-joined requires userId and serviceName (400)', async () => {
    const res = await request(app)
      .post('/api/notifications/queue-joined')
      .send({ userId: 1 }); // no serviceName

    expect(res.status).toBe(400);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  test('POST /position-update fires "almost ready" at the threshold (201)', async () => {
    const res = await request(app)
      .post('/api/notifications/position-update')
      .send({ userId: 1, serviceName: 'Welfare Check', position: 2 });

    expect(res.status).toBe(201);
    expect(res.body.notification.title).toBe('Almost ready');
  });

  test('POST /position-update above the threshold creates nothing (200, null)', async () => {
    const res = await request(app)
      .post('/api/notifications/position-update')
      .send({ userId: 1, serviceName: 'Welfare Check', position: 5 });

    expect(res.status).toBe(200);
    expect(res.body.notification).toBeNull();
  });

  test('POST /position-update rejects an invalid position (400)', async () => {
    const res = await request(app)
      .post('/api/notifications/position-update')
      .send({ userId: 1, serviceName: 'Welfare Check', position: 0 });

    expect(res.status).toBe(400);
  });

  test('POST /served creates a completion notification (201)', async () => {
    const res = await request(app)
      .post('/api/notifications/served')
      .send({ userId: 1, serviceName: 'Welfare Check' });

    expect(res.status).toBe(201);
    expect(res.body.notification.title).toBe('Served');
  });

  test('stored notifications come back from GET after a trigger', async () => {
    await request(app)
      .post('/api/notifications/queue-joined')
      .send({ userId: 7, serviceName: 'Advising Things' });

    const res = await request(app).get('/api/notifications/7');
    expect(res.status).toBe(200);
    expect(res.body.notifications).toHaveLength(1);
  });

  test('DELETE clears a user\'s notifications', async () => {
    await request(app)
      .post('/api/notifications/queue-joined')
      .send({ userId: 3, serviceName: 'Advising Things' });

    const del = await request(app).delete('/api/notifications/3');
    expect(del.status).toBe(200);

    const res = await request(app).get('/api/notifications/3');
    expect(res.body.notifications).toEqual([]);
  });

  test('POST /queue-left succeeds without creating a notification (200, null)', async () => {
    const res = await request(app)
      .post('/api/notifications/queue-left')
      .send({ userId: 1, serviceName: 'Welfare Check' });

    expect(res.status).toBe(200);
    expect(res.body.notification).toBeNull();
  });

  test('POST / (generic) rejects invalid input with 400 + errors', async () => {
    const res = await request(app)
      .post('/api/notifications')
      .send({ userId: 1 }); // missing type and message

    expect(res.status).toBe(400);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  test('GET /api/health reports the server is up', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toMatch(/running/i);
  });
});
