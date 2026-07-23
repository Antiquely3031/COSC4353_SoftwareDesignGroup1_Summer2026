// tempory memory to be replaced by Assignment 4
// The logic validation, triggers, message wording lives in NotificationBackend.js

let notificationsByUser = new Map();

// remembers which "userId|serviceName" combos were already told "almost ready",
// so the same user is not spammed every time their position changes
let almostReadySent = new Set();

let nextId = 1;

module.exports = {
  nextIdValue: () => nextId++,

  addNotification: (userId, notification) => {
    if (!notificationsByUser.has(userId)) {
      notificationsByUser.set(userId, []);
    }
    notificationsByUser.get(userId).unshift(notification); // newest first
    return notification;
  },

  getNotifications: (userId) => notificationsByUser.get(userId) || [],

  clearNotifications: (userId) => notificationsByUser.delete(userId),

  // "almost ready" tracking
  wasAlmostReadySent: (userId, serviceName) => almostReadySent.has(userId + '|' + serviceName),
  markAlmostReadySent: (userId, serviceName) => almostReadySent.add(userId + '|' + serviceName),
  resetAlmostReady: (userId, serviceName) => almostReadySent.delete(userId + '|' + serviceName),

  _resetForTests: () => {
    notificationsByUser = new Map();
    almostReadySent = new Set();
    nextId = 1;
  }
};
