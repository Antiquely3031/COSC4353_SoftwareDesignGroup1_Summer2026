// Unit tests for the Notification backend
// Run with npm test jest --coverage

const notif = require('./QSNotificationBackend');
const db = require('./QSnotificationDB');

// Every test starts from a clean empty store
beforeEach(() => {
  db._resetForTests();
});

// Validation rules required fields, types, length limits

describe('validateNotification', () => {
  const valid = { userId: 1, type: 'info', message: 'hello' };

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

  test('rejects a userId of the wrong type', () => {
    expect(notif.validateNotification({ ...valid, userId: { id: 1 } }))
      .toContain('userId must be a number or a string');
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

  test('reports multiple problems at once', () => {
    const errors = notif.validateNotification({});
    expect(errors).toContain('userId is required');
    expect(errors).toContain('type is required');
    expect(errors).toContain('message is required');
  });
});

// create / read / clear 

describe('createNotification / getNotificationsForUser / clearNotifications', () => {
  test('creates and stores a valid notification', () => {
    const result = notif.createNotification({ userId: 1, type: 'info', message: 'hi' });

    expect(result.ok).toBe(true);
    expect(result.notification).toMatchObject({ userId: 1, type: 'info', message: 'hi' });
    expect(result.notification.id).toBe(1);
    expect(typeof result.notification.time).toBe('string');

    expect(notif.getNotificationsForUser(1)).toHaveLength(1);
  });

  test('refuses an invalid notification and stores nothing', () => {
    const result = notif.createNotification({ userId: 1 }); // missing type and message

    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(notif.getNotificationsForUser(1)).toHaveLength(0);
  });

  test('fills in a default title per type when no title is given', () => {
    const q = notif.createNotification({ userId: 1, type: 'queue', message: 'm' });
    const s = notif.createNotification({ userId: 1, type: 'status', message: 'm' });
    const i = notif.createNotification({ userId: 1, type: 'info', message: 'm' });

    expect(q.notification.title).toBe('Queue Update');
    expect(s.notification.title).toBe('Status Change');
    expect(i.notification.title).toBe('Info');
  });

  test('keeps notifications newest first', () => {
    notif.createNotification({ userId: 1, type: 'info', message: 'first' });
    notif.createNotification({ userId: 1, type: 'info', message: 'second' });

    const list = notif.getNotificationsForUser(1);
    expect(list[0].message).toBe('second');
    expect(list[1].message).toBe('first');
  });

  test('keeps different users separate', () => {
    notif.createNotification({ userId: 1, type: 'info', message: 'for user 1' });
    notif.createNotification({ userId: 2, type: 'info', message: 'for user 2' });

    expect(notif.getNotificationsForUser(1)).toHaveLength(1);
    expect(notif.getNotificationsForUser(2)).toHaveLength(1);
    expect(notif.getNotificationsForUser(1)[0].message).toBe('for user 1');
  });

  test('returns an empty array for a user with no notifications', () => {
    expect(notif.getNotificationsForUser(999)).toEqual([]);
  });

  test('clearNotifications wipes one user only', () => {
    notif.createNotification({ userId: 1, type: 'info', message: 'a' });
    notif.createNotification({ userId: 2, type: 'info', message: 'b' });

    notif.clearNotifications(1);

    expect(notif.getNotificationsForUser(1)).toEqual([]);
    expect(notif.getNotificationsForUser(2)).toHaveLength(1);
  });
});

// Trigger 1 user joins a queue 

describe('notifyQueueJoined', () => {
  test('creates a queue notification with the service name in the message', () => {
    const result = notif.notifyQueueJoined(1, 'Academic Advising');

    expect(result.ok).toBe(true);
    expect(result.notification.type).toBe('queue');
    expect(result.notification.message).toBe('You joined the Academic Advising queue.');
    expect(notif.getNotificationsForUser(1)).toHaveLength(1);
  });
});

// Trigger 2 user is about to be served

describe('notifyPositionUpdate', () => {
  test('does nothing while the user is above the threshold', () => {
    const result = notif.notifyPositionUpdate(1, 'IT Help Desk', notif.ALMOST_READY_THRESHOLD + 1);

    expect(result).toEqual({ ok: true, notification: null });
    expect(notif.getNotificationsForUser(1)).toHaveLength(0);
  });

  test('fires "almost ready" exactly at the threshold', () => {
    const result = notif.notifyPositionUpdate(1, 'IT Help Desk', notif.ALMOST_READY_THRESHOLD);

    expect(result.ok).toBe(true);
    expect(result.notification.title).toBe('Almost ready');
    expect(result.notification.message)
      .toBe('You are almost up for IT Help Desk. Please stay nearby.');
  });

  test('does not spam: only notifies once per user+service', () => {
    notif.notifyPositionUpdate(1, 'IT Help Desk', 2);
    const again = notif.notifyPositionUpdate(1, 'IT Help Desk', 1); // moved 2 to 1

    expect(again).toEqual({ ok: true, notification: null });
    expect(notif.getNotificationsForUser(1)).toHaveLength(1);
  });

  test('tracks user+service separately (other services still notify)', () => {
    notif.notifyPositionUpdate(1, 'IT Help Desk', 2);
    const other = notif.notifyPositionUpdate(1, 'Financial Aid', 2);

    expect(other.notification.title).toBe('Almost ready');
    expect(notif.getNotificationsForUser(1)).toHaveLength(2);
  });

  test('rejects an invalid position', () => {
    expect(notif.notifyPositionUpdate(1, 'IT Help Desk', 0).ok).toBe(false);
    expect(notif.notifyPositionUpdate(1, 'IT Help Desk', 'first').ok).toBe(false);
    expect(notif.notifyPositionUpdate(1, 'IT Help Desk', 1.5).ok).toBe(false);
  });
});

// Extra triggers served and left

describe('notifyServed and notifyQueueLeft', () => {
  test('notifyServed creates a completion notification', () => {
    const result = notif.notifyServed(1, 'Financial Aid');

    expect(result.ok).toBe(true);
    expect(result.notification.title).toBe('Served');
    expect(result.notification.message).toBe('Your Financial Aid request has been completed.');
  });

  test('being served resets "almost ready", so a return visit notifies again', () => {
    notif.notifyPositionUpdate(1, 'IT Help Desk', 2); // almost ready triggers
    notif.notifyServed(1, 'IT Help Desk');            // served and tracker reset

    const nextVisit = notif.notifyPositionUpdate(1, 'IT Help Desk', 2);
    expect(nextVisit.notification.title).toBe('Almost ready');
  });

  test('leaving a queue resets "almost ready" without creating a notification', () => {
    notif.notifyPositionUpdate(1, 'IT Help Desk', 2); // almost ready triggers
    const left = notif.notifyQueueLeft(1, 'IT Help Desk');

    expect(left).toEqual({ ok: true, notification: null });
    expect(notif.getNotificationsForUser(1)).toHaveLength(1); // nothing new added

    const rejoin = notif.notifyPositionUpdate(1, 'IT Help Desk', 2);
    expect(rejoin.notification.title).toBe('Almost ready'); // can trigger again
  });
});
