// Demo server for the Notification module
// Run it with node QSNotificationServer.js or just npm start

const express = require('express');
const cors = require('cors');
require('dotenv').config();
const notificationRoutes = require('./QSNotificationRoutes');

const app = express();
app.use(cors());            // let the front end call
app.use(express.json());

// health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Notification server is running' });
});

// notifications routes live under /api/notifications
app.use('/api/notifications', notificationRoutes);

// 3001 keeps this module clear of the other backends, which all use 3000
const PORT = process.env.PORT || 3001;

// Listens when this file is run directly node QSNotificationServer.js
// When it is require() by the tests we export app instead so supertest can
// use it without opening a real port
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Notification server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
