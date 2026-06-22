require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL ? [process.env.FRONTEND_URL, 'http://localhost:5173'] : true,
  credentials: true,
}));
app.use(express.json());

// API routes
app.use('/api/seniors', require('./routes/seniors'));
app.use('/api', require('./routes/checkin'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/push', require('./routes/push'));

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
