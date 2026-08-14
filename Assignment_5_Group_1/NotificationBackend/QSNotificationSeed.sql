/* QSNotificationSeed.sql
   Richard Tiamzon Notification module

   NotificationHistory.user_id is a foreign key into UserCredentials, so a
   notification cannot exist without a real user

   Both accounts use the password:  testpass123
   The hashes below are bcrypt hashes, so these accounts can
   actually sign in through the login backend

   the DELETE removes the test users first, and the ON DELETE CASCADE on 
   NotificationHistory clears their notifications with them
*/

USE QueueSmartDB;

/* Remove any previous run
   Matching on id as well as email clears the slot even if someone signed up
   with a different address at the same id. */
DELETE FROM UserCredentials
WHERE email IN ('richard@test.com', 'admin@test.com')
   OR user_id IN (1, 2);

/* user_id is given rather than left to AUTO_INCREMENT. Without this
   the ids climb on every rerun, and a plain DELETE + INSERT moved these accounts
   from 1 and 2 to 3 and 4. Fixed ids keep the demo reproducible */
INSERT INTO UserCredentials (user_id, name, email, password_hash, role) VALUES
    (1, 'Richard Test', 'richard@test.com',
     '$2b$10$4D0nEv15kux1wpywa3tg1urhUEYJihViDPOXQ1hebVLV1KfJr1ibW', 'User'),
    (2, 'Admin Test', 'admin@test.com',
     '$2b$10$4D0nEv15kux1wpywa3tg1urhUEYJihViDPOXQ1hebVLV1KfJr1ibW', 'Administrator');

/* Sample notifications for the regular test user */

INSERT INTO NotificationHistory (user_id, type, title, service_name, message, status)
SELECT user_id, 'queue', 'Joined queue', 'Advising Academics',
       'You joined the Advising Academics queue.', 'viewed'
FROM UserCredentials WHERE email = 'richard@test.com';

INSERT INTO NotificationHistory (user_id, type, title, service_name, message, status)
SELECT user_id, 'status', 'Almost ready', 'Advising Academics',
       'You are almost up for Advising Academics. Please stay nearby.', 'sent'
FROM UserCredentials WHERE email = 'richard@test.com';

INSERT INTO NotificationHistory (user_id, type, title, service_name, message, status)
SELECT user_id, 'queue', 'Joined queue', 'IT Help Desk',
       'You joined the IT Help Desk queue.', 'sent'
FROM UserCredentials WHERE email = 'richard@test.com';

INSERT INTO NotificationHistory (user_id, type, title, service_name, message, status)
SELECT user_id, 'info', 'Info', NULL,
       'Welcome to QueueSmart.', 'sent'
FROM UserCredentials WHERE email = 'richard@test.com';
