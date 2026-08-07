/* QSNotificationRoutes.js
  REST API layer for the Notification module
  This is an Express "router", a self contained set of routes that can be
   1. mounted by QSNotificationServer.js to run standalone like in a demo,
   2. mounted by a single shared server later
  Either way this file does not change. All it does is translate HTTP requests
  into calls on QSNotificationBackend and turn the results into HTTP responses
  This layer only maps functions from and to HTTP.

  ASSIGNMENT 4 CHANGES
     Handlers are async and awaited
     Every handler is wrapped so a database failure returns a 500
     Added PATCH /:userId/viewed for the sent/viewed status
 */

const express = require('express');
const notif = require('./QSNotificationBackend');

const router = express.Router();

function handle(fn)
{
  return function (req, res)
  {
    Promise.resolve(fn(req, res)).catch(function (error)
    {
      console.error('Notification route failed:', error.message);
      res.status(500).json({ errors: ['Notification service failed'] });
    });
  };
}

// Turns the backend result ({ok, notification} | {ok:false, errors}) into a response shown below
//    validation failed            400 with the list of errors
//    created a notification       201 with the notification
//    succceeded but nothing new   200 with notification null
function sendResult(res, result)
{
  if (!result.ok)
  {
    return res.status(400).json({ errors: result.errors });
  }
  const code = result.notification ? 201 : 200;
  return res.status(code).json({ notification: result.notification });
}

// Guard for the trigger routes just so they all need a userId and a serviceName
function requireUserAndService(req, res)
{
  const { userId, serviceName } = req.body || {};
  if (!userId || !serviceName)
  {
    res.status(400).json({ errors: ['userId and serviceName are required'] });
    return null;
  }
  return { userId: userId, serviceName: serviceName };
}

router.post('/', handle(async (req, res) =>
{
  sendResult(res, await notif.createNotification(Object.assign({}, req.body)));
}));

// POST /api/notifications/queue-joined  -> TRIGGER 1 (user joined a queue)
router.post('/queue-joined', handle(async (req, res) =>
{
  const p = requireUserAndService(req, res);
  if (!p) { return; }
  sendResult(res, await notif.notifyQueueJoined(p.userId, p.serviceName));
}));

// POST /api/notifications/position-update TRIGGER 2
router.post('/position-update', handle(async (req, res) =>
{
  const p = requireUserAndService(req, res);
  if (!p) { return; }
  sendResult(res, await notif.notifyPositionUpdate(p.userId, p.serviceName, req.body.position));
}));

// POST /api/notifications/served user has been served
router.post('/served', handle(async (req, res) =>
{
  const p = requireUserAndService(req, res);
  if (!p) { return; }
  sendResult(res, await notif.notifyServed(p.userId, p.serviceName));
}));

// POST /api/notifications/queue-left user left the queue which resets the tracker
router.post('/queue-left', handle(async (req, res) =>
{
  const p = requireUserAndService(req, res);
  if (!p) { return; }
  sendResult(res, await notif.notifyQueueLeft(p.userId, p.serviceName));
}));

/* PATCH /api/notifications/:userId/viewed mark this user's unread
   notifications as viewed and the sent/viewed status exists
   in the table */
router.patch('/:userId/viewed', handle(async (req, res) =>
{
  const result = await notif.markNotificationsViewed(req.params.userId);
  if (!result.ok)
  {
    return res.status(400).json({ errors: result.errors });
  }
  res.status(200).json({ ok: true, updated: result.updated });
}));

// GET /api/notifications/:userId  -> all notifications for one user (newest first)
router.get('/:userId', handle(async (req, res) =>
{
  const list = await notif.getNotificationsForUser(req.params.userId);
  res.status(200).json({ notifications: list });
}));

// DELETE /api/notifications/:userId  -> clear one user's notifications
router.delete('/:userId', handle(async (req, res) =>
{
  await notif.clearNotifications(req.params.userId);
  res.status(200).json({ ok: true });
}));

module.exports = router;
