/* QSNotificationRoutes.js
  REST API layer for the Notification module
  This is an Express "router", a self contained set of routes that can be
   1. mounted by QSNotificationServer.js to run standalone like in a demo,
   2. mounted by a single shared server later 
  Either way this file does not change. All it does is translate HTTP requests
  into calls on QSNotificationBackend and turn the results into HTTP responses
  This layer only maps functions from and to HTTP.
 */

const express = require('express');
const notif = require('./QSNotificationBackend');

const router = express.Router();

// Turns the backend result ({ok, notification} | {ok:false, errors}) into a response shown below
//    validation failed            400 with the list of errors
//    created a notification       201 with the notification
//    succceeded but nothing new   200 with notification null
function sendResult(res, result) {
  if (!result.ok) {
    return res.status(400).json({ errors: result.errors });
  }
  const code = result.notification ? 201 : 200;
  return res.status(code).json({ notification: result.notification });
}

// Guard for the trigger routes just so they all need a userId and a serviceName.
function requireUserAndService(req, res) {
  const { userId, serviceName } = req.body || {};
  if (!userId || !serviceName) {
    res.status(400).json({ errors: ['userId and serviceName are required'] });
    return null;
  }
  return { userId: String(userId), serviceName: serviceName };
}

// GET /api/notifications/:userId  -> all notifications for one user (newest first)
router.get('/:userId', (req, res) => {
  const list = notif.getNotificationsForUser(String(req.params.userId));
  res.status(200).json({ notifications: list });
});

// DELETE /api/notifications/:userId  -> clear one user's notifications
router.delete('/:userId', (req, res) => {
  notif.clearNotifications(String(req.params.userId));
  res.status(200).json({ ok: true });
});

// POST /api/notifications  -> generic create (mainly exercises validation directly)
router.post('/', (req, res) => {
  const data = Object.assign({}, req.body);
  if (data.userId !== undefined && data.userId !== null && data.userId !== '') {
    data.userId = String(data.userId);
  }
  sendResult(res, notif.createNotification(data));
});

// POST /api/notifications/queue-joined  -> TRIGGER 1 (user joined a queue)
router.post('/queue-joined', (req, res) => {
  const p = requireUserAndService(req, res);
  if (!p) { return; }
  sendResult(res, notif.notifyQueueJoined(p.userId, p.serviceName));
});

// POST /api/notifications/position-update TRIGGER 2 
router.post('/position-update', (req, res) => {
  const p = requireUserAndService(req, res);
  if (!p) { return; }
  sendResult(res, notif.notifyPositionUpdate(p.userId, p.serviceName, req.body.position));
});

// POST /api/notifications/served user has been served
router.post('/served', (req, res) => {
  const p = requireUserAndService(req, res);
  if (!p) { return; }
  sendResult(res, notif.notifyServed(p.userId, p.serviceName));
});

// POST /api/notifications/queue-left user left the queue which resets the trackr
router.post('/queue-left', (req, res) => {
  const p = requireUserAndService(req, res);
  if (!p) { return; }
  sendResult(res, notif.notifyQueueLeft(p.userId, p.serviceName));
});

module.exports = router;
