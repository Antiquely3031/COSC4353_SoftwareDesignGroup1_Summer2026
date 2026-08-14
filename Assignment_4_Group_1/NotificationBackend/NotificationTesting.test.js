/* Unit tests for the Notification backend
   Run with npm test (jest --coverage --runInBand)

   ASSIGNMENT 4: these now run against the real MySQL database rather than
   in memory
*/

const notif = require('./QSNotificationBackend');
const db = require('./QSNotificationDB');
const t = require('./testUtils');

beforeAll(async () => {
  await t.createTestUsers();
});

// Every test starts with no notifications for the users
beforeEach(async () => {
  await t.clearTestNotifications();
});

afterAll(async () => {
  await t.removeTestUsers();
  await t.closePool();
  await db.closePool();
});

// Validation rules required fields, types, length limits

describe('validateNotification', () => {
  const valid = { userId: t.USER_A, type: 'info', message: 'hello' };

  test('accepts a valid notification', () => {
    expect(notif.validateNotification(valid)).toEqual([]);
  });

  test('rejects non-object input', () => {
    expect(notif.validateNotification(null)).toContain('notification data must be an object');
    expect(notif.validateNotification('nope')).toContain('notification data must be an object');
  });

  test('requires userId', () => {
    expect(notif.validateNotification({ ...valid, userId: undefined }))
      .toContain('userId is required');
    expect(notif.validateNotification({ ...valid, userId: '' }))
      .toContain('userId is required');
  });

  test('rejects a userId that could not be a real user_id', () => {
    // A4: user_id is an INT foreign key, so objects and words are both out
    expect(notif.validateNotification({ ...valid, userId: { id: 1 } }))
      .toContain('userId must be a positive whole number');
    expect(notif.validateNotification({ ...valid, userId: 'abc' }))
      .toContain('userId must be a positive whole number');
  });

  test('requires type and rejects unknown types', () => {
    expect(notif.validateNotification({ ...valid, type: undefined }))
      .toContain('type is required');
    expect(notif.validateNotification({ ...valid, type: 'carrier-pigeon' }))
      .toContain('type must be one of: queue, status, info');
  });

  test('requires message', () => {
    expect(notif.validateNotification({ ...valid, message: undefined }))
      .toContain('message is required');
    expect(notif.validateNotification({ ...valid, message: '' }))
      .toContain('message is required');
  });

  test('rejects a message of the wrong type', () => {
    expect(notif.validateNotification({ ...valid, message: 12345 }))
      .toContain('message must be a string');
  });

  test('enforces the message length limit', () => {
    const tooLong = 'x'.repeat(notif.MESSAGE_MAX + 1);
    expect(notif.validateNotification({ ...valid, message: tooLong }))
      .toContain('message must be ' + notif.MESSAGE_MAX + ' characters or fewer');
    // exactly at the limit is fine
    const atLimit = 'x'.repeat(notif.MESSAGE_MAX);
    expect(notif.validateNotification({ ...valid, message: atLimit })).toEqual([]);
  });

  test('title is optional, but must be a string within the limit when given', () => {
    expect(notif.validateNotification({ ...valid })).toEqual([]); // no title is fine
    expect(notif.validateNotification({ ...valid, title: 42 }))
      .toContain('title must be a string');
    const tooLong = 'x'.repeat(notif.TITLE_MAX + 1);
    expect(notif.validateNotification({ ...valid, title: tooLong }))
      .toContain('title must be ' + notif.TITLE_MAX + ' characters or fewer');
  });

  // A4: service_name is a real column now, so it has a limit of its own
  test('serviceName is optional, but must fit its column when given', () => {
    expect(notif.validateNotification({ ...valid, serviceName: 42 }))
      .toContain('serviceName must be a string');
    const tooLong = 'x'.repeat(notif.SERVICE_MAX + 1);
    expect(notif.validateNotification({ ...valid, serviceName: tooLong }))
      .toContain('serviceName must be ' + notif.SERVICE_MAX + ' characters or fewer');
    expect(notif.validateNotification({ ...valid, serviceName: 'IT Help Desk' })).toEqual([]);
  });

  test('reports multiple problems at once', () => {
    const errors = notif.validateNotification({});
    expect(errors).toContain('userId is required');
    expect(errors).toContain('type is required');
    expect(errors).toContain('message is required');
  });
});

