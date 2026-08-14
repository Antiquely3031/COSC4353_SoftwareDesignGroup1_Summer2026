// db.js — real MySQL connection, replaces fakeDB.js
require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

module.exports = {
  findUserByEmail: async (email) => {
    const [rows] = await pool.execute(
      'SELECT * FROM user_credentials WHERE email = ?', [email]
    );
    return rows[0]; // undefined if not found — same behavior as fakeDB
  },
  createUser: async (userData) => {
    const { name, email, password, role } = userData;
    const dbRole = role === 'admin' ? 'Administrator' : 'User';
    const [result] = await pool.execute(
      'INSERT INTO user_credentials (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, password, dbRole]
    );
    return { id: result.insertId, name, email, role: dbRole };
  },
  updateUserRole: async (email, role) => {
    await pool.execute(
      'UPDATE user_credentials SET role = ? WHERE email = ?',
      [role, email]
    );
  },
  deleteUserByEmail: async (email) => {
    await pool.execute('DELETE FROM user_credentials WHERE email = ?', [email]);
  },
  updateLoginTracking: async (user_Id, ip) => {
    await pool.execute(
      `UPDATE UserCredentials SET last_login_ip = ?, last_login_time = NOW() WHERE user_id = ?`,
      [ip, user_Id]
    );
  },
  closePool: async () => {
    await pool.end();
  }
};