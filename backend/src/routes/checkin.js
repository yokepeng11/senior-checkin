const express = require('express');
const router = express.Router();
const db = require('../db');
const { randomUUID } = require('crypto');

// POST /api/checkin
router.post('/checkin', (req, res) => {
  const { senior_id, timestamp, app_version = '1.0.0', device_type = 'web' } = req.body;

  if (!senior_id) {
    return res.status(400).json({ status: 'error', message: 'senior_id is required' });
  }

  const senior = db.prepare('SELECT * FROM seniors WHERE senior_id = ? AND is_active = 1').get(senior_id);
  if (!senior) {
    return res.status(404).json({ status: 'error', message: 'Senior not found' });
  }

  const now = timestamp ? new Date(timestamp) : new Date();
  const today = now.toISOString().split('T')[0];
  const confirmedAt = now.toISOString();

  // Idempotent: return existing check-in if already done today
  const existing = db.prepare(
    'SELECT * FROM daily_status WHERE senior_id = ? AND date = ? AND checked_in_today = 1'
  ).get(senior_id, today);

  if (existing) {
    return res.json({
      status: 'success',
      message: 'Already checked in today',
      confirmed_at: existing.last_checkin_time,
    });
  }

  db.prepare(
    'INSERT INTO checkins (checkin_id, senior_id, checkin_timestamp, device_type, app_version) VALUES (?, ?, ?, ?, ?)'
  ).run(randomUUID(), senior_id, confirmedAt, device_type, app_version);

  db.prepare(`
    INSERT INTO daily_status (status_id, senior_id, date, checked_in_today, last_checkin_time)
    VALUES (?, ?, ?, 1, ?)
    ON CONFLICT(senior_id, date) DO UPDATE SET checked_in_today = 1, last_checkin_time = ?
  `).run(randomUUID(), senior_id, today, confirmedAt, confirmedAt);

  console.log(`✅ Check-in: ${senior.name} (${senior_id}) at ${confirmedAt}`);

  res.json({ status: 'success', message: 'Check-in recorded successfully', confirmed_at: confirmedAt });
});

// GET /api/checkin/today?senior_id=xxx
router.get('/checkin/today', (req, res) => {
  const { senior_id } = req.query;
  if (!senior_id) return res.status(400).json({ error: 'senior_id required' });

  const today = new Date().toISOString().split('T')[0];
  const status = db.prepare('SELECT * FROM daily_status WHERE senior_id = ? AND date = ?').get(senior_id, today);

  res.json({
    checked_in: status?.checked_in_today === 1,
    last_checkin_time: status?.last_checkin_time || null,
    date: today,
  });
});

// GET /api/history/:senior_id?days=30
router.get('/history/:senior_id', (req, res) => {
  const { senior_id } = req.params;
  const days = parseInt(req.query.days) || 30;

  const history = db.prepare(`
    SELECT date, checked_in_today, last_checkin_time
    FROM daily_status
    WHERE senior_id = ?
    ORDER BY date DESC
    LIMIT ?
  `).all(senior_id, days);

  res.json(history);
});

module.exports = router;
