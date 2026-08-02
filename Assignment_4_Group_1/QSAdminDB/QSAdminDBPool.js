import mysql from 'mysql2/promise'; // Uses the promise-based wrapper for async/await
import dotenv from 'dotenv';
dotenv.config({ path: './QSAdminDBEnv.env' });

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 100,
  queueLimit: 0
});

export default pool;
