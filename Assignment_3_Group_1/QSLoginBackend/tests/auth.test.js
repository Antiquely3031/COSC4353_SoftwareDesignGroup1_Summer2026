const request = require('supertest');
const app = require('../app');
const db = require('../fakeDB');

beforeEach(() => {
  db._resetForTests();
});

describe('POST /api/signup', () => {
  test('creates a new user with valid data', async () => {
    const res = await request(app)
      .post('/api/signup')
      .send({ name: 'Patrick', email: 'patrick@test.com', password: 'testpass123' });

    expect(res.statusCode).toBe(201);
    expect(res.body.email).toBe('patrick@test.com');
    expect(res.body.role).toBe('user');
    expect(res.body.password).toBeUndefined(); // hash should never be returned
  });

  test('rejects missing fields', async () => {
    const res = await request(app)
      .post('/api/signup')
      .send({ email: 'patrick@test.com', password: 'testpass123' }); // no name

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  test('rejects password shorter than 8 characters', async () => {
    const res = await request(app)
      .post('/api/signup')
      .send({ name: 'Patrick', email: 'patrick@test.com', password: 'short' });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/8 and 20/i);
  });

  test('rejects password longer than 20 characters', async () => {
    const res = await request(app)
      .post('/api/signup')
      .send({ name: 'Patrick', email: 'patrick@test.com', password: 'a'.repeat(21) });

    expect(res.statusCode).toBe(400);
  });

  test('rejects invalid email format', async () => {
    const res = await request(app)
      .post('/api/signup')
      .send({ name: 'Patrick', email: 'not-an-email', password: 'testpass123' });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/valid email/i);
  });

  test('rejects duplicate email', async () => {
    await request(app).post('/api/signup')
      .send({ name: 'Patrick', email: 'patrick@test.com', password: 'testpass123' });

    const res = await request(app).post('/api/signup')
      .send({ name: 'Someone Else', email: 'patrick@test.com', password: 'anotherpass' });

    expect(res.statusCode).toBe(409);
  });
});

describe('POST /api/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/signup')
      .send({ name: 'Patrick', email: 'patrick@test.com', password: 'testpass123' });
  });

  test('logs in with correct credentials', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ email: 'patrick@test.com', password: 'testpass123' });

    expect(res.statusCode).toBe(200);
    expect(res.body.email).toBe('patrick@test.com');
  });

  test('rejects wrong password', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ email: 'patrick@test.com', password: 'wrongpass' });

    expect(res.statusCode).toBe(401);
  });

  test('rejects nonexistent email', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ email: 'nobody@test.com', password: 'testpass123' });

    expect(res.statusCode).toBe(401);
  });

  test('rejects missing password', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ email: 'patrick@test.com' });

    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/admin-login', () => {
  beforeEach(async () => {
    await request(app).post('/api/signup')
      .send({ name: 'Patrick', email: 'patrick@test.com', password: 'testpass123' });
    await request(app).post('/api/signup')
      .send({ name: 'Admin', email: 'admin@test.com', password: 'adminpass123' });
    await request(app).post('/api/debug/make-admin')
      .send({ email: 'admin@test.com' });
  });

  test('allows login for a promoted admin', async () => {
    const res = await request(app)
      .post('/api/admin-login')
      .send({ email: 'admin@test.com', password: 'adminpass123' });

    expect(res.statusCode).toBe(200);
    expect(res.body.role).toBe('admin');
  });

  test('blocks a valid, non-admin user with 403', async () => {
    const res = await request(app)
      .post('/api/admin-login')
      .send({ email: 'patrick@test.com', password: 'testpass123' });

    expect(res.statusCode).toBe(403);
  });

  test('rejects wrong password with 401, not 403', async () => {
    const res = await request(app)
      .post('/api/admin-login')
      .send({ email: 'admin@test.com', password: 'wrongpass' });

    expect(res.statusCode).toBe(401);
  });
});