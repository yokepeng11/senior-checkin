const express = require('express');
const router = express.Router();
const db = require('../db');
const { normalisePhone } = require('../phoneUtils');

// GET /api/dashboard?phone=91234567
// If phone is provided, only return seniors linked to that caregiver phone.
router.get('/', (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  let seniors;
  if (req.query.phone) {
    const queryPhone = normalisePhone(req.query.phone);
    // Load all then filter in JS so the normalisation logic is consistent
    const all = db.prepare('SELECT * FROM seniors WHERE is_active = 1 ORDER BY name').all();
    seniors = all.filter(s =>
      normalisePhone(s.person_in_charge_phone) === queryPhone ||
      normalisePhone(s.next_of_kin_phone)      === queryPhone
    );
  } else {
    seniors = db.prepare('SELECT * FROM seniors WHERE is_active = 1 ORDER BY name').all();
  }

  const seniorsWithStatus = seniors.map(senior => {
    const status = db.prepare(
      'SELECT * FROM daily_status WHERE senior_id = ? AND date = ?'
    ).get(senior.senior_id, today);

    const last30 = db.prepare(
      'SELECT checked_in_today FROM daily_status WHERE senior_id = ? ORDER BY date DESC LIMIT 30'
    ).all(senior.senior_id);

    const checkInRate = last30.length
      ? Math.round((last30.filter(d => d.checked_in_today).length / last30.length) * 100)
      : 0;

    return {
      ...senior,
      today_status: {
        checked_in: status?.checked_in_today === 1,
        last_checkin_time: status?.last_checkin_time || null,
      },
      check_in_rate: checkInRate,
    };
  });

  const checkedIn = seniorsWithStatus.filter(s => s.today_status.checked_in).length;

  res.json({
    date: today,
    total_seniors: seniors.length,
    checked_in_today: checkedIn,
    not_checked_in: seniors.length - checkedIn,
    seniors: seniorsWithStatus,
  });
});

// GET /api/dashboard/reports/weekly/:senior_id
router.get('/reports/weekly/:senior_id', (req, res) => {
  const senior = db.prepare('SELECT * FROM seniors WHERE senior_id = ?').get(req.params.senior_id);
  if (!senior) return res.status(404).json({ error: 'Senior not found' });

  const history = db.prepare(`
    SELECT date, checked_in_today, last_checkin_time
    FROM daily_status WHERE senior_id = ? ORDER BY date DESC LIMIT 7
  `).all(req.params.senior_id);

  const checkedInDays = history.filter(d => d.checked_in_today).length;
  const rate = history.length ? Math.round((checkedInDays / history.length) * 100) : 0;

  res.json({
    senior,
    period: '7 days',
    total_days: history.length,
    checked_in_days: checkedInDays,
    missed_days: history.length - checkedInDays,
    check_in_rate: rate,
    missed_dates: history.filter(d => !d.checked_in_today).map(d => d.date),
    history,
    trend: rate >= 80 ? 'stable' : rate >= 60 ? 'declining' : 'critical',
  });
});

// GET /api/dashboard/reports/monthly/:senior_id
router.get('/reports/monthly/:senior_id', (req, res) => {
  const senior = db.prepare('SELECT * FROM seniors WHERE senior_id = ?').get(req.params.senior_id);
  if (!senior) return res.status(404).json({ error: 'Senior not found' });

  const history = db.prepare(`
    SELECT date, checked_in_today, last_checkin_time
    FROM daily_status WHERE senior_id = ? ORDER BY date DESC LIMIT 30
  `).all(req.params.senior_id);

  const checkedInDays = history.filter(d => d.checked_in_today).length;
  const rate = history.length ? Math.round((checkedInDays / history.length) * 100) : 0;

  res.json({
    senior,
    period: '30 days',
    total_days: history.length,
    checked_in_days: checkedInDays,
    missed_days: history.length - checkedInDays,
    check_in_rate: rate,
    missed_dates: history.filter(d => !d.checked_in_today).map(d => d.date),
    history,
    trend: rate >= 80 ? 'stable' : rate >= 60 ? 'declining' : 'critical',
  });
});

// GET /api/dashboard/alerts
router.get('/alerts', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const alerts = db.prepare(
    'SELECT * FROM alert_log WHERE alert_date = ? ORDER BY sent_at DESC'
  ).all(today);
  res.json(alerts);
});

module.exports = router;
