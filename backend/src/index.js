require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = new Set([
  'http://localhost:5173',
  'https://senior-checkin-omega.vercel.app',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
]);
app.use(cors({
  origin: (origin, cb) => cb(null, !origin || allowedOrigins.has(origin) ? true : false),
  credentials: true,
}));
app.use(express.json());

// API routes
app.use('/api/seniors', require('./routes/seniors'));
app.use('/api/caregivers', require('./routes/caregivers'));
app.use('/api', require('./routes/checkin'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/push', require('./routes/push'));
app.use('/api/debug', require('./routes/debug'));

app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
);

// Scheduled jobs
const { scheduleDailyReset, scheduleSMSAlerts, scheduleWeeklyReport, scheduleMonthlyReport, schedulePushReminders } =
  require('./jobs/scheduler');

scheduleDailyReset();
scheduleSMSAlerts();
scheduleWeeklyReport();
scheduleMonthlyReport();
schedulePushReminders();

app.listen(PORT, () => {
  console.log(`\n🏥 Senior Check-In Server running on http://localhost:${PORT}`);
  console.log('📅 Scheduled jobs: midnight reset, 12pm SMS alert, weekly & monthly reports\n');
});
