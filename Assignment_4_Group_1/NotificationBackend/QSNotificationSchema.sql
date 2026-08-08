/* QSNotificationSchema.sql
   Richard Tiamzon, Notification module

   The base NotificationHistory table only stores user_id, message, timestamp
   and status. The notification object also carries a type and a title, and the "almost ready" trigger needs to know
   which service a notification belonged to

   These three columns close that gap:
     type          mirrors the TYPES constant in QSNotificationBackend.js
     title         VARCHAR(50) mirrors TITLE_MAX, enforcing the length limit in the DB
     service_name  lets the "almost ready" dEduplication live in the database
                   instead of the in memory Set

   message is already VARCHAR(255), which matches MESSAGE_MAX

   SIDENOTE: MySQL 8.0 has no "ADD COLUMN IF NOT EXISTS", so this script runs once.
   Re-running it errors with "Duplicate column name"
*/

USE QueueSmartDB;

ALTER TABLE NotificationHistory
    ADD COLUMN type ENUM('queue', 'status', 'info') NOT NULL DEFAULT 'info' AFTER user_id,
    ADD COLUMN title VARCHAR(50) NOT NULL DEFAULT 'Info' AFTER type,
    ADD COLUMN service_name VARCHAR(100) NULL AFTER title,
    ADD INDEX idx_notif_user_time (user_id, timestamp);