// A4: userId coercion is what keeps the foreign key satisfied

describe('toUserId', () => {
  test('accepts whole numbers and numeric strings', () => {
    expect(notif.toUserId(5)).toBe(5);
    expect(notif.toUserId('5')).toBe(5);
  });

  test('rejects anything that is not a positive whole number', () => {
    expect(notif.toUserId('abc')).toBeNull();
    expect(notif.toUserId(0)).toBeNull();
    expect(notif.toUserId(-1)).toBeNull();
    expect(notif.toUserId(1.5)).toBeNull();
    expect(notif.toUserId(null)).toBeNull();
    expect(notif.toUserId('')).toBeNull();
  });
});

// create / read / clear

describe('createNotification / getNotificationsForUser / clearNotifications', () => {
  test('creates and stores a valid notification', async () => {
    const result = await notif.createNotification({
      userId: t.USER_A, type: 'info', message: 'hi'
    });

    expect(result.ok).toBe(true);
    expect(result.notification).toMatchObject({
      userId: t.USER_A, type: 'info', message: 'hi'
    });
    // A4: MySQL assigns the id, so we check the shape rather than a fixed value
    expect(Number.isInteger(result.notification.id)).toBe(true);
    expect(result.notification.status).toBe('sent');

    expect(await notif.getNotificationsForUser(t.USER_A)).toHaveLength(1);
  });

  test('refuses an invalid notification and stores nothing', async () => {
    const result = await notif.createNotification({ userId: t.USER_A }); // no type/message

    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(await notif.getNotificationsForUser(t.USER_A)).toHaveLength(0);
  });

  // A4: the foreign key is a validation boundary
  test('refuses a notification for a user that does not exist', async () => {
    const result = await notif.createNotification({
      userId: t.MISSING_USER, type: 'info', message: 'nobody home'
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('userId does not match an existing user');
  });

  test('fills in a default title per type when no title is given', async () => {
    const q = await notif.createNotification({ userId: t.USER_A, type: 'queue', message: 'm' });
    const s = await notif.createNotification({ userId: t.USER_A, type: 'status', message: 'm' });
    const i = await notif.createNotification({ userId: t.USER_A, type: 'info', message: 'm' });

    expect(q.notification.title).toBe('Queue Update');
    expect(s.notification.title).toBe('Status Change');
    expect(i.notification.title).toBe('Info');
  });

  test('keeps notifications newest first', async () => {
    await notif.createNotification({ userId: t.USER_A, type: 'info', message: 'first' });
    await notif.createNotification({ userId: t.USER_A, type: 'info', message: 'second' });

    const list = await notif.getNotificationsForUser(t.USER_A);
    expect(list[0].message).toBe('second');
    expect(list[1].message).toBe('first');
  });

  test('keeps different users separate', async () => {
    await notif.createNotification({ userId: t.USER_A, type: 'info', message: 'for user A' });
    await notif.createNotification({ userId: t.USER_B, type: 'info', message: 'for user B' });

    expect(await notif.getNotificationsForUser(t.USER_A)).toHaveLength(1);
    expect(await notif.getNotificationsForUser(t.USER_B)).toHaveLength(1);
    expect((await notif.getNotificationsForUser(t.USER_A))[0].message).toBe('for user A');
  });

  test('returns an empty array for a user with no notifications', async () => {
    expect(await notif.getNotificationsForUser(t.MISSING_USER)).toEqual([]);
  });

  test('returns an empty array for an unusable userId', async () => {
    expect(await notif.getNotificationsForUser('not-a-number')).toEqual([]);
  });

  test('clearNotifications wipes one user only', async () => {
    await notif.createNotification({ userId: t.USER_A, type: 'info', message: 'a' });
    await notif.createNotification({ userId: t.USER_B, type: 'info', message: 'b' });

    await notif.clearNotifications(t.USER_A);

    expect(await notif.getNotificationsForUser(t.USER_A)).toEqual([]);
    expect(await notif.getNotificationsForUser(t.USER_B)).toHaveLength(1);
  });

  test('clearNotifications ignores an unusable userId', async () => {
    await notif.createNotification({ userId: t.USER_A, type: 'info', message: 'a' });
    await notif.clearNotifications('not-a-number');
    expect(await notif.getNotificationsForUser(t.USER_A)).toHaveLength(1);
  });
});

// A4: the sent/viewed status the assignment asks for

describe('markNotificationsViewed', () => {
  test('moves unread notifications to viewed and reports the count', async () => {
    await notif.createNotification({ userId: t.USER_A, type: 'info', message: 'one' });
    await notif.createNotification({ userId: t.USER_A, type: 'info', message: 'two' });

    const result = await notif.markNotificationsViewed(t.USER_A);

    expect(result.ok).toBe(true);
    expect(result.updated).toBe(2);

    const list = await notif.getNotificationsForUser(t.USER_A);
    expect(list.every(n => n.status === 'viewed')).toBe(true);
  });

  test('marking twice does not double count', async () => {
    await notif.createNotification({ userId: t.USER_A, type: 'info', message: 'one' });

    await notif.markNotificationsViewed(t.USER_A);
    const second = await notif.markNotificationsViewed(t.USER_A);

    expect(second.updated).toBe(0);
  });

  test('leaves other users alone', async () => {
    await notif.createNotification({ userId: t.USER_A, type: 'info', message: 'a' });
    await notif.createNotification({ userId: t.USER_B, type: 'info', message: 'b' });

    await notif.markNotificationsViewed(t.USER_A);

    const other = await notif.getNotificationsForUser(t.USER_B);
    expect(other[0].status).toBe('sent');
  });

  test('rejects an unusable userId', async () => {
    const result = await notif.markNotificationsViewed('not-a-number');
    expect(result.ok).toBe(false);
  });
});

// Trigger 1 user joins a queue

describe('notifyQueueJoined', () => {
  test('creates a queue notification with the service name in the message', async () => {
    const result = await notif.notifyQueueJoined(t.USER_A, 'Academic Advising');

    expect(result.ok).toBe(true);
    expect(result.notification.type).toBe('queue');
    expect(result.notification.message).toBe('You joined the Academic Advising queue.');
    expect(await notif.getNotificationsForUser(t.USER_A)).toHaveLength(1);
  });

  // A4: the service is stored now
  test('records the service name in its own column', async () => {
    await notif.notifyQueueJoined(t.USER_A, 'Academic Advising');

    const list = await notif.getNotificationsForUser(t.USER_A);
    expect(list[0].serviceName).toBe('Academic Advising');
  });
});

// Trigger 2 user is about to be served

describe('notifyPositionUpdate', () => {
  test('does nothing while the user is above the threshold', async () => {
    const result = await notif.notifyPositionUpdate(
      t.USER_A, 'IT Help Desk', notif.ALMOST_READY_THRESHOLD + 1
    );

    expect(result).toEqual({ ok: true, notification: null });
    expect(await notif.getNotificationsForUser(t.USER_A)).toHaveLength(0);
  });

  test('fires "almost ready" exactly at the threshold', async () => {
    const result = await notif.notifyPositionUpdate(
      t.USER_A, 'IT Help Desk', notif.ALMOST_READY_THRESHOLD
    );

    expect(result.ok).toBe(true);
    expect(result.notification.title).toBe('Almost ready');
    expect(result.notification.message)
      .toBe('You are almost up for IT Help Desk. Please stay nearby.');
  });

  test('does not spam: only notifies once per user+service', async () => {
    await notif.notifyPositionUpdate(t.USER_A, 'IT Help Desk', 2);
    const again = await notif.notifyPositionUpdate(t.USER_A, 'IT Help Desk', 1); // moved 2 to 1

    expect(again).toEqual({ ok: true, notification: null });
    expect(await notif.getNotificationsForUser(t.USER_A)).toHaveLength(1);
  });

  /* A4:  The marker is a stored row, so a fresh read of the database still sees it */
  test('the "almost ready" marker lives in the database, not in memory', async () => {
    await notif.notifyPositionUpdate(t.USER_A, 'IT Help Desk', 2);

    expect(await db.wasAlmostReadySent(t.USER_A, 'IT Help Desk')).toBe(true);
    expect(await db.wasAlmostReadySent(t.USER_A, 'Financial Aid')).toBe(false);
  });

  test('tracks user+service separately (other services still notify)', async () => {
    await notif.notifyPositionUpdate(t.USER_A, 'IT Help Desk', 2);
    const other = await notif.notifyPositionUpdate(t.USER_A, 'Financial Aid', 2);

    expect(other.notification.title).toBe('Almost ready');
    expect(await notif.getNotificationsForUser(t.USER_A)).toHaveLength(2);
  });

  test('tracks users separately (another user still notifies)', async () => {
    await notif.notifyPositionUpdate(t.USER_A, 'IT Help Desk', 2);
    const other = await notif.notifyPositionUpdate(t.USER_B, 'IT Help Desk', 2);

    expect(other.notification.title).toBe('Almost ready');
  });

  test('rejects an invalid position', async () => {
    expect((await notif.notifyPositionUpdate(t.USER_A, 'IT Help Desk', 0)).ok).toBe(false);
    expect((await notif.notifyPositionUpdate(t.USER_A, 'IT Help Desk', 'first')).ok).toBe(false);
    expect((await notif.notifyPositionUpdate(t.USER_A, 'IT Help Desk', 1.5)).ok).toBe(false);
  });

  test('rejects an unusable userId', async () => {
    const result = await notif.notifyPositionUpdate('not-a-number', 'IT Help Desk', 1);
    expect(result.ok).toBe(false);
  });
});

// Extra triggers served and left

describe('notifyServed and notifyQueueLeft', () => {
  test('notifyServed creates a completion notification', async () => {
    const result = await notif.notifyServed(t.USER_A, 'Financial Aid');

    expect(result.ok).toBe(true);
    expect(result.notification.title).toBe('Served');
    expect(result.notification.message).toBe('Your Financial Aid request has been completed.');
  });

  test('being served resets "almost ready", so a return visit notifies again', async () => {
    await notif.notifyPositionUpdate(t.USER_A, 'IT Help Desk', 2); // almost ready triggers
    await notif.notifyServed(t.USER_A, 'IT Help Desk');            // served and marker cleared

    const nextVisit = await notif.notifyPositionUpdate(t.USER_A, 'IT Help Desk', 2);
    expect(nextVisit.notification.title).toBe('Almost ready');
  });

  test('leaving a queue resets "almost ready" without creating a notification', async () => {
    await notif.notifyPositionUpdate(t.USER_A, 'IT Help Desk', 2); // almost ready triggers
    const left = await notif.notifyQueueLeft(t.USER_A, 'IT Help Desk');

    expect(left).toEqual({ ok: true, notification: null });
    // the marker row is removed, so nothing of that service remains
    expect(await notif.getNotificationsForUser(t.USER_A)).toHaveLength(0);

    const rejoin = await notif.notifyPositionUpdate(t.USER_A, 'IT Help Desk', 2);
    expect(rejoin.notification.title).toBe('Almost ready'); // can trigger again
  });

  test('both triggers reject an unusable userId', async () => {
    expect((await notif.notifyServed('not-a-number', 'Financial Aid')).ok).toBe(false);
    expect((await notif.notifyQueueLeft('not-a-number', 'Financial Aid')).ok).toBe(false);
  });
});
