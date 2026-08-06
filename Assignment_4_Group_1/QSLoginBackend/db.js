// db.js — real MySQL connection, replaces fakeDB.js
require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

module.exports = {
  findUserByEmail: async (email) => {
    const [rows] = await pool.execute(
      'SELECT * FROM UserCredentials WHERE email = ?', [email]
    );
    return rows[0]; // undefined if not found — same behavior as fakeDB
  },
  createUser: async (userData) => {
    const { name, email, password, role } = userData;
    const dbRole = role === 'admin' ? 'Administrator' : 'User';
    const [result] = await pool.execute(
      'INSERT INTO UserCredentials (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, password, dbRole]
    );
    return { id: result.insertId, name, email, role: dbRole };
  },
  updateUserRole: async (email, role) => {
    await pool.execute(
      'UPDATE UserCredentials SET role = ? WHERE email = ?',
      [role, email]
    );
  },
  updateUser: async (user_id, updates) => {
    const fields = [];
    const values = [];
    if(updates.name) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if(updates.password_hash) {
      fields.push('password_hash = ?');
      values.push(updates.password_hash);
    }
    if(fields.length === 0) return;
    values.push(user_id);
    await pool.execute(
      `UPDATE UserCredentials SET ${fields.join(', ')} WHERE user_id = ?`,
      values
    );
  },
  deleteUserByEmail: async (email) => {
    await pool.execute('DELETE FROM UserCredentials WHERE email = ?', [email]);
  },
  setResetToken: async (user_id, token, expires) => {
    await pool.execute(
      `UPDATE UserCredentials SET reset_token = ?, reset_token_expires = ? WHERE user_id = ?`,
      [token, expires, user_id]
    );
  },
  findUserByResetToken: async (token) => {
    const [rows] = await pool.execute(
      `SELECT * FROM UserCredentials WHERE reset_token = ?`,
      [token]
    );
    return rows[0];
  },
  clearResetToken: async (user_id) => {
    await pool.execute(
      `UPDATE UserCredentials SET reset_token = NULL, reset_token_expires = NULL WHERE user_id = ?`,
      [user_id]
    );
  },
  closePool: async () => {
    await pool.end();
  }
};