/* API tests for the Notification module (Richard).

   ASSIGNMENT 4: these hit the real database through the router, so the
   users have to exist before any notification can be stored against them
*/

const request = require('supertest');
const app = require('./QSNotificationServer');
const db = require('./QSNotificationDB');
const t = require('./testUtils');

const BASE = '/api/notifications';

beforeAll(async () => {
  await t.createTestUsers();
});

beforeEach(async () => {
  await t.clearTestNotifications();
});

afterAll(async () => {
  await t.removeTestUsers();
  await t.closePool();
  await db.closePool();
});

describe('Notification API', () => {
  test('GET /api/notifications/:userId returns an empty list for a new user', async () => {
    const res = await request(app).get(`${BASE}/${t.USER_A}`);
    expect(res.status).toBe(200);
    expect(res.body.notifications).toEqual([]);
  });

  test('POST /queue-joined creates a queue notification (201)', async () => {
    const res = await request(app)
      .post(`${BASE}/queue-joined`)
      .send({ userId: t.USER_A, serviceName: 'Advising Things' });

    expect(res.status).toBe(201);
    expect(res.body.notification.type).toBe('queue');
    expect(res.body.notification.message).toBe('You joined the Advising Things queue.');
  });

  test('POST /queue-joined requires userId and serviceName (400)', async () => {
    const res = await request(app)
      .post(`${BASE}/queue-joined`)
      .send({ userId: t.USER_A }); // no serviceName

    expect(res.status).toBe(400);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  // A4: an unknown user is a bad request
  test('POST /queue-joined for a missing user returns 400, not 500', async () => {
    const res = await request(app)
      .post(`${BASE}/queue-joined`)
      .send({ userId: t.MISSING_USER, serviceName: 'Advising Things' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toContain('userId does not match an existing user');
  });

  test('POST /position-update fires "almost ready" at the threshold (201)', async () => {
    const res = await request(app)
      .post(`${BASE}/position-update`)
      .send({ userId: t.USER_A, serviceName: 'Welfare Check', position: 2 });

    expect(res.status).toBe(201);
    expect(res.body.notification.title).toBe('Almost ready');
  });

  test('POST /position-update above the threshold creates nothing (200, null)', async () => {
    const res = await request(app)
      .post(`${BASE}/position-update`)
      .send({ userId: t.USER_A, serviceName: 'Welfare Check', position: 5 });

    expect(res.status).toBe(200);
    expect(res.body.notification).toBeNull();
  });

  test('POST /position-update rejects an invalid position (400)', async () => {
    const res = await request(app)
      .post(`${BASE}/position-update`)
      .send({ userId: t.USER_A, serviceName: 'Welfare Check', position: 0 });

    expect(res.status).toBe(400);
  });

  test('POST /served creates a completion notification (201)', async () => {
    const res = await request(app)
      .post(`${BASE}/served`)
      .send({ userId: t.USER_A, serviceName: 'Welfare Check' });

    expect(res.status).toBe(201);
    expect(res.body.notification.title).toBe('Served');
  });

  test('stored notifications come back from GET after a trigger', async () => {
    await request(app)
      .post(`${BASE}/queue-joined`)
      .send({ userId: t.USER_B, serviceName: 'Advising Things' });

    const res = await request(app).get(`${BASE}/${t.USER_B}`);
    expect(res.status).toBe(200);
    expect(res.body.notifications).toHaveLength(1);
  });

  /* A4: a notification written by one request is still there for a later, separate request */
  test('notifications persist across separate requests', async () => {
    await request(app)
      .post(`${BASE}/queue-joined`)
      .send({ userId: t.USER_A, serviceName: 'IT Help Desk' });

    const first = await request(app).get(`${BASE}/${t.USER_A}`);
    const second = await request(app).get(`${BASE}/${t.USER_A}`);

    expect(first.body.notifications).toHaveLength(1);
    expect(second.body.notifications).toHaveLength(1);
    expect(second.body.notifications[0].id).toBe(first.body.notifications[0].id);
  });

  test('DELETE clears a user\'s notifications', async () => {
    await request(app)
      .post(`${BASE}/queue-joined`)
      .send({ userId: t.USER_A, serviceName: 'Advising Things' });

    const del = await request(app).delete(`${BASE}/${t.USER_A}`);
    expect(del.status).toBe(200);

    const res = await request(app).get(`${BASE}/${t.USER_A}`);
    expect(res.body.notifications).toEqual([]);
  });

  test('POST /queue-left succeeds without creating a notification (200, null)', async () => {
    const res = await request(app)
      .post(`${BASE}/queue-left`)
      .send({ userId: t.USER_A, serviceName: 'Welfare Check' });

    expect(res.status).toBe(200);
    expect(res.body.notification).toBeNull();
  });

  test('POST / (generic) rejects invalid input with 400 + errors', async () => {
    const res = await request(app)
      .post(BASE)
      .send({ userId: t.USER_A }); // missing type and message

    expect(res.status).toBe(400);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  test('POST / (generic) stores a valid notification (201)', async () => {
    const res = await request(app)
      .post(BASE)
      .send({ userId: t.USER_A, type: 'info', title: 'Hello', message: 'Direct create.' });

    expect(res.status).toBe(201);
    expect(res.body.notification.title).toBe('Hello');
    expect(res.body.notification.status).toBe('sent');
  });

  // A4: the sent/viewed status the assignment requires

  test('PATCH /:userId/viewed marks unread notifications as viewed', async () => {
    await request(app)
      .post(`${BASE}/queue-joined`)
      .send({ userId: t.USER_A, serviceName: 'IT Help Desk' });

    const patch = await request(app).patch(`${BASE}/${t.USER_A}/viewed`);
    expect(patch.status).toBe(200);
    expect(patch.body.updated).toBe(1);

    const res = await request(app).get(`${BASE}/${t.USER_A}`);
    expect(res.body.notifications[0].status).toBe('viewed');
  });

  test('PATCH /:userId/viewed reports zero when there is nothing unread', async () => {
    const patch = await request(app).patch(`${BASE}/${t.USER_A}/viewed`);
    expect(patch.status).toBe(200);
    expect(patch.body.updated).toBe(0);
  });

  test('PATCH /:userId/viewed rejects an unusable userId (400)', async () => {
    const patch = await request(app).patch(`${BASE}/not-a-number/viewed`);
    expect(patch.status).toBe(400);
  });

  test('GET /api/health reports the server is up', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toMatch(/running/i);
  });
});
