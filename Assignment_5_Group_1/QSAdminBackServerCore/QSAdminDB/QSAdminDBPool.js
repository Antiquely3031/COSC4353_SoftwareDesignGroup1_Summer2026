import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve directory name for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load env file relative to this module's directory
dotenv.config({ path: path.resolve(__dirname, 'QSAdminDBEnv.env') });

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  port: Number(process.env.DB_PORT) || 3306,
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'queuesmartdb',
  multipleStatements: true,
  waitForConnections: true,
  connectionLimit: 100,
  queueLimit: 0
});

export default pool;