/* I, Richard Tiamzon, am in charge of the Notification portion of the project (Assignment 3).

 This module is the backend notification logic
   1. creates/stores/reads notifications (in memory via notificationDB.js (Not a real DB),
   2. validates all input,
   3. provides the TRIGGER functions the Queue module should call
        notifyQueueJoined() --> when a user joins a queue         
        notifyPositionUpdate() --> sends "almost ready" near the front 
        notifyServed() / notifyQueueLeft() --> extra for completeness
*/

const db = require('./QSnotificationDB');

// Constants 

const TYPES = ['queue', 'status', 'info']; // used from the Assignment 2 frontend
const TITLE_MAX = 50;                      // field length limits 
const MESSAGE_MAX = 255;
const ALMOST_READY_THRESHOLD = 2;          // position at which the "almost ready" message gets sent

// Validation

// This returns a list of problems with the given notification data
// Validating required fields, field types, and field length limits
function validateNotification(data) {
  const errors = [];

  if (data === null || typeof data !== 'object') {
    return ['notification data must be an object'];
  }

  // userId required
  if (data.userId === undefined || data.userId === null || data.userId === '') {
    errors.push('userId is required');
  } else if (typeof data.userId !== 'number' && typeof data.userId !== 'string') {
    errors.push('userId must be a number or a string');
  }

  // type required
  if (data.type === undefined || data.type === null || data.type === '') {
    errors.push('type is required');
  } else if (typeof data.type !== 'string' || !TYPES.includes(data.type)) {
    errors.push('type must be one of: ' + TYPES.join(', '));
  }

  // title optional
  if (data.title !== undefined && data.title !== null) {
    if (typeof data.title !== 'string') {
      errors.push('title must be a string');
    } else if (data.title.length > TITLE_MAX) {
      errors.push('title must be ' + TITLE_MAX + ' characters or fewer');
    }
  }

  // message required
  if (data.message === undefined || data.message === null || data.message === '') {
    errors.push('message is required');
  } else if (typeof data.message !== 'string') {
    errors.push('message must be a string');
  } else if (data.message.length > MESSAGE_MAX) {
    errors.push('message must be ' + MESSAGE_MAX + ' characters or fewer');
  }

  return errors;
}

// Core functions 

/* Creates and stores a notification
   Returns {ok: true, notification}  on success
           {ok: false, errors: [...]} if validation fails
*/
function createNotification(data) {
  const errors = validateNotification(data);
  if (errors.length > 0) {
    return { ok: false, errors: errors };
  }

  const notification = {
    id: db.nextIdValue(),
    userId: data.userId,
    type: data.type,
    title: data.title || defaultTitle(data.type),
    message: data.message,
    time: new Date().toISOString()
  };

  db.addNotification(data.userId, notification);
  return { ok: true, notification: notification };
}

// All notifications for one user
function getNotificationsForUser(userId) {
  return db.getNotifications(userId);
}

// Removes every notification for one user
function clearNotifications(userId) {
  db.clearNotifications(userId);
}

// Trigger functions that the Queue module calls
// Trigger 1 calls when a user joins a queue
function notifyQueueJoined(userId, serviceName) {
  return createNotification({
    userId: userId,
    type: 'queue',
    title: 'Joined queue',
    message: 'You joined the ' + serviceName + ' queue.'
  });
}

/* Trigger 2 calls every time a user's queue position changes
   Sends "almost ready" once the position reaches ALMOST_READY_THRESHOLD,
   but only once per user+service, so a user moving 2 to 1 isn't notified twice.
   Returns {ok: true, notification: null} when there is nothing to announce
 */
function notifyPositionUpdate(userId, serviceName, position) {
  if (typeof position !== 'number' || !Number.isInteger(position) || position < 1) {
    return { ok: false, errors: ['position must be a whole number of at least 1'] };
  }

  if (position > ALMOST_READY_THRESHOLD) {
    return { ok: true, notification: null }; 
  }

  if (db.wasAlmostReadySent(userId, serviceName)) {
    return { ok: true, notification: null }; 
  }

  db.markAlmostReadySent(userId, serviceName);
  return createNotification({
    userId: userId,
    type: 'status',
    title: 'Almost ready',
    message: 'You are almost up for ' + serviceName + '. Please stay nearby.'
  });
}

// calls when a user has been served
// Also resets the "almost ready" tracker so a future visit can notify again later
function notifyServed(userId, serviceName) {
  db.resetAlmostReady(userId, serviceName);
  return createNotification({
    userId: userId,
    type: 'status',
    title: 'Served',
    message: 'Your ' + serviceName + ' request has been completed.'
  });
}

// calls when a user leaves a queue without being served
// Resets the tracker only
function notifyQueueLeft(userId, serviceName) {
  db.resetAlmostReady(userId, serviceName);
  return { ok: true, notification: null };
}

// Helpers 
function defaultTitle(type) {
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
  // triggers
  notifyQueueJoined,
  notifyPositionUpdate,
  notifyServed,
  notifyQueueLeft,
  // validation 
  validateNotification,
  // constants for tests and teammates
  TYPES,
  TITLE_MAX,
  MESSAGE_MAX,
  ALMOST_READY_THRESHOLD
};
