const http = require('http');
const app = require('./app');
const { testConnection } = require('./config/database');
const { runSafeMigrations } = require('../database/migrate');
require('dotenv').config();

const PORT = process.env.PORT || 3000;
const { UPLOADS_BASE, WEBFILES_BASE, isMediaOutsideProject } = require('./utils/paths');

// 1. Immediately bind HTTP server so reverse proxy / edge never waits on DB connection
const server = app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`🚀 PhonesDaddy Server is running on:`);
  console.log(`👉 http://localhost:${PORT}`);
  console.log(`👉 Admin Panel: http://localhost:${PORT}/admin`);
  console.log(`📁 Uploads Dir: ${UPLOADS_BASE}`);
  console.log(`📁 Webfiles Dir: ${WEBFILES_BASE}`);
  console.log(`🛡️  Media Safety: ${isMediaOutsideProject ? 'OUTSIDE deployment folder (SAFE from Git & ZIP)' : 'INSIDE project'}`);
  console.log(`⚡ Instant Port Binding: Active (0ms cold-start block)`);
  console.log(`=================================================`);
});

// 2. Perform DB connection & migrations non-blockingly in background
(async function initBackgroundServices() {
  try {
    const dbOk = await testConnection();
    if (!dbOk) {
      console.error('⚠️ Warning: Failed to connect to MySQL database. Ensure MySQL daemon is running.');
    } else {
      await runSafeMigrations();
    }
  } catch (err) {
    console.error('Background init error:', err.message);
  }
})();

// 3. Keep-alive self-ping (every 8 minutes) to prevent Hostinger LiteSpeed/Passenger process idle shutdown
const KEEP_ALIVE_INTERVAL = 8 * 60 * 1000;
setInterval(() => {
  http.get(`http://localhost:${PORT}/api/health`, (res) => {
    res.resume(); // Consume stream
  }).on('error', () => {});
}, KEEP_ALIVE_INTERVAL);

module.exports = server;

