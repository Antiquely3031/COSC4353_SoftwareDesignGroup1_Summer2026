/* testUtils.js
   Richard Tiamzon

   Assignment 3 could start each test from an empty Map with _resetForTests().
   With a real database, that is essentiall no longer possible as NotificationHistory.user_id
   is a foreign key, so a notification cannot exist unless its user does

   Excluded from coverage in jest.config.json, it is test scaffolding, not
   part of the notification module
*/

const mysql = require('mysql2/promise');
require('dotenv').config();

// Far above anything AUTO_INCREMENT will realistically reach in this project
const USER_A = 9001;
const USER_B = 9002;

const pool = mysql.createPool(
{
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 5
});

async function createTestUsers()
{
  await removeTestUsers();

  await pool.execute(
    `INSERT INTO UserCredentials (user_id, name, email, password_hash, role)
     VALUES (?, 'Jest User A', 'jest.a@test.invalid', 'not-a-real-hash', 'User'),
            (?, 'Jest User B', 'jest.b@test.invalid', 'not-a-real-hash', 'User')`,
    [USER_A, USER_B]
  );
}

// ON DELETE CASCADE clears their notifications along with them
async function removeTestUsers()
{
  await pool.execute(
    'DELETE FROM UserCredentials WHERE user_id IN (?, ?)',
    [USER_A, USER_B]
  );
}

// Between tests we only need the notifications gone
async function clearTestNotifications()
{
  await pool.execute(
    'DELETE FROM NotificationHistory WHERE user_id IN (?, ?)',
    [USER_A, USER_B]
  );
}

async function closePool()
{
  await pool.end();
}

module.exports = {
  USER_A,
  USER_B,
  MISSING_USER: 999999, 
  createTestUsers,
  removeTestUsers,
  clearTestNotifications,
  closePool
};
