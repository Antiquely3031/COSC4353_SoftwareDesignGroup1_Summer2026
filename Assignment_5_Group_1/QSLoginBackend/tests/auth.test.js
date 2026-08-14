jest.mock('nodemailer', () => ({
  createTransport: () => ({
    sendMail: jest.fn().mockResolvedValue({response: 'mocked'})
  })
}));

const request = require('supertest');
const app = require('../app');
const db = require('../db');

beforeEach(async () => {
  await db.deleteUserByEmail('patrick@test.com');
  await db.deleteUserByEmail('admin@test.com');
});

afterAll(async () => {
  await db.closePool();
});

describe('POST /api/signup', () => {
  test('creates a new user with valid data', async () => {
    const res = await request(app)
      .post('/api/signup')
      .send({ name: 'Patrick', email: 'patrick@test.com', password: 'testpass123' });

    expect(res.statusCode).toBe(201);
    expect(res.body.email).toBe('patrick@test.com');
    expect(res.body.role).toBe('User');
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

  test('allow login for prompted admin', async () => {
    const res = await request(app)
      .post('/api/admin-login')
      .send({email: 'admin@test.com', password: 'adminpass123'});
    expect(res.statusCode).toBe(200);
    expect(res.body.role).toBe('Administrator');
  });

  test('block a valid, non-admin user with 403 code', async () => {
    const res = await request(app)
      .post('/api/admin-login')
      .send({email: 'patrick@test.com', password: 'testpass123'});
    expect(res.statusCode).toBe(403);
  });

  test('reject incorrect password with 401', async () => {
    const res = await request(app)
      .post('/api/admin-login')
      .send({email: 'admin@test.com', password: 'wrongpass'});
    expect(res.statusCode).toBe(401);
  });

  test('rejects missing email or password', async () => {
    const res = await request(app)
      .post('/api/admin-login')
      .send({email: 'admin@test.com'});
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  test('rejects invalid email formatting', async () => {
    const res = await request(app)
      .post('/api/admin-login')
      .send({email: 'not-an-email', password: 'adminpass123'});
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/valid email/i);
  });

  test('reject email that does not exist', async () => {
    const res = await request(app)
      .post('/api/admin-login')
      .send({email: 'nobody@test.com', password: 'anypassword'});
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/invalid/i);
  });
});

describe('PUT /api/user/update', () => {
  beforeEach(async() => {
    await db.deleteUserByEmail('updateuser@test.com');
    await request(app).post('/api/signup/')
      .send({name: 'Original Name', email: 'updateuser@test.com', password: 'testpass123'});
  });

  test('updates name with correct current password', async () => {
    const res = await request(app)
      .put('/api/user/update')
      .send({email: 'updateuser@test.com', currentPassword: 'testpass123', newName: 'New Name'});
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('Account updated successfully.');
  });

  test('rejects update with wrong current password', async () => {
    const res = await request(app)
      .put('/api/user/update')
      .send({email: 'updateuser@test.com', currentPassword: 'wrongpass', newName: 'New Name'});
    expect(res.statusCode).toBe(401);
  });

  test('rejects new password outside length bounds', async() => {
    const res = await request(app)
      .put('/api/user/update')
      .send({email: 'updateuser@test.com', currentPassword: 'testpass123', newPassword: 'short'});
    expect(res.statusCode).toBe(400);
  });

  test('successfully changes password and old password stops working', async () => {
    await request(app).put('/api/user/update')
      .send({email: 'updateuser@test.com', currentPassword: 'testpass123', newPassword: 'newpass456'});
    const oldLogin = await request(app).post('/api/login')
      .send({email: 'updateuser@test.com', password: 'testpass123'});
    expect(oldLogin.statusCode).toBe(401);
    const newLogin = await request(app).post('/api/login')
      .send({email: 'updateuser@test.com', password: 'newpass456'});
    expect(newLogin.statusCode).toBe(200);
  });
});

describe('POST /api/forgot-password', () => {
  beforeEach(async () => {
    await db.deleteUserByEmail('forgotuser@test.com');
    await request(app).post('/api/signup')
      .send({name: 'Forgot User', email: 'forgotuser@test.com', password: 'testpass123'});
  });

  test('returns generic success message for an existing email', async () => {
    const res = await request(app)
      .post('/api/forgot-password')
      .send({email: 'forgotuser@test.com'});
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBeDefined();
  });

  test('returns generic message for an email that does not exist', async () => {
    const res = await request(app)
      .post('/api/forgot-password')
      .send({email: 'doesnotexist@test.com'});
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBeDefined();
  });

  test('rejects missing email', async () => {
    const res = await request(app)
      .post('/api/forgot-password')
      .send({});
    expect(res.statusCode).toBe(400);
  });

  test('sets reset token in database for real user', async () => {
    await request(app).post('/api/forgot-password').send({email: 'forgotuser@test.com'});
    const user = await db.findUserByEmail('forgotuser@test.com');
    expect(user.reset_token).not.toBeNull();
    expect(user.reset_token_expires).not.toBeNull();
  });
});

describe('POST /api/reset-password', () => {
  let validToken;
  beforeEach(async () => {
    await db.deleteUserByEmail('resetflow@test.com');
    await request(app).post('/api/signup')
      .send({name: 'Reset Flow', email: 'resetflow@test.com', password: 'testpass123'});
    validToken = 'test-token-' + Date.now();
    const user = await db.findUserByEmail('resetflow@test.com');
    const futureExpiry = new Date(Date.now() + 3600000);
    await db.setResetToken(user.user_id, validToken, futureExpiry);
  });

  test('rejects missing token password', async () => {
    const res = await request(app).post('/api/reset-password').send({});
    expect(res.statusCode).toBe(400);
  });

  test('rejects an invalid or unkown token', async () => {
    const res = await request(app)
      .post('/api/reset-password')
      .send({token: 'not-a-real-token', newPassword: 'newpass456'});
    expect(res.statusCode).toBe(400);
  });

  test('rejects an expired token', async () => {
    const user = await db.findUserByEmail('resetflow@test.com');
    const pastExpiry = new Date(Date.now() - 1000);
    await db.setResetToken(user.user_id, validToken, pastExpiry);
    const res = await request(app)
      .post('/api/reset-password')
      .send({token: validToken, newPassword: 'newpass456'});
    expect(res.statusCode).toBe(400);
  });

  test('successful password reset with token', async () => {
    const res = await request(app)
      .post('/api/reset-password')
      .send({token: validToken, newPassword: 'newpass456'});
    expect(res.statusCode).toBe(200);
    const login = await request(app).post('/api/login')
      .send({email: 'resetflow@test.com', password: 'newpass456'});
    expect(login.statusCode).toBe(200);
  });

  test('token cannot be reused after reset', async () => {
    await request(app).post('/api/reset-password')
      .send({token: validToken, newPassword: 'newpass456'});
    const secondAttempt = await request(app)
      .post('/api/reset-password')
      .send({token: validToken, newPassword: 'anotherpass789'});
    expect(secondAttempt.statusCode).toBe(400);
  });
});

describe('isAnomalousLogin logic', () => {
  const {isAnomalousLogin} = require('../app');

  test('do not flag first-ever login', () => {
    const user = {last_login_ip: null, last_login_time:null};
    expect(isAnomalousLogin(user, '1.2.3.4')).toBe(false);
  });

  test('flags an IP change within 30 minutes of last login', () => {
    const user = {last_login_ip: '1.2.3.4', last_login_time: new Date(Date.now() - 5 * 60000)};
    expect(isAnomalousLogin(user, '5.6.7.8')).toBe(true);
  });

  test('do not flag the same IP, even when recent', () => {
    const user = {last_login_ip: '1.2.3.4', last_login_time: new Date(Date.now() - 5 * 60000)};
    expect(isAnomalousLogin(user, '1.2.3.4')).toBe(false);
  });

  test('do not flag IP change after more than 30 minutes', () => {
    const user = {last_login_ip: '1.2.3.4', last_login_time: new Date(Date.now() - 60 * 60000)};
    expect(isAnomalousLogin(user, '5.6.7.8')).toBe(false);
  });
});

