/* I, Richard Tiamzon, am in charge of the Notification portion of the project

 This module is the backend notification logic
   1. creates/stores/reads notifications (now in real MySQL via QSNotificationDB.js),
   2. validates all input,
   3. provides the TRIGGER functions the Queue module should call
        notifyQueueJoined() -> when a user joins a queue
        notifyPositionUpdate() -> sends "almost ready" near the front
        notifyServed() / notifyQueueLeft() -> extra for completeness

 ASSIGNMENT 4 CHANGES
   - Every function that touches storage is now async because the storage is
     a database
   - userId must now be a positive whole number. NotificationHistory.user_id is
     a foreign key into UserCredentials, so essentially a notification cannot be created for
     a user that does not exist
   - Added markNotificationsViewed() to support the sent/viewed status
   - Triggers now pass serviceName
*/

const db = require('./QSNotificationDB');

// Constants

const TYPES = ['queue', 'status', 'info']; // used from the Assignment 2 frontend
const TITLE_MAX = 50;                      
const MESSAGE_MAX = 255;                   
const SERVICE_MAX = 100;                   
const ALMOST_READY_THRESHOLD = 2;          

// Validation

/* Accepts a number or a numeric string and returns a positive integer,
   or null when the value could not be a real user_id */
function toUserId(value)
{
  if (value === undefined || value === null || value === '') { return null; }

  const asNumber = Number(value);
  if (!Number.isInteger(asNumber) || asNumber < 1) { return null; }

  return asNumber;
}

// This returns a list of problems with the given notification data
// Validating required fields, field types, and field length limits
function validateNotification(data)
{
  const errors = [];

  if (data === null || typeof data !== 'object')
  {
    return ['notification data must be an object'];
  }

  // userId required, and must be usable as a foreign key
  if (data.userId === undefined || data.userId === null || data.userId === '')
  {
    errors.push('userId is required');
  }
  else if (toUserId(data.userId) === null)
  {
    errors.push('userId must be a positive whole number');
  }

  // type required
  if (data.type === undefined || data.type === null || data.type === '')
  {
    errors.push('type is required');
  }
  else if (typeof data.type !== 'string' || !TYPES.includes(data.type))
  {
    errors.push('type must be one of: ' + TYPES.join(', '));
  }

  // title optional
  if (data.title !== undefined && data.title !== null)
  {
    if (typeof data.title !== 'string')
    {
      errors.push('title must be a string');
    }
    else if (data.title.length > TITLE_MAX)
    {
      errors.push('title must be ' + TITLE_MAX + ' characters or fewer');
    }
  }

  // serviceName optional, but must fit the column when present
  if (data.serviceName !== undefined && data.serviceName !== null)
  {
    if (typeof data.serviceName !== 'string')
    {
      errors.push('serviceName must be a string');
    }
    else if (data.serviceName.length > SERVICE_MAX)
    {
      errors.push('serviceName must be ' + SERVICE_MAX + ' characters or fewer');
    }
  }

  // message required
  if (data.message === undefined || data.message === null || data.message === '')
  {
    errors.push('message is required');
  }
  else if (typeof data.message !== 'string')
  {
    errors.push('message must be a string');
  }
  else if (data.message.length > MESSAGE_MAX)
  {
    errors.push('message must be ' + MESSAGE_MAX + ' characters or fewer');
  }

  return errors;
}

// Core functions

/* Creates and stores a notification
   Returns {ok: true, notification}  on success
           {ok: false, errors: [...]} if validation fails or the user does not exist
*/
async function createNotification(data)
{
  const errors = validateNotification(data);
  if (errors.length > 0)
  {
    return { ok: false, errors: errors };
  }

  const userId = toUserId(data.userId);

  const notification = {
    userId: userId,
    type: data.type,
    title: data.title || defaultTitle(data.type),
    serviceName: data.serviceName === undefined ? null : data.serviceName,
    message: data.message
  };

  try
  {
    const saved = await db.addNotification(userId, notification);
    return { ok: true, notification: saved };
  }
  catch (error)
  {
    /* The foreign key rejects notifications for users who do not exist. */
    if (error && error.code === 'ER_NO_REFERENCED_ROW_2')
    {
      return { ok: false, errors: ['userId does not match an existing user'] };
    }
    throw error;
  }
}

