/* QSNotificationDB.js
   Richard Tiamzon

   This replaces the in memory Map/Set used in Assignment 3 with real MySQL
   persistence against the NotificationHistory table

   Rows are mapped back into the same object shape the front end has used
   since Assignment 2 ({id, userId, type, title, message, time}), basically UI
   change is required
*/

const mysql = require('mysql2/promise');
require('dotenv').config();

const ALMOST_READY_TITLE = 'Almost ready';

const pool = mysql.createPool(
{
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10
});

/* NotificationHistory stores column names */
function rowToNotification(row)
{
  return {
    id: row.notification_id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    serviceName: row.service_name,
    message: row.message,
    time: row.timestamp instanceof Date
      ? row.timestamp.toISOString()
      : row.timestamp,
    status: row.status
  };
}

module.exports = {

  ALMOST_READY_TITLE,

  /* Insert one notification and return it with the id MySQL assigned */
  addNotification: async (userId, notification) =>
  {
    const [result] = await pool.execute(
      `INSERT INTO NotificationHistory
         (user_id, type, title, service_name, message, status)
       VALUES (?, ?, ?, ?, ?, 'sent')`,
      [
        userId,
        notification.type,
        notification.title,
        notification.serviceName === undefined ? null : notification.serviceName,
        notification.message
      ]
    );

    return Object.assign({}, notification, {
      id: result.insertId,
      userId: userId,
      status: 'sent'
    });
  },

  // Newest first, matching the unshift() ordering Assignment 3 used
  getNotifications: async (userId) =>
  {
    const [rows] = await pool.execute(
      `SELECT notification_id, user_id, type, title, service_name,
              message, timestamp, status
         FROM NotificationHistory
        WHERE user_id = ?
        ORDER BY timestamp DESC, notification_id DESC`,
      [userId]
    );

    return rows.map(rowToNotification);
  },

  clearNotifications: async (userId) =>
  {
    await pool.execute(
      'DELETE FROM NotificationHistory WHERE user_id = ?',
      [userId]
    );
  },

  /* Marks every unread notification for one user as viewed and reports how many
     changed */
  markAllViewed: async (userId) =>
  {
    const [result] = await pool.execute(
      `UPDATE NotificationHistory
          SET status = 'viewed'
        WHERE user_id = ? AND status = 'sent'`,
      [userId]
    );

    return result.affectedRows;
  },

  /* "Almost ready" de-duplication */
  wasAlmostReadySent: async (userId, serviceName) =>
  {
    const [rows] = await pool.execute(
      `SELECT 1
         FROM NotificationHistory
        WHERE user_id = ? AND service_name = ? AND title = ?
        LIMIT 1`,
      [userId, serviceName, ALMOST_READY_TITLE]
    );

    return rows.length > 0;
  },

  /* Clears the marker so a later visit to the same service can notify again.
     Also Called when a user is served or leaves the queue */
  resetAlmostReady: async (userId, serviceName) =>
  {
    await pool.execute(
      `DELETE FROM NotificationHistory
        WHERE user_id = ? AND service_name = ? AND title = ?`,
      [userId, serviceName, ALMOST_READY_TITLE]
    );
  },

  // Lets Jest close the connection pool so the test run can exit
  closePool: async () =>
  {
    await pool.end();
  }
};
