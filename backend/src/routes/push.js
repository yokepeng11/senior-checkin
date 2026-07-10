const express = require('express');
const router = express.Router();
const db = require('../db');
const { normalisePhone } = require('../phoneUtils');

// POST /api/push/subscribe  — senior device
router.post('/subscribe', (req, res) => {
  const { senior_id, subscription } = req.body;
  if (!senior_id || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  db.prepare(`
    INSERT INTO push_subscriptions (senior_id, endpoint, p256dh, auth)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET
      senior_id  = excluded.senior_id,
      p256dh     = excluded.p256dh,
      auth       = excluded.auth,
      created_at = datetime('now')
  `).run(senior_id, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth);
  res.json({ ok: true });
});

// POST /api/push/caregiver-subscribe  — caregiver device
// Body: { phone: "+6582687111", device_id: "uuid", subscription: { endpoint, keys: { p256dh, auth } } }
router.post('/caregiver-subscribe', (req, res) => {
  const { phone, device_id, subscription } = req.body;
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  const normPhone = phone ? normalisePhone(phone) : null;
  db.prepare(`
    INSERT INTO caregiver_push_subscriptions (phone, device_id, endpoint, p256dh, auth)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET
      phone      = excluded.phone,
      device_id  = excluded.device_id,
      p256dh     = excluded.p256dh,
      auth       = excluded.auth,
      created_at = datetime('now')
  `).run(normPhone, device_id || null, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth);
  res.json({ ok: true });
});

// POST /api/push/unsubscribe  — remove a senior's push subscription
router.post('/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' });
  db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
  res.json({ ok: true });
});

module.exports = router;