// All notifications for one user, newest first
async function getNotificationsForUser(userId)
{
  const id = toUserId(userId);
  if (id === null) { return []; }

  return db.getNotifications(id);
}

// Removes every notification for one user
async function clearNotifications(userId)
{
  const id = toUserId(userId);
  if (id === null) { return; }

  await db.clearNotifications(id);
}

/* Marks this user's unread notifications as viewed.
   Returns {ok: true, updated: n} so the caller knows how many changed */
async function markNotificationsViewed(userId)
{
  const id = toUserId(userId);
  if (id === null)
  {
    return { ok: false, errors: ['userId must be a positive whole number'] };
  }

  const updated = await db.markAllViewed(id);
  return { ok: true, updated: updated };
}

// Trigger functions that the Queue module calls
// Trigger 1 calls when a user joins a queue
async function notifyQueueJoined(userId, serviceName)
{
  return createNotification({
    userId: userId,
    type: 'queue',
    title: 'Joined queue',
    serviceName: serviceName,
    message: 'You joined the ' + serviceName + ' queue.'
  });
}

/* Trigger 2 calls every time a user's queue position changes
   Sends "almost ready" once the position reaches the ALMOST_READY_THRESHOLD,
   but just once per user+service, so a user moving 2 to 1 doesnt get notified twice.
   Returns {ok: true, notification: null} when there is nothing to announce
 */
async function notifyPositionUpdate(userId, serviceName, position)
{
  if (typeof position !== 'number' || !Number.isInteger(position) || position < 1)
  {
    return { ok: false, errors: ['position must be a whole number of at least 1'] };
  }

  const id = toUserId(userId);
  if (id === null)
  {
    return { ok: false, errors: ['userId must be a positive whole number'] };
  }

  if (position > ALMOST_READY_THRESHOLD)
  {
    return { ok: true, notification: null };
  }

  if (await db.wasAlmostReadySent(id, serviceName))
  {
    return { ok: true, notification: null };
  }

  return createNotification({
    userId: id,
    type: 'status',
    title: db.ALMOST_READY_TITLE,
    serviceName: serviceName,
    message: 'You are almost up for ' + serviceName + '. Please stay nearby.'
  });
}

// calls when a user has been served
// Also clears the "almost ready" marker so a future visit can notify again
async function notifyServed(userId, serviceName)
{
  const id = toUserId(userId);
  if (id === null)
  {
    return { ok: false, errors: ['userId must be a positive whole number'] };
  }

  await db.resetAlmostReady(id, serviceName);

  return createNotification({
    userId: id,
    type: 'status',
    title: 'Served',
    serviceName: serviceName,
    message: 'Your ' + serviceName + ' request has been completed.'
  });
}

// calls when a user leaves a queue without being served
// Clears the marker only
async function notifyQueueLeft(userId, serviceName)
{
  const id = toUserId(userId);
  if (id === null)
  {
    return { ok: false, errors: ['userId must be a positive whole number'] };
  }

  await db.resetAlmostReady(id, serviceName);
  return { ok: true, notification: null };
}

// Helpers
function defaultTitle(type)
{
  if (type === 'queue') { return 'Queue Update'; }
  if (type === 'status') { return 'Status Change'; }
  return 'Info';
}

// Exports

module.exports = {
  // core
  createNotification,
  getNotificationsForUser,
  clearNotifications,
  markNotificationsViewed,
  // triggers
  notifyQueueJoined,
  notifyPositionUpdate,
  notifyServed,
  notifyQueueLeft,
  // validation
  validateNotification,
  toUserId,
  // constants for tests and teammates
  TYPES,
  TITLE_MAX,
  MESSAGE_MAX,
  SERVICE_MAX,
  ALMOST_READY_THRESHOLD
};
